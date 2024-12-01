use crate::data_fetcher::{self};
use crate::pool::Db;
use crate::user_handler::User;
use crate::utils;
use crate::{APIResponse, InternalError, ServerState};
use anyhow::Result;
use chrono::Duration;
use entity::sea_orm;
use entity::snapshot::{self, SyncFiles};
use memolanes_core::journey_header::JourneyKind;
use memolanes_core::journey_kernel::JourneyBitmap;
use rocket::data::{Data, ToByteUnit};
use rocket::http::ContentType;
use rocket::http::Status;
use rocket::request::Request;
use rocket::response::{self, Responder, Response};
use sea_orm::{entity::*, query::*};
use sea_orm_rocket::Connection;
use serde_json::json;
use std::fs;
use std::io::{Cursor, Seek, Write};
use tempfile::TempDir;
use tokio::time::Instant;

#[derive(Clone)]
pub enum DownloadItem {
    Snapshot { snapshot_id: i64 },
    MemolanesArchive { uid: i64, timezone: chrono_tz::Tz },
}

pub fn generate_download_token(server_state: &ServerState, download_item: DownloadItem) -> String {
    let mut download_items = server_state.download_items.lock().unwrap();
    let download_token = utils::random_token(|token| !download_items.contains_key(token));
    download_items.insert(
        download_token.clone(),
        download_item,
        std::time::Duration::from_secs(10 * 60),
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

async fn internal_generate_sync_zip_from_sync_files<W: Write + Seek>(
    server_state: &rocket::State<ServerState>,
    writer: &mut W,
    sync_files: &entity::snapshot::SyncFiles,
    user: &User,
) -> Result<(), InternalError> {
    let mut zip = zip::ZipWriter::new(writer);
    let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    zip.add_directory("Sync/", options)?;

    for (file_id, sha256) in &sync_files.0 {
        let sync_file = data_fetcher::SyncFile::create_from_id(*file_id, sha256)?;
        zip.start_file(format!("Sync/{}", sync_file.filename()), options)?;
        let mut file = server_state.file_storage.open_file(user, sha256)?;
        // TODO: async?
        std::io::copy(&mut file, &mut zip)?;
    }
    zip.finish()?;
    Ok(())
}

async fn generate_sync_zip_from_snapshot<W: Write + Seek>(
    server_state: &rocket::State<ServerState>,
    writer: &mut W,
    snapshot: &entity::snapshot::Model,
    user: &User,
) -> Result<(), InternalError> {
    internal_generate_sync_zip_from_sync_files(server_state, writer, &snapshot.sync_files, user)
        .await
}

async fn download_snapshot(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    snapshot_id: i64,
) -> Result<FileResponse, InternalError> {
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
            generate_sync_zip_from_snapshot(
                server_state,
                &mut std::io::Cursor::new(&mut buf),
                &snapshot,
                &user,
            )
            .await?;
            Ok(FileResponse::Ok {
                filename: String::from("Sync.zip"),
                content: buf,
            })
        }
    }
}

struct InternalProcessSnapshotOutput {
    bitmap_diff: JourneyBitmap,
    state: (SyncFiles, JourneyBitmap),
}

fn internal_count_bitmap_blocks(bitmap: &JourneyBitmap) -> u64 {
    let mut blocks: u64 = 0;
    bitmap.tiles.iter().for_each(|(_, tiles)| {
        blocks += tiles.blocks.len() as u64;
    });
    blocks
}

