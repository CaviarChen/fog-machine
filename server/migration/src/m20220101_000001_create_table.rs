use sea_orm::{DbBackend, Schema};
use sea_schema::migration::{sea_query::*, *};

use entity;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20220101_000001_create_table"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db_postgres = DbBackend::Postgres;
        let schema = Schema::new(db_postgres);
        manager
            .create_table(schema.create_table_from_entity(entity::user::Entity))
            .await?;
        manager
            .create_table(schema.create_table_from_entity(entity::snapshot::Entity))
            .await?;
        manager
            .create_table(schema.create_table_from_entity(entity::snapshot_log::Entity))
            .await?;
        manager
            .create_table(schema.create_table_from_entity(entity::snapshot_task::Entity))
            .await?;
        manager
            .create_table(schema.create_table_from_entity(entity::snapshot_share::Entity))
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .table(entity::snapshot_share::Entity)
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .table(entity::snapshot_task::Entity)
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(Table::drop().table(entity::snapshot_log::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(entity::snapshot::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(entity::user::Entity).to_owned())
            .await
    }
}
