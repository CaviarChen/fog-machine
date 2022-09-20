use crate::data_fetcher;
use crate::pool::Db;
use crate::user_handler::User;
use crate::APIResponse;
use anyhow::Error;
use anyhow::Result;
use chrono::prelude::*;
use entity::sea_orm;
use entity::{snapshot, snapshot_log};
use rocket::http::Status;
use rocket::serde::json::Json;
use sea_orm::{entity::*, query::*, DatabaseTransaction};
use sea_orm_rocket::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::cmp;
use std::collections::HashSet;

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

pub fn routes() -> Vec<rocket::Route> {
    routes![list_all]
}
