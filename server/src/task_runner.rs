use crate::data_fetcher;
use crate::file_storage;
use crate::pool;
use crate::user_handler;
use anyhow::Result;
use chrono::prelude::*;
use entity::sea_orm;
use entity::sea_orm::{entity::*, query::*};
use entity::{snapshot, snapshot_log, snapshot_task};
use rocket::{Orbit, Rocket};
use sea_orm_rocket::Pool;
use tokio::task;
use tokio::time::sleep;

pub async fn fetch_and_lock_one_task(
    conn: &sea_orm::DatabaseConnection,
) -> Result<Option<snapshot_task::Model>> {
    let txn = conn.begin().await?;
    let task = snapshot_task::Entity::find()
        .filter(snapshot_task::Column::Status.eq(snapshot_task::Status::Running))
        .filter(snapshot_task::Column::NextSync.lte(Utc::now()))
        .order_by_asc(snapshot_task::Column::NextSync)
        .lock_exclusive()
        .one(&txn)
        .await?;
    match task {
        None => {
            txn.commit().await?;
            // Nothing to do
            Ok(None)
        }
        Some(task) => {
            snapshot_task::Entity::update(snapshot_task::ActiveModel {
                user_id: Set(task.user_id),
                // we "lock" a task by setting its `next_sync` to 20 mins later
                // if the job succeed, we will update the `next_sync` agian, if not
                // we will retry it 20 mins later.
                // Note that the lock is not super safe, user can reset it, but it
                // is good enough.
                next_sync: Set(Utc::now() + chrono::Duration::minutes(20)),
                ..Default::default()
            })
            .exec(&txn)
            .await?;
            txn.commit().await?;
            Ok(Some(task))
        }
    }
}

// error returned here are internal error, job error is handled within this function
pub async fn do_one_task(
    conn: &sea_orm::DatabaseConnection,
    sync_file_storage: &file_storage::SyncFileStorage,
) -> Result<()> {
    match fetch_and_lock_one_task(conn).await? {
        None => {
            sleep(std::time::Duration::from_secs(30)).await;
        }
        Some(task) => {
            let user = user_handler::User { uid: task.user_id };
            let snapshot_result =
                data_fetcher::snapshot(&task.source, &user, sync_file_storage).await;

            let txn = conn.begin().await?;
            let current_task = snapshot_task::Entity::find()
                .filter(snapshot_task::Column::Status.eq(snapshot_task::Status::Running))
                .filter(snapshot_task::Column::UserId.eq(task.user_id))
                .lock_exclusive()
                .one(&txn)
                .await?;
            let saved = match current_task {
                None => false,
                Some(current_task) => {
                    if current_task.source != task.source {
                        false
                    } else {
                        let (succeed, snapshot_id) = match snapshot_result.result {
                            Err(()) => {
                                let error_count = current_task.error_count + 1;
                                snapshot_task::Entity::update(snapshot_task::ActiveModel {
                                    user_id: Set(task.user_id),
                                    status: if error_count >= 3 {
                                        Set(snapshot_task::Status::Stopped)
                                    } else {
                                        NotSet
                                    },
                                    error_count: Set(error_count),
                                    ..Default::default()
                                })
                                .exec(&txn)
                                .await?;
                                (false, None)
                            }
                            Ok((sync_files, snapshot_time)) => {
                                snapshot_task::Entity::update(snapshot_task::ActiveModel {
                                    user_id: Set(task.user_id),
                                    next_sync: Set(Utc::now()
                                        + chrono::Duration::minutes(current_task.interval.into())),
                                    error_count: Set(0),
                                    ..Default::default()
                                })
                                .exec(&txn)
                                .await?;

                                let last_snapshot = snapshot::Entity::find()
                                    .filter(snapshot_task::Column::UserId.eq(task.user_id))
                                    .order_by_desc(snapshot::Column::Timestamp)
                                    .one(&txn)
                                    .await?;

                                let changed = match last_snapshot {
                                    None => true,
                                    Some(last_snapshot) => last_snapshot.sync_files != sync_files,
                                };

                                if changed {
                                    let snapshot = snapshot::ActiveModel {
                                        id: NotSet,
                                        user_id: Set(task.user_id),
                                        timestamp: Set(snapshot_time),
                                        sync_files: Set(sync_files),
                                        source_kind: Set(snapshot::SourceKind::Snapshot),
                                        note: Set(None),
                                    }
                                    .insert(&txn)
                                    .await?;
                                    (true, Some(snapshot.id))
                                } else {
                                    (true, None)
                                }
                            }
                        };
                        snapshot_log::ActiveModel {
                            id: NotSet,
                            user_id: Set(task.user_id),
                            snapshot_id: Set(snapshot_id),
                            timestamp: Set(Utc::now()),
                            succeed: Set(succeed),
                            details: Set(snapshot_result.logs.join("\n")),
                        }
                        .insert(&txn)
                        .await?;

                        true
                    }
                }
            };
            if !saved {
                info!("snapshot task done but discarded, uid: {}", task.user_id);
            }
            txn.commit().await?;
        }
    }
    Ok(())
}

pub async fn run(rocket: &Rocket<Orbit>, sync_file_storage: file_storage::SyncFileStorage) {
    // TODO: it is a terrible idea to create another connection pool for the background job.
    // I could get the main pool by `let conn = Db::fetch(&rocket).unwrap().conn.clone();`
    // But somehow I encounter race condition with that (having a chance raising errors like
    // incorrect binary data format in bind parameter 1).
    // I'll revist this later and maybe report this to upstream if it is a bug. We don't care
    // about performance at the moment.
    let db = pool::SeaOrmPool::init(&rocket.figment().focus("databases.main"))
        .await
        .unwrap();
    task::spawn(async move {
        // TODO: run job in parallel
        sleep(std::time::Duration::from_secs(10)).await;

        loop {
            match do_one_task(&db.conn, &sync_file_storage).await {
                Ok(()) => (),
                Err(error) => {
                    error!("internal error: {}", error);
                    sleep(std::time::Duration::from_secs(60)).await;
                }
            }
        }
    });
}
