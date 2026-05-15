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
    skills_path: Option<&str>, // stored in DB, used by skill scanner
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
            &pool, name, Some(url), path, source_type, local_path_str, "syncing", skills_path,
            auth_type, auth_config, branch,
        ).await.map_err(|e| e.to_string())?;

        // Clone in background
        let repo_id = repo.id.clone();
        let pool_clone = pool.inner().clone();
        let url_owned = url.to_string();
        let branch_owned = branch.unwrap_or("main").to_string();
        let auth_type_owned = auth_type.unwrap_or("none").to_string();
        let auth_config_owned = auth_config.unwrap_or("{}").to_string();
        let lp_owned = local_path_str.to_string();
        tauri::async_runtime::spawn(async move {
            let result = git::clone_repository(
                &url_owned, &lp_owned, &branch_owned, &auth_type_owned, &auth_config_owned,
            ).await;
            match result {
                Ok(_) => {
                    if let Err(e) = sqlx::query("UPDATE repositories SET status = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?1")
                        .bind(&repo_id)
                        .execute(&pool_clone)
                        .await
                    {
                        eprintln!("Failed to update repo {} status: {}", repo_id, e);
                    }
                    if let Ok(Some(repo)) = db::repository::Repository::get_by_id(&pool_clone, &repo_id).await.map_err(|e| e.to_string()) {
                        if let Err(e) = skills::discovery::scan_repository(&pool_clone, &repo, false).await {
                            eprintln!("Failed to scan repo {} for skills: {}", repo_id, e);
                        }
                    }
                }
                Err(e) => {
                    if let Err(db_err) = sqlx::query("UPDATE repositories SET status = 'error', error_message = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
                        .bind(e.to_string())
                        .bind(&repo_id)
                        .execute(&pool_clone)
                        .await
                    {
                        eprintln!("Failed to update repo {} error status: {}", repo_id, db_err);
                    }
                }
            }
        });

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
            &pool, name, None, path, source_type, local_path_str, "syncing", skills_path,
            None, None, None,
        ).await.map_err(|e| e.to_string())?;

        // Copy/symlink in background
        let repo_id = repo.id.clone();
        let pool_clone = pool.inner().clone();
        let lp_owned = local_path_str.to_string();
        let src_owned = path.to_string();
        let should_copy = copy.unwrap_or(false);
        tauri::async_runtime::spawn(async move {
            let result = if should_copy {
                dispatch::copy::copy_dir(Path::new(&src_owned), Path::new(&lp_owned))
            } else {
                #[cfg(unix)]
                {
                    std::os::unix::fs::symlink(&src_owned, &lp_owned)
                        .map_err(|e| format!("Failed to create symbolic link: {}", e))
                }
                #[cfg(windows)]
                {
                    std::os::windows::fs::symlink_dir(&src_owned, &lp_owned)
                        .map_err(|e| format!("Failed to create symbolic link: {}", e))
                }
            };
            match result {
                Ok(_) => {
                    if let Err(e) = sqlx::query("UPDATE repositories SET status = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?1")
                        .bind(&repo_id)
                        .execute(&pool_clone)
                        .await
                    {
                        eprintln!("Failed to update repo {} status: {}", repo_id, e);
                    }
                    if let Ok(Some(repo)) = db::repository::Repository::get_by_id(&pool_clone, &repo_id).await.map_err(|e| e.to_string()) {
                        if let Err(e) = skills::discovery::scan_repository(&pool_clone, &repo, false).await {
                            eprintln!("Failed to scan repo {} for skills: {}", repo_id, e);
                        }
                    }
                }
                Err(e) => {
                    if let Err(db_err) = sqlx::query("UPDATE repositories SET status = 'error', error_message = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
                        .bind(e)
                        .bind(&repo_id)
                        .execute(&pool_clone)
                        .await
                    {
                        eprintln!("Failed to update repo {} error status: {}", repo_id, db_err);
                    }
                }
            }
        });

        Ok(repo)
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
async fn update_repository(
    id: &str,
    name: Option<&str>,
    skills_path: Option<&str>,
    url: Option<&str>,
    branch: Option<&str>,
    auth_type: Option<&str>,
    auth_config: Option<&str>,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<db::repository::Repository, String> {
    db::repository::Repository::get_by_id(&pool, id)
        .await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Repository not found".to_string())?;

    // Update basic fields
    if let Some(name) = name {
        sqlx::query("UPDATE repositories SET name = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(name).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(sp) = skills_path {
        sqlx::query("UPDATE repositories SET skills_path = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(sp).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(u) = url {
        sqlx::query("UPDATE repositories SET url = ?1, path = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(u).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(b) = branch {
        sqlx::query("UPDATE repositories SET branch = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(b).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(at) = auth_type {
        sqlx::query("UPDATE repositories SET auth_type = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(at).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(ac) = auth_config {
        sqlx::query("UPDATE repositories SET auth_config = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(ac).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }

    // Reload after updates
    let updated = db::repository::Repository::get_by_id(&pool, id)
        .await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Repository not found after update".to_string())?;

    Ok(updated)
}

#[tauri::command]
async fn sync_repository(
    id: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<db::repository::Repository, String> {
    let repo = db::repository::Repository::get_by_id(&pool, id)
        .await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Repository not found".to_string())?;

    // Set syncing status immediately
    repo.update(&pool, None, None, None, None, None, Some("syncing"), None).await.map_err(|e| e.to_string())?;

    let repo_id = repo.id.clone();
    let pool_clone = pool.inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let rt = tokio::runtime::Handle::current();
        rt.block_on(async {
            let result = async {
                let fresh_repo = db::repository::Repository::get_by_id(&pool_clone, &repo_id)
                    .await.map_err(|e| e.to_string())?
                    .ok_or_else(|| "Repository not found".to_string())?;

                if fresh_repo.source_type == "local" {
                    let source_path = std::path::Path::new(&fresh_repo.path);
                    let local_path = std::path::Path::new(&fresh_repo.local_path);
                    dispatch::copy::copy_dir(source_path, local_path)
                        .map_err(|e| e.to_string())?;
                } else if fresh_repo.url.is_some() {
                    let local_path = std::path::Path::new(&fresh_repo.local_path);
                    if !local_path.exists() {
                        let url = fresh_repo.url.as_deref().unwrap();
                        let branch = fresh_repo.branch.as_deref().unwrap_or("main");
                        let auth_type = fresh_repo.auth_type.as_deref().unwrap_or("none");
                        let auth_config = fresh_repo.auth_config.as_deref().unwrap_or("{}");
                        git::clone_repository(url, &fresh_repo.local_path, branch, auth_type, auth_config).await
                            .map_err(|e| e.to_string())?;
                    } else {
                        // Try pull first; if it fails (corrupted repo), delete and re-clone
                        let pull_result = git::sync_repository(&fresh_repo).await;
                        if let Err(_) = pull_result {
                            let _ = std::fs::remove_dir_all(&fresh_repo.local_path);
                            let url = fresh_repo.url.as_deref().unwrap();
                            let branch = fresh_repo.branch.as_deref().unwrap_or("main");
                            let auth_type = fresh_repo.auth_type.as_deref().unwrap_or("none");
                            let auth_config = fresh_repo.auth_config.as_deref().unwrap_or("{}");
                            git::clone_repository(url, &fresh_repo.local_path, branch, auth_type, auth_config).await
                                .map_err(|e| e.to_string())?;
                        }
                    }
                }

                Ok::<(), String>(())
            }.await;

            match result {
                Ok(_) => {
                    let _ = sqlx::query("UPDATE repositories SET status = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?1")
                        .bind(&repo_id)
                        .execute(&pool_clone)
                        .await;
                    if let Ok(Some(r)) = db::repository::Repository::get_by_id(&pool_clone, &repo_id).await {
                        let _ = skills::discovery::scan_repository(&pool_clone, &r, false).await;
                    }
                }
                Err(e) => {
                    let _ = sqlx::query("UPDATE repositories SET status = 'error', error_message = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
                        .bind(&e)
                        .bind(&repo_id)
                        .execute(&pool_clone)
                        .await;
                }
            }
        });
    });

    // Return immediately with syncing status
    db::repository::Repository::get_by_id(&pool, id)
        .await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Repository not found after sync".to_string())
}

#[tauri::command]
async fn sync_all_repositories(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Vec<db::repository::Repository>, String> {
    let repos = db::repository::Repository::get_all(&pool).await.map_err(|e| e.to_string())?;

    for repo in &repos {
        if repo.source_type != "local" && repo.url.is_some() {
            let _ = repo.update(&pool, None, None, None, None, None, Some("syncing"), None).await;

            let repo_id = repo.id.clone();
            let pool_clone = pool.inner().clone();

            tauri::async_runtime::spawn_blocking(move || {
                let rt = tokio::runtime::Handle::current();
                rt.block_on(async {
                    let fresh_repo = match db::repository::Repository::get_by_id(&pool_clone, &repo_id).await {
                        Ok(Some(r)) => r,
                        _ => return,
                    };
                    let local_path = std::path::Path::new(&fresh_repo.local_path);
                    let result = if !local_path.exists() {
                        let url = fresh_repo.url.as_deref().unwrap();
                        let branch = fresh_repo.branch.as_deref().unwrap_or("main");
                        let auth_type = fresh_repo.auth_type.as_deref().unwrap_or("none");
                        let auth_config = fresh_repo.auth_config.as_deref().unwrap_or("{}");
                        git::clone_repository(url, &fresh_repo.local_path, branch, auth_type, auth_config).await
                    } else {
                        // Try pull; on failure, delete and re-clone
                        match git::sync_repository(&fresh_repo).await {
                            Ok(()) => Ok(()),
                            Err(_) => {
                                let _ = std::fs::remove_dir_all(&fresh_repo.local_path);
                                let url = fresh_repo.url.as_deref().unwrap();
                                let branch = fresh_repo.branch.as_deref().unwrap_or("main");
                                let auth_type = fresh_repo.auth_type.as_deref().unwrap_or("none");
                                let auth_config = fresh_repo.auth_config.as_deref().unwrap_or("{}");
                                git::clone_repository(url, &fresh_repo.local_path, branch, auth_type, auth_config).await
                            }
                        }
                    };
                    match result {
                        Ok(_) => {
                            let _ = sqlx::query("UPDATE repositories SET status = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?1")
                                .bind(&repo_id)
                                .execute(&pool_clone)
                                .await;
                            if let Ok(Some(r)) = db::repository::Repository::get_by_id(&pool_clone, &repo_id).await {
                                let _ = skills::discovery::scan_repository(&pool_clone, &r, false).await;
                            }
                        }
                        Err(e) => {
                            let _ = sqlx::query("UPDATE repositories SET status = 'error', error_message = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
                                .bind(e.to_string())
                                .bind(&repo_id)
                                .execute(&pool_clone)
                                .await;
                        }
                    }
                });
            });
        }
    }

    // Return all repos with their current statuses
    db::repository::Repository::get_all(&pool).await.map_err(|e| e.to_string())
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
            update_repository,
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
            dispatch::delete_dispatch,
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
