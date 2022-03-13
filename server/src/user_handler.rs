use crate::{APIResponse, Config, InternalError};
use anyhow::anyhow;
use rocket::http::Status;
use rocket::serde::{json::Json, Deserialize};
use rocket::State;
use serde_json::json;
use std::vec::Vec;

#[derive(Deserialize)]
struct GithubSSOData {
    code: String,
}
#[post("/sso/github", data = "<data>")]
async fn sso_github(data: Json<GithubSSOData>, config: &State<Config>) -> APIResponse {
    let client = reqwest::Client::new();
    let res = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&json!({
            "client_id": config.github_client_id,
            "client_secret": config.github_client_secret,
            "code": data.code}))
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    let access_token = match res.get("access_token") {
        Some(access_token) => access_token,
        None => match res.get("error").and_then(|x| x.as_str()) {
            Some("bad_verification_code") => {
                return Ok((
                    Status::Unauthorized,
                    json!({"error": "bad_verification_code"}),
                ))
            }
            Some(_) | None => {
                return Err(InternalError(anyhow!("Unexpected error: {}", res)));
            }
        },
    };
    print!("{:?}", res);
    Ok((Status::Ok, json!({})))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![sso_github]
}
