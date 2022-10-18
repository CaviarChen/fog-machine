use crate::data_fetcher::SyncFile;
use crate::misc_handler;
use crate::pool::Db;
use crate::user_handler::User;
use crate::{APIResponse, ServerState};
use chrono::prelude::*;
use entity::sea_orm;
use entity::snapshot;
use rocket::http::Status;
use rocket::serde::json::Json;
use sea_orm::ItemsAndPagesNumber;
use sea_orm::{entity::*, query::*};
use sea_orm_rocket::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::Path;
use std::{fs, io};

#[derive(Serialize)]
struct SnapshotJson {
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    pub source_kind: snapshot::SourceKind,
    pub note: Option<String>,
}
// TODO: pagination looks not good,but it works.
#[get("/?<page>&<per_page>")]
async fn list_snapshots(
    conn: Connection<'_, Db>,
    user: User,
    page: Option<usize>,
    per_page: Option<usize>,
) -> APIResponse {
    let db = conn.into_inner();

    let snapshot_list_p: Vec<snapshot::Model>;
    let total: ItemsAndPagesNumber;

    match per_page {
        Some(per_page) => {
            match page {
                Some(page) => {
                    let snapshots = snapshot::Entity::find()
                        .filter(snapshot::Column::UserId.eq(user.uid))
                        .order_by_desc(snapshot::Column::Timestamp)
                        .paginate(db, per_page);
                    // frontend page start from 1,but sea_orm page start from 0 , so use page-1 here
                    snapshot_list_p = snapshots.fetch_page(page - 1).await?;
                    total = match snapshots.num_items_and_pages().await {
                        Ok(num) => num,
                        Err(_) => ItemsAndPagesNumber {
                            number_of_items: 0,
                            number_of_pages: 0,
                        },
                    };
                }

                None => {
                    let snapshots = snapshot::Entity::find()
                        .filter(snapshot::Column::UserId.eq(user.uid))
                        .order_by_desc(snapshot::Column::Timestamp)
                        .paginate(db, per_page);
                    snapshot_list_p = snapshots.fetch_page(0).await?;
                    total = match snapshots.num_items_and_pages().await {
                        Ok(num) => num,
                        Err(_) => ItemsAndPagesNumber {
                            number_of_items: 0,
                            number_of_pages: 0,
                        },
                    };
                }
            }
        }

        None => {
            snapshot_list_p = snapshot::Entity::find()
                .filter(snapshot::Column::UserId.eq(user.uid))
                .order_by_desc(snapshot::Column::Timestamp)
                .all(db)
                .await?;
            total = ItemsAndPagesNumber {
                number_of_items: snapshot_list_p.len(),
                number_of_pages: 1,
            };
        }
    }

    let mut snapshot_list: Vec<SnapshotJson> = Vec::with_capacity(snapshot_list_p.len());
    for snapshot in snapshot_list_p {
        let snapshot::Model {
            id,
            user_id: _,
            timestamp,
            source_kind,
            note,
            sync_files: _,
        } = snapshot;
        snapshot_list.push(SnapshotJson {
            id,
            timestamp,
            source_kind,
            note,
        })
    }

    Ok((
        Status::Ok,
        json!({"total":total.number_of_items,"total_pages":total.number_of_pages,"content":snapshot_list}),
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
}
#[post("/", data = "<data>")]
async fn create(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    user: User,
    data: Json<CreateData>,
) -> APIResponse {
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
                note: Set(None),
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

#[get("/<snapshot_id>/download_token")]
async fn get_download_token(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    user: User,
    snapshot_id: i64,
) -> APIResponse {
    let db = conn.into_inner();

    if snapshot::Entity::find()
        .filter(snapshot::Column::UserId.eq(user.uid))
        .filter(snapshot::Column::Id.eq(snapshot_id))
        .count(db)
        .await?
        == 1
    {
        Ok((
            Status::Ok,
            json!({
                "token": misc_handler::generate_snapshot_download_token(server_state, snapshot_id)
            }),
        ))
    } else {
        Ok((Status::NotFound, json!({})))
    }
}

#[get("/<snapshot_id>/editor_view")]
async fn get_editor_view(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
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
                    "timestamp":  s.timestamp,
                })
            });
            let next = next_snapshot.map(|s| {
                json!({
                    "id": s.id,
                    "timestamp":  s.timestamp,
                })
            });

            Ok((
                Status::Ok,
                json!({
                    "id": this_snapshot.id,
                    "timestamp": this_snapshot.timestamp,
                    "prev": prev,
                    "next": next,
                    "download_token":
                        misc_handler::generate_snapshot_download_token(server_state, snapshot_id),
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
        get_download_token,
        get_editor_view
    ]
}
