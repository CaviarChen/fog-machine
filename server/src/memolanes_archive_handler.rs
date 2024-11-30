use crate::misc_handler;
use crate::user_handler::User;
use crate::{APIResponse, ServerState};
use rocket::http::Status;
use serde_json::json;

#[get("/download_token?<timezone>")]
async fn get_download_token(
    server_state: &rocket::State<ServerState>,
    user: User,
    timezone: String,
) -> APIResponse {
    let timezone: chrono_tz::Tz = timezone.parse()?;
    let download_item = misc_handler::DownloadItem::MemolanesArchive {
        uid: user.uid,
        timezone,
    };
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
