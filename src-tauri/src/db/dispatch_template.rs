use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchTemplate {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub skill_ids: String, // JSON array of skill IDs
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateDispatchTemplateInput {
    pub name: String,
    pub description: Option<String>,
    pub skill_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateDispatchTemplateInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub skill_ids: Option<Vec<String>>,
}

/// Map a database row to a DispatchTemplate struct
fn map_row_to_template(row: &sqlx::sqlite::SqliteRow) -> DispatchTemplate {
    DispatchTemplate {
        id: row.get("id"),
        name: row.get("name"),
        description: row.get("description"),
        skill_ids: row.get("skill_ids"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

impl DispatchTemplate {
    /// Create a new dispatch template
    pub async fn create(
        pool: &SqlitePool,
        input: CreateDispatchTemplateInput,
    ) -> Result<Self, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        let skill_ids = serde_json::to_string(&input.skill_ids).map_err(|e| {
            sqlx::Error::Configuration(format!("Failed to serialize skill IDs: {}", e).into())
        })?;

        let now = chrono::Utc::now();

        sqlx::query(
            r#"
            INSERT INTO dispatch_templates (id, name, description, skill_ids, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&skill_ids)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        let row = sqlx::query("SELECT * FROM dispatch_templates WHERE id = ?")
            .bind(&id)
            .fetch_one(pool)
            .await?;

        Ok(map_row_to_template(&row))
    }

    /// Get all dispatch templates
    pub async fn get_all(pool: &SqlitePool) -> Result<Vec<Self>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM dispatch_templates ORDER BY created_at DESC")
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(map_row_to_template).collect())
    }

    /// Get a dispatch template by ID
    pub async fn get_by_id(
        pool: &SqlitePool,
        id: &str,
    ) -> Result<Option<Self>, sqlx::Error> {
        let row = sqlx::query("SELECT * FROM dispatch_templates WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;

        Ok(row.as_ref().map(map_row_to_template))
    }

    /// Update a dispatch template
    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        input: UpdateDispatchTemplateInput,
    ) -> Result<Option<Self>, sqlx::Error> {
        let existing = Self::get_by_id(pool, id).await?;
        if existing.is_none() {
            return Ok(None);
        }

        let existing = existing.unwrap();
        let name = input.name.unwrap_or(existing.name);
        let description = input.description.or(existing.description);
        let skill_ids = match input.skill_ids {
            Some(ids) => serde_json::to_string(&ids).map_err(|e| {
                sqlx::Error::Configuration(format!("Failed to serialize skill IDs: {}", e).into())
            })?,
            None => existing.skill_ids,
        };

        let now = chrono::Utc::now();

        sqlx::query(
            r#"
            UPDATE dispatch_templates
            SET name = ?, description = ?, skill_ids = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&name)
        .bind(&description)
        .bind(&skill_ids)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        Self::get_by_id(pool, id).await
    }

    /// Delete a dispatch template
    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM dispatch_templates WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Get skill IDs as a Vec<String>
    pub fn skill_ids_vec(&self) -> Result<Vec<String>, serde_json::Error> {
        serde_json::from_str(&self.skill_ids)
    }
}
