// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod db;
mod config;
mod git;
mod skills;
mod llm;
mod dispatch;
#[cfg(test)]
mod test_utils;

use crate::db::dispatch_template::{DispatchTemplate, CreateDispatchTemplateInput, UpdateDispatchTemplateInput};
use crate::db::dispatch::DispatchMethod;

// ------------------------------
// General Config Commands
// ------------------------------

#[tauri::command]
async fn get_config(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    key: &str,
) -> Result<Option<String>, String> {
    crate::db::config::Config::get(&pool, key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_config(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    key: &str,
    value: &str,
) -> Result<(), String> {
    crate::db::config::Config::set(&pool, key, value)
        .await
        .map_err(|e| e.to_string())
        .map(|_| ())
}

#[tauri::command]
async fn delete_config(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    key: &str,
) -> Result<(), String> {
    crate::db::config::Config::delete(&pool, key)
        .await
        .map_err(|e| e.to_string())
}

// ------------------------------
// LLM Provider Commands
// ------------------------------

#[tauri::command]
async fn list_llm_providers(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Vec<llm::LLMProvider>, String> {
    llm::LLMProvider::list_from_db(&pool).await
}

#[tauri::command]
async fn save_llm_providers(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    providers: Vec<llm::LLMProvider>,
) -> Result<(), String> {
    llm::LLMProvider::save_all(&pool, &providers).await
}

#[tauri::command]
async fn fetch_llm_models(
    base_url: &str,
    api_key: &str,
) -> Result<Vec<llm::LLMModel>, String> {
    llm::fetch_models(base_url, api_key).await
}

// ------------------------------
// Git Configuration Commands
// ------------------------------

#[tauri::command]
async fn detect_git_path() -> Result<Option<String>, String> {
    Ok(which::which("git")
        .ok()
        .map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
async fn get_git_executable_path(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Option<String>, String> {
    crate::db::config::Config::get(&pool, "git.executable_path")
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_git_executable_path(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    path: &str,
) -> Result<(), String> {
    crate::db::config::Config::set(&pool, "git.executable_path", path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ------------------------------
// Repository Commands
// ------------------------------

use std::path::Path;
use std::fs;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Add repository
#[tauri::command]
async fn add_repository(
    name: &str,
    url: Option<&str>,
    path: &str,
    source_type: &str,
    auth_type: Option<&str>,
    auth_config: Option<&str>,
    branch: Option<&str>,
    copy: Option<bool>,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<db::repository::Repository, String> {
    let base_path = config::base_path::get_base_path(&pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Base path not set, please configure it first".to_string())?;

    match source_type {
        "github" | "private-git" | "local" => {},
        _ => return Err(format!("Invalid source type: {}, must be one of github, private-git, local", source_type)),
    }

    let base_path = Path::new(&base_path);
    let local_path = match source_type {
        "github" => base_path.join("github").join(name),
        "private-git" => base_path.join("private-git").join(name),
        "local" => base_path.join("local").join(name),
        _ => unreachable!(),
    };

    let local_path_str = local_path.to_str()
        .ok_or_else(|| "Invalid local path, contains non-UTF8 characters".to_string())?;

    if source_type == "github" || source_type == "private-git" {
        let url = url.ok_or_else(|| "URL is required for Git repositories".to_string())?;

        let repo = db::repository::Repository::create(
            &pool, name, Some(url), path, source_type, local_path_str, "pending",
        ).await.map_err(|e| e.to_string())?;

        match git::clone_repository(
            url, local_path_str,
            branch.unwrap_or("main"),
            auth_type.unwrap_or("none"),
            auth_config.unwrap_or("{}"),
        ).await {
            Ok(_) => {
                repo.update(&pool, None, None, None, None, None, Some("synced"), None).await.map_err(|e| e.to_string())?;
            }
            Err(e) => {
                repo.update(&pool, None, None, None, None, None, Some("error"), Some(&e.to_string())).await.map_err(|e| e.to_string())?;
                return Err(e.to_string());
            }
        }

        Ok(repo)
    } else if source_type == "local" {
        let source_path = Path::new(path);

        if !source_path.exists() {
            return Err(format!("Source path does not exist: {}", path));
        }
        if !source_path.is_dir() {
            return Err(format!("Source path is not a directory: {}", path));
        }
        if local_path.exists() {
            return Err(format!("Repository already exists at: {}", local_path_str));
        }

        let repo = db::repository::Repository::create(
            &pool, name, None, path, source_type, local_path_str, "pending",
        ).await.map_err(|e| e.to_string())?;

        fn copy_dir(source: &Path, target: &Path) -> Result<(), String> {
            fs::create_dir_all(target).map_err(|e| format!("Failed to create directory: {}", e))?;
            for entry in fs::read_dir(source).map_err(|e| format!("Failed to read source directory: {}", e))? {
                let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
                let entry_path = entry.path();
                let target_entry_path = target.join(entry.file_name());
                if entry_path.is_dir() {
                    copy_dir(&entry_path, &target_entry_path)?;
                } else {
                    fs::copy(&entry_path, &target_entry_path).map_err(|e| format!("Failed to copy file: {}", e))?;
                }
            }
            Ok(())
        }

        let copy = copy.unwrap_or(false);
        let result = if copy {
            copy_dir(source_path, &local_path)
        } else {
            #[cfg(unix)]
            {
                std::os::unix::fs::symlink(source_path, &local_path)
                    .map_err(|e| format!("Failed to create symbolic link: {}", e))
            }
            #[cfg(windows)]
            {
                std::os::windows::fs::symlink_dir(source_path, &local_path)
                    .map_err(|e| format!("Failed to create symbolic link: {}", e))
            }
        };

        match result {
            Ok(_) => {
                repo.update(&pool, None, None, None, None, None, Some("synced"), None).await.map_err(|e| e.to_string())?;
                Ok(repo)
            }
            Err(e) => {
                repo.update(&pool, None, None, None, None, None, Some("error"), Some(&e)).await.map_err(|e| e.to_string())?;
                Err(e)
            }
        }
    } else {
        Err("Invalid source type".to_string())
    }
}

#[tauri::command]
async fn list_repositories(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Vec<db::repository::Repository>, String> {
    db::repository::Repository::get_all(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_repository(
    id: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Option<db::repository::Repository>, String> {
    db::repository::Repository::get_by_id(&pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_repository(
    id: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<(), String> {
    let repo = db::repository::Repository::get_by_id(&pool, id)
        .await.map_err(|e| e.to_string())?;
    if let Some(repo) = repo {
        repo.delete(&pool).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn sync_repository(
    id: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<db::repository::Repository, String> {
    let repo = db::repository::Repository::get_by_id(&pool, id)
        .await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Repository not found".to_string())?;

    if repo.source_type != "local" && repo.url.is_some() {
        repo.update(&pool, None, None, None, None, None, Some("syncing"), None).await.map_err(|e| e.to_string())?;
        match git::sync_repository(&repo).await {
            Ok(_) => {
                repo.update(&pool, None, None, None, None, None, Some("synced"), None).await.map_err(|e| e.to_string())?;
            }
            Err(e) => {
                repo.update(&pool, None, None, None, None, None, Some("error"), Some(&e.to_string())).await.map_err(|e| e.to_string())?;
                return Err(e.to_string());
            }
        }
    }

    Ok(repo)
}

#[tauri::command]
async fn sync_all_repositories(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Vec<db::repository::Repository>, String> {
    let repos = db::repository::Repository::get_all(&pool).await.map_err(|e| e.to_string())?;
    let mut updated_repos = Vec::new();

    for repo in repos {
        if repo.source_type != "local" && repo.url.is_some() {
            let _ = repo.update(&pool, None, None, None, None, None, Some("syncing"), None).await;
            match git::sync_repository(&repo).await {
                Ok(_) => {
                    let _ = repo.update(&pool, None, None, None, None, None, Some("synced"), None).await;
                }
                Err(e) => {
                    let _ = repo.update(&pool, None, None, None, None, None, Some("error"), Some(&e.to_string())).await;
                }
            }
        }
        updated_repos.push(repo);
    }

    Ok(updated_repos)
}

#[tauri::command]
async fn get_repository_skill_counts(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<std::collections::HashMap<String, i64>, String> {
    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT repository_id, COUNT(*) as count FROM skills WHERE repository_id IS NOT NULL GROUP BY repository_id"
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().collect())
}

// ------------------------------
// Dispatch Template Commands
// ------------------------------

#[tauri::command]
async fn create_dispatch_template(
    name: &str,
    description: Option<&str>,
    skill_ids: Vec<String>,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<DispatchTemplate, String> {
    let input = CreateDispatchTemplateInput {
        name: name.to_string(),
        description: description.map(|s| s.to_string()),
        skill_ids,
    };
    DispatchTemplate::create(&pool, input).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_dispatch_templates(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Vec<DispatchTemplate>, String> {
    DispatchTemplate::get_all(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_dispatch_template(
    id: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Option<DispatchTemplate>, String> {
    DispatchTemplate::get_by_id(&pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_dispatch_template(
    id: &str,
    name: Option<&str>,
    description: Option<&str>,
    skill_ids: Option<Vec<String>>,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Option<DispatchTemplate>, String> {
    let input = UpdateDispatchTemplateInput {
        name: name.map(|s| s.to_string()),
        description: description.map(|s| s.to_string()),
        skill_ids,
    };
    DispatchTemplate::update(&pool, id, input).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_dispatch_template(
    id: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<bool, String> {
    DispatchTemplate::delete(&pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn dispatch_template(
    template_id: &str,
    target_dir: &str,
    method: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<dispatch::BulkDispatchResult, String> {
    let template = DispatchTemplate::get_by_id(&pool, template_id)
        .await.map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Template with id {} not found", template_id))?;

    let dispatch_method = match method {
        "symlink" => DispatchMethod::Symlink,
        "copy" => DispatchMethod::Copy,
        "hardlink" => DispatchMethod::Hardlink,
        _ => return Err(format!("Invalid dispatch method: {}", method)),
    };

    let skill_ids = template.skill_ids_vec()
        .map_err(|e| format!("Failed to parse skill IDs from template: {}", e))?;

    dispatch::bulk_dispatch(skill_ids, target_dir, dispatch_method, pool).await
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let db_path = db::resolve_db_path(&app.handle());
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            let db_url = format!("sqlite:{}?mode=rwc", db_path.to_string_lossy());
            let pool = tauri::async_runtime::block_on(async move {
                sqlx::sqlite::SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect(&db_url)
                    .await
            })?;

            app.manage(pool.clone());

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::init_db(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            // Config
            get_config,
            set_config,
            delete_config,
            // Base path
            config::base_path::get_base_path_command,
            config::base_path::set_base_path_command,
            config::base_path::init_base_directory_command,
            config::base_path::migrate_base_directory_command,
            // LLM Providers
            list_llm_providers,
            save_llm_providers,
            fetch_llm_models,
            // Git
            detect_git_path,
            get_git_executable_path,
            set_git_executable_path,
            // Repositories
            add_repository,
            list_repositories,
            get_repository,
            delete_repository,
            sync_repository,
            sync_all_repositories,
            get_repository_skill_counts,
            // Skills
            skills::discovery::discover_skills,
            skills::crud::list_skills,
            skills::crud::update_skill_command,
            skills::crud::delete_skill_command,
            skills::analyzer::analyze_skill,
            // Dispatch
            dispatch::add_target_dir,
            dispatch::list_target_dirs,
            dispatch::delete_target_dir,
            dispatch::dispatch_skill,
            dispatch::list_dispatches,
            dispatch::check_dispatch_sync,
            dispatch::sync_dispatched_skill,
            dispatch::bulk_dispatch,
            // Templates
            create_dispatch_template,
            list_dispatch_templates,
            get_dispatch_template,
            update_dispatch_template,
            delete_dispatch_template,
            dispatch_template,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
