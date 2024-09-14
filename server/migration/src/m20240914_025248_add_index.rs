use sea_orm_migration::{
    prelude::*,
    sea_orm::{DbBackend, Schema},
};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let schema = Schema::new(DbBackend::Postgres);
        for stmt in schema.create_index_from_entity(entity::user::Entity) {
            manager.create_index(stmt).await?;
        }
        for stmt in schema.create_index_from_entity(entity::snapshot::Entity) {
            manager.create_index(stmt).await?;
        }
        for stmt in schema.create_index_from_entity(entity::snapshot_log::Entity) {
            manager.create_index(stmt).await?;
        }
        for stmt in schema.create_index_from_entity(entity::snapshot_task::Entity) {
            manager.create_index(stmt).await?;
        }
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}