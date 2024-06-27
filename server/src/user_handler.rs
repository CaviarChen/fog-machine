use crate::pool::Db;
use crate::user_handler::PendingRegistration::Github;
use crate::utils;
use crate::{APIResponse, InternalError, ServerState};
use anyhow::anyhow;
use entity::sea_orm;
use jwt::SignWithKey;
use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use rocket::response::Redirect;
use rocket::serde::{json::Json, Deserialize, Serialize};
use sea_orm::{entity::*, query::*};
use sea_orm_rocket::Connection;
use serde_json::json;
use std::time::Duration;
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

#[derive(Serialize, Deserialize)]
struct JwtData {
    ver: i8,
    sub: i64,
    exp: i64,
}

fn generate_user_token(server_state: &ServerState, user_id: i64) -> String {
    let exp = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .expect("valid timestamp")
        .timestamp();

    let jwt_data = JwtData {
        ver: 1,
        sub: user_id,
        exp,
    };
    jwt_data.sign_with_key(&server_state.user_jwt_key).unwrap()
}

pub struct User {
    pub uid: i64,
}
#[rocket::async_trait]
impl<'r> FromRequest<'r> for User {
    type Error = ();

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        use jwt::VerifyWithKey;
        // https://jwt.io/introduction/

        let user = match req.headers().get_one("Authorization") {
            None => None,
            Some(authorization) => match authorization.strip_prefix("Bearer ") {
                None => None,
                Some(jwt_token) => {
                    let server_state = req.rocket().state::<ServerState>().unwrap();
                    if server_state
                        .config
                        .single_user_no_auth_mode
                        .unwrap_or(false)
                    {
                        if jwt_token == "SINGLE-USER-NO-AUTH-MODE-TOKEN" {
                            Some(User { uid: -1 })
                        } else {
                            None
                        }
                    } else {
                        let jwt_data: Result<JwtData, _> =
                            jwt_token.verify_with_key(&server_state.user_jwt_key);
                        match jwt_data {
                            Err(_) => None,
                            Ok(jwt_data) => {
                                if jwt_data.ver == 1 {
                                    let now = chrono::Utc::now().timestamp();
                                    if now < jwt_data.exp {
                                        Some(User { uid: jwt_data.sub })
                                    } else {
                                        None
                                    }
                                } else {
                                    None
                                }
                            }
                        }
                    }
                }
            },
        };
        match user {
            None => Outcome::Error((Status::Forbidden, ())),
            Some(user) => Outcome::Success(user),
        }
    }
}

#[derive(Clone)]
pub enum PendingRegistration {
    Github { github_uid: i64 },
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
            let mut pending_registrations = server_state.pending_registrations.lock().unwrap();
            let registration_token =
                utils::random_token(|token| !pending_registrations.contains_key(token));
            pending_registrations.insert(
                registration_token.clone(),
                Github { github_uid },
                Duration::from_secs(20 * 60),
            );
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

fn get_and_remove_pending_registration(
    server_state: &rocket::State<ServerState>,
    token: &str,
) -> Option<PendingRegistration> {
    let mut pending_registrations = server_state.pending_registrations.lock().unwrap();
    pending_registrations.remove(token)
}

// create a new user by sso.
#[post("/sso", data = "<data>")]
async fn sso(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    data: Json<SSOData>,
) -> APIResponse {
    let contact_email = data.contact_email.to_lowercase();
    if !email_address::EmailAddress::is_valid(&contact_email) {
        return Ok((Status::BadRequest, json!({"error": "invalid_email"})));
    }
    let pending_registration =
        match get_and_remove_pending_registration(server_state, &data.registration_token) {
            None => {
                return Ok((
                    Status::Unauthorized,
                    json!({"error": "invalid_registration_token"}),
                ))
            }
            Some(pending_registration) => pending_registration,
        };
    let db = conn.into_inner();
    match pending_registration {
        Github { github_uid } => {
            let new_user = entity::user::ActiveModel {
                id: NotSet,
                email: Set(None),
                password: Set(None),
                contact_email: Set(contact_email),
                github_uid: Set(Some(github_uid)),
                language: Set(data.language),
                created_at: Set(chrono::offset::Utc::now()),
                updated_at: Set(chrono::offset::Utc::now()),
            };
            // we have unique contrain on `github_uid` and I don't think we need a
            // proper error message here
            let new_user = new_user.insert(db).await?;
            Ok((
                Status::Ok,
                json!({"token": generate_user_token(server_state, new_user.id)}),
            ))
        }
    }
}

#[get("/")]
async fn user(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    user: User,
) -> APIResponse {
    let db = conn.into_inner();

    if server_state
        .config
        .single_user_no_auth_mode
        .unwrap_or(false)
        && user.uid == -1
    {
        // we are in single user no auth mode, may need to initialize the user
        if entity::user::Entity::find()
            .filter(entity::user::Column::Id.eq(user.uid))
            .count(db)
            .await?
            == 0
        {
            let new_user = entity::user::ActiveModel {
                id: Set(-1),
                email: Set(None),
                password: Set(None),
                contact_email: Set("user@example.com".to_owned()),
                github_uid: Set(None),
                language: Set(entity::user::Language::EnUs),
                created_at: Set(chrono::offset::Utc::now()),
                updated_at: Set(chrono::offset::Utc::now()),
            };
            let _new_user = new_user.insert(db).await?;
        }
    }

    let user = entity::user::Entity::find()
        .filter(entity::user::Column::Id.eq(user.uid))
        .one(db)
        .await?
        .unwrap();

    Ok((
        Status::Ok,
        json!({"email": user.email, "contact_email": user.contact_email, "language": user.language, "created_at": user.created_at, "updated_at": user.updated_at }),
    ))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![sso_github, sso_github_redirect, sso, user]
}
