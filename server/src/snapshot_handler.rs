use crate::data_fetcher::{self, SyncFile};
use crate::misc_handler::{self, DownloadRequest, GeneratedDownloadItem};
use crate::pool::Db;
use crate::user_handler::User;
use crate::{APIResponse, ServerState};
use anyhow::Result;
use chrono::prelude::*;
use entity::sea_orm;
use entity::snapshot;
use rocket::http::{ContentType, Status};
use rocket::serde::json::Json;
use sea_orm::{entity::*, query::*};
use sea_orm_rocket::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{Seek, Write};
use std::path::Path;
use std::{fs, io};
use tempfile::NamedTempFile;

#[derive(Serialize)]
struct SnapshotJson {
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    pub source_kind: snapshot::SourceKind,
    pub note: Option<String>,
}

#[get("/?<page>&<page_size>")]
async fn list_snapshots(
    conn: Connection<'_, Db>,
    user: User,
    page: Option<u64>,
    page_size: Option<u64>,
) -> APIResponse {
    let db = conn.into_inner();

    let page_size = page_size.unwrap_or(10);
    if page_size > 200 {
        return Ok((Status::BadRequest, json!({"error": "invalid_page_size"})));
    }
    let page = page.unwrap_or(1);

    let snapshot_page = snapshot::Entity::find()
        .filter(snapshot::Column::UserId.eq(user.uid))
        .order_by_desc(snapshot::Column::Timestamp)
        .paginate(db, page_size);
    // sea_orm page index start from 0
    let snapshots = snapshot_page.fetch_page(page - 1).await?;
    let counts = snapshot_page.num_items_and_pages().await?;
    let snapshots: Vec<SnapshotJson> = snapshots
        .into_iter()
        .map(|snapshot| {
            let snapshot::Model {
                id,
                user_id: _,
                timestamp,
                source_kind,
                note,
                sync_files: _,
            } = snapshot;
            SnapshotJson {
                id,
                timestamp,
                source_kind,
                note,
            }
        })
        .collect();

    Ok((
        Status::Ok,
        json!({"number_of_snapshots":counts.number_of_items,"number_of_pages":counts.number_of_pages,"snapshots":snapshots}),
    ))
}

fn get_and_remove_uploaded_item(
    server_state: &rocket::State<ServerState>,
    token: &str,
) -> Option<Vec<u8>> {
    let mut uploaded_items = server_state.uploaded_items.lock().unwrap();
    uploaded_items.remove(token)
}

#[derive(Deserialize)]
struct CreateData {
    timestamp: DateTime<Utc>,
    upload_token: String,
    note: Option<String>,
}

