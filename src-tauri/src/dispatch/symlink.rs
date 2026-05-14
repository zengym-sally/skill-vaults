use std::path::PathBuf;
use anyhow::Result;
use serde::{Serialize, Deserialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::db::dispatch::{Dispatch, DispatchMethod, SyncStatus};
use crate::db::skill::Skill;
use super::target_dir::TargetDir;
use super::copy::copy_dir;

/// Dispatch a skill to target directory using specified method
#[tauri::command]
pub async fn dispatch_skill(
    skill_id: &str,
    target_dir_id: &str,
    dispatch_method: DispatchMethod,
    pool: State<'_, SqlitePool>,
) -> Result<Dispatch, String> {
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

    // Perform dispatch based on method
    match dispatch_method {
        DispatchMethod::Symlink => {
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
        }
        DispatchMethod::Copy => {
            // Recursively copy directory
            copy_dir(&source_path, &dest_path)?;
        }
        DispatchMethod::Hardlink => {
            return Err("Hardlink dispatch method is not supported yet".to_string());
        }
    }

    // Create dispatch record
    let now = chrono::Utc::now();
    let dispatch = Dispatch::create(
        &pool,
        target_dir.id.clone(),
        skill.id.clone(),
        dispatch_method,
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

/// List all dispatch rules
#[tauri::command]
pub async fn list_dispatches(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Dispatch>, String> {
    Dispatch::get_all(&pool)
        .await
        .map_err(|e| format!("Failed to list dispatches: {}", e))
}

/// Bulk dispatch result containing successful dispatches and errors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkDispatchResult {
    pub successful: Vec<Dispatch>,
    pub errors: Vec<(String, String)>, // (skill_id, error_message)
}

/// Bulk dispatch multiple skills to target directory using specified method
#[tauri::command]
pub async fn bulk_dispatch(
    skill_ids: Vec<String>,
    target_dir_id: &str,
    dispatch_method: DispatchMethod,
    pool: State<'_, SqlitePool>,
) -> Result<BulkDispatchResult, String> {
    let mut bulk_result = BulkDispatchResult {
        successful: Vec::new(),
        errors: Vec::new(),
    };

    if skill_ids.is_empty() {
        return Ok(bulk_result);
    }

    // Get target directory once (common for all dispatches)
    let target_dir = sqlx::query_as::<_, TargetDir>(
        "SELECT * FROM target_dirs WHERE id = ?"
    )
    .bind(target_dir_id)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| format!("Failed to get target directory: {}", e))?
    .ok_or_else(|| format!("Target directory with id {} not found", target_dir_id))?;

    // Pre-fetch all skills in one query to avoid N+1 database calls
    let placeholders = std::iter::repeat("?").take(skill_ids.len()).collect::<Vec<_>>().join(",");
    let query = format!("SELECT * FROM skills WHERE id IN ({})", placeholders);

    let mut query_builder = sqlx::query(&query);
    for skill_id in &skill_ids {
        query_builder = query_builder.bind(skill_id);
    }

    let rows = query_builder.fetch_all(&*pool)
        .await
        .map_err(|e| format!("Failed to fetch skills: {}", e))?;

    let skills: Vec<Skill> = rows.iter()
        .filter_map(|r| crate::db::skill::map_row_to_skill(r).ok())
        .collect();

    let skill_map: std::collections::HashMap<_, _> = skills.into_iter().map(|s| (s.id.clone(), s)).collect();

    // Process dispatches sequentially to avoid concurrency issues
    for skill_id in skill_ids {
        let skill = match skill_map.get(&skill_id) {
            Some(s) => s.clone(),
            None => {
                bulk_result.errors.push((skill_id.clone(), format!("Skill with id {} not found", skill_id)));
                continue;
            }
        };

        match process_single_dispatch_with_skill(&skill, &target_dir, dispatch_method, &pool).await {
            Ok(dispatch) => bulk_result.successful.push(dispatch),
            Err(e) => bulk_result.errors.push((skill_id, e)),
        }
    }

    Ok(bulk_result)
}

/// Helper function to process a single dispatch with pre-fetched skill
async fn process_single_dispatch_with_skill(
    skill: &Skill,
    target_dir: &TargetDir,
    dispatch_method: DispatchMethod,
    pool: &SqlitePool,
) -> Result<Dispatch, String> {
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

    // Perform dispatch based on method
    match dispatch_method {
        DispatchMethod::Symlink => {
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
        }
        DispatchMethod::Copy => {
            // Recursively copy directory
            copy_dir(&source_path, &dest_path)?;
        }
        DispatchMethod::Hardlink => {
            return Err("Hardlink dispatch method is not supported yet".to_string());
        }
    }

    // Create dispatch record
    let now = chrono::Utc::now();
    let dispatch = Dispatch::create(
        pool,
        target_dir.id.clone(),
        skill.id.clone(),
        dispatch_method,
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

