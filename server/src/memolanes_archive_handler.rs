use crate::misc_handler;
use crate::user_handler::User;
use crate::{APIResponse, ServerState};
use rocket::http::Status;
use serde_json::json;

#[get("/download_token")]
async fn get_download_token(server_state: &rocket::State<ServerState>, user: User) -> APIResponse {
    let download_item = misc_handler::DownloadItem::MemolanesArchive { uid: user.uid };
    Ok((
        Status::Ok,
        json!({
            "token": misc_handler::generate_download_token(server_state, download_item)
        }),
    ))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![get_download_token]
}