#[post("/", data = "<data>")]
async fn create(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    user: User,
    data: Json<CreateData>,
) -> APIResponse {
    let note_len = data.note.as_ref().map_or(0, |s| s.len());
    if note_len > 256 {
        return Ok((Status::BadRequest, json!({"error":"note_too_long"})));
    }
    let cutoff = Utc::now() + chrono::Duration::seconds(10);
    if data.timestamp > cutoff {
        return Ok((
            Status::BadRequest,
            json!({"error": "timestamp_is_in_future"}),
        ));
    }
    match get_and_remove_uploaded_item(server_state, &data.upload_token) {
        None => Ok((Status::BadRequest, json!({"error": "invalid_upload_token"}))),
        Some(zip_data) => {
            // TODO: share the code with `data_fetcher`
            let reader = std::io::Cursor::new(zip_data);
            let mut zip = zip::ZipArchive::new(reader)?;
            let has_sync_folder = zip
                .file_names()
                .any(|name| name.to_lowercase().contains("sync/"));

            // let's put file in a temp dir first, we only save the file when we belive everything is good.
            let tmp_dir = server_state.file_storage.get_tmp_dir()?;
            let mut logs = Vec::new();
            let mut sync_files: HashMap<u32, String> = HashMap::new();
            let mut files_to_add = Vec::new();
            for i in 0..zip.len() {
                let mut file = zip.by_index(i)?;
                let filename = file.name().to_lowercase();
                // the check below are just best effort.
                // if there is a sync folder, skip all other files
                if has_sync_folder && !filename.contains("sync/") {
                    continue;
                }
                let filename = Path::file_name(Path::new(&filename))
                    .and_then(|x| x.to_str())
                    .unwrap_or("");
                if filename.is_empty() {
                    continue;
                }
                // TODO: we compute the sha-256 multiple times, this is totally unnecessary,
                // we should redesign the API to avoid that.
                let mut hasher = Sha256::new();
                // TODO: async?
                io::copy(&mut file, &mut hasher)?;
                drop(file);
                let sha256_lowercase = format!("{:x}", hasher.finalize());
                match SyncFile::create_from_filename(filename, &sha256_lowercase) {
                    Err(_) => {
                        logs.push(format!("unexpected file: {}", filename));
                    }
                    Ok(sync_file) => {
                        if !server_state.file_storage.has_file(&user, &sha256_lowercase) {
                            let tmp_file_path = tmp_dir.path().join(sync_file.id.to_string());
                            let mut tmp_file = fs::File::create(&tmp_file_path)?;
                            let mut file = zip.by_index(i)?;
                            io::copy(&mut file, &mut tmp_file)?;
                            files_to_add.push((sha256_lowercase, tmp_file_path));
                        }
                        sync_files.insert(sync_file.id, sync_file.sha256);
                    }
                }
            }

            let file_count = sync_files.len();
            if file_count == 0 {
                return Ok((Status::BadRequest, json!({"error": "snapshot_is_empty"})));
            }
            logs.push(format!("new files: {}/{}", files_to_add.len(), file_count));
            // save files
            server_state
                .file_storage
                .add_files(&user, &files_to_add[..])?;

            let db = conn.into_inner();
            // save snapshot
            let snapshot = snapshot::ActiveModel {
                id: NotSet,
                user_id: Set(user.uid),
                timestamp: Set(data.timestamp),
                sync_files: Set(entity::snapshot::SyncFiles(sync_files)),
                source_kind: Set(snapshot::SourceKind::Upload),
                note: Set(data.note.to_owned()),
            }
            .insert(db)
            .await?;

            Ok((
                Status::Ok,
                json!({"id": snapshot.id, "file_count": file_count, "logs": logs.join("\n")}),
            ))
        }
    }
}

#[derive(Deserialize)]
struct EditData {
    note: Option<String>,
}

#[post("/<snapshot_id>", data = "<data>")]
async fn update(
    conn: Connection<'_, Db>,
    user: User,
    snapshot_id: i64,
    data: Json<EditData>,
) -> APIResponse {
    let txn = conn.into_inner().begin().await?;
    let note_len = data.note.as_ref().map_or(0, |s| s.len());
    if note_len > 256 {
        return Ok((Status::BadRequest, json!({"error":"note_too_long"})));
    }
    match snapshot::Entity::find()
        .filter(snapshot::Column::UserId.eq(user.uid))
        .filter(snapshot::Column::Id.eq(snapshot_id))
        .lock_exclusive()
        .one(&txn)
        .await?
    {
        Some(snapshot) => {
            let mut snapshot: snapshot::ActiveModel = snapshot.into();
            snapshot.note = Set(data.note.to_owned());
            snapshot.update(&txn).await?;
            txn.commit().await?;
            Ok((Status::Ok, json!({})))
        }
        None => Ok((Status::NotFound, json!({}))),
    }
}

#[delete("/<snapshot_id>")]
async fn delete(conn: Connection<'_, Db>, user: User, snapshot_id: i64) -> APIResponse {
    let db = conn.into_inner();
    let txn = db.begin().await?;

    match snapshot::Entity::find()
        .filter(snapshot::Column::UserId.eq(user.uid))
        .filter(snapshot::Column::Id.eq(snapshot_id))
        .lock_exclusive()
        .one(&txn)
        .await?
    {
        Some(snapshot) => {
            snapshot.delete(&txn).await?;
            txn.commit().await?;
            Ok((Status::Ok, json!({})))
        }
        None => Ok((Status::NotFound, json!({}))),
    }
}

