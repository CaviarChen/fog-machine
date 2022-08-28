use crate::limit;
use crate::user_handler::User;
use anyhow::Error;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::{fs, io};
use tempfile::TempDir;

// TODO: unit tests

pub fn byte_unit_to_string_hum(bytes: u64) -> String {
    byte_unit::Byte::from_bytes(bytes.into())
        .get_appropriate_unit(true)
        .to_string()
}

fn dir_size(path: impl Into<PathBuf>) -> io::Result<u64> {
    fn dir_size(mut dir: fs::ReadDir) -> io::Result<u64> {
        dir.try_fold(0, |acc, file| {
            let file = file?;
            let size = match file.metadata()? {
                data if data.is_dir() => dir_size(fs::read_dir(file.path())?)?,
                data => data.len(),
            };
            Ok(acc + size)
        })
    }
    dir_size(fs::read_dir(path.into())?)
}

/// we use SHA-256 (lower case!!!) as the key of a file. We don't share file between users (I don't
/// think different users will have a same file) so we don't really need to worry about hash collision.
pub struct SyncFileStorage {
    data_base_dir: String,
}

// TODO: GC
impl SyncFileStorage {
    fn get_user_path(&self, user: &User) -> PathBuf {
        Path::new(&self.data_base_dir)
            .join("users")
            .join(user.uid.to_string())
            .join("sync_files")
    }

    pub fn init(data_base_dir: &str) -> io::Result<SyncFileStorage> {
        let data_base_dir = String::from(data_base_dir);
        let tmp_dir = Path::new(&data_base_dir).join("tmp");
        if tmp_dir.exists() {
            fs::remove_dir_all(&tmp_dir)?
        }
        fs::create_dir_all(&tmp_dir)?;
        Ok(SyncFileStorage { data_base_dir })
    }

    pub fn get_tmp_dir(&self) -> io::Result<TempDir> {
        TempDir::new_in(Path::new(&self.data_base_dir).join("tmp"))
    }

    pub fn has_file(&self, user: &User, sha256: &str) -> bool {
        self.get_user_path(user).join(sha256).exists()
    }

    /// `[(sha-256, file_path)]`, sha-256 will be recomputed from the file.
    /// file will be moved to the permanent storage, NOTE that we move file by calling `fs::rename`
    /// so the tmp file must at the same mount point.
    pub fn add_files(&self, user: &User, files: &[(&str, PathBuf)]) -> Result<(), Error> {
        // validate sha-256 and size
        let mut size: u64 = 0;
        for (sha256, path) in files {
            let mut hasher = Sha256::new();
            let mut file = fs::File::open(path)?;
            size += file.metadata()?.len();
            // TODO: async?
            io::copy(&mut file, &mut hasher)?;
            let hash = format!("{:x}", hasher.finalize());
            if &hash != sha256 {
                return Err(anyhow!("provided hash does not match the actual file. file: {}, expected_hash: {}, actual_hash: {}",
                                   path.display(), sha256, hash));
            }
        }
        let user_path = self.get_user_path(user);
        fs::create_dir_all(&user_path)?;
        let current_size = dir_size(&user_path)?;
        if size + current_size > limit::SYNC_FILE_STORAGE_LIMIT_PER_USER {
            return Err(anyhow!(
                "out of sync file storage quota. current: {}, need: {}, limit: {}",
                byte_unit_to_string_hum(current_size),
                byte_unit_to_string_hum(size),
                byte_unit_to_string_hum(limit::SYNC_FILE_STORAGE_LIMIT_PER_USER)
            ));
        }
        // TODO: maybe validate zlib header?
        // all good, let's save files
        for (sha256, path) in files {
            let target = user_path.join(sha256);
            if !target.exists() {
                // race-condition should be fine
                fs::rename(path, target)?
            }
        }
        Ok(())
    }
}
