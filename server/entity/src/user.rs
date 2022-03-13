use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(column_type = "Text")]
    pub email: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub password: Option<String>,
    pub github_sso_uid: Option<i32>,
    #[sea_orm(column_type = "Text")]
    pub language: String,
    pub create_at: DateTimeUtc,
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
