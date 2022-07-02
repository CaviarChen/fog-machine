use crate::pool::Db;
use crate::user_handler::PendingRegistration::Github;
use crate::{APIResponse, InternalError, ServerState};
use anyhow::anyhow;
use chrono;
use entity::sea_orm;
use jwt::SignWithKey;
use rocket::http::Status;
use rocket::response::Redirect;
use rocket::serde::{json::Json, Deserialize, Serialize};
use sea_orm::{entity::*, query::*};
use sea_orm_rocket::Connection;
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::vec::Vec;

/* Design of the user system
  -------------------------
  To make our life easier, currently we only support sso login.

  For sso login, we ask the user to enter a contact email. So we have a way to contact them just in
  case of things like sso no longer working. For sso that provides email address, we just
  pre-populated the field but still ask the user to confirm/change it. We do not validate (via
  email with validation code) the email address and just treat it as contact email(more on this
  later). The reason is that we are not sure how much we could trust the email provide by the
  sso. E.g. github provides a public email, but it can be anything. We could get the list of
  validated emails but the user may not want to expose it. Maybe in the future we can have some
  special rules such as: For google sso, if the email is end with gmail.com then we just trust it.
  But that's too much for now.

  In our system, an user has an `email` and a `contact_email`. `email` is unused at the moment and
  set to `None`. It should have unique constrain if it is `Some`. `contact_email` is mandatory but
  it doesn't have an unique constrain.
*/

fn random_token(validate_token: impl Fn(&str) -> bool) -> String {
    use rand::distributions::{Alphanumeric, DistString};
    loop {
        let token = Alphanumeric.sample_string(&mut rand::thread_rng(), 16);
        if validate_token(&token) {
            return token;
        }
    }
}

#[derive(Clone)]
enum PendingRegistration {
    Github { uid: i64 },
}

pub struct State {
    // we'll lost the state when we restart the server, but for the use case below, it should be
    // fine.
    pending_registrations: Arc<Mutex<HashMap<String, PendingRegistration>>>,
}
impl State {
    pub fn create() -> Self {
        State {
            pending_registrations: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn add_pending_registration(&self, pending: PendingRegistration) -> String {
        let mut pending_registrations = self.pending_registrations.lock().unwrap();
        let token = random_token(|token| !pending_registrations.contains_key(token));
        pending_registrations.insert(token.clone(), pending);

        // clean this up after 20 mins.
        // TODO: this is silly but good enough for now. Note that this is the only place that we remove things from the hashmap.
        let arc_pending_registrations = Arc::clone(&self.pending_registrations);
        let token_copy = token.clone();
        tokio::task::spawn(async move {
            use tokio::time::{sleep, Duration};
            sleep(Duration::from_secs(60 * 20)).await;
            let mut pending_registrations = arc_pending_registrations.lock().unwrap();
            pending_registrations.remove(&token_copy);
        });
        token
    }

    fn get_pending_registration(&self, token: &str) -> Option<PendingRegistration> {
        let pending_registrations = self.pending_registrations.lock().unwrap();
        pending_registrations.get(token).map(|x| x.clone())
    }
}

#[derive(Serialize, Deserialize)]
struct JwtData {
    ver: i8,
    sub: i32,
    exp: i64,
}

fn generate_user_token(server_state: &ServerState, user_id: i32) -> String {
    let exp = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::seconds(60))
        .expect("valid timestamp")
        .timestamp();

    let jwt_data = JwtData {
        ver: 1,
        sub: user_id,
        exp,
    };
    return jwt_data.sign_with_key(&server_state.jwt_key).unwrap();
}

#[derive(Deserialize)]
struct GithubSSOData {
    code: String,
}

// try login with github sso, if there isn't a connected user, then a `registration_token` will be
// retruned, which can be used at `/sso` to create a new user.
#[post("/sso/github", data = "<data>")]
async fn sso_github(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    state: &rocket::State<State>,
    data: Json<GithubSSOData>,
) -> APIResponse {
    let client = reqwest::Client::builder().user_agent("rust").build()?;
    let res = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&json!({
            "client_id": server_state.config.github_client_id,
            "client_secret": server_state.config.github_client_secret,
            "code": data.code}))
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    let access_token = match res["access_token"].as_str() {
        Some(access_token) => access_token,
        None => {
            return match res["error"].as_str() {
                Some("bad_verification_code") => Ok((
                    Status::Unauthorized,
                    json!({"error": "bad_verification_code"}),
                )),
                Some(_) | None => Err(InternalError(anyhow!(
                    "Unexpected error while getting access_token: {}",
                    res
                ))),
            }
        }
    };
    let res = client
        .get("https://api.github.com/user")
        .header("Accept", "application/vnd.github.v3+json")
        .header("Authorization", format!("token {}", access_token))
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    let github_uid = match res["id"].as_i64() {
        Some(id) => id,
        None => {
            return Err(InternalError(anyhow!(
                "Unexpected error while getting github uid: {}",
                res
            )))
        }
    };
    let db = conn.into_inner();
    let user = entity::user::Entity::find()
        .filter(entity::user::Column::GithubUid.eq(github_uid))
        .one(db)
        .await?;
    match user {
        Some(user) => Ok((
            Status::Ok,
            json!({"login": true, "token": generate_user_token(server_state, user.id)}),
        )),
        None => {
            // this email cannot be trusted
            let email: Option<&str> = res["email"].as_str();
            let registration_token = state.add_pending_registration(Github { uid: github_uid });
            Ok((
                Status::Ok,
                json!({"login": false, "default_email":email , "registration_token": registration_token }),
            ))
        }
    }
}

#[get("/sso/github")]
async fn sso_github_redirect(server_state: &rocket::State<ServerState>) -> Redirect {
    Redirect::to(format!(
        "https://github.com/login/oauth/authorize?client_id={}",
        server_state.config.github_client_id
    ))
}

#[derive(Deserialize)]
struct SSOData {
    registration_token: String,
    contact_email: String,
    language: entity::user::Language,
}

// create a new user by sso.
#[post("/sso", data = "<data>")]
async fn sso(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    state: &rocket::State<State>,
    data: Json<SSOData>,
) -> APIResponse {
    panic!("TODO")
}

pub fn routes() -> Vec<rocket::Route> {
    routes![sso_github, sso_github_redirect,]
}
