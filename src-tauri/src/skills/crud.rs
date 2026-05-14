use anyhow::Result;
use sqlx::SqlitePool;

use crate::db::skill::{Skill, UpdateSkill};

/// List skills with optional filtering
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSkillsOptions {
    /// Search term to filter by name, description, or tags
    pub search: Option<String>,
    /// Filter by skill type
    pub r#type: Option<String>,
    /// Filter by status
    pub status: Option<String>,
    /// Filter by source type
    pub source_type: Option<String>,
}

/// List skills with optional filtering
#[tauri::command]
pub async fn list_skills(
    options: Option<ListSkillsOptions>,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Vec<Skill>, String> {
    let options = options.unwrap_or(ListSkillsOptions {
        search: None,
        r#type: None,
        status: None,
        source_type: None,
    });

    // Start with base query
    let mut query = "SELECT * FROM skills WHERE 1=1".to_string();
    let mut params: Vec<&dyn sqlx::Encode<'_, sqlx::Sqlite>> = Vec::new();

    // Add filters
    if let Some(search) = &options.search {
        query.push_str(" AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)");
        let search_pattern = format!("%{}%", search);
        params.push(&search_pattern);
        params.push(&search_pattern);
        params.push(&search_pattern);
    }

    if let Some(skill_type) = &options.r#type {
        query.push_str(" AND type = ?");
        params.push(skill_type);
    }

    if let Some(status) = &options.status {
        query.push_str(" AND status = ?");
        params.push(status);
    }

    if let Some(source_type) = &options.source_type {
        query.push_str(" AND source_type = ?");
        params.push(source_type);
    }

    query.push_str(" ORDER BY name ASC");

    // Execute query
    let mut query_builder = sqlx::query(&query);
    for param in params {
        query_builder = query_builder.bind(param);
    }

    let rows = query_builder
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    let mut skills = Vec::with_capacity(rows.len());
    for row in rows {
        let tags: Vec<String> = serde_json::from_str(row.get::<&str, _>("tags"))
            .map_err(|e| format!("Failed to parse tags: {}", e))?;
        let dependencies: Vec<String> = serde_json::from_str(row.get::<&str, _>("dependencies"))
            .map_err(|e| format!("Failed to parse dependencies: {}", e))?;

        skills.push(Skill {
            id: row.get("id"),
            name: row.get("name"),
            r#type: row.get("type"),
            source_type: row.get("source_type"),
            repository_id: row.get("repository_id"),
            local_path: row.get("local_path"),
            description: row.get("description"),
            usage: row.get("usage"),
            tags,
            dependencies,
            llm_analyzed: row.get("llm_analyzed"),
            quality_score: row.get("quality_score"),
            status: row.get("status"),
            first_discovered_at: row.get("first_discovered_at"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        });
    }

    Ok(skills)
}

/// Update a skill
#[tauri::command]
pub async fn update_skill_command(
    id: &str,
    update: UpdateSkill,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Option<Skill>, String> {
    crate::db::skill::update_skill(pool.inner(), id, update)
        .await
        .map_err(|e| e.to_string())
}

/// Delete a skill
#[tauri::command]
pub async fn delete_skill_command(
    id: &str,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<bool, String> {
    crate::db::skill::delete_skill(pool.inner(), id)
        .await
        .map_err(|e| e.to_string())
}
