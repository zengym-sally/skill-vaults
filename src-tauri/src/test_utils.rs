//! Test utilities for SkillVault backend
//!
//! This module provides common utilities for testing, including:
//! - In-memory SQLite database setup
//! - Mock objects
//! - Test environment configuration

use sqlx::{Executor, Row, SqlitePool};
use std::env;
use crate::db;

/// Create an in-memory SQLite database for testing
///
/// This function creates a new in-memory SQLite database, runs the schema
/// initialization, and returns the connection pool. Each test gets its own
/// separate database instance.
pub async fn create_test_db() -> Result<SqlitePool, Box<dyn std::error::Error>> {
    // Create in-memory SQLite database
    let pool = SqlitePool::connect("sqlite::memory:").await?;
    
    // Run schema initialization
    pool.execute(db::schema::INIT_SQL).await?;
    
    Ok(pool)
}

/// Load test environment variables
///
/// This function loads environment variables from a .env.test file if it exists,
/// or uses default values for testing.
pub fn load_test_env() {
    // Try to load .env.test file
    let _ = dotenv::from_filename(".env.test");
    
    // Set default LLM configuration if not present
    if env::var("LLM_API_KEY").is_err() {
        env::set_var("LLM_API_KEY", "test-api-key");
    }
    if env::var("LLM_BASE_URL").is_err() {
        env::set_var("LLM_BASE_URL", "https://api.openai.com/v1");
    }
    if env::var("LLM_MODEL").is_err() {
        env::set_var("LLM_MODEL", "gpt-3.5-turbo");
    }
}

/// Test LLM configuration structure
#[derive(Debug, Clone)]
pub struct TestLLMConfig {
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: String,
}

impl Default for TestLLMConfig {
    fn default() -> Self {
        Self {
            api_key: "test-api-key".to_string(),
            base_url: Some("https://api.openai.com/v1".to_string()),
            model: "gpt-3.5-turbo".to_string(),
        }
    }
}

/// Get test LLM configuration from environment variables or defaults
pub fn get_test_llm_config() -> TestLLMConfig {
    TestLLMConfig {
        api_key: env::var("LLM_API_KEY").unwrap_or_else(|_| "test-api-key".to_string()),
        base_url: env::var("LLM_BASE_URL").ok(),
        model: env::var("LLM_MODEL").unwrap_or_else(|_| "gpt-3.5-turbo".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_create_test_db() {
        let pool = create_test_db().await.unwrap();
        
        // Test that we can execute a simple query
        let result = sqlx::query("SELECT 1 + 1 as sum")
            .fetch_one(&pool)
            .await
            .unwrap();
            
        let sum: i32 = result.get("sum");
        assert_eq!(sum, 2);
    }
    
    #[test]
    fn test_load_test_env_sets_defaults() {
        // Verify load_test_env sets default values when vars are missing.
        // Note: parallel tests may set these vars, so we only check existence.
        load_test_env();

        assert!(env::var("LLM_API_KEY").is_ok());
        assert!(env::var("LLM_BASE_URL").is_ok());
        assert!(env::var("LLM_MODEL").is_ok());
    }
}
