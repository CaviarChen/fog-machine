use crate::{APIResponse, Config};
use rocket::http::Status;
use rocket::serde::{json::Json, Deserialize};
use rocket::State;
use serde_json::json;
use std::vec::Vec;

#[derive(Deserialize)]
struct GithubSSOCallback {
    code: String,
}
#[post("/sso/github", data = "<data>")]
async fn sso_github(data: Json<GithubSSOCallback>, config: &State<Config>) -> APIResponse {
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
    print!("{:?}", res);
    Ok((Status::Ok, json!({})))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![sso_github]
}
