use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Repository {
    pub id: String,
    pub name: String,
    pub url: Option<String>,
    pub path: String,
    pub source_type: String,
    pub local_path: String,
    pub auth_type: Option<String>,
    pub auth_config: Option<String>,
    pub branch: Option<String>,
    pub skills_path: String,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub last_checked_at: Option<DateTime<Utc>>,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Repository {
    /// Create a new repository
    pub async fn create(
        pool: &SqlitePool,
        name: &str,
        url: Option<&str>,
        path: &str,
        source_type: &str,
        local_path: &str,
        status: &str,
        skills_path: Option<&str>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let repo = sqlx::query_as::<_, Repository>(
            "INSERT INTO repositories (name, url, path, source_type, local_path, status, skills_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE(?7, 'skills'))
             RETURNING *"
        )
        .bind(name)
        .bind(url)
        .bind(path)
        .bind(source_type)
        .bind(local_path)
        .bind(status)
        .bind(skills_path)
        .fetch_one(pool)
        .await?;
        
        Ok(repo)
    }
    
    /// Get all repositories
    pub async fn get_all(pool: &SqlitePool) -> Result<Vec<Self>, Box<dyn std::error::Error>> {
        let repos = sqlx::query_as::<_, Repository>("SELECT * FROM repositories")
            .fetch_all(pool)
            .await?;
        Ok(repos)
    }
    
    /// Get repository by id
    pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>, Box<dyn std::error::Error>> {
        let repo = sqlx::query_as::<_, Repository>("SELECT * FROM repositories WHERE id = ?1")
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(repo)
    }
    
    /// Update repository
    pub async fn update(
        &self,
        pool: &SqlitePool,
        name: Option<&str>,
        url: Option<&str>,
        path: Option<&str>,
        source_type: Option<&str>,
        local_path: Option<&str>,
        status: Option<&str>,
        error_message: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        sqlx::query(
            "UPDATE repositories SET 
                name = COALESCE(?1, name), 
                url = COALESCE(?2, url), 
                path = COALESCE(?3, path),
                source_type = COALESCE(?4, source_type),
                local_path = COALESCE(?5, local_path),
                status = COALESCE(?6, status),
                error_message = COALESCE(?7, error_message),
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?8"
        )
        .bind(name)
        .bind(url)
        .bind(path)
        .bind(source_type)
        .bind(local_path)
        .bind(status)
        .bind(error_message)
        .bind(&self.id)
        .execute(pool)
        .await?;
        Ok(())
    }
    
    /// Delete repository
    pub async fn delete(&self, pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
        sqlx::query("DELETE FROM repositories WHERE id = ?1")
            .bind(&self.id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
