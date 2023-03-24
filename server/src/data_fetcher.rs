use crate::file_storage;
use crate::limit;
use crate::user_handler::User;
use anyhow::Error;
use chrono::prelude::*;
use chrono::Duration;
use entity::snapshot::SyncFiles;
use entity::snapshot_task::Source;
use std::collections::HashMap;
use tokio::time::sleep;

#[derive(Debug)]
pub struct SyncFile {
    pub id: u32,
    pub sha256: String,
}

impl SyncFile {
    const FILENAME_MASK1: &'static str = "olhwjsktri";
    const FILENAME_MASK2: &'static str = "eizxdwknmo";

    fn id_to_filename(id: u32) -> String {
        let id_str = id.to_string();
        let id_part: String = id_str
            .chars()
            .map(|c| {
                SyncFile::FILENAME_MASK1
                    .chars()
                    .nth(c.to_digit(10).unwrap() as usize)
                    .unwrap()
            })
            .collect();
        let suffix: String = id_str[(id_str.len() - 2)..(id_str.len())]
            .chars()
            .map(|c| {
                SyncFile::FILENAME_MASK2
                    .chars()
                    .nth(c.to_digit(10).unwrap() as usize)
                    .unwrap()
            })
            .collect();
        let prefix = &format!("{:x}", md5::compute(&id_str))[0..4];
        prefix.to_owned() + &id_part + &suffix
    }

    pub fn create_from_id(id: u32, sha256_lowercase: &str) -> Result<SyncFile, Error> {
        if id > 512 * 512 {
            return Err(anyhow!("invalid id"));
        }
        if sha256_lowercase.chars().any(char::is_uppercase) {
            return Err(anyhow!("sha256 must be lower case"));
        }
        Ok(SyncFile {
            id,
            sha256: String::from(sha256_lowercase),
        })
    }

    pub fn create_from_filename(filename: &str, sha256_lowercase: &str) -> Result<SyncFile, Error> {
        if filename.len() < 6 {
            return Err(anyhow!("invalid filename"));
        }
        let id_part = &filename[4..(filename.len() - 2)];
        let mut id: u32 = 0;
        for c in id_part.chars() {
            let v = SyncFile::FILENAME_MASK1
                .find(c)
                .ok_or_else(|| anyhow!("invalid filename"))? as u32;
            id = id * 10 + v;
        }
        if SyncFile::id_to_filename(id) == filename {
            SyncFile::create_from_id(id, sha256_lowercase)
        } else {
            Err(anyhow!("invalid filename"))
        }
    }

