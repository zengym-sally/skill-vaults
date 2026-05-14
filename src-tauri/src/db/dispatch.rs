use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DispatchMethod {
    Symlink,
    Copy,
    Hardlink,
}

impl std::fmt::Display for DispatchMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DispatchMethod::Symlink => write!(f, "symlink"),
            DispatchMethod::Copy => write!(f, "copy"),
            DispatchMethod::Hardlink => write!(f, "hardlink"),
        }
    }
}

impl std::str::FromStr for DispatchMethod {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "symlink" => Ok(DispatchMethod::Symlink),
            "copy" => Ok(DispatchMethod::Copy),
            "hardlink" => Ok(DispatchMethod::Hardlink),
            _ => Err(format!("Invalid dispatch method: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SyncStatus {
    Synced,
    Outdated,
    Conflict,
    Error,
}

impl std::fmt::Display for SyncStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SyncStatus::Synced => write!(f, "synced"),
            SyncStatus::Outdated => write!(f, "outdated"),
            SyncStatus::Conflict => write!(f, "conflict"),
            SyncStatus::Error => write!(f, "error"),
        }
    }
}

impl std::str::FromStr for SyncStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "synced" => Ok(SyncStatus::Synced),
            "outdated" => Ok(SyncStatus::Outdated),
            "conflict" => Ok(SyncStatus::Conflict),
            "error" => Ok(SyncStatus::Error),
            _ => Err(format!("Invalid sync status: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dispatch {
    pub id: String,
    pub target_dir: String,
    pub skill_id: String,
    pub method: DispatchMethod,
    pub source_path: String,
    pub dest_path: String,
    pub dispatched_at: DateTime<Utc>,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub sync_status: SyncStatus,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Map a database row to a Dispatch struct
fn map_row_to_dispatch(row: &sqlx::sqlite::SqliteRow) -> Result<Dispatch> {
    let method_str: &str = row.get("method");
    let status_str: &str = row.get("sync_status");

    let method: DispatchMethod = method_str
        .parse()
        .map_err(|e: String| anyhow::anyhow!(e))?;
    let sync_status: SyncStatus = status_str
        .parse()
        .map_err(|e: String| anyhow::anyhow!(e))?;

    Ok(Dispatch {
        id: row.get("id"),
        target_dir: row.get("target_dir"),
        skill_id: row.get("skill_id"),
        method,
        source_path: row.get("source_path"),
        dest_path: row.get("dest_path"),
        dispatched_at: row.get("dispatched_at"),
        last_synced_at: row.get("last_synced_at"),
        sync_status,
        error_message: row.get("error_message"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

impl Dispatch {
    /// Create a new dispatch rule
    pub async fn create(
        pool: &SqlitePool,
        target_dir: String,
        skill_id: String,
        method: DispatchMethod,
        source_path: String,
        dest_path: String,
        sync_status: SyncStatus,
        error_message: Option<String>,
        last_synced_at: Option<DateTime<Utc>>,
    ) -> Result<Self> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO dispatch (
                id, target_dir, skill_id, method, source_path, dest_path,
                dispatched_at, last_synced_at, sync_status, error_message,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&target_dir)
        .bind(&skill_id)
        .bind(method.to_string())
        .bind(&source_path)
        .bind(&dest_path)
        .bind(now)
        .bind(last_synced_at)
        .bind(sync_status.to_string())
        .bind(&error_message)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        // Fetch the created record
        let row = sqlx::query("SELECT * FROM dispatch WHERE id = ?")
            .bind(&id)
            .fetch_one(pool)
            .await?;

        map_row_to_dispatch(&row)
    }

    /// Get all dispatch rules
    pub async fn get_all(pool: &SqlitePool) -> Result<Vec<Self>> {
        let rows = sqlx::query("SELECT * FROM dispatch ORDER BY created_at DESC")
            .fetch_all(pool)
            .await?;

        rows.iter().map(|r| map_row_to_dispatch(r)).collect()
    }

    /// Get dispatch by id
    pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>> {
        let row = sqlx::query("SELECT * FROM dispatch WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;

        match row {
            Some(row) => Ok(Some(map_row_to_dispatch(&row)?)),
            None => Ok(None),
        }
    }

    /// Update dispatch rule
    pub async fn update(
        &self,
        pool: &SqlitePool,
        target_dir: Option<String>,
        skill_id: Option<String>,
        method: Option<DispatchMethod>,
        source_path: Option<String>,
        dest_path: Option<String>,
        last_synced_at: Option<DateTime<Utc>>,
        sync_status: Option<SyncStatus>,
        error_message: Option<Option<String>>,
    ) -> Result<Self> {
        let now = Utc::now();

        let target_dir = target_dir.as_ref().unwrap_or(&self.target_dir);
        let skill_id = skill_id.as_ref().unwrap_or(&self.skill_id);
        let method_str = method
            .map(|m| m.to_string())
            .unwrap_or_else(|| self.method.to_string());
        let source_path = source_path.as_ref().unwrap_or(&self.source_path);
        let dest_path = dest_path.as_ref().unwrap_or(&self.dest_path);
        let last_synced_at = last_synced_at.or(self.last_synced_at);
        let sync_status_str = sync_status
            .map(|s| s.to_string())
            .unwrap_or_else(|| self.sync_status.to_string());
        let error_message_val = error_message
            .unwrap_or_else(|| self.error_message.clone());
        let error_message_ref = error_message_val.as_deref();

        sqlx::query(
            r#"
            UPDATE dispatch
            SET
                target_dir = ?,
                skill_id = ?,
                method = ?,
                source_path = ?,
                dest_path = ?,
                last_synced_at = ?,
                sync_status = ?,
                error_message = ?,
                updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(target_dir)
        .bind(skill_id)
        .bind(&method_str)
        .bind(source_path)
        .bind(dest_path)
        .bind(last_synced_at)
        .bind(&sync_status_str)
        .bind(error_message_ref)
        .bind(now)
        .bind(&self.id)
        .execute(pool)
        .await?;

        let row = sqlx::query("SELECT * FROM dispatch WHERE id = ?")
            .bind(&self.id)
            .fetch_one(pool)
            .await?;

        map_row_to_dispatch(&row)
    }

}
