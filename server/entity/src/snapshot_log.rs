use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "snapshot_logs")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(indexed)]
    pub user_id: i64,
    // `snapshot_id` set to None means the task failed.
    #[sea_orm(indexed)]
    pub snapshot_id: Option<i64>,
    pub timestamp: DateTimeUtc,
    #[sea_orm(column_type = "Text", nullable)]
    pub details: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
