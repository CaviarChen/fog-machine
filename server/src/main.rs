#[macro_use]
extern crate rocket;
use envconfig::Envconfig;
use rocket::http::ContentType;
use rocket::http::Status;
use rocket::request::Request;
use rocket::response::{self, Responder, Response};
use std::error::Error;
use std::io::Cursor;

#[derive(Envconfig)]
pub struct Config {
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

#[launch]
fn rocket() -> _ {
    dotenv::dotenv().ok();

    let config = Config::init_from_env().unwrap();
    rocket::build()
        .manage(config)
        .mount("/api/v1/user", user_handler::routes())
}
