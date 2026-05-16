use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::Row;
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub r#type: String,
    pub source_type: String,
    pub repository_id: Option<String>,
    pub local_path: String,
    pub description: Option<String>,
    pub ai_summary: Option<String>,
    pub usage: Option<String>,
    pub tags: Vec<String>,
    pub dependencies: Vec<String>,
    pub llm_analyzed: bool,
    pub quality_score: Option<i32>,
    pub status: String,
    pub first_discovered_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub dispatch_count: i32,
    #[serde(default)]
    pub repository_name: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSkill {
    pub name: String,
    #[serde(rename = "type")]
    pub r#type: String,
    pub source_type: String,
    pub repository_id: Option<String>,
    pub local_path: String,
    pub description: Option<String>,
    pub usage: Option<String>,
    pub tags: Vec<String>,
    pub dependencies: Vec<String>,
    pub llm_analyzed: Option<bool>,
    pub quality_score: Option<i32>,
    pub status: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSkill {
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub r#type: Option<String>,
    pub source_type: Option<String>,
    pub repository_id: Option<String>,
    pub local_path: Option<String>,
    pub description: Option<String>,
    pub ai_summary: Option<String>,
    pub usage: Option<String>,
    pub tags: Option<Vec<String>>,
    pub dependencies: Option<Vec<String>>,
    pub llm_analyzed: Option<bool>,
    pub quality_score: Option<i32>,
    pub status: Option<String>,
}

/// Map a database row to a Skill struct, handling JSON parsing for tags/dependencies
pub fn map_row_to_skill(row: &sqlx::sqlite::SqliteRow) -> Result<Skill> {
    let tags_str: Option<&str> = row.get("tags");
    let deps_str: Option<&str> = row.get("dependencies");

    let tags: Vec<String> = tags_str
        .map(serde_json::from_str)
        .transpose()?
        .unwrap_or_default();

    let dependencies: Vec<String> = deps_str
        .map(serde_json::from_str)
        .transpose()?
        .unwrap_or_default();

    Ok(Skill {
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
    })
}

#[cfg(test)]
/// Create a new skill
pub async fn create_skill(pool: &sqlx::SqlitePool, create: CreateSkill) -> Result<Skill> {
    let mut skills = bulk_create_skills(pool, vec![create]).await?;
    Ok(skills.remove(0))
}

/// Bulk create multiple skills (optimized for batch operations)
pub async fn bulk_create_skills(
    pool: &sqlx::SqlitePool,
    creates: Vec<CreateSkill>,
) -> Result<Vec<Skill>> {
    if creates.is_empty() {
        return Ok(Vec::new());
    }

    let now = Utc::now();
    let mut skills = Vec::with_capacity(creates.len());
    let mut query_builder = sqlx::QueryBuilder::new(
        "INSERT INTO skills (
            id, name, type, source_type, repository_id, local_path, description, usage,
            tags, dependencies, llm_analyzed, quality_score, status, first_discovered_at,
            created_at, updated_at
        ) ",
    );

    query_builder.push_values(creates.iter(), |mut b, create| {
        let id = Uuid::new_v4().to_string();
        let llm_analyzed = create.llm_analyzed.unwrap_or(false);
        let tags_json = serde_json::to_string(&create.tags).unwrap_or_default();
        let dependencies_json = serde_json::to_string(&create.dependencies).unwrap_or_default();

        skills.push(Skill {
            id: id.clone(),
            name: create.name.clone(),
            r#type: create.r#type.clone(),
            source_type: create.source_type.clone(),
            repository_id: create.repository_id.clone(),
            local_path: create.local_path.clone(),
            description: create.description.clone(),
            ai_summary: None,
            usage: create.usage.clone(),
            tags: create.tags.clone(),
            dependencies: create.dependencies.clone(),
            llm_analyzed,
            quality_score: create.quality_score,
            status: create.status.clone(),
            first_discovered_at: now,
            created_at: now,
            updated_at: now,
            dispatch_count: 0,
            repository_name: None,
        });

        b.push_bind(id)
            .push_bind(&create.name)
            .push_bind(&create.r#type)
            .push_bind(&create.source_type)
            .push_bind(&create.repository_id)
            .push_bind(&create.local_path)
            .push_bind(&create.description)
            .push_bind(&create.usage)
            .push_bind(tags_json)
            .push_bind(dependencies_json)
            .push_bind(llm_analyzed)
            .push_bind(&create.quality_score)
            .push_bind(&create.status)
            .push_bind(now)
            .push_bind(now)
            .push_bind(now);
    });

    query_builder.build().execute(pool).await?;

    Ok(skills)
}

/// Get a skill by ID
pub async fn get_skill_by_id(pool: &sqlx::SqlitePool, id: &str) -> Result<Option<Skill>> {
    let row = sqlx::query("SELECT * FROM skills WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;

    match row {
        Some(row) => Ok(Some(map_row_to_skill(&row)?)),
        None => Ok(None),
    }
}

#[cfg(test)]
/// Get all skills
pub async fn get_all_skills(pool: &sqlx::SqlitePool) -> Result<Vec<Skill>> {
    let rows = sqlx::query("SELECT * FROM skills")
        .fetch_all(pool)
        .await?;

    rows.iter().map(|r| map_row_to_skill(r)).collect()
}

/// Update a skill
pub async fn update_skill(
    pool: &sqlx::SqlitePool,
    id: &str,
    update: UpdateSkill,
) -> Result<Option<Skill>> {
    let tags_json = update
        .tags
        .as_ref()
        .map(|t| serde_json::to_string(t))
        .transpose()?;
    let dependencies_json = update
        .dependencies
        .as_ref()
        .map(|d| serde_json::to_string(d))
        .transpose()?;

    sqlx::query(
        r#"
        UPDATE skills
        SET
            name = COALESCE(?, name),
            type = COALESCE(?, type),
            source_type = COALESCE(?, source_type),
            repository_id = COALESCE(?, repository_id),
            local_path = COALESCE(?, local_path),
            description = COALESCE(?, description),
            ai_summary = COALESCE(?, ai_summary),
            usage = COALESCE(?, usage),
            tags = COALESCE(?, tags),
            dependencies = COALESCE(?, dependencies),
            llm_analyzed = COALESCE(?, llm_analyzed),
            quality_score = COALESCE(?, quality_score),
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#,
    )
    .bind(&update.name)
    .bind(&update.r#type)
    .bind(&update.source_type)
    .bind(&update.repository_id)
    .bind(&update.local_path)
    .bind(&update.description)
    .bind(&update.ai_summary)
    .bind(&update.usage)
    .bind(tags_json)
    .bind(dependencies_json)
    .bind(update.llm_analyzed)
    .bind(update.quality_score)
    .bind(&update.status)
    .bind(id)
    .execute(pool)
    .await?;

    get_skill_by_id(pool, id).await
}

/// Delete a skill
pub async fn delete_skill(pool: &sqlx::SqlitePool, id: &str) -> Result<bool> {
    let result = sqlx::query("DELETE FROM skills WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

impl Skill {
    pub async fn get_by_id(
        pool: &sqlx::SqlitePool,
        id: &str,
    ) -> Result<Option<Self>, anyhow::Error> {
        get_skill_by_id(pool, id).await
    }

    pub async fn update_analysis(
        &mut self,
        pool: &sqlx::SqlitePool,
        skill_type: &str,
        description: &str,
        ai_summary: &str,
        usage: &str,
        tags: &str,
        dependencies: &str,
        quality_score: i32,
    ) -> Result<(), sqlx::Error> {
        let tags: Vec<String> = serde_json::from_str(tags).unwrap_or_default();
        let dependencies: Vec<String> = serde_json::from_str(dependencies).unwrap_or_default();

        sqlx::query(
            r#"
            UPDATE skills
            SET
                type = ?,
                description = ?,
                ai_summary = ?,
                usage = ?,
                tags = ?,
                dependencies = ?,
                llm_analyzed = 1,
                quality_score = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            "#,
        )
        .bind(skill_type)
        .bind(description)
        .bind(ai_summary)
        .bind(usage)
        .bind(serde_json::to_string(&tags).unwrap_or_default())
        .bind(serde_json::to_string(&dependencies).unwrap_or_default())
        .bind(quality_score)
        .bind(&self.id)
        .execute(pool)
        .await?;

        self.r#type = skill_type.to_string();
        self.description = Some(description.to_string());
        self.ai_summary = Some(ai_summary.to_string());
        self.usage = Some(usage.to_string());
        self.tags = tags;
        self.dependencies = dependencies;
        self.llm_analyzed = true;
        self.quality_score = Some(quality_score);
        self.updated_at = Utc::now();

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::create_test_db;

    #[tokio::test]
    async fn test_create_skill() {
        let pool = create_test_db().await.unwrap();

        let create = CreateSkill {
            name: "Test Skill".to_string(),
            r#type: "utility".to_string(),
            source_type: "local".to_string(),
            repository_id: None,
            local_path: "/path/to/skill".to_string(),
            description: Some("A test skill".to_string()),
            usage: Some("Test usage".to_string()),
            tags: vec!["test".to_string(), "utility".to_string()],
            dependencies: vec![],
            llm_analyzed: Some(false),
            quality_score: Some(80),
            status: "active".to_string(),
        };

        let skill = create_skill(&pool, create).await.unwrap();

        assert_eq!(skill.name, "Test Skill");
        assert_eq!(skill.r#type, "utility");
        assert_eq!(skill.source_type, "local");
        assert_eq!(skill.local_path, "/path/to/skill");
        assert_eq!(skill.description, Some("A test skill".to_string()));
        assert_eq!(skill.usage, Some("Test usage".to_string()));
        assert_eq!(skill.tags, vec!["test", "utility"]);
        assert_eq!(skill.dependencies, Vec::<String>::new());
        assert_eq!(skill.llm_analyzed, false);
        assert_eq!(skill.quality_score, Some(80));
        assert_eq!(skill.status, "active");
    }

    #[tokio::test]
    async fn test_bulk_create_skills() {
        let pool = create_test_db().await.unwrap();

        let creates = vec![
            CreateSkill {
                name: "Test Skill 1".to_string(),
                r#type: "utility".to_string(),
                source_type: "local".to_string(),
                repository_id: None,
                local_path: "/path/to/skill1".to_string(),
                description: None,
                usage: None,
                tags: vec!["test".to_string()],
                dependencies: vec![],
                llm_analyzed: None,
                quality_score: None,
                status: "active".to_string(),
            },
            CreateSkill {
                name: "Test Skill 2".to_string(),
                r#type: "workflow".to_string(),
                source_type: "git".to_string(),
                repository_id: None,
                local_path: "/path/to/skill2".to_string(),
                description: Some("Second test skill".to_string()),
                usage: None,
                tags: vec!["test".to_string(), "workflow".to_string()],
                dependencies: vec!["skill1".to_string()],
                llm_analyzed: Some(true),
                quality_score: Some(90),
                status: "active".to_string(),
            },
        ];

        let skills = bulk_create_skills(&pool, creates).await.unwrap();

        assert_eq!(skills.len(), 2);
        assert_eq!(skills[0].name, "Test Skill 1");
        assert_eq!(skills[1].name, "Test Skill 2");
        assert_eq!(skills[0].llm_analyzed, false);
        assert_eq!(skills[1].llm_analyzed, true);

        let all_skills = get_all_skills(&pool).await.unwrap();
        assert_eq!(all_skills.len(), 2);
    }

    #[tokio::test]
    async fn test_bulk_create_empty() {
        let pool = create_test_db().await.unwrap();

        let skills = bulk_create_skills(&pool, vec![]).await.unwrap();
        assert!(skills.is_empty());

        let all_skills = get_all_skills(&pool).await.unwrap();
        assert!(all_skills.is_empty());
    }

    #[tokio::test]
    async fn test_get_skill_by_id() {
        let pool = create_test_db().await.unwrap();

        let create = CreateSkill {
            name: "Test Skill".to_string(),
            r#type: "utility".to_string(),
            source_type: "local".to_string(),
            repository_id: None,
            local_path: "/path/to/skill".to_string(),
            description: None,
            usage: None,
            tags: vec![],
            dependencies: vec![],
            llm_analyzed: None,
            quality_score: None,
            status: "active".to_string(),
        };

        let skill = create_skill(&pool, create).await.unwrap();

        let found = get_skill_by_id(&pool, &skill.id).await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().id, skill.id);

        let not_found = get_skill_by_id(&pool, "non-existent-id").await.unwrap();
        assert!(not_found.is_none());
    }

    #[tokio::test]
    async fn test_update_skill() {
        let pool = create_test_db().await.unwrap();

        let create = CreateSkill {
            name: "Original Name".to_string(),
            r#type: "utility".to_string(),
            source_type: "local".to_string(),
            repository_id: None,
            local_path: "/original/path".to_string(),
            description: Some("Original description".to_string()),
            usage: None,
            tags: vec!["original".to_string()],
            dependencies: vec![],
            llm_analyzed: Some(false),
            quality_score: Some(70),
            status: "active".to_string(),
        };

        let skill = create_skill(&pool, create).await.unwrap();

        let update = UpdateSkill {
            name: Some("Updated Name".to_string()),
            r#type: Some("workflow".to_string()),
            local_path: Some("/updated/path".to_string()),
            tags: Some(vec!["updated".to_string(), "new".to_string()]),
            llm_analyzed: Some(true),
            quality_score: Some(95),
            status: Some("deprecated".to_string()),
            source_type: None,
            repository_id: None,
            description: None,
            ai_summary: None,
            usage: None,
            dependencies: None,
        };

        let updated = update_skill(&pool, &skill.id, update).await.unwrap();
        assert!(updated.is_some());
        let updated = updated.unwrap();

        assert_eq!(updated.name, "Updated Name");
        assert_eq!(updated.r#type, "workflow");
        assert_eq!(updated.local_path, "/updated/path");
        assert_eq!(updated.tags, vec!["updated", "new"]);
        assert_eq!(updated.llm_analyzed, true);
        assert_eq!(updated.quality_score, Some(95));
        assert_eq!(updated.status, "deprecated");
        assert_eq!(updated.source_type, "local");
        assert_eq!(
            updated.description,
            Some("Original description".to_string())
        );
    }

    #[tokio::test]
    async fn test_update_nonexistent_skill() {
        let pool = create_test_db().await.unwrap();

        let update = UpdateSkill {
            name: Some("Test".to_string()),
            r#type: None,
            source_type: None,
            repository_id: None,
            local_path: None,
            description: None,
            ai_summary: None,
            usage: None,
            tags: None,
            dependencies: None,
            llm_analyzed: None,
            quality_score: None,
            status: None,
        };

        let result = update_skill(&pool, "non-existent-id", update)
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_delete_skill() {
        let pool = create_test_db().await.unwrap();

        let create = CreateSkill {
            name: "Test Skill".to_string(),
            r#type: "utility".to_string(),
            source_type: "local".to_string(),
            repository_id: None,
            local_path: "/path/to/skill".to_string(),
            description: None,
            usage: None,
            tags: vec![],
            dependencies: vec![],
            llm_analyzed: None,
            quality_score: None,
            status: "active".to_string(),
        };

        let skill = create_skill(&pool, create).await.unwrap();

        let delete_result = delete_skill(&pool, &skill.id).await.unwrap();
        assert!(delete_result);

        let found = get_skill_by_id(&pool, &skill.id).await.unwrap();
        assert!(found.is_none());

        let delete_result = delete_skill(&pool, "non-existent-id")
            .await
            .unwrap();
        assert!(!delete_result);
    }

    #[tokio::test]
    async fn test_skill_update_analysis() {
        let pool = create_test_db().await.unwrap();

        let create = CreateSkill {
            name: "Test Skill".to_string(),
            r#type: "unknown".to_string(),
            source_type: "local".to_string(),
            repository_id: None,
            local_path: "/path/to/skill".to_string(),
            description: None,
            usage: None,
            tags: vec![],
            dependencies: vec![],
            llm_analyzed: Some(false),
            quality_score: None,
            status: "active".to_string(),
        };

        let mut skill = create_skill(&pool, create).await.unwrap();

        skill
            .update_analysis(
                &pool,
                "utility",
                "Updated description from analysis",
                "AI生成的简短摘要",
                "Updated usage instructions",
                "[\"analyzed\", \"utility\"]",
                "[\"dep1\", \"dep2\"]",
                92,
            )
            .await
            .unwrap();

        assert_eq!(skill.r#type, "utility");
        assert_eq!(
            skill.description,
            Some("Updated description from analysis".to_string())
        );
        assert_eq!(
            skill.usage,
            Some("Updated usage instructions".to_string())
        );
        assert_eq!(skill.tags, vec!["analyzed", "utility"]);
        assert_eq!(skill.dependencies, vec!["dep1", "dep2"]);
        assert_eq!(skill.llm_analyzed, true);
        assert_eq!(skill.quality_score, Some(92));

        let found = get_skill_by_id(&pool, &skill.id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(found.r#type, "utility");
        assert_eq!(found.llm_analyzed, true);
        assert_eq!(found.quality_score, Some(92));
    }
}
