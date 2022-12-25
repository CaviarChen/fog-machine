use crate::pool::Db;
use crate::user_handler::User;
use crate::APIResponse;
use entity::sea_orm;
use entity::snapshot_log;
use rocket::http::Status;
use sea_orm::{entity::*, query::*};
use sea_orm_rocket::Connection;
use serde_json::json;

#[get("/")]
async fn get(conn: Connection<'_, Db>, user: User) -> APIResponse {
    let db = conn.into_inner();

    let snapshot_logs = snapshot_log::Entity::find()
        .filter(snapshot_log::Column::UserId.eq(user.uid))
        .order_by_desc(snapshot_log::Column::Timestamp)
        .all(db)
        .await?;

    Ok((Status::Ok, json!({ "snapshot_logs": snapshot_logs })))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![get]
}
