use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

// NOTE: sea_orm doesn't seem to support `u16`

#[derive(Copy, Clone, Serialize, Deserialize, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "i16", db_type = "TinyInteger")]
/// `Paused` is requested by human and `Stopped` is caused by things like too many errors.
pub enum Status {
    #[sea_orm(num_value = 0)]
    Running,
    #[sea_orm(num_value = 1)]
    Paused,
    #[sea_orm(num_value = 2)]
    Stopped,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
pub enum Source {
    OneDrive { share_url: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, DeriveEntityModel)]
#[sea_orm(table_name = "snapshot_tasks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub user_id: i64,
    #[sea_orm(indexed)]
    pub status: Status,
    // unit: mintue
    pub interval: i16,
    pub source: Source,
    // I haven't thought really hard about the scheduling, so let's make it simple for now.
    // Basically we'll try to sync from the source when: current_time >= next_sync && status == Running.
    // Last sync can be found by looking at the snapshot log table.
    // The tricky parts here are:
    // 1. Do users want to have more control on when to sync if we don't allow them to sync very frequently?
    //    It is very likely that users have some patterns about when they sync data from their devices to the cloud.
    // 2. Sycning (and maybe retrying) takes a while, so the current naive approach will make the schedule shift a bit
    //    every single time.
    #[sea_orm(indexed)]
    pub next_sync: DateTimeUtc,
    pub error_count: i16,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
