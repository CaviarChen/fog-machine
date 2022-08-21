use crate::data_fetcher;
use crate::pool::Db;
use crate::user_handler::User;
use crate::APIResponse;
use anyhow::Error;
use chrono::prelude::*;
use entity::sea_orm;
use rocket::http::Status;
use rocket::serde::{json::Json, Deserialize};
use sea_orm::{entity::*, query::*};
use sea_orm_rocket::Connection;
use serde_json::json;
use std::collections::HashSet;

// TODO: we have a minimum interval, but user can bypass that by recreating or using
// the update api. We might need a rate limiter.
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

    let task = entity::snapshot_task::ActiveModel {
        user_id: Set(user.uid),
        status: Set(entity::snapshot_task::Status::Running),
        interval: Set(data.interval),
        source: Set(data.source.clone()),
        next_sync: Set(Utc::now()),
        last_error_count: Set(0),
    };

    let db = conn.into_inner();
    task.insert(db).await?;

    Ok((Status::Ok, json!({})))
}

#[get("/")]
async fn get(conn: Connection<'_, Db>, user: User) -> APIResponse {
    let db = conn.into_inner();
    let task = entity::snapshot_task::Entity::find()
        .filter(entity::snapshot_task::Column::UserId.eq(user.uid))
        .one(db)
        .await?;
    match task {
        None => Ok((Status::NotFound, json!({}))),
        Some(task) => Ok((Status::Ok, json!(task))),
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
                task_mut.next_sync = Set(Utc::now());
                task_mut.last_error_count = Set(0);
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
