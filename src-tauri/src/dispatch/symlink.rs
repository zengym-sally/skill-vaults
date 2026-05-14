use std::path::PathBuf;
use anyhow::Result;
use sqlx::SqlitePool;
use tauri::State;

use crate::db::dispatch::{Dispatch, DispatchMethod, SyncStatus};
use crate::db::skill::Skill;
use super::target_dir::TargetDir;

/// Create a symbolic link from skill to target directory
#[tauri::command]
pub async fn dispatch_skill(
    skill_id: &str,
    target_dir_id: &str,
    dispatch_method: DispatchMethod,
    pool: State<'_, SqlitePool>,
) -> Result<Dispatch, String> {
    // Only support symlink for now
    if dispatch_method != DispatchMethod::Symlink {
        return Err("Only symlink dispatch method is supported currently".to_string());
    }

    // Get skill by ID
    let skill = Skill::get_by_id(&pool, skill_id)
        .await
        .map_err(|e| format!("Failed to get skill: {}", e))?
        .ok_or_else(|| format!("Skill with id {} not found", skill_id))?;

    // Get target directory by ID
    let target_dir = sqlx::query_as::<_, TargetDir>(
        "SELECT * FROM target_dirs WHERE id = ?"
    )
    .bind(target_dir_id)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| format!("Failed to get target directory: {}", e))?
    .ok_or_else(|| format!("Target directory with id {} not found", target_dir_id))?;

    // Build source and destination paths
    let source_path = PathBuf::from(&skill.local_path);
    let dest_path = PathBuf::from(&target_dir.path).join(&skill.name);

    // Check if source path exists
    if !source_path.exists() {
        return Err(format!("Skill source path does not exist: {}", source_path.display()));
    }

    // Check if destination path already exists
    if dest_path.exists() {
        return Err(format!("Destination path already exists: {}", dest_path.display()));
    }

    // Create parent directories if they don't exist
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directories: {}", e))?;
    }

    // Create symbolic link
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&source_path, &dest_path)
            .map_err(|e| format!("Failed to create symbolic link: {}", e))?;
    }

    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_dir(&source_path, &dest_path)
            .map_err(|e| format!("Failed to create symbolic link: {}", e))?;
    }

    // Create dispatch record
    let now = chrono::Utc::now();
    let dispatch = Dispatch::create(
        &pool,
        target_dir.id.clone(),
        skill.id.clone(),
        DispatchMethod::Symlink,
        source_path.to_string_lossy().to_string(),
        dest_path.to_string_lossy().to_string(),
        SyncStatus::Synced,
        None,
        Some(now),
    )
    .await
    .map_err(|e| format!("Failed to create dispatch record: {}", e))?;

    Ok(dispatch)
}
