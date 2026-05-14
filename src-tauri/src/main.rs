// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod db;
mod config;
mod git;
mod skills;
mod llm;
mod dispatch;

use std::path::Path;
use std::fs;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
            config::base_path::get_base_path_command,
            config::base_path::set_base_path_command,
            config::base_path::init_base_directory_command,
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
            dispatch::delete_target_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
