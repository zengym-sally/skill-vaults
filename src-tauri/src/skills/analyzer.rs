use sqlx::SqlitePool;

use crate::db::skill::Skill;
use crate::llm::{LLMClient, LLMConfig, OpenAIClient, LLMProvider};

#[tauri::command]
pub async fn analyze_skill(
    skill_id: &str,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Skill, String> {
    let mut skill = Skill::get_by_id(pool.inner(), skill_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Skill with id {} not found", skill_id))?;

    let local_path = std::path::Path::new(&skill.local_path);
    let content = if local_path.is_dir() {
        let skill_md = local_path.join("SKILL.md");
        let index_path = local_path.join("index.md");
        let readme_path = local_path.join("README.md");
        if skill_md.exists() {
            std::fs::read_to_string(&skill_md)
                .map_err(|e| format!("Failed to read skill file: {}", e))?
        } else if index_path.exists() {
            std::fs::read_to_string(&index_path)
                .map_err(|e| format!("Failed to read skill file: {}", e))?
        } else if readme_path.exists() {
            std::fs::read_to_string(&readme_path)
                .map_err(|e| format!("Failed to read skill file: {}", e))?
        } else {
            return Err("Cannot analyze skill directory: no SKILL.md, index.md or README.md found".to_string());
        }
    } else {
        std::fs::read_to_string(local_path)
            .map_err(|e| format!("Failed to read skill file: {}", e))?
    };

    let provider = LLMProvider::get_default(pool.inner())
        .await?
        .ok_or_else(|| "No LLM provider configured. Please add a provider in Settings.".to_string())?;

    let llm_config = LLMConfig::from(&provider);
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
            &result.ai_summary,
            &result.usage_instructions,
            &serde_json::to_string(&result.tags).unwrap(),
            &serde_json::to_string(&result.dependencies).unwrap(),
            result.quality_score,
        )
        .await
        .map_err(|e| format!("Failed to update skill: {}", e))?;

    Ok(skill)
}
