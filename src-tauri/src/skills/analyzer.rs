use openai::{
    chat::{ChatCompletion, ChatCompletionMessage, ChatCompletionMessageContent, ChatCompletionMessageRole},
    Client,
};
use sqlx::SqlitePool;

use crate::llm::{create_client, skill_analysis_prompt, LLMConfig, SkillAnalysisResult};
use crate::db::skill::Skill;

#[tauri::command]
pub async fn analyze_skill(
    skill_id: &str,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Skill, String> {
    let mut skill = Skill::get_by_id(pool.inner(), skill_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Skill with id {} not found", skill_id))?;
    
    let content = std::fs::read_to_string(&skill.file_path)
        .map_err(|e| format!("Failed to read skill file: {}", e))?;
    
    let llm_config = LLMConfig::from_db(&pool).await?;
    
    let client = create_client(&llm_config);
    
    let prompt = skill_analysis_prompt(&content);
    
    let response = client
        .chat()
        .completions()
        .create(
            ChatCompletion::builder(
                &llm_config.model,
                vec![ChatCompletionMessage {
                    role: ChatCompletionMessageRole::User,
                    content: Some(ChatCompletionMessageContent::Text(prompt)),
                    name: None,
                    tool_calls: None,
                    tool_call_id: None,
                }],
            )
            .temperature(0.2)
            .response_format(serde_json::json!({ "type": "json_object" }))
            .build()
            .unwrap(),
        )
        .await
        .map_err(|e| format!("OpenAI API call failed: {}", e))?;
    
    let result = response
        .choices
        .first()
        .ok_or_else(|| "No response from OpenAI API".to_string())?
        .message
        .content
        .as_ref()
        .and_then(|c| match c {
            ChatCompletionMessageContent::Text(t) => Some(t),
            _ => None,
        })
        .ok_or_else(|| "Empty response from OpenAI API".to_string())?;
    
    let analysis_result: SkillAnalysisResult = serde_json::from_str(result)
        .map_err(|e| format!("Failed to parse LLM response: {}", e))?;
    
    skill
        .update_analysis(
            &pool,
            &analysis_result.skill_type,
            &analysis_result.description,
            &analysis_result.usage_instructions,
            &serde_json::to_string(&analysis_result.tags).unwrap(),
            &serde_json::to_string(&analysis_result.dependencies).unwrap(),
            analysis_result.quality_score,
        )
        .await
        .map_err(|e| format!("Failed to update skill: {}", e))?;
    
    Ok(skill)
}
