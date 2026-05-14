use openai::Client;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::config::models::Config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMConfig {
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: String,
}

impl LLMConfig {
    pub async fn from_db(pool: &SqlitePool) -> Result<Self, String> {
        let api_key = Config::get(pool, "llm.openai.api_key")
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "OpenAI API Key not configured".to_string())?;
        
        let base_url = Config::get(pool, "llm.openai.base_url")
            .await
            .map_err(|e| e.to_string())?;
        
        let model = Config::get(pool, "llm.openai.model")
            .await
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "gpt-4o".to_string());
        
        Ok(Self {
            api_key,
            base_url,
            model,
        })
    }
}

pub fn create_client(config: &LLMConfig) -> Client {
    let mut client = Client::new(&config.api_key);
    
    if let Some(base_url) = &config.base_url {
        client = client.with_api_base(base_url);
    }
    
    client
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillAnalysisResult {
    pub skill_type: String,
    pub description: String,
    pub usage_instructions: String,
    pub tags: Vec<String>,
    pub dependencies: Vec<String>,
    pub quality_score: i32,
}
