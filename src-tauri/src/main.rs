// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod db;
mod config;
mod git;
mod skills;
mod llm;
mod dispatch;

use crate::db::dispatch_template::{DispatchTemplate, CreateDispatchTemplateInput, UpdateDispatchTemplateInput};
use crate::dispatch::DispatchMethod;

// ------------------------------
// General Config Commands
// ------------------------------

/// Get a config value by key
#[tauri::command]
async fn get_config(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    key: &str,
) -> Result<Option<String>, String> {
    crate::db::config::Config::get(&pool, key)
        .await
        .map_err(|e| e.to_string())
}

/// Set a config value
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

/// Delete a config value
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
// LLM Config Commands
// ------------------------------

/// Get LLM configuration
#[tauri::command]
async fn get_llm_config(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<crate::llm::LLMConfig, String> {
    crate::llm::LLMConfig::from_db(&pool).await
}

/// Save LLM configuration
#[tauri::command]
async fn save_llm_config(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    api_key: &str,
    base_url: Option<&str>,
    model: &str,
) -> Result<(), String> {
    use crate::db::config::Config;
    
    // Save API key
    Config::set(&pool, "llm.openai.api_key", api_key)
        .await
        .map_err(|e| e.to_string())?;
    
    // Save base URL (if provided)
    if let Some(base_url) = base_url {
        Config::set(&pool, "llm.openai.base_url", base_url)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        // Delete if base URL is empty
        Config::delete(&pool, "llm.openai.base_url")
            .await
            .map_err(|e| e.to_string())?;
    }
    
    // Save model
    Config::set(&pool, "llm.openai.model", model)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// ------------------------------
// Git Config Commands
// ------------------------------

/// Get Git configuration
#[tauri::command]
async fn get_git_config(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<serde_json::Value, String> {
    use crate::db::config::Config;
    
    let username = Config::get(&pool, "git.global.username")
        .await
        .map_err(|e| e.to_string())?;
    
    let email = Config::get(&pool, "git.global.email")
        .await
        .map_err(|e| e.to_string())?;
    
    let ssh_key_path = Config::get(&pool, "git.global.ssh_key_path")
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "username": username,
        "email": email,
        "sshKeyPath": ssh_key_path
    }))
}

/// Save Git configuration
#[tauri::command]
async fn save_git_config(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    username: &str,
    email: &str,
    ssh_key_path: Option<&str>,
) -> Result<(), String> {
    use crate::db::config::Config;
    
    // Save username
    Config::set(&pool, "git.global.username", username)
        .await
        .map_err(|e| e.to_string())?;
    
    // Save email
    Config::set(&pool, "git.global.email", email)
        .await
        .map_err(|e| e.to_string())?;
    
    // Save SSH key path (if provided)
    if let Some(ssh_key_path) = ssh_key_path {
        if !ssh_key_path.is_empty() {
            Config::set(&pool, "git.global.ssh_key_path", ssh_key_path)
                .await
                .map_err(|e| e.to_string())?;
        } else {
            Config::delete(&pool, "git.global.ssh_key_path")
                .await
                .map_err(|e| e.to_string())?;
        }
    } else {
        Config::delete(&pool, "git.global.ssh_key_path")
            .await
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

// ------------------------------
// Sync Config Commands
// ------------------------------

/// Get Sync configuration
#[tauri::command]
async fn get_sync_config(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<serde_json::Value, String> {
    use crate::db::config::Config;
    
    let auto_sync_enabled = Config::get(&pool, "sync.auto_sync_enabled")
        .await
        .map_err(|e| e.to_string())?;
    
    let sync_interval = Config::get(&pool, "sync.sync_interval")
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "autoSyncEnabled": auto_sync_enabled.map(|v| v == "true").unwrap_or(false),
        "syncInterval": sync_interval.unwrap_or("daily".to_string())
    }))
}

