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
        conditions.push("(skills.name LIKE ? OR skills.description LIKE ? OR skills.tags LIKE ?)");
        search_param = Some(format!("%{}%", search));
    }

    if options.r#type.is_some() {
        conditions.push("skills.type = ?");
        type_param = options.r#type.clone();
    }

    if options.status.is_some() {
        conditions.push("skills.status = ?");
        status_param = options.status.clone();
    }

    if options.source_type.is_some() {
        conditions.push("skills.source_type = ?");
        source_type_param = options.source_type.clone();
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" AND {}", conditions.join(" AND "))
    };

    let query = format!(
        "SELECT skills.*, \
         COALESCE(d.cnt, 0) as dispatch_count, \
         repositories.name as repository_name \
         FROM skills \
         LEFT JOIN (SELECT skill_id, COUNT(*) as cnt FROM dispatch GROUP BY skill_id) d ON d.skill_id = skills.id \
         LEFT JOIN repositories ON skills.repository_id = repositories.id \
         WHERE 1=1{} ORDER BY skills.name ASC",
        where_clause
    );

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
            ai_summary: row.try_get("ai_summary").unwrap_or(None),
            usage: row.get("usage"),
            tags,
            dependencies,
            llm_analyzed: row.get("llm_analyzed"),
            quality_score: row.get("quality_score"),
            status: row.get("status"),
            first_discovered_at: row.get("first_discovered_at"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            dispatch_count: row.try_get("dispatch_count").unwrap_or(0),
            repository_name: row.try_get("repository_name").unwrap_or(None),
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

/// Read skill file content for display in detail dialog
#[tauri::command]
pub async fn read_skill_file(
    skill_id: String,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<String, String> {
    let skill = crate::db::skill::get_skill_by_id(pool.inner(), &skill_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Skill with id {} not found", skill_id))?;

    let path = std::path::Path::new(&skill.local_path);
    if path.is_dir() {
        let readme_path = path.join("README.md");
        let target = if path.join("SKILL.md").exists() {
            path.join("SKILL.md")
        } else if path.join("index.md").exists() {
            path.join("index.md")
        } else if readme_path.exists() {
            readme_path
        } else {
            // List files in directory
            let entries: Vec<String> = std::fs::read_dir(path)
                .map_err(|e| format!("Failed to read skill directory: {}", e))?
                .filter_map(|e| e.ok())
                .map(|e| e.file_name().to_string_lossy().to_string())
                .collect();
            return Ok(format!("Skill directory contains:\n{}", entries.join("\n")));
        };
        std::fs::read_to_string(&target)
            .map_err(|e| format!("Failed to read skill file: {}", e))
    } else {
        std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read skill file: {}", e))
    }
}
