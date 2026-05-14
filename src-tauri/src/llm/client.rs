use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::db::config::Config;

#[cfg_attr(test, mockall::automock)]
pub trait LLMClient {
    async fn analyze_skill(
        &self,
        skill_content: &str,
        model: &str,
    ) -> Result<SkillAnalysisResult, String>;
}

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

pub struct OpenAIClient {
    client: reqwest::Client,
    api_key: String,
    base_url: String,
}

impl OpenAIClient {
    pub fn new(config: &LLMConfig) -> Self {
        let base_url = config
            .base_url
            .clone()
            .unwrap_or_else(|| "https://api.openai.com/v1".to_string());

        Self {
            client: reqwest::Client::new(),
            api_key: config.api_key.clone(),
            base_url,
        }
    }

    #[cfg(test)]
    pub fn api_base(&self) -> &str {
        &self.base_url
    }
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

// Internal types for OpenAI API serialization
#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
}

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ResponseFormat {
    r#type: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChoiceMessage,
}

#[derive(Deserialize)]
struct ChoiceMessage {
    content: Option<String>,
}

impl LLMClient for OpenAIClient {
    async fn analyze_skill(
        &self,
        skill_content: &str,
        model: &str,
    ) -> Result<SkillAnalysisResult, String> {
        let prompt = crate::llm::prompts::skill_analysis_prompt(skill_content);

        let request = ChatRequest {
            model: model.to_string(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "You are a skill analyzer. Extract structured information from skill content.".to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: prompt,
                },
            ],
            temperature: 0.2,
            response_format: Some(ResponseFormat {
                r#type: "json_object".to_string(),
            }),
        };

        let url = format!(
            "{}/chat/completions",
            self.base_url.trim_end_matches('/')
        );

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("API request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API request failed with status {}: {}", status, body));
        }

        let chat_response: ChatResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse API response: {}", e))?;

        let content = chat_response
            .choices
            .first()
            .ok_or_else(|| "No response from API".to_string())?
            .message
            .content
            .as_ref()
            .ok_or_else(|| "Empty response content".to_string())?;

        let result: SkillAnalysisResult = serde_json::from_str(content)
            .map_err(|e| format!("Failed to parse LLM response: {}", e))?;

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;

    #[tokio::test]
    async fn test_llm_config_creation() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();

        sqlx::query("CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            .execute(&pool)
            .await
            .unwrap();

        sqlx::query("INSERT INTO config (key, value) VALUES (?, ?)")
            .bind("llm.openai.api_key")
            .bind("test_api_key_123")
            .execute(&pool)
            .await
            .unwrap();

        sqlx::query("INSERT INTO config (key, value) VALUES (?, ?)")
            .bind("llm.openai.base_url")
            .bind("https://api.openai.com/v1")
            .execute(&pool)
            .await
            .unwrap();

        sqlx::query("INSERT INTO config (key, value) VALUES (?, ?)")
            .bind("llm.openai.model")
            .bind("gpt-4o-mini")
            .execute(&pool)
            .await
            .unwrap();

        let config = LLMConfig::from_db(&pool).await.unwrap();

        assert_eq!(config.api_key, "test_api_key_123");
        assert_eq!(
            config.base_url,
            Some("https://api.openai.com/v1".to_string())
        );
        assert_eq!(config.model, "gpt-4o-mini");
    }

    #[tokio::test]
    async fn test_llm_config_missing_api_key() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query("CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            .execute(&pool)
            .await
            .unwrap();

        let result = LLMConfig::from_db(&pool).await;
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), "OpenAI API Key not configured");
    }

    #[tokio::test]
    async fn test_llm_config_default_model() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query("CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            .execute(&pool)
            .await
            .unwrap();

        sqlx::query("INSERT INTO config (key, value) VALUES (?, ?)")
            .bind("llm.openai.api_key")
            .bind("test_api_key_123")
            .execute(&pool)
            .await
            .unwrap();

        let config = LLMConfig::from_db(&pool).await.unwrap();
        assert_eq!(config.model, "gpt-4o");
    }

    #[test]
    fn test_create_client_with_base_url() {
        let config = LLMConfig {
            api_key: "test_key".to_string(),
            base_url: Some("https://custom.api.com/v1".to_string()),
            model: "gpt-4o".to_string(),
        };

        let client = OpenAIClient::new(&config);
        assert!(client.api_base().contains("https://custom.api.com/v1"));
    }

    #[test]
    fn test_create_client_without_base_url() {
        let config = LLMConfig {
            api_key: "test_key".to_string(),
            base_url: None,
            model: "gpt-4o".to_string(),
        };

        let client = OpenAIClient::new(&config);
        assert_eq!(client.api_base(), "https://api.openai.com/v1");
    }

    // Mock tests for LLMClient trait
    #[tokio::test]
    async fn test_analyze_skill_success() {
        let mut mock_client = MockLLMClient::new();

        let expected_result = SkillAnalysisResult {
            skill_type: "automation".to_string(),
            description: "Test skill for automation".to_string(),
            usage_instructions: "Run with cargo test".to_string(),
            tags: vec!["test".to_string(), "automation".to_string()],
            dependencies: vec!["rust".to_string(), "tokio".to_string()],
            quality_score: 8,
        };

        let expected_result_clone = expected_result.clone();
        mock_client
            .expect_analyze_skill()
            .with(eq("test skill content"), eq("gpt-4o"))
            .return_once(move |_, _| Ok(expected_result_clone));

        let result = mock_client
            .analyze_skill("test skill content", "gpt-4o")
            .await
            .unwrap();

        assert_eq!(result.skill_type, expected_result.skill_type);
        assert_eq!(result.description, expected_result.description);
        assert_eq!(result.quality_score, expected_result.quality_score);
        assert_eq!(result.tags, expected_result.tags);
    }

    #[tokio::test]
    async fn test_analyze_skill_api_error() {
        let mut mock_client = MockLLMClient::new();

        mock_client
            .expect_analyze_skill()
            .return_once(|_, _| Err("API request failed: timeout".to_string()));

        let result = mock_client.analyze_skill("test content", "gpt-4o").await;

        assert!(result.is_err());
        assert_eq!(
            result.err().unwrap(),
            "API request failed: timeout"
        );
    }

    #[tokio::test]
    async fn test_analyze_skill_invalid_json_response() {
        let mut mock_client = MockLLMClient::new();

        mock_client.expect_analyze_skill().return_once(|_, _| {
            Err(
                "Failed to parse response: expected value at line 1 column 1"
                    .to_string(),
            )
        });

        let result = mock_client.analyze_skill("test content", "gpt-4o").await;

        assert!(result.is_err());
        assert!(result
            .err()
            .unwrap()
            .contains("Failed to parse response"));
    }

    #[tokio::test]
    async fn test_analyze_skill_empty_response() {
        let mut mock_client = MockLLMClient::new();

        mock_client
            .expect_analyze_skill()
            .return_once(|_, _| Err("Empty response content".to_string()));

        let result = mock_client.analyze_skill("test content", "gpt-4o").await;

        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), "Empty response content");
    }

    #[tokio::test]
    async fn test_analyze_skill_authentication_failure() {
        let mut mock_client = MockLLMClient::new();

        mock_client.expect_analyze_skill().return_once(|_, _| {
            Err("API request failed with status 401 Unauthorized".to_string())
        });

        let result = mock_client.analyze_skill("test content", "gpt-4o").await;

        assert!(result.is_err());
        assert!(result.err().unwrap().contains("401 Unauthorized"));
    }
}
