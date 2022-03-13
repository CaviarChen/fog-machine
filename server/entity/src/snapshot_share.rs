use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "snapshot_shares")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false, column_type = "Text")]
    pub share_token: String,
    pub snapshot_id: i32,
    pub expire_at: Option<DateTimeUtc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::snapshot::Entity",
        from = "Column::SnapshotId",
        to = "super::snapshot::Column::Id"
    )]
    Snapshot,
}

impl Related<super::snapshot::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Snapshot.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
