use crate::data_fetcher::{self};
use crate::pool::Db;
use crate::user_handler::User;
use crate::utils;
use crate::{APIResponse, InternalError, ServerState};
use anyhow::Result;
use chrono::NaiveDate;
use entity::sea_orm;
use entity::snapshot;
use memolanes_core::journey_header::JourneyKind;
use rocket::data::{Data, ToByteUnit};
use rocket::http::ContentType;
use rocket::http::Status;
use rocket::request::Request;
use rocket::response::{self, Responder, Response};
use sea_orm::{entity::*, query::*};
use sea_orm_rocket::Connection;
use serde_json::json;
use std::fs;
use std::io::Cursor;
use std::time::Duration;
use tempfile::TempDir;

#[derive(Clone)]
pub enum DownloadItem {
    Snapshot { snapshot_id: i64 },
    MemolanesArchive { uid: i64 },
}

pub fn generate_download_token(server_state: &ServerState, download_item: DownloadItem) -> String {
    let mut download_items = server_state.download_items.lock().unwrap();
    let download_token = utils::random_token(|token| !download_items.contains_key(token));
    download_items.insert(
        download_token.clone(),
        download_item,
        Duration::from_secs(10 * 60),
    );
    download_token
}

// TODO: streaming?
enum FileResponse {
    Ok {
        filename: String,
        content: std::vec::Vec<u8>,
    },
    Forbidden,
}

#[rocket::async_trait]
impl<'r> Responder<'r, 'static> for FileResponse {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        match self {
            // TODO: ContentType from extension?
            FileResponse::Ok { filename, content } => Response::build()
                .status(Status::Ok)
                .header(ContentType::ZIP)
                .raw_header(
                    "Content-Disposition",
                    // TODO: escape?
                    format!("attachment; filename=\"{}\"", filename),
                )
                .sized_body(content.len(), std::io::Cursor::new(content))
                .ok(),
            FileResponse::Forbidden => Response::build().status(Status::Forbidden).ok(),
        }
    }
}

fn get_download_item(
    server_state: &rocket::State<ServerState>,
    token: &str,
) -> Option<DownloadItem> {
    let download_times = server_state.download_items.lock().unwrap();
    download_times.get(token).cloned()
}

#[get("/download?<token>")]
async fn download<'r>(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    token: &str,
) -> Result<FileResponse, InternalError> {
    match get_download_item(server_state, token) {
        None => Ok(FileResponse::Forbidden),
        Some(DownloadItem::Snapshot { snapshot_id }) => {
            let db = conn.into_inner();
            let snapshot = snapshot::Entity::find()
                .filter(snapshot::Column::Id.eq(snapshot_id))
                .one(db)
                .await?;
            match snapshot {
                None => Ok(FileResponse::Forbidden),
                Some(snapshot) => {
                    let user = User {
                        uid: snapshot.user_id,
                    };
                    let mut buf = Vec::new();
                    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
                    let options = zip::write::FileOptions::default()
                        .compression_method(zip::CompressionMethod::Stored);
                    zip.add_directory("Sync/", options)?;

                    let entity::snapshot::SyncFiles(sync_files) = snapshot.sync_files;
                    for (file_id, sha256) in &sync_files {
                        let sync_file = data_fetcher::SyncFile::create_from_id(*file_id, sha256)?;
                        zip.start_file(format!("Sync/{}", sync_file.filename()), options)?;
                        let mut file = server_state.file_storage.open_file(&user, sha256)?;
                        // TODO: async?
                        std::io::copy(&mut file, &mut zip)?;
                    }
                    zip.finish()?;
                    drop(zip);

                    Ok(FileResponse::Ok {
                        filename: String::from("Sync.zip"),
                        content: buf,
                    })
                }
            }
        }
        Some(DownloadItem::MemolanesArchive { uid }) => {
            let db = conn.into_inner();
            let snapshots = snapshot::Entity::find()
                .filter(snapshot::Column::UserId.eq(uid))
                .order_by_desc(snapshot::Column::Timestamp)
                .all(db)
                .await?;

            let user = User { uid };
            let temp_dir = TempDir::new()?;
            let mut main_db =
                memolanes_core::main_db::MainDb::open(temp_dir.path().to_str().unwrap());
            for snapshot in snapshots {
                let zip_file_path = temp_dir.path().join("temp_sync.zip");
                let mut zip_file = fs::File::create(zip_file_path.clone())?;
                let mut zip = zip::ZipWriter::new(&mut zip_file);
                let options = zip::write::FileOptions::default()
                    .compression_method(zip::CompressionMethod::Stored);
                zip.add_directory("Sync/", options)?;

                let entity::snapshot::SyncFiles(sync_files) = snapshot.sync_files;
                for (file_id, sha256) in &sync_files {
                    let sync_file = data_fetcher::SyncFile::create_from_id(*file_id, sha256)?;
                    zip.start_file(format!("Sync/{}", sync_file.filename()), options)?;
                    let mut file = server_state.file_storage.open_file(&user, sha256)?;
                    std::io::copy(&mut file, &mut zip)?;
                }
                zip.finish()?;
                let journey_bitmap = memolanes_core::import_data::load_fow_sync_data(
                    zip_file_path.to_str().unwrap(),
                )?;
                let journey_data =
                    memolanes_core::journey_data::JourneyData::Bitmap(journey_bitmap.0);
                main_db.with_txn(|txn| {
                    txn.create_and_insert_journey(
                        NaiveDate::default(),
                        None,
                        None,
                        None,
                        JourneyKind::DefaultKind,
                        None,
                        journey_data,
                    )
                })?;
            }

            let mut buf = Vec::new();
            let mut writer = Cursor::new(&mut buf);
            memolanes_core::archive::archive_all_as_zip(&mut main_db, &mut writer)?;

            Ok(FileResponse::Ok {
                filename: String::from("Archive.zip"),
                content: buf,
            })
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
    uploaded_items.insert(upload_token.clone(), bytes, Duration::from_secs(60));

    Ok((Status::Ok, json!({ "upload_token": upload_token })))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![upload, download]
}
