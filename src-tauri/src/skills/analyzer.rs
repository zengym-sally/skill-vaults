use sqlx::SqlitePool;

use crate::db::skill::Skill;
use crate::llm::{LLMClient, LLMConfig, OpenAIClient};

#[tauri::command]
pub async fn analyze_skill(
    skill_id: &str,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Skill, String> {
    let mut skill = Skill::get_by_id(pool.inner(), skill_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Skill with id {} not found", skill_id))?;

    let content = std::fs::read_to_string(&skill.local_path)
        .map_err(|e| format!("Failed to read skill file: {}", e))?;

    let llm_config = LLMConfig::from_db(&pool).await?;
    let client = OpenAIClient::new(&llm_config);

    let result = client
        .analyze_skill(&content, &llm_config.model)
        .await
        .map_err(|e| format!("OpenAI API call failed: {}", e))?;

    skill
        .update_analysis(
            pool.inner(),
            &result.skill_type,
            &result.description,
            &result.usage_instructions,
            &serde_json::to_string(&result.tags).unwrap(),
            &serde_json::to_string(&result.dependencies).unwrap(),
            result.quality_score,
        )
        .await
        .map_err(|e| format!("Failed to update skill: {}", e))?;

    Ok(skill)
}
