use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::db::config::Config;

// --- LLM Provider (multi-provider support) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMProvider {
    pub id: String,
    pub name: String,
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub is_default: bool,
}

const PROVIDERS_CONFIG_KEY: &str = "llm.providers";

impl LLMProvider {
    /// Load all providers from DB
    pub async fn list_from_db(pool: &SqlitePool) -> Result<Vec<LLMProvider>, String> {
        // Try new format first
        if let Ok(Some(json)) = Config::get(pool, PROVIDERS_CONFIG_KEY).await {
            if let Ok(providers) = serde_json::from_str::<Vec<LLMProvider>>(&json) {
                return Ok(providers);
            }
        }

        // Backward compatibility: migrate old single-provider format
        let api_key = Config::get(pool, "llm.openai.api_key").await.map_err(|e| e.to_string())?;
        if let Some(api_key) = api_key {
            let base_url = Config::get(pool, "llm.openai.base_url").await
                .map_err(|e| e.to_string())?
                .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
            let model = Config::get(pool, "llm.openai.model").await
                .map_err(|e| e.to_string())?
                .unwrap_or_else(|| "gpt-4o".to_string());

            let provider = LLMProvider {
                id: uuid::Uuid::new_v4().to_string(),
                name: "OpenAI".to_string(),
                api_key,
                base_url,
                model,
                is_default: true,
            };

            let providers = vec![provider];
            // Save in new format
            Self::save_all(pool, &providers).await?;
            return Ok(providers);
        }

        Ok(vec![])
    }

    /// Save all providers to DB
    pub async fn save_all(pool: &SqlitePool, providers: &[LLMProvider]) -> Result<(), String> {
        let json = serde_json::to_string(providers).map_err(|e| e.to_string())?;
        Config::set(pool, PROVIDERS_CONFIG_KEY, &json).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Get the default provider (first default-marked, or first in list)
    pub async fn get_default(pool: &SqlitePool) -> Result<Option<LLMProvider>, String> {
        let providers = Self::list_from_db(pool).await?;
        let default = providers.iter().find(|p| p.is_default).cloned();
        Ok(default.or_else(|| providers.into_iter().next()))
    }
}

// --- Legacy LLMConfig for internal use ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMConfig {
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: String,
}

impl From<&LLMProvider> for LLMConfig {
    fn from(provider: &LLMProvider) -> Self {
        Self {
            api_key: provider.api_key.clone(),
            base_url: Some(provider.base_url.clone()),
            model: provider.model.clone(),
        }
    }
}

// --- LLM Model info for model fetching ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMModel {
    pub id: String,
    #[serde(rename = "owned_by", skip_serializing_if = "Option::is_none")]
    pub owned_by: Option<String>,
}

// --- OpenAI Client ---

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

/// Extract JSON content from LLM response, stripping markdown code blocks if present
fn extract_json(content: &str) -> String {
    let trimmed = content.trim();

    // Strip ```json ... ``` or ``` ... ``` wrapper
    if trimmed.starts_with("```") {
        let without_prefix = trimmed
            .strip_prefix("```json")
            .or_else(|| trimmed.strip_prefix("```"))
            .unwrap_or(trimmed);
        if let Some(stripped) = without_prefix.strip_suffix("```") {
            return stripped.trim().to_string();
        }
    }

    // Find first { to last } as fallback
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            if start < end {
                return trimmed[start..=end].to_string();
            }
        }
    }

    trimmed.to_string()
}

fn string_or_seq_string<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let val = serde_json::Value::deserialize(deserializer)?;
    match val {
        serde_json::Value::String(s) => Ok(s),
        serde_json::Value::Array(arr) => Ok(arr
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect::<Vec<_>>()
            .join("\n")),
        other => Err(serde::de::Error::custom(format!(
            "expected string or array, got {:?}",
            other
        ))),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillAnalysisResult {
    pub skill_type: String,
    pub description: String,
    #[serde(deserialize_with = "string_or_seq_string")]
    pub ai_summary: String,
    #[serde(deserialize_with = "string_or_seq_string")]
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

#[derive(Deserialize)]
struct ModelsResponse {
    data: Vec<ModelData>,
}

#[derive(Deserialize)]
struct ModelData {
    id: String,
    owned_by: Option<String>,
}

#[cfg_attr(test, mockall::automock)]
pub trait LLMClient {
    async fn analyze_skill(
        &self,
        skill_content: &str,
        model: &str,
    ) -> Result<SkillAnalysisResult, String>;
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

        // Extract JSON from possible markdown code blocks
        let json_str = extract_json(content);
        let result: SkillAnalysisResult = serde_json::from_str(&json_str)
            .map_err(|e| format!("Failed to parse LLM response: {}", e))?;

        Ok(result)
    }
}

/// Fetch available models from an OpenAI-compatible API endpoint
pub async fn fetch_models(base_url: &str, api_key: &str) -> Result<Vec<LLMModel>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Failed to fetch models ({}): {}", status, body));
    }

    let models_response: ModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse models response: {}", e))?;

    Ok(models_response
        .data
        .into_iter()
        .map(|m| LLMModel {
            id: m.id,
            owned_by: m.owned_by,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;

    #[tokio::test]
    async fn test_llm_config_creation() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();

        sqlx::query("CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)")
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

        let providers = LLMProvider::list_from_db(&pool).await.unwrap();
        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0].api_key, "test_api_key_123");
        assert_eq!(providers[0].base_url, "https://api.openai.com/v1");
        assert_eq!(providers[0].model, "gpt-4o-mini");
        assert!(providers[0].is_default);
    }

    #[tokio::test]
    async fn test_llm_config_missing_api_key() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query("CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)")
            .execute(&pool)
            .await
            .unwrap();

        let providers = LLMProvider::list_from_db(&pool).await.unwrap();
        assert!(providers.is_empty());
    }

    #[tokio::test]
    async fn test_llm_config_default_model() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query("CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)")
            .execute(&pool)
            .await
            .unwrap();

        sqlx::query("INSERT INTO config (key, value) VALUES (?, ?)")
            .bind("llm.openai.api_key")
            .bind("test_api_key_123")
            .execute(&pool)
            .await
            .unwrap();

        let providers = LLMProvider::list_from_db(&pool).await.unwrap();
        assert_eq!(providers[0].model, "gpt-4o");
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

    #[tokio::test]
    async fn test_analyze_skill_success() {
        let mut mock_client = MockLLMClient::new();

        let expected_result = SkillAnalysisResult {
            skill_type: "automation".to_string(),
            description: "Test skill for automation".to_string(),
            ai_summary: "自动化测试技能".to_string(),
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
