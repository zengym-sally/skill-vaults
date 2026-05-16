pub mod schema;
pub mod repository;
pub mod skill;
pub mod dispatch;
pub mod config;
pub mod dispatch_template;

use tauri::{AppHandle, Manager};
use sqlx::{SqlitePool, Executor};
use std::path::PathBuf;
use std::fs;

/// Bootstrap config stored in app data dir to resolve DB path
#[derive(serde::Serialize, serde::Deserialize)]
struct BootstrapConfig {
    version: u32,
    base_path: String,
}

fn get_app_data_dir(app_handle: &AppHandle) -> PathBuf {
    app_handle.path().data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn get_bootstrap_path(app_handle: &AppHandle) -> PathBuf {
    get_app_data_dir(app_handle).join(".skillvault").join("bootstrap.json")
}

pub fn get_legacy_db_path(app_handle: &AppHandle) -> PathBuf {
    get_app_data_dir(app_handle).join(".skillvault").join("vault.db")
}

/// Resolve the actual database path using bootstrap config
pub fn resolve_db_path(app_handle: &AppHandle) -> PathBuf {
    let bootstrap_path = get_bootstrap_path(app_handle);

    if let Ok(content) = fs::read_to_string(&bootstrap_path) {
        if let Ok(config) = serde_json::from_str::<BootstrapConfig>(&content) {
            let db_path = PathBuf::from(&config.base_path)
                .join(".skill-vaults")
                .join("vault.db");
            if db_path.parent().is_some() {
                return db_path;
            }
        }
    }

    get_legacy_db_path(app_handle)
}

/// Write bootstrap config to point to a base directory
pub fn write_bootstrap(app_handle: &AppHandle, base_path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let bootstrap_path = get_bootstrap_path(app_handle);
    if let Some(parent) = bootstrap_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let config = BootstrapConfig {
        version: 1,
        base_path: base_path.to_string(),
    };
    let content = serde_json::to_string_pretty(&config)?;
    fs::write(&bootstrap_path, content)?;
    Ok(())
}

/// Migrate legacy database to new location under base directory
async fn migrate_legacy_database(
    app_handle: &AppHandle,
    pool: &SqlitePool,
) -> Result<(), Box<dyn std::error::Error>> {
    let legacy_path = get_legacy_db_path(app_handle);
    if !legacy_path.exists() {
        return Ok(());
    }

    let base_path: Option<String> = sqlx::query_scalar("SELECT value FROM config WHERE key = 'base_path'")
        .fetch_optional(pool)
        .await?
        .flatten();

    let base_path = match base_path {
        Some(bp) => bp,
        None => return Ok(()),
    };

    let new_db_dir = PathBuf::from(&base_path).join(".skill-vaults");
    fs::create_dir_all(&new_db_dir)?;

    let new_db_path = new_db_dir.join("vault.db");

    if !new_db_path.exists() {
        fs::copy(&legacy_path, &new_db_path)?;

        let original_len = fs::metadata(&legacy_path)?.len();
        let copy_len = fs::metadata(&new_db_path)?.len();
        if original_len == copy_len {
            write_bootstrap(app_handle, &base_path)?;
        }
    } else {
        write_bootstrap(app_handle, &base_path)?;
    }

    Ok(())
}

/// Initialize database with schema and handle legacy migration
pub async fn init_db(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let pool = app_handle.state::<SqlitePool>();
    pool.execute(schema::INIT_SQL).await?;

    // Migrate: add skills_path column if missing
    let _ = sqlx::query(
        "ALTER TABLE repositories ADD COLUMN skills_path TEXT NOT NULL DEFAULT 'skills'"
    ).execute(pool.inner()).await;

    // Migrate: add ai_summary column to skills
    let _ = sqlx::query(
        "ALTER TABLE skills ADD COLUMN ai_summary TEXT"
    ).execute(pool.inner()).await;

    // Migrate: add skills_subdir column to target_dirs
    let _ = sqlx::query(
        "ALTER TABLE target_dirs ADD COLUMN skills_subdir TEXT NOT NULL DEFAULT ''"
    ).execute(pool.inner()).await;

    let bootstrap_path = get_bootstrap_path(app_handle);
    let legacy_path = get_legacy_db_path(app_handle);

    if !bootstrap_path.exists() && legacy_path.exists() {
        migrate_legacy_database(app_handle, pool.inner()).await?;
    }

    Ok(())
}