async fn internal_memolanes_archive_process_snapshot(
    server_state: &rocket::State<ServerState>,
    temp_dir: &TempDir,
    user: &User,
    final_bitmap: &Option<JourneyBitmap>,
    snapshot: &entity::snapshot::Model,
    prev_state: &Option<(SyncFiles, JourneyBitmap)>,
) -> Result<Option<InternalProcessSnapshotOutput>, InternalError> {
    let mut sync_files = snapshot.sync_files.clone();
    match prev_state {
        None => (),
        Some((prev_sync_files, _)) => {
            // an optimization, we only care about files that are new
            sync_files
                .0
                .retain(|file_id, hash| prev_sync_files.0.get(file_id) != Some(hash));
        }
    }

    if sync_files.0.is_empty() {
        return Ok(None);
    }

    let zip_file_path = temp_dir.path().join("temp_sync.zip");
    let mut zip_file = fs::File::create(&zip_file_path)?;
    internal_generate_sync_zip_from_sync_files(server_state, &mut zip_file, &sync_files, user)
        .await?;
    drop(zip_file);

    let full_journey_bitmap =
        memolanes_core::import_data::load_fow_sync_data(zip_file_path.to_str().unwrap())?.0;

    fs::remove_file(&zip_file_path)?;

    let mut journey_bitmap = full_journey_bitmap.clone();

    // compute a better diff
    // the current one minus the previous one
    match prev_state {
        None => (),
        Some((_, prev_full_bitmap)) => {
            journey_bitmap.difference(prev_full_bitmap);
            journey_bitmap.intersection(&full_journey_bitmap);
        }
    }

    // only keep things that are in the final bitmap
    match final_bitmap {
        None => (),
        Some(final_bitmap) => {
            journey_bitmap.intersection(final_bitmap);
        }
    }

    if journey_bitmap.tiles.is_empty() {
        return Ok(None);
    }

    // skipping super small snapshots
    if internal_count_bitmap_blocks(&journey_bitmap) <= 4 {
        return Ok(None);
    }

    // we are keeping this bitmap
    Ok(Some(InternalProcessSnapshotOutput {
        bitmap_diff: journey_bitmap,
        // we need original value
        state: (snapshot.sync_files.clone(), full_journey_bitmap),
    }))
}

async fn download_memolanes_archive(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    uid: i64,
    timezone: chrono_tz::Tz,
) -> Result<FileResponse, InternalError> {
    let start_time = Instant::now();

    let db = conn.into_inner();
    let snapshots = snapshot::Entity::find()
        .filter(snapshot::Column::UserId.eq(uid))
        .order_by_asc(snapshot::Column::Timestamp)
        .all(db)
        .await?;

    let user = User { uid };
    let temp_dir = TempDir::new()?;
    let mut main_db = memolanes_core::main_db::MainDb::open(temp_dir.path().to_str().unwrap());

    let final_bitmap = match snapshots.last() {
        None => None,
        Some(snapshot) => {
            let zip_file_path = temp_dir.path().join("temp_sync.zip");
            let mut zip_file = fs::File::create(&zip_file_path)?;
            generate_sync_zip_from_snapshot(server_state, &mut zip_file, snapshot, &user).await?;
            drop(zip_file);
            Some(
                memolanes_core::import_data::load_fow_sync_data(zip_file_path.to_str().unwrap())?.0,
            )
        }
    };

    let mut prev_state = None;

    for snapshot in snapshots {
        let result = internal_memolanes_archive_process_snapshot(
            server_state,
            &temp_dir,
            &user,
            &final_bitmap,
            &snapshot,
            &prev_state,
        )
        .await?;

        match result {
            None => (), // skipping this snapshot
            Some(InternalProcessSnapshotOutput { bitmap_diff, state }) => {
                prev_state = Some(state);

                let journey_data = memolanes_core::journey_data::JourneyData::Bitmap(bitmap_diff);

                // Compute the date based on user's timezone. The 6 hours diff is to account for the sync delay.
                // This is a best effort thing.
                let journey_date = (snapshot.timestamp - Duration::hours(6))
                    .with_timezone(&timezone)
                    .date_naive();

                // TODO: generate these details
                main_db.with_txn(|txn| {
                    txn.create_and_insert_journey(
                        journey_date,
                        None,
                        Some(snapshot.timestamp),
                        None,
                        JourneyKind::DefaultKind,
                        snapshot.note,
                        journey_data,
                    )
                })?;
            }
        }
    }

    let mut buf = Vec::new();
    let mut writer = Cursor::new(&mut buf);
    main_db.with_txn(|txn| {
        memolanes_core::archive::export_as_mldx(
            &memolanes_core::archive::WhatToExport::All,
            txn,
            &mut writer,
        )
    })?;

    println!(
        "Finsih generating memolanes archive, user = {}, time_used = {:?}",
        user.uid,
        start_time.elapsed()
    );

    Ok(FileResponse::Ok {
        filename: String::from("export.mldx"),
        content: buf,
    })
}

#[get("/download?<token>")]
async fn download<'r>(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    token: &str,
) -> Result<FileResponse, InternalError> {
    let download_item = {
        let mut download_items = server_state.download_items.lock().unwrap();
        download_items.remove(token)
    };

    match download_item {
        None => Ok(FileResponse::Forbidden),
        Some(DownloadItem::Snapshot { snapshot_id }) => {
            download_snapshot(conn, server_state, snapshot_id).await
        }
        Some(DownloadItem::MemolanesArchive { uid, timezone }) => {
            download_memolanes_archive(conn, server_state, uid, timezone).await
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