pub async fn internal_generate_sync_zip_from_sync_files<W: Write + Seek>(
    server_state: &rocket::State<ServerState>,
    writer: &mut W,
    sync_files: &entity::snapshot::SyncFiles,
    user: &User,
) -> Result<()> {
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

pub async fn internal_generate_sync_zip_from_snapshot<W: Write + Seek>(
    server_state: &rocket::State<ServerState>,
    writer: &mut W,
    snapshot: &entity::snapshot::Model,
    user: &User,
) -> Result<()> {
    internal_generate_sync_zip_from_sync_files(server_state, writer, &snapshot.sync_files, user)
        .await
}

pub async fn generate_sync_zip(
    server_state: &rocket::State<ServerState>,
    conn: Connection<'_, Db>,
    snapshot_id: i64,
) -> Result<GeneratedDownloadItem> {
    let db = conn.into_inner();
    let snapshot = snapshot::Entity::find()
        .filter(snapshot::Column::Id.eq(snapshot_id))
        .one(db)
        .await?
        .ok_or_else(|| {
            anyhow!("snapshot become missing while generating sync zip, snapshot id: {snapshot_id}")
        })?;

    let user = User {
        uid: snapshot.user_id,
    };

    let mut file = NamedTempFile::new()?;
    internal_generate_sync_zip_from_snapshot(server_state, &mut file, &snapshot, &user).await?;

    Ok(GeneratedDownloadItem {
        content_type: ContentType::ZIP,
        filename: String::from("Sync.zip"),
        file,
    })
}

#[get("/<snapshot_id>/download_token")]
async fn get_download_token(
    server_state: &rocket::State<ServerState>,
    conn: Connection<'_, Db>,
    user: User,
    snapshot_id: i64,
) -> APIResponse {
    let db = conn.into_inner();
    let count = snapshot::Entity::find()
        .filter(snapshot::Column::UserId.eq(user.uid))
        .filter(snapshot::Column::Id.eq(snapshot_id))
        .count(db)
        .await?;

    if count > 0 {
        let token = misc_handler::generate_download_token(
            server_state,
            DownloadRequest::Snapshot { snapshot_id },
        );
        Ok((Status::Ok, json!({ "token": token })))
    } else {
        Ok((Status::NotFound, json!({})))
    }
}

#[get("/<snapshot_id>/editor_view")]
async fn get_editor_view(
    server_state: &rocket::State<ServerState>,
    conn: Connection<'_, Db>,
    user: User,
    snapshot_id: i64,
) -> APIResponse {
    let db = conn.into_inner();
    let txn = db.begin().await?;

    let this_snapshot = snapshot::Entity::find()
        .filter(snapshot::Column::UserId.eq(user.uid))
        .filter(snapshot::Column::Id.eq(snapshot_id))
        .one(&txn)
        .await?;

    match this_snapshot {
        None => {
            txn.commit().await?;
            Ok((Status::NotFound, json!({})))
        }
        Some(this_snapshot) => {
            let prev_snapshot = snapshot::Entity::find()
                .filter(snapshot::Column::UserId.eq(user.uid))
                .filter(snapshot::Column::Id.ne(snapshot_id))
                .filter(snapshot::Column::Timestamp.lte(this_snapshot.timestamp))
                .order_by_desc(snapshot::Column::Timestamp)
                .one(&txn)
                .await?;
            let next_snapshot = snapshot::Entity::find()
                .filter(snapshot::Column::UserId.eq(user.uid))
                .filter(snapshot::Column::Id.ne(snapshot_id))
                .filter(snapshot::Column::Timestamp.gte(this_snapshot.timestamp))
                .order_by_asc(snapshot::Column::Timestamp)
                .one(&txn)
                .await?;
            txn.commit().await?;

            let prev = prev_snapshot.map(|s| {
                json!({
                    "id": s.id,
                    "note": s.note,
                    "timestamp":  s.timestamp,
                })
            });
            let next = next_snapshot.map(|s| {
                json!({
                    "id": s.id,
                    "note": s.note,
                    "timestamp":  s.timestamp,
                })
            });
            let download_token = misc_handler::generate_download_token(
                server_state,
                DownloadRequest::Snapshot { snapshot_id },
            );

            Ok((
                Status::Ok,
                json!({
                    "id": this_snapshot.id,
                    "note": this_snapshot.note,
                    "timestamp": this_snapshot.timestamp,
                    "prev": prev,
                    "next": next,
                    "download_token": download_token,
                }),
            ))
        }
    }
}

pub fn routes() -> Vec<rocket::Route> {
    routes![
        list_snapshots,
        create,
        delete,
        update,
        get_download_token,
        get_editor_view
    ]
}
