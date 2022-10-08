#[macro_use]
extern crate rocket;
#[macro_use]
extern crate lazy_static;
#[macro_use]
extern crate anyhow;
use envconfig::Envconfig;
use hmac::{Hmac, Mac};
use migration::MigratorTrait;
use rocket::fairing::{self, AdHoc};
use rocket::http::ContentType;
use rocket::http::Status;
use rocket::request::Request;
use rocket::response::{self, Responder, Response};
use rocket::{Build, Rocket};
use rocket_cors::AllowedOrigins;
use sea_orm_rocket::Database;
use sha2::Sha256;
use std::io::Cursor;
use std::sync::Mutex;

mod data_fetcher;
mod file_storage;
mod limit;
mod misc_handler;
mod pool;
mod snapshot_handler;
mod snapshot_task_handler;
mod task_runner;
mod user_handler;
mod utils;

use pool::Db;

#[derive(Envconfig)]
pub struct Config {
    #[envconfig(from = "DATABASE_URL")]
    pub database_url: String,

    #[envconfig(from = "GITHUB_CLIENT_ID")]
    pub github_client_id: String,

    #[envconfig(from = "GITHUB_CLIENT_SECRET")]
    pub github_client_secret: String,

    #[envconfig(from = "JWT_SECRET")]
    pub jwt_secret: String,

    #[envconfig(from = "CORS_ALLOWED_ORIGINS")]
    pub cors_allowed_origins: String,

    #[envconfig(from = "DATA_BASE_DIR")]
    pub data_base_dir: String,
}

pub struct ServerState {
    pub config: Config,
    pub user_jwt_key: Hmac<Sha256>,
    pub download_jwt_key: Hmac<Sha256>,
    pub file_storage: file_storage::SyncFileStorage,
    // in-memory-cache: Sotre short-lived intermediate data that is ok to be lost during server reboot
    pub pending_registrations: Mutex<
        endorphin::HashMap<String, user_handler::PendingRegistration, endorphin::policy::TTLPolicy>,
    >,
    pub download_items:
        Mutex<endorphin::HashMap<String, misc_handler::DownloadItem, endorphin::policy::TTLPolicy>>,
}
impl ServerState {
    pub fn from_config(config: Config) -> Self {
        // it is very important that we use different key for different jwt.
        let user_jwt_key =
            Hmac::new_from_slice(format!("user#{}", config.jwt_secret).as_bytes()).unwrap();
        let download_jwt_key =
            Hmac::new_from_slice(format!("download#{}", config.jwt_secret).as_bytes()).unwrap();
        let file_storage = file_storage::SyncFileStorage::init(&config.data_base_dir).unwrap();
        ServerState {
            config,
            user_jwt_key,
            download_jwt_key,
            file_storage,
            pending_registrations: Mutex::new(endorphin::HashMap::new(
                endorphin::policy::TTLPolicy::new(),
            )),
            download_items: Mutex::new(
                endorphin::HashMap::new(endorphin::policy::TTLPolicy::new()),
            ),
        }
    }
}

pub type APIResponse = Result<(Status, serde_json::Value), InternalError>;

pub struct InternalError(anyhow::Error);
#[rocket::async_trait]
impl<'r> Responder<'r, 'static> for InternalError {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        let InternalError(error) = self;

        error!("InternalError: {:?}", error);
        let body = r#"{"error":"internal_error"}"#;
        Response::build()
            .status(Status::InternalServerError)
            .header(ContentType::JSON)
            .sized_body(body.len(), Cursor::new(body))
            .ok()
    }
}

impl<E> From<E> for InternalError
where
    E: Into<anyhow::Error>,
{
    fn from(error: E) -> Self {
        InternalError(error.into())
    }
}

async fn run_migrations(rocket: Rocket<Build>) -> fairing::Result {
    let conn = &Db::fetch(&rocket).unwrap().conn;
    let _ = migration::Migrator::up(conn, None).await;
    Ok(rocket)
}

#[launch]
fn rocket() -> _ {
    dotenv::dotenv().ok();
    let config = Config::init_from_env().unwrap();
    let figment = rocket::Config::figment().merge((
        "databases.main",
        sea_orm_rocket::Config {
            url: String::clone(&config.database_url),
            min_connections: None,
            max_connections: 1024,
            connect_timeout: 3,
            idle_timeout: None,
        },
    ));

    let allowed_origins = if config.cors_allowed_origins == "*" {
        AllowedOrigins::All
    } else {
        let exact: Vec<&str> = (config.cors_allowed_origins).split(',').collect();
        AllowedOrigins::some_exact(&exact)
    };

    let cors = rocket_cors::CorsOptions {
        allowed_origins,
        ..Default::default()
    }
    .to_cors()
    .unwrap();

    let server_state = ServerState::from_config(config);
    let file_storage = server_state.file_storage.clone();

    rocket::custom(figment)
        .attach(Db::init())
        .attach(AdHoc::try_on_ignite("Migrations", run_migrations))
        .attach(cors)
        .attach(AdHoc::on_liftoff("Task Runner", |rocket| {
            Box::pin(async move { task_runner::run(rocket, file_storage).await })
        }))
        .attach(AdHoc::on_response("No cache", |_, resp| {
            Box::pin(async move {
                resp.set_raw_header("Cache-Control", "no-cache, no-store");
            })
        }))
        .manage(server_state)
        .mount("/api/v1/user", user_handler::routes())
        .mount("/api/v1/snapshot_task", snapshot_task_handler::routes())
        .mount("/api/v1/snapshot", snapshot_handler::routes())
        .mount("/api/v1/misc", misc_handler::routes())
}
