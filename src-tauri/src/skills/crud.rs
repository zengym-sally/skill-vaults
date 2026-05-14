use anyhow::Result;
use sqlx::{Row, SqlitePool};

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

    // Build query with filters using separate bind calls
    let mut conditions = Vec::new();
    let mut search_param: Option<String> = None;
    let mut type_param: Option<String> = None;
    let mut status_param: Option<String> = None;
    let mut source_type_param: Option<String> = None;

    if let Some(search) = &options.search {
        conditions.push("(name LIKE ? OR description LIKE ? OR tags LIKE ?)");
        search_param = Some(format!("%{}%", search));
    }

    if options.r#type.is_some() {
        conditions.push("type = ?");
        type_param = options.r#type.clone();
    }

    if options.status.is_some() {
        conditions.push("status = ?");
        status_param = options.status.clone();
    }

    if options.source_type.is_some() {
        conditions.push("source_type = ?");
        source_type_param = options.source_type.clone();
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" AND {}", conditions.join(" AND "))
    };

    let query = format!("SELECT * FROM skills WHERE 1=1{} ORDER BY name ASC", where_clause);

    // Bind parameters in order
    let mut query_builder = sqlx::query(&query);

    if let Some(ref search) = search_param {
        query_builder = query_builder.bind(search).bind(search).bind(search);
    }
    if let Some(ref t) = type_param {
        query_builder = query_builder.bind(t);
    }
    if let Some(ref s) = status_param {
        query_builder = query_builder.bind(s);
    }
    if let Some(ref st) = source_type_param {
        query_builder = query_builder.bind(st);
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
