use std::path::PathBuf;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;
use chrono::Utc;

use crate::db::dispatch::{Dispatch, DispatchMethod, SyncStatus};
use super::copy::copy_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncTargetDirResult {
    pub synced: Vec<Dispatch>,
    pub failed: Vec<(String, String)>,
}

/// Sync all dispatches for a target directory
#[tauri::command]
pub async fn sync_target_dir_dispatches(
    target_dir_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<SyncTargetDirResult, String> {
    let dispatches = Dispatch::get_by_target_dir(&pool, &target_dir_id)
        .await
        .map_err(|e| format!("Failed to get dispatches: {}", e))?;

    let mut result = SyncTargetDirResult {
        synced: Vec::new(),
        failed: Vec::new(),
    };

    for dispatch in dispatches {
        let dispatch_id = dispatch.id.clone();
        let skill_name = dispatch.skill_id.clone();

        // Check current status
        let status = check_dispatch_sync(&dispatch_id, pool.clone()).await;
        let should_sync = match status {
            Ok(SyncStatus::Outdated) => true,
            Ok(SyncStatus::Synced) => false,
            _ => false,
        };

        if should_sync {
            match sync_dispatched_skill(&dispatch_id, pool.clone()).await {
                Ok(updated) => result.synced.push(updated),
                Err(e) => result.failed.push((skill_name, e)),
            }
        } else {
            // Already synced or un-syncable, just include as-is
            match status {
                Ok(SyncStatus::Synced) => result.synced.push(dispatch),
                _ => result.failed.push((skill_name, "Cannot sync in current state".to_string())),
            }
        }
    }

    Ok(result)
}

/// Check sync status for a dispatch
#[tauri::command]
pub async fn check_dispatch_sync(
    dispatch_id: &str,
    pool: State<'_, SqlitePool>,
) -> Result<SyncStatus, String> {
    let dispatch = Dispatch::get_by_id(&pool, dispatch_id)
        .await
        .map_err(|e| format!("Failed to get dispatch: {}", e))?
        .ok_or_else(|| format!("Dispatch with id {} not found", dispatch_id))?;

    let source_path = PathBuf::from(&dispatch.source_path);
    let dest_path = PathBuf::from(&dispatch.dest_path);

    if !source_path.exists() {
        let _ = dispatch.update(
            &pool,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(SyncStatus::Error),
            Some(Some("Source path does not exist".to_string())),
        ).await;
        return Ok(SyncStatus::Error);
    }

    if !dest_path.exists() {
        let _ = dispatch.update(
            &pool,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(SyncStatus::Error),
            Some(Some("Destination path does not exist".to_string())),
        ).await;
        return Ok(SyncStatus::Error);
    }

    let sync_status = match dispatch.method {
        DispatchMethod::Symlink => {
            let link_target = std::fs::read_link(&dest_path)
                .map_err(|e| format!("Failed to read symlink: {}", e))?;
            
            if link_target != source_path {
                SyncStatus::Conflict
            } else {
                SyncStatus::Synced
            }
        }
        DispatchMethod::Copy => {
            let last_synced_at = dispatch.last_synced_at.ok_or_else(|| {
                "Last synced time not found for copy dispatch".to_string()
            })?;

            let dest_modified = is_directory_modified_after(&dest_path, last_synced_at)
                .map_err(|e| format!("Failed to check destination modification time: {}", e))?;

            if dest_modified {
                SyncStatus::Conflict
            } else {
                let source_modified = is_directory_modified_after(&source_path, last_synced_at)
                    .map_err(|e| format!("Failed to check source modification time: {}", e))?;

                if source_modified {
                    SyncStatus::Outdated
                } else {
                    SyncStatus::Synced
                }
            }
        }
        DispatchMethod::Hardlink => {
            return Err("Hardlink dispatch method is not supported yet".to_string());
        }
    };

    let _ = dispatch.update(
        &pool,
        None,
        None,
        None,
        None,
        None,
        None,
        Some(sync_status),
        if sync_status == SyncStatus::Error {
            Some(Some("Sync check failed".to_string()))
        } else {
            Some(None)
        },
    ).await;

    Ok(sync_status)
}

/// Sync a dispatched skill to match source
#[tauri::command]
pub async fn sync_dispatched_skill(
    dispatch_id: &str,
    pool: State<'_, SqlitePool>,
) -> Result<Dispatch, String> {
    let mut dispatch = Dispatch::get_by_id(&pool, dispatch_id)
        .await
        .map_err(|e| format!("Failed to get dispatch: {}", e))?
        .ok_or_else(|| format!("Dispatch with id {} not found", dispatch_id))?;

    let source_path = PathBuf::from(&dispatch.source_path);
    let dest_path = PathBuf::from(&dispatch.dest_path);

    if !source_path.exists() {
        return Err(format!("Source path does not exist: {}", source_path.display()));
    }

    if !dest_path.exists() {
        return Err(format!("Destination path does not exist: {}", dest_path.display()));
    }

    let sync_status = check_dispatch_sync(dispatch_id, pool.clone()).await?;

    match sync_status {
        SyncStatus::Conflict => {
            return Err("Cannot sync: destination has been modified. Please resolve conflict manually.".to_string());
        }
        SyncStatus::Error => {
            return Err("Cannot sync: dispatch is in error state.".to_string());
        }
        SyncStatus::Synced => {
            return Ok(dispatch);
        }
        SyncStatus::Outdated => {}
    }

    match dispatch.method {
        DispatchMethod::Symlink => {
            // Symlinks point to the source path directly, so if the source
            // changed the symlink already reflects it. Just verify the link
            // target matches.
            let link_target = std::fs::read_link(&dest_path)
                .map_err(|e| format!("Symlink is broken: {}", e))?;
            if link_target != source_path {
                // Re-link if the target diverged
                std::fs::remove_file(&dest_path)
                    .or_else(|_| std::fs::remove_dir_all(&dest_path))
                    .map_err(|e| format!("Failed to remove stale link: {}", e))?;
                #[cfg(unix)]
                {
                    std::os::unix::fs::symlink(&source_path, &dest_path)
                        .map_err(|e| format!("Failed to re-create symlink: {}", e))?;
                }
                #[cfg(windows)]
                {
                    std::os::windows::fs::symlink_dir(&source_path, &dest_path)
                        .map_err(|e| format!("Failed to re-create symlink: {}", e))?;
                }
            }
        }
        DispatchMethod::Copy => {
            std::fs::remove_dir_all(&dest_path)
                .map_err(|e| format!("Failed to remove existing destination directory: {}", e))?;
            
            copy_dir(&source_path, &dest_path)?;
        }
        DispatchMethod::Hardlink => {
            return Err("Hardlink dispatch method is not supported yet".to_string());
        }
    }

    let now = Utc::now();
    dispatch = dispatch.update(
        &pool,
        None,
        None,
        None,
        None,
        None,
        Some(now),
        Some(SyncStatus::Synced),
        Some(None),
    ).await.map_err(|e| format!("Failed to update dispatch sync status: {}", e))?;

    Ok(dispatch)
}

/// Helper function to check if any file in a directory was modified after a given time
fn is_directory_modified_after(dir_path: &PathBuf, time: chrono::DateTime<Utc>) -> Result<bool, String> {
    for entry in std::fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let entry_path = entry.path();

        let metadata = entry.metadata()
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;

        let modified_time: chrono::DateTime<Utc> = metadata.modified()
            .map_err(|e| format!("Failed to get file modification time: {}", e))?
            .into();

        if modified_time > time {
            return Ok(true);
        }

        if entry_path.is_dir() {
            if is_directory_modified_after(&entry_path, time)? {
                return Ok(true);
            }
        }
    }

    Ok(false)
}
