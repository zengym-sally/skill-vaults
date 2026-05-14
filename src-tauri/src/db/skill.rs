use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, serde::Serialize, serde::Deserialize)]
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
    pub usage: Option<String>,
    pub tags: Vec<String>,
    pub dependencies: Vec<String>,
    pub llm_analyzed: bool,
    pub quality_score: Option<i32>,
    pub status: String,
    pub first_discovered_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
    pub usage: Option<String>,
    pub tags: Option<Vec<String>>,
    pub dependencies: Option<Vec<String>>,
    pub llm_analyzed: Option<bool>,
    pub quality_score: Option<i32>,
    pub status: Option<String>,
}

/// Create the skills table if it doesn't exist
pub async fn create_table(pool: &sqlx::SqlitePool) -> Result<()> {
    sqlx::query!(
        r#"
        CREATE TABLE IF NOT EXISTS skills (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            source_type TEXT NOT NULL,
            repository_id TEXT,
            local_path TEXT NOT NULL,
            description TEXT,
            usage TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            dependencies TEXT NOT NULL DEFAULT '[]',
            llm_analyzed BOOLEAN NOT NULL DEFAULT 0,
            quality_score INTEGER,
            status TEXT NOT NULL,
            first_discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
        )
        "#
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Create a new skill
pub async fn create_skill(pool: &sqlx::SqlitePool, create: CreateSkill) -> Result<Skill> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let llm_analyzed = create.llm_analyzed.unwrap_or(false);

    let tags_json = serde_json::to_string(&create.tags)?;
    let dependencies_json = serde_json::to_string(&create.dependencies)?;

    sqlx::query!(
        r#"
        INSERT INTO skills (
            id, name, type, source_type, repository_id, local_path, description, usage,
            tags, dependencies, llm_analyzed, quality_score, status, first_discovered_at,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
        id,
        create.name,
        create.r#type,
        create.source_type,
        create.repository_id,
        create.local_path,
        create.description,
        create.usage,
        tags_json,
        dependencies_json,
        llm_analyzed,
        create.quality_score,
        create.status,
        now,
        now,
        now
    )
    .execute(pool)
    .await?;

    Ok(Skill {
        id,
        name: create.name,
        r#type: create.r#type,
        source_type: create.source_type,
        repository_id: create.repository_id,
        local_path: create.local_path,
        description: create.description,
        usage: create.usage,
        tags: create.tags,
        dependencies: create.dependencies,
        llm_analyzed,
        quality_score: create.quality_score,
        status: create.status,
        first_discovered_at: now,
        created_at: now,
        updated_at: now,
    })
}

/// Get a skill by ID
pub async fn get_skill_by_id(pool: &sqlx::SqlitePool, id: &str) -> Result<Option<Skill>> {
    let row = sqlx::query!(
        r#"
        SELECT * FROM skills WHERE id = ?
        "#,
        id
    )
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Ok(None);
    };

    let tags: Vec<String> = serde_json::from_str(&row.tags)?;
    let dependencies: Vec<String> = serde_json::from_str(&row.dependencies)?;

    Ok(Some(Skill {
        id: row.id,
        name: row.name,
        r#type: row.r#type,
        source_type: row.source_type,
        repository_id: row.repository_id,
        local_path: row.local_path,
        description: row.description,
        usage: row.usage,
        tags,
        dependencies,
        llm_analyzed: row.llm_analyzed,
        quality_score: row.quality_score,
        status: row.status,
        first_discovered_at: row.first_discovered_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }))
}

/// Get all skills
pub async fn get_all_skills(pool: &sqlx::SqlitePool) -> Result<Vec<Skill>> {
    let rows = sqlx::query!(
        r#"
        SELECT * FROM skills
        "#
    )
    .fetch_all(pool)
    .await?;

    let mut skills = Vec::with_capacity(rows.len());
    for row in rows {
        let tags: Vec<String> = serde_json::from_str(&row.tags)?;
        let dependencies: Vec<String> = serde_json::from_str(&row.dependencies)?;

        skills.push(Skill {
            id: row.id,
            name: row.name,
            r#type: row.r#type,
            source_type: row.source_type,
            repository_id: row.repository_id,
            local_path: row.local_path,
            description: row.description,
            usage: row.usage,
            tags,
            dependencies,
            llm_analyzed: row.llm_analyzed,
            quality_score: row.quality_score,
            status: row.status,
            first_discovered_at: row.first_discovered_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        });
    }

    Ok(skills)
}

/// Update a skill
pub async fn update_skill(pool: &sqlx::SqlitePool, id: &str, update: UpdateSkill) -> Result<Option<Skill>> {
    let tags_json = update.tags.as_ref().map(|t| serde_json::to_string(t)).transpose()?;
    let dependencies_json = update.dependencies.as_ref().map(|d| serde_json::to_string(d)).transpose()?;

    sqlx::query!(
        r#"
        UPDATE skills
        SET
            name = COALESCE(?, name),
            type = COALESCE(?, type),
            source_type = COALESCE(?, source_type),
            repository_id = COALESCE(?, repository_id),
            local_path = COALESCE(?, local_path),
            description = COALESCE(?, description),
            usage = COALESCE(?, usage),
            tags = COALESCE(?, tags),
            dependencies = COALESCE(?, dependencies),
            llm_analyzed = COALESCE(?, llm_analyzed),
            quality_score = COALESCE(?, quality_score),
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#,
        update.name,
        update.r#type,
        update.source_type,
        update.repository_id,
        update.local_path,
        update.description,
        update.usage,
        tags_json,
        dependencies_json,
        update.llm_analyzed,
        update.quality_score,
        update.status,
        id
    )
    .execute(pool)
    .await?;

    get_skill_by_id(pool, id).await
}

/// Delete a skill
pub async fn delete_skill(pool: &sqlx::SqlitePool, id: &str) -> Result<bool> {
    let result = sqlx::query!(
        r#"
        DELETE FROM skills WHERE id = ?
        "#,
        id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

impl Skill {
    pub async fn get_by_id(pool: &sqlx::SqlitePool, id: &str) -> Result<Option<Self>, anyhow::Error> {
        get_skill_by_id(pool, id).await
    }

    pub async fn update_analysis(
        &mut self,
        pool: &sqlx::SqlitePool,
        skill_type: &str,
        description: &str,
        usage: &str,
        tags: &str,
        dependencies: &str,
        quality_score: i32,
    ) -> Result<(), sqlx::Error> {
        let tags: Vec<String> = serde_json::from_str(tags).unwrap_or_default();
        let dependencies: Vec<String> = serde_json::from_str(dependencies).unwrap_or_default();

        sqlx::query!(
            r#"
            UPDATE skills
            SET
                type = ?,
                description = ?,
                usage = ?,
                tags = ?,
                dependencies = ?,
                llm_analyzed = 1,
                quality_score = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            "#,
            skill_type,
            description,
            usage,
            tags,
            dependencies,
            quality_score,
            self.id
        )
        .execute(pool)
        .await?;

        self.r#type = skill_type.to_string();
        self.description = Some(description.to_string());
        self.usage = Some(usage.to_string());
        self.tags = tags;
        self.dependencies = dependencies;
        self.llm_analyzed = true;
        self.quality_score = Some(quality_score);
        self.updated_at = Utc::now();

        Ok(())
    }
}
