use entity;
use sea_orm::schema::Schema;
use sea_orm::DbBackend;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let schema = Schema::new(DbBackend::Postgres);
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