    pub fn filename(&self) -> String {
        SyncFile::id_to_filename(self.id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_sync_file() {
        let filename = "23e4lltkkoke";
        let sync_file = SyncFile::create_from_filename(filename, "").unwrap();
        assert_eq!(sync_file.id, 117660);
        let filename = "23e4lltkkoki";
        let error = SyncFile::create_from_filename(filename, "");
        assert!(error.is_err());
    }
}

pub enum ValidationError {
    InvalidShare,
    InvalidFolderStructure,
}

fn onedrive_api_of_link(url: &str) -> String {
    format!(
        "https://api.onedrive.com/v1.0/shares/u!{}",
        base64::encode_config(url, base64::URL_SAFE_NO_PAD)
    )
}

async fn onedrive_find_sync_folder_link(url: &str) -> Result<Option<String>, Error> {
    let resp = reqwest::get(onedrive_api_of_link(url) + "/root/children")
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    for child in resp["value"]
        .as_array()
        .ok_or_else(|| anyhow!("invalid api response"))?
    {
        if let Some("Sync") = child["name"].as_str() {
            return Ok(child["webUrl"].as_str().map(String::from));
        }
    }
    Ok(None)
}

pub async fn validate(source: &Source) -> Result<Result<(), ValidationError>, Error> {
    match source {
        Source::OneDrive { share_url } => {
            let resp = reqwest::get(onedrive_api_of_link(share_url) + "/root").await?;
            if resp.status() != 200 {
                return Ok(Err(ValidationError::InvalidShare));
            }
            let root = resp.json::<serde_json::Value>().await?;
            match root["name"].as_str() {
                Some("Fog of World") => (),
                _ => return Ok(Err(ValidationError::InvalidFolderStructure)),
            }
            match onedrive_find_sync_folder_link(share_url).await? {
                Some(_) => Ok(Ok(())),
                None => Ok(Err(ValidationError::InvalidFolderStructure)),
            }
        }
    }
}

enum SnapshotResultInternal {
    Ok(SyncFiles, DateTime<Utc>),
    Locked,
}

async fn snapshot_internal(
    source: &Source,
    logs: &mut Vec<String>,
    user: &User,
    sync_file_storage: &file_storage::SyncFileStorage,
) -> Result<SnapshotResultInternal, Error> {
    match source {
        Source::OneDrive { share_url } => {
            // we trust the hash provided by onedrive for deduping, but we recompute it after download.
            let link_for_sync_folder = onedrive_find_sync_folder_link(share_url)
                .await?
                .ok_or_else(|| anyhow!("missing sync folder"))?;
            let time = Utc::now();

            let mut files = Vec::new();
            let mut total_size: u64 = 0;
            let mut next_link =
                Some(onedrive_api_of_link(&link_for_sync_folder) + "/root/children");
            loop {
                match &next_link {
                    None => break,
                    Some(current_link) => {
                        let resp = reqwest::get(current_link)
                            .await?
                            .error_for_status()?
                            .json::<serde_json::Value>()
                            .await?;
                        next_link = resp["@odata.nextLink"].as_str().map(str::to_string);
                        for child in resp["value"]
                            .as_array()
                            .ok_or_else(|| anyhow!("invalid api response"))?
                        {
                            let name = child["name"]
                                .as_str()
                                .ok_or_else(|| anyhow!("invalid api response"))?;
                            if name == "FoW-Sync-Lock" {
                                let last_modified_time: DateTime<Utc> =
                                    serde_json::from_value(child["lastModifiedDateTime"].clone())?;
                                // TODO: starting from a recent FoW version, the semantic of lock file changed. 
                                // It doesn't remove the lock file after finishing syncing, I guess it might encode
                                // the lock status inside the file, I haven't figure out the new behavior, but in order
                                // to make things work, let's just ignore locks that are older than 15 minutes.
                                if time - last_modified_time <= Duration::minutes(15) {
                                    return Ok(SnapshotResultInternal::Locked);
                                }
                            }
                            if child["file"].is_null() {
                                logs.push(format!("unexpected folder: {}", name));
                            } else {
                                let sha256_lowercase = child["file"]["hashes"]["sha256Hash"]
                                    .as_str()
                                    .ok_or_else(|| anyhow!("invalid api response"))?
                                    .to_lowercase();
                                let download_url = child["@content.downloadUrl"]
                                    .as_str()
                                    .ok_or_else(|| anyhow!("invalid api response"))?;
                                let file_size = child["size"]
                                    .as_i64()
                                    .ok_or_else(|| anyhow!("invalid api response"))?;
                                match SyncFile::create_from_filename(name, &sha256_lowercase) {
                                    Err(_) => {
                                        logs.push(format!("unexpected file: {}", name));
                                    }
                                    Ok(sync_file) => {
                                        total_size += file_size as u64;
                                        files.push((sync_file, String::from(download_url)));
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // validate size
            if total_size > limit::SYNC_FILE_LIMIT_PER_SNAPSHOT {
                return Err(anyhow!(
                    "snapshot is too big. size: {}, limit: {}",
                    file_storage::byte_unit_to_string_hum(total_size),
                    file_storage::byte_unit_to_string_hum(limit::SYNC_FILE_LIMIT_PER_SNAPSHOT)
                ));
            }

            // download file
            // TODO: parallel?
            let tmp_dir = sync_file_storage.get_tmp_dir()?;
            let mut downloaded = Vec::new();
            for (sync_file, download_url) in &files {
                if !sync_file_storage.has_file(user, &sync_file.sha256) {
                    let resp = reqwest::get(download_url.to_owned()).await?;
                    // NOTE: id is used for the tmp file name because it is unique. sha256 might not be
                    // unique. we don't handle it in a smart way, but it should be fine, `sync_file_storage`
                    // can handle this.
                    let tmp_file_path = tmp_dir.path().join(sync_file.id.to_string());
                    // sha256 will be validated later
                    // TODO: async?
                    std::fs::write(&tmp_file_path, resp.bytes().await?)?;
                    downloaded.push((sync_file.sha256.as_str(), tmp_file_path));
                }
            }

            logs.push(format!("new files: {}/{}", downloaded.len(), files.len()));
            // save files
            sync_file_storage.add_files(user, &downloaded[..])?;

            let mut sync_files: HashMap<u32, String> = HashMap::new();
            for (sync_file, _) in files {
                sync_files.insert(sync_file.id, sync_file.sha256);
            }
            Ok(SnapshotResultInternal::Ok(SyncFiles(sync_files), time))
        }
    }
}

#[derive(Debug)]
pub struct SnapshotResult {
    pub result: Result<(SyncFiles, DateTime<Utc>), ()>,
    pub logs: Vec<String>,
}

pub async fn snapshot(
    source: &Source,
    user: &User,
    sync_file_storage: &file_storage::SyncFileStorage,
) -> SnapshotResult {
    let mut logs = Vec::new();

    for n in 1..=3 {
        match snapshot_internal(source, &mut logs, user, sync_file_storage).await {
            Ok(SnapshotResultInternal::Ok(sync_files, time)) => {
                return SnapshotResult {
                    result: Ok((sync_files, time)),
                    logs,
                }
            }
            Ok(SnapshotResultInternal::Locked) => {
                if n < 3 {
                    logs.push("Locked, trying again in 2 min.".into());
                    sleep(std::time::Duration::from_secs(120)).await;
                }
            }
            Err(error) => {
                logs.push(error.to_string());
                return SnapshotResult {
                    result: Err(()),
                    logs,
                };
            }
        }
    }
    logs.push("Still locked, failed to sync.".into());
    SnapshotResult {
        result: Err(()),
        logs,
    }
}