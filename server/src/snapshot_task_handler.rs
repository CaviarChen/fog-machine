use crate::data_fetcher;
use crate::pool::Db;
use crate::user_handler::User;
use crate::APIResponse;
use anyhow::Error;
use anyhow::Result;
use chrono::prelude::*;
use entity::sea_orm;
use entity::{snapshot_log, snapshot_task};
use rocket::http::Status;
use rocket::serde::json::Json;
use sea_orm::{entity::*, query::*, DatabaseTransaction};
use sea_orm_rocket::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::cmp;
use std::collections::HashSet;

// TODO: we might also need a rate limiter for validating source, it is an expensive
// task.

lazy_static! {
    static ref ALLOWED_INTERVAL: HashSet<i16> =
        HashSet::from([6 * 60, 8 * 60, 12 * 60, 24 * 60, 2 * 24 * 60, 7 * 24 * 60]);
}

async fn validate_input(
    status: Option<entity::snapshot_task::Status>,
    interval: Option<i16>,
    source: Option<&entity::snapshot_task::Source>,
) -> Result<Result<(), &'static str>, Error> {
    // `Stopped` status cannot be set by human
    if status == Some(entity::snapshot_task::Status::Stopped) {
        return Ok(Err("invalid_status"));
    }
    match interval {
        None => (),
        Some(interval) => {
            if !ALLOWED_INTERVAL.contains(&interval) {
                return Ok(Err("invalid_interval"));
            }
        }
    }
    match source {
        None => (),
        Some(source) => {
            let res = data_fetcher::validate(source).await?;
            match res {
                Ok(()) => (),
                Err(data_fetcher::ValidationError::InvalidShare) => {
                    return Ok(Err("invalid_share"))
                }
                Err(data_fetcher::ValidationError::InvalidFolderStructure) => {
                    return Ok(Err("invalid_folder_structure"))
                }
            }
        }
    }
    Ok(Ok(()))
}

async fn get_last_sync_time(
    txn: &DatabaseTransaction,
    user: &User,
    succeed_only: bool,
) -> Result<Option<DateTime<Utc>>> {
    let query = snapshot_log::Entity::find()
        .filter(snapshot_log::Column::UserId.eq(user.uid))
        .order_by_desc(snapshot_log::Column::Timestamp);

    let query = if succeed_only {
        query.filter(snapshot_log::Column::Succeed.eq(true))
    } else {
        query
    };

    match query.one(txn).await? {
        None => Ok(None),
        Some(snapshot_log) => Ok(Some(snapshot_log.timestamp)),
    }
}

async fn get_min_next_sync_time(txn: &DatabaseTransaction, user: &User) -> Result<DateTime<Utc>> {
    match get_last_sync_time(txn, user, false).await? {
        None => Ok(Utc::now()),
        Some(last_time) => Ok(cmp::max(
            last_time + chrono::Duration::minutes(20),
            Utc::now(),
        )),
    }
}

#[derive(Deserialize)]
struct CreateData {
    interval: i16,
    source: entity::snapshot_task::Source,
}
#[post("/", data = "<data>")]
async fn create(conn: Connection<'_, Db>, user: User, data: Json<CreateData>) -> APIResponse {
    let res = validate_input(None, Some(data.interval), Some(&data.source)).await?;
    match res {
        Ok(()) => (),
        Err(error) => return Ok((Status::BadRequest, json!({ "error": error }))),
    }

    let db = conn.into_inner();
    let txn = db.begin().await?;

    let task = snapshot_task::ActiveModel {
        user_id: Set(user.uid),
        status: Set(entity::snapshot_task::Status::Running),
        interval: Set(data.interval),
        source: Set(data.source.clone()),
        next_sync: Set(get_min_next_sync_time(&txn, &user).await?),
        error_count: Set(0),
    };

    task.insert(&txn).await?;

    txn.commit().await?;

    Ok((Status::Ok, json!({})))
}

#[derive(Serialize)]
struct TaskJson {
    pub status: snapshot_task::Status,
    pub interval: i16,
    pub source: snapshot_task::Source,
    pub last_success_sync: Option<DateTime<Utc>>,
    pub error_count: i16,
}

#[get("/")]
async fn get(conn: Connection<'_, Db>, user: User) -> APIResponse {
    let db = conn.into_inner();
    let txn = db.begin().await?;

    let task = snapshot_task::Entity::find()
        .filter(snapshot_task::Column::UserId.eq(user.uid))
        .one(&txn)
        .await?;
    match task {
        None => Ok((Status::NotFound, json!({}))),
        Some(task) => {
            let snapshot_task::Model {
                user_id: _,
                status,
                interval,
                source,
                next_sync: _,
                error_count,
            } = task;
            let last_success_sync = get_last_sync_time(&txn, &user, true).await?;

            txn.commit().await?;

            Ok((
                Status::Ok,
                json!(TaskJson {
                    status,
                    interval,
                    source,
                    last_success_sync,
                    error_count,
                }),
            ))
        }
    }
}

#[derive(Deserialize)]
struct UpdateData {
    status: Option<entity::snapshot_task::Status>,
    interval: Option<i16>,
    source: Option<entity::snapshot_task::Source>,
}
#[patch("/", data = "<data>")]
async fn update(conn: Connection<'_, Db>, user: User, data: Json<UpdateData>) -> APIResponse {
    let res = validate_input(data.status, data.interval, data.source.as_ref()).await?;
    match res {
        Ok(()) => (),
        Err(error) => return Ok((Status::BadRequest, json!({ "error": error }))),
    }

    let db = conn.into_inner();
    let txn = db.begin().await?;

    let task = entity::snapshot_task::Entity::find()
        .filter(entity::snapshot_task::Column::UserId.eq(user.uid))
        .lock_exclusive()
        .one(&txn)
        .await?;
    match task {
        None => Ok((Status::NotFound, json!({}))),
        Some(task) => {
            // TODO: the reset logic is really naive
            let need_reset = ((task.status != entity::snapshot_task::Status::Running)
                && (data.status == Some(entity::snapshot_task::Status::Running)))
                || data.interval.is_some()
                || data.source.is_some();

            let mut task_mut: entity::snapshot_task::ActiveModel = task.into();
            if need_reset {
                task_mut.next_sync = Set(get_min_next_sync_time(&txn, &user).await?);
                task_mut.error_count = Set(0);
            }
            match data.status {
                None => (),
                Some(status) => task_mut.status = Set(status),
            };
            match data.interval {
                None => (),
                Some(interval) => task_mut.interval = Set(interval),
            };
            match &data.source {
                None => (),
                Some(source) => task_mut.source = Set(source.clone()),
            };
            task_mut.update(&txn).await?;

            txn.commit().await?;
            Ok((Status::Ok, json!({})))
        }
    }
}

#[delete("/")]
async fn delete(conn: Connection<'_, Db>, user: User) -> APIResponse {
    let db = conn.into_inner();
    let res = entity::snapshot_task::Entity::delete_by_id(user.uid)
        .exec(db)
        .await?;

    if res.rows_affected == 1 {
        Ok((Status::Ok, json!({})))
    } else {
        Ok((Status::NotFound, json!({})))
    }
}

pub fn routes() -> Vec<rocket::Route> {
    routes![create, get, update, delete]
}
