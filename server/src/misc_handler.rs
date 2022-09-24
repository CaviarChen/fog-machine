use crate::data_fetcher;
use crate::pool::Db;
use crate::user_handler::User;
use crate::{APIResponse, InternalError, ServerState};
use anyhow::Error;
use anyhow::Result;
use chrono::prelude::*;
use entity::sea_orm;
use entity::{snapshot, snapshot_log};
use jwt::SignWithKey;
use rocket::http::ContentType;
use rocket::http::Status;
use rocket::request::Request;
use rocket::response::{self, Responder, Response};
use rocket::serde::json::Json;
use sea_orm::{entity::*, query::*, DatabaseTransaction};
use sea_orm_rocket::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::cmp;
use std::collections::HashSet;
use zip::write::FileOptions;

#[derive(Serialize, Deserialize)]
struct DownloadJwtData {
    ver: i8,
    sub: i64,
    exp: i64,
}

pub fn generate_snapshot_download_token(server_state: &ServerState, snapshot_id: i64) -> String {
    let exp = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::minutes(10))
        .expect("valid timestamp")
        .timestamp();

    let jwt_data = DownloadJwtData {
        ver: 1,
        sub: snapshot_id,
        exp,
    };
    jwt_data
        .sign_with_key(&server_state.download_jwt_key)
        .unwrap()
}

// TODO: streaming?
enum FileResponse {
    Ok {
        filename: String,
        content: std::vec::Vec<u8>,
    },
    Forbidden,
}

#[rocket::async_trait]
impl<'r> Responder<'r, 'static> for FileResponse {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        match self {
            // TODO: ContentType from extension?
            FileResponse::Ok { filename, content } => Response::build()
                .status(Status::Ok)
                .header(ContentType::ZIP)
                .raw_header(
                    "Content-Disposition",
                    // TODO: escape?
                    format!("attachment; filename=\"{}\"", filename),
                )
                .sized_body(content.len(), std::io::Cursor::new(content))
                .ok(),
            FileResponse::Forbidden => Response::build().status(Status::Forbidden).ok(),
        }
    }
}

#[get("/download?<token>")]
async fn download<'r>(
    conn: Connection<'_, Db>,
    server_state: &rocket::State<ServerState>,
    token: &str,
) -> Result<FileResponse, InternalError> {
    use jwt::VerifyWithKey;

    println!("token: {}", token);
    let jwt_data: Result<DownloadJwtData, _> =
        token.verify_with_key(&server_state.download_jwt_key);
    let sanpshot_id = match jwt_data {
        Err(_) => None,
        Ok(jwt_data) => {
            if jwt_data.ver == 1 {
                let now = chrono::Utc::now().timestamp();
                if now < jwt_data.exp {
                    Some(jwt_data.sub)
                } else {
                    None
                }
            } else {
                None
            }
        }
    };
    match sanpshot_id {
        None => Ok(FileResponse::Forbidden),
        Some(sanpshot_id) => {
            let db = conn.into_inner();
            let snapshot = snapshot::Entity::find()
                .filter(snapshot::Column::Id.eq(sanpshot_id))
                .one(db)
                .await?;
            match snapshot {
                None => Ok(FileResponse::Forbidden),
                Some(snapshot) => {
                    let user = User {
                        uid: snapshot.user_id,
                    };
                    let mut buf = Vec::new();
                    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
                    let options = zip::write::FileOptions::default()
                        .compression_method(zip::CompressionMethod::Stored);
                    zip.add_directory("Sync/", options)?;

                    let entity::snapshot::SyncFiles(sync_files) = snapshot.sync_files;
                    for (file_id, sha256) in &sync_files {
                        let sync_file = data_fetcher::SyncFile::create_from_id(*file_id, sha256)?;
                        zip.start_file(format!("Sync/{}", sync_file.filename()), options)?;
                        let mut file = server_state.file_storage.open_file(&user, sha256)?;
                        // TODO: async?
                        std::io::copy(&mut file, &mut zip)?;
                    }
                    zip.finish()?;
                    drop(zip);

                    Ok(FileResponse::Ok {
                        filename: String::from("Sync.zip"),
                        content: buf,
                    })
                }
            }
        }
    }
}

pub fn routes() -> Vec<rocket::Route> {
    routes![download]
}
