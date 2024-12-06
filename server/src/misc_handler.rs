use crate::pool::Db;
use crate::user_handler::User;
use crate::{memolanes_archive_handler, snapshot_handler, utils};
use crate::{APIResponse, InternalError, ServerState};
use rocket::data::{Data, ToByteUnit};
use rocket::http::ContentType;
use rocket::http::Status;
use rocket::request::Request;
use rocket::response::{self, Responder, Response};
use sea_orm_rocket::Connection;
use serde_json::json;
use std::fs::File;
use std::sync::Arc;
use tempfile::NamedTempFile;

pub enum DownloadRequest {
    Snapshot { snapshot_id: i64 },
    MemolanesArchive { uid: i64, timezone: chrono_tz::Tz },
}

pub struct GeneratedDownloadItem {
    pub content_type: ContentType,
    pub filename: String,
    pub file: NamedTempFile,
}

impl GeneratedDownloadItem {
    fn to_file_response(&self) -> anyhow::Result<FileResponse> {
        Ok(FileResponse::Ok {
            content_type: Box::new(self.content_type.clone()),
            filename: self.filename.clone(),
            file: self.file.reopen()?,
        })
    }
}

pub enum DownloadItem {
    Request(DownloadRequest),
    Generated(GeneratedDownloadItem),
}

pub fn generate_download_token(
    server_state: &ServerState,
    download_request: DownloadRequest,
) -> String {
    let mut download_items = server_state.download_items.lock().unwrap();
    let download_token = utils::random_token(|token| !download_items.contains_key(token));
    download_items.insert(
        download_token.clone(),
        Arc::new(tokio::sync::Mutex::new(DownloadItem::Request(
            download_request,
        ))),
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
    conn: Connection<'_, Db>,
    token: &str,
) -> Result<FileResponse, InternalError> {
    let download_item = {
        let download_items = server_state.download_items.lock().unwrap();
        download_items.get(token).cloned()
    };

    match download_item {
        None => Ok(FileResponse::Forbidden),
        Some(download_item) => {
            let mut download_item = download_item.lock().await;

            let file_response = match &*download_item {
                DownloadItem::Request(request) => {
                    let generated = match request {
                        DownloadRequest::Snapshot { snapshot_id } => {
                            snapshot_handler::generate_sync_zip(server_state, conn, *snapshot_id)
                                .await?
                        }
                        DownloadRequest::MemolanesArchive { uid, timezone } => {
                            memolanes_archive_handler::generate_memolanes_archive(
                                conn,
                                server_state,
                                *uid,
                                *timezone,
                            )
                            .await?
                        }
                    };

                    let file_response = generated.to_file_response();
                    *download_item = DownloadItem::Generated(generated);
                    file_response?
                }
                DownloadItem::Generated(generated) => generated.to_file_response()?,
            };

            drop(download_item);
            Ok(file_response)
        }
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
