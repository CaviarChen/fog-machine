#[macro_use]
extern crate rocket;
use envconfig::Envconfig;
use migration::MigratorTrait;
use rocket::fairing::{self, AdHoc};
use rocket::http::ContentType;
use rocket::http::Status;
use rocket::request::Request;
use rocket::response::{self, Responder, Response};
use rocket::{Build, Rocket};
use sea_orm_rocket::Database;
use std::error::Error;
use std::io::Cursor;

mod pool;
use pool::Db;

#[derive(Envconfig)]
pub struct Config {
    #[envconfig(from = "DATABASE_URL")]
    pub database_url: String,

    #[envconfig(from = "GITHUB_CLIENT_ID")]
    pub github_client_id: String,

    #[envconfig(from = "GITHUB_CLIENT_SECRET")]
    pub github_client_secret: String,
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
    E: Error + Sync + Send + 'static,
{
    fn from(error: E) -> Self {
        InternalError(anyhow::Error::from(error))
    }
}

mod user_handler;

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

    rocket::custom(figment)
        .attach(Db::init())
        .attach(AdHoc::try_on_ignite("Migrations", run_migrations))
        .manage(config)
        .mount("/api/v1/user", user_handler::routes())
}
