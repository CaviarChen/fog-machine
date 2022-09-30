use crate::misc_handler;
use crate::pool::Db;
use crate::user_handler::User;
use crate::{APIResponse, ServerState};
use chrono::prelude::*;
use entity::sea_orm;
use entity::snapshot;
use rocket::http::Status;
use sea_orm::{entity::*, query::*};
use sea_orm_rocket::Connection;
use serde::Serialize;
use serde_json::json;

#[derive(Serialize)]
struct SnapshotJson {
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    pub source_kind: snapshot::SourceKind,
    pub note: Option<String>,
}
// TODO: pagination
#[get("/")]
async fn list_all(conn: Connection<'_, Db>, user: User) -> APIResponse {
    let db = conn.into_inner();
    let snapshots = snapshot::Entity::find()
        .filter(snapshot::Column::UserId.eq(user.uid))
        .order_by_desc(snapshot::Column::Timestamp)
        .all(db)
        .await?;
    let mut snapshot_list: Vec<SnapshotJson> = Vec::with_capacity(snapshots.len());
    for snapshot in snapshots {
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
    Ok((Status::Ok, json!(snapshot_list)))
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
    routes![list_all, get_download_token, get_editor_view]
}
