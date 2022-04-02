use crate::pool::Db;
use crate::{APIResponse, InternalError, ServerState};
use anyhow::anyhow;
use chrono;
use entity::sea_orm;
use jwt::SignWithKey;
use rocket::http::Status;
use rocket::response::Redirect;
use rocket::serde::{json::Json, Deserialize, Serialize};
use rocket::State;
use sea_orm::{entity::*, query::*};
use sea_orm_rocket::Connection;
use serde_json::json;
use std::vec::Vec;

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

#[derive(Serialize, Deserialize, Debug)]
struct GithubEmail {
    email: String,
    primary: bool,
    verified: bool,
    visibility: Option<String>,
}

#[derive(Deserialize)]
struct GithubSSOData {
    code: String,
    language: Option<entity::user::Language>,
}

// create user if not exists
// when creating the user, make sure there is a valid email without conflict.
#[post("/sso/github", data = "<data>")]
async fn sso_github(
    conn: Connection<'_, Db>,
    server_state: &State<ServerState>,
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
    let github_sso_uid = match res["id"].as_i64() {
        Some(id) => id,
        None => {
            return Err(InternalError(anyhow!(
                "Unexpected error while getting github sso uid: {}",
                res
            )))
        }
    };
    let db = conn.into_inner();
    let user = entity::user::Entity::find()
        .filter(entity::user::Column::GithubSsoUid.eq(github_sso_uid))
        .one(db)
        .await?;
    match user {
        Some(user) => Ok((
            Status::Ok,
            json!({"new_user": false, "token": generate_user_token(server_state, user.id)}),
        )),
        None => {
            let mut user_email: Option<(i32, &String)> = None;
            // find user's email
            let res = client
                .get("https://api.github.com/user/emails")
                .header("Accept", "application/vnd.github.v3+json")
                .header("Authorization", format!("token {}", access_token))
                .send()
                .await?
                .error_for_status()?
                .json::<Vec<GithubEmail>>()
                .await?;
            for i in res.iter() {
                // required verified and prefer visibility > priority
                if i.verified {
                    let mut priority = 0;
                    if i.primary {
                        priority += 1
                    }
                    if i.visibility
                        .as_deref()
                        .map_or(false, |visibility| visibility == "public")
                    {
                        priority += 2
                    }
                    match user_email {
                        None => user_email = Some((priority, &i.email)),
                        Some((p, _)) => {
                            if priority > p {
                                user_email = Some((priority, &i.email))
                            }
                        }
                    }
                }
            }
            match user_email {
                None => Ok((Status::Unauthorized, json!({"error": "missing_email"}))),
                Some((_, email)) => {
                    if entity::user::Entity::find()
                        .filter(entity::user::Column::Email.eq(String::from(email)))
                        .one(db)
                        .await?
                        .is_some()
                    {
                        Ok((
                            Status::Unauthorized,
                            json!({"error": "email_already_in_use"}),
                        ))
                    } else {
                        // create new user
                        let new_user = entity::user::ActiveModel {
                            id: NotSet,
                            email: Set(String::from(email)),
                            password: Set(None),
                            github_sso_uid: Set(Some(github_sso_uid.try_into().unwrap())),
                            language: Set(data.language),
                            created_at: Set(chrono::offset::Utc::now()),
                            updated_at: Set(chrono::offset::Utc::now()),
                        };
                        let new_user = new_user.insert(db).await?;
                        Ok((
                            Status::Ok,
                            json!({"new_user": true,
                            "token": generate_user_token(server_state, new_user.id)
                            }),
                        ))
                    }
                }
            }
        }
    }
}

#[get("/sso/github")]
async fn sso_github_redirect(server_state: &State<ServerState>) -> Redirect {
    Redirect::to(format!(
        "https://github.com/login/oauth/authorize?client_id={}&scope=read:user,user:email",
        server_state.config.github_client_id
    ))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![sso_github, sso_github_redirect,]
}