/// Save Sync configuration
#[tauri::command]
async fn save_sync_config(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    auto_sync_enabled: bool,
    sync_interval: &str,
) -> Result<(), String> {
    use crate::db::config::Config;
    
    // Save auto sync enabled
    Config::set(&pool, "sync.auto_sync_enabled", &auto_sync_enabled.to_string())
        .await
        .map_err(|e| e.to_string())?;
    
    // Save sync interval
    Config::set(&pool, "sync.sync_interval", sync_interval)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// ------------------------------
// Dispatch Template Commands
// ------------------------------

/// Create a new dispatch template
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
    
    DispatchTemplate::create(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

/// Get all dispatch templates
#[tauri::command]
async fn list_dispatch_templates(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Vec<DispatchTemplate>, String> {
    DispatchTemplate::get_all(&pool)
        .await
        .map_err(|e| e.to_string())
}

/// Get a dispatch template by ID
#[tauri::command]
async fn get_dispatch_template(
    id: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Option<DispatchTemplate>, String> {
    DispatchTemplate::get_by_id(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

/// Update a dispatch template
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
    
    DispatchTemplate::update(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

/// Delete a dispatch template
#[tauri::command]
async fn delete_dispatch_template(
    id: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<bool, String> {
    DispatchTemplate::delete(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

/// Dispatch all skills in a template to a target directory
#[tauri::command]
async fn dispatch_template(
    template_id: &str,
    target_dir: &str,
    method: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<dispatch::BulkDispatchResult, String> {
    // Get the template
    let template = DispatchTemplate::get_by_id(&pool, template_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Template with id {} not found", template_id))?;
    
    // Parse dispatch method
    let dispatch_method = match method {
        "symlink" => DispatchMethod::Symlink,
        "copy" => DispatchMethod::Copy,
        "hardlink" => DispatchMethod::Hardlink,
        _ => return Err(format!("Invalid dispatch method: {}", method)),
    };
    
    // Get skill IDs from template
    let skill_ids = template.skill_ids_vec()
        .map_err(|e| format!("Failed to parse skill IDs from template: {}", e))?;
    
    // Use bulk dispatch to dispatch all skills
    dispatch::bulk_dispatch(skill_ids, target_dir, dispatch_method, pool).await
}

use std::path::Path;
use std::fs;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Export database backup
#[tauri::command]
fn export_db(app_handle: tauri::AppHandle) -> Result<String, String> {
    let db_path = crate::db::get_db_path(&app_handle);
    if !db_path.exists() {
        return Err("Database file not found".to_string());
    }
    Ok(db_path.to_string_lossy().to_string())
}

/// Import database backup
#[tauri::command]
fn import_db(app_handle: tauri::AppHandle, backup_path: &str) -> Result<(), String> {
    use std::fs;
    use std::path::Path;
    
    let backup_path = Path::new(backup_path);
    if !backup_path.exists() || !backup_path.is_file() {
        return Err("Invalid backup file".to_string());
    }
    
    let db_path = crate::db::get_db_path(&app_handle);
    
    // Copy backup file to overwrite current database
    fs::copy(backup_path, &db_path)
        .map_err(|e| format!("Failed to import database: {}", e))?;
    
    Ok(())
}

/// 添加仓库
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
    // 获取基础路径
    let base_path = config::base_path::get_base_path(&pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Base path not set, please configure it first".to_string())?;
    
    // 验证source_type
    match source_type {
        "github" | "private-git" | "local" => {},
        _ => return Err(format!("Invalid source type: {}, must be one of github, private-git, local", source_type)),
    }
    
    // 构建本地路径
    let base_path = Path::new(&base_path);
    let local_path = match source_type {
        "github" => base_path.join("github").join(name),
        "private-git" => base_path.join("private-git").join(name),
        "local" => base_path.join("local").join(name),
        _ => unreachable!(),
    };
    
    let local_path_str = local_path.to_str()
        .ok_or_else(|| "Invalid local path, contains non-UTF8 characters".to_string())?;
    
    // 处理Git类型仓库
    if source_type == "github" || source_type == "private-git" {
        let url = url.ok_or_else(|| "URL is required for Git repositories".to_string())?;
        
        // 创建仓库记录
        let mut repo = db::repository::Repository::create(
            &pool,
            name,
            Some(url),
            path,
            source_type,
            local_path_str,
            "pending",
        )
        .await
        .map_err(|e| e.to_string())?;
        
        // 执行克隆
        match git::clone_repository(
            url,
            local_path_str,
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
    } 
    // 处理本地类型仓库
    else if source_type == "local" {
        let source_path = Path::new(path);
        
        // 验证源路径
        if !source_path.exists() {
            return Err(format!("Source path does not exist: {}", path));
        }
        if !source_path.is_dir() {
            return Err(format!("Source path is not a directory: {}", path));
        }
        
        // 检查目标路径是否已存在
        if local_path.exists() {
            return Err(format!("Repository already exists at: {}", local_path_str));
        }
        
        // 创建仓库记录
        let mut repo = db::repository::Repository::create(
            &pool,
            name,
            None,
            path,
            source_type,
            local_path_str,
            "pending",
        )
        .await
        .map_err(|e| e.to_string())?;
        
        // 递归复制目录的辅助函数
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
        
        // 执行复制或符号链接
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

/// 获取所有仓库
#[tauri::command]
async fn list_repositories(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Vec<db::repository::Repository>, String> {
    db::repository::Repository::get_all(&pool)
        .await
        .map_err(|e| e.to_string())
}

/// 获取单个仓库
#[tauri::command]
async fn get_repository(
    id: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Option<db::repository::Repository>, String> {
    db::repository::Repository::get_by_id(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

/// 删除仓库
#[tauri::command]
async fn delete_repository(
    id: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<(), String> {
    let repo = db::repository::Repository::get_by_id(&pool, id)
        .await
        .map_err(|e| e.to_string())?;
    
    if let Some(repo) = repo {
        repo.delete(&pool).await.map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

/// 同步单个仓库
#[tauri::command]
async fn sync_repository(
    id: &str,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<db::repository::Repository, String> {
    let mut repo = db::repository::Repository::get_by_id(&pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Repository not found".to_string())?;
    
    if repo.source_type == "git" && repo.url.is_some() {
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

/// 同步所有仓库
#[tauri::command]
async fn sync_all_repositories(
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Vec<db::repository::Repository>, String> {
    let repos = db::repository::Repository::get_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let mut updated_repos = Vec::new();
    
    for mut repo in repos {
        if repo.source_type == "git" && repo.url.is_some() {
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Create database parent directory if not exists
            let db_path = db::get_db_path(&app.handle());
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            
            // Initialize SQLite pool
            let db_url = format!("sqlite://{}", db_path.to_string_lossy());
            let pool = tauri::async_runtime::block_on(async move {
                sqlx::sqlite::SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect(&db_url)
                    .await
            })?;
            
            // Add pool to app state
            app.manage(pool.clone());
            
            // Initialize database schema
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
            export_db,
            import_db,
            config::base_path::get_base_path_command,
            config::base_path::set_base_path_command,
            config::base_path::init_base_directory_command,
            get_config,
            set_config,
            delete_config,
            get_llm_config,
            save_llm_config,
            get_git_config,
            save_git_config,
            get_sync_config,
            save_sync_config,
            add_repository,
            list_repositories,
            get_repository,
            delete_repository,
            sync_repository,
            sync_all_repositories,
            skills::discovery::discover_skills,
            skills::crud::list_skills,
            skills::crud::update_skill_command,
            skills::crud::delete_skill_command,
            skills::analyzer::analyze_skill,
            dispatch::add_target_dir,
            dispatch::list_target_dirs,
            dispatch::delete_target_dir,
            dispatch::dispatch_skill,
            dispatch::list_dispatches,
            dispatch::check_dispatch_sync,
            dispatch::sync_dispatched_skill,
            dispatch::bulk_dispatch,
            create_dispatch_template,
            list_dispatch_templates,
            get_dispatch_template,
            update_dispatch_template,
            delete_dispatch_template,
            dispatch_template
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
