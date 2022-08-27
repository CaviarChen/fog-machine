use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Serialize, Deserialize, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "String", db_type = "Text")]
pub enum Language {
    #[serde(rename = "zh-cn")]
    #[sea_orm(string_value = "zh-cn")]
    ZhCn,
    #[serde(rename = "en-us")]
    #[sea_orm(string_value = "en-us")]
    EnUs,
}

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(column_type = "Text", unique, nullable, index)]
    pub email: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub password: Option<String>,
    #[sea_orm(column_type = "Text")]
    pub contact_email: String,
    #[sea_orm(nullable, unique, index)]
    pub github_uid: Option<i64>,
    pub language: Language,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_one = "super::snapshot_task::Entity")]
    SnapshotTask,
    #[sea_orm(has_many = "super::snapshot::Entity")]
    Snapshot,
    #[sea_orm(has_many = "super::snapshot_log::Entity")]
    SnapshotLog,
}

impl ActiveModelBehavior for ActiveModel {}
