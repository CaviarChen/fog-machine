use std::fs;

use crate::misc_handler::{DownloadRequest, GeneratedDownloadItem};
use crate::pool::Db;
use crate::user_handler::User;
use crate::{misc_handler, snapshot_handler};
use crate::{APIResponse, ServerState};
use anyhow::Result;
use chrono::Duration;
use entity::sea_orm;
use entity::snapshot::{self, SyncFiles};
use memolanes_core::journey_header::JourneyKind;
use memolanes_core::journey_kernel::JourneyBitmap;
use rocket::http::{ContentType, Status};
use sea_orm::{entity::*, query::*};
use sea_orm_rocket::Connection;
use serde_json::json;
use tempfile::{NamedTempFile, TempDir};
use tokio::time::Instant;

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
) -> Result<Option<InternalProcessSnapshotOutput>> {
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
    snapshot_handler::internal_generate_sync_zip_from_sync_files(
        server_state,
        &mut zip_file,
        &sync_files,
        user,
    )
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

pub async fn generate_memolanes_archive(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    uid: i64,
    timezone: chrono_tz::Tz,
) -> Result<GeneratedDownloadItem> {
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
            snapshot_handler::internal_generate_sync_zip_from_snapshot(
                server_state,
                &mut zip_file,
                snapshot,
                &user,
            )
            .await?;
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

    let mut file = NamedTempFile::new()?;
    main_db.with_txn(|txn| {
        memolanes_core::archive::export_as_mldx(
            &memolanes_core::archive::WhatToExport::All,
            txn,
            &mut file,
        )
    })?;

    println!(
        "Finsih generating memolanes archive, user = {}, time_used = {:?}",
        user.uid,
        start_time.elapsed()
    );

    Ok(GeneratedDownloadItem {
        content_type: (ContentType::Binary),
        filename: String::from("export.mldx"),
        file,
    })
}

#[get("/download_token?<timezone>")]
async fn get_download_token(
    server_state: &rocket::State<ServerState>,
    user: User,
    timezone: String,
) -> APIResponse {
    let timezone: chrono_tz::Tz = timezone.parse()?;
    let token = misc_handler::generate_download_token(
        server_state,
        DownloadRequest::MemolanesArchive {
            uid: user.uid,
            timezone,
        },
    );
    Ok((Status::Ok, json!({ "token": token })))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![get_download_token]
}
