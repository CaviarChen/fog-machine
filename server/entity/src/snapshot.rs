use sea_orm::entity::prelude::*;
use sea_orm::sea_query;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Copy, Clone, Serialize, Deserialize, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "i16", db_type = "TinyInteger")]
pub enum SourceKind {
    #[sea_orm(num_value = 0)]
    Snapshot,
    #[sea_orm(num_value = 1)]
    Upload,
}

// Sadly currently sea-orm doesn't array etc, so we save is as json
// u32: SyncFile id, String: sha256
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct SyncFiles(pub HashMap<u32, String>);

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "snapshots")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(indexed)]
    pub user_id: i64,
    #[sea_orm(indexed)]
    pub timestamp: DateTimeUtc,
    #[sea_orm(indexed)]
    pub source_kind: SourceKind,
    pub note: Option<String>,
    pub sync_files: SyncFiles,
    // TODO: record level? area?
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
