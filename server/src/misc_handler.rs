use crate::user_handler::User;
use crate::utils;
use crate::{APIResponse, InternalError, ServerState};
use anyhow::Result;
use rocket::data::{Data, ToByteUnit};
use rocket::http::ContentType;
use rocket::http::Status;
use rocket::request::Request;
use rocket::response::{self, Responder, Response};
use serde_json::json;
use std::fs::File;
use std::sync::Arc;
use tempfile::NamedTempFile;

pub struct DownloadItem {
    pub content_type: ContentType,
    pub filename: String,
    pub file: NamedTempFile,
}

pub fn generate_download_token(server_state: &ServerState, download_item: DownloadItem) -> String {
    let mut download_items = server_state.download_items.lock().unwrap();
    let download_token = utils::random_token(|token| !download_items.contains_key(token));
    download_items.insert(
        download_token.clone(),
        Arc::new(download_item),
        std::time::Duration::from_secs(10 * 60),
    );
    download_token
}

enum FileResponse {
    Ok {
        content_type: Box<ContentType>,
        filename: String,
        file: File,
    },
    Forbidden,
}

#[rocket::async_trait]
impl<'r> Responder<'r, 'static> for FileResponse {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        match self {
            FileResponse::Ok {
                content_type,
                filename,
                file,
            } => {
                let size = file.metadata().ok().map(|m| m.len() as usize);
                let file = tokio::fs::File::from_std(file);
                Response::build()
                    .header(*content_type)
                    .raw_header(
                        "Content-Disposition",
                        // TODO: escape?
                        format!("attachment; filename=\"{}\"", filename),
                    )
                    .sized_body(size, file)
                    .ok()
            }
            FileResponse::Forbidden => Response::build().status(Status::Forbidden).ok(),
        }
    }
}

#[get("/download?<token>")]
async fn download<'r>(
    server_state: &rocket::State<ServerState>,
    token: &str,
) -> Result<FileResponse, InternalError> {
    let download_item = {
        let download_items = server_state.download_items.lock().unwrap();
        download_items.get(token).cloned()
    };

    match download_item {
        None => Ok(FileResponse::Forbidden),
        Some(download_item) => Ok(FileResponse::Ok {
            content_type: Box::new(download_item.content_type.clone()),
            filename: download_item.filename.clone(),
            file: download_item.file.reopen()?,
        }),
    }
}

#[post("/upload", data = "<data>")]
async fn upload<'r>(
    server_state: &rocket::State<ServerState>,
    // we don't keep track of of who uploaded what. this is just make sure only valid users are allowed to upload
    user: User,
    data: Data<'_>,
) -> APIResponse {
    // TODO: we just save the whole thing in memory for 1 mins. This is bad and one can use this to OOM us.
    // we should do something better.
    let bytes = data.open(4.mebibytes()).into_bytes().await?.into_inner();

    if bytes.is_empty() {
        return Ok((Status::BadRequest, json!({"error":"empty_file"})));
    }

    info!(
        "[misc/upload] data received from user: {} size: {}",
        user.uid,
        bytes.len(),
    );

    let mut uploaded_items = server_state.uploaded_items.lock().unwrap();
    let upload_token = utils::random_token(|token| !uploaded_items.contains_key(token));
    uploaded_items.insert(
        upload_token.clone(),
        bytes,
        std::time::Duration::from_secs(60),
    );

    Ok((Status::Ok, json!({ "upload_token": upload_token })))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![upload, download]
}
