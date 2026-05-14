use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Config {
    pub key: String,
    pub value: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Config {
    /// Set a config value (upsert)
    pub async fn set(
        pool: &SqlitePool,
        key: &str,
        value: &str,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let config = sqlx::query_as::<_, Config>(
            "INSERT INTO config (key, value) VALUES (?1, ?2) 
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = CURRENT_TIMESTAMP
             RETURNING *"
        )
        .bind(key)
        .bind(value)
        .fetch_one(pool)
        .await?;
        
        Ok(config)
    }
    
    /// Get a config value by key
    pub async fn get(pool: &SqlitePool, key: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
        let value = sqlx::query_scalar::<_, String>("SELECT value FROM config WHERE key = ?1")
            .bind(key)
            .fetch_optional(pool)
            .await?;
        Ok(value)
    }
    
    /// Delete a config entry
    pub async fn delete(pool: &SqlitePool, key: &str) -> Result<(), Box<dyn std::error::Error>> {
        sqlx::query("DELETE FROM config WHERE key = ?1")
            .bind(key)
            .execute(pool)
            .await?;
        Ok(())
    }
}
