use sqlx::{FromRow, SqlitePool};
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, serde::Serialize, serde::Deserialize)]
pub struct TargetDir {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateTargetDir {
    pub name: String,
    pub path: String,
    pub description: Option<String>,
}

impl TargetDir {
    pub async fn create(pool: &SqlitePool, create: CreateTargetDir) -> Result<Self, Box<dyn std::error::Error>> {
        let now = chrono::Local::now().naive_local();
        let id = Uuid::new_v4().to_string();

        let target_dir = sqlx::query_as::<_, TargetDir>(
            "INSERT INTO target_dirs (id, name, path, description, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             RETURNING *"
        )
        .bind(id)
        .bind(create.name)
        .bind(create.path)
        .bind(create.description)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await?;

        Ok(target_dir)
    }

    pub async fn list(pool: &SqlitePool) -> Result<Vec<Self>, Box<dyn std::error::Error>> {
        let target_dirs = sqlx::query_as::<_, TargetDir>(
            "SELECT * FROM target_dirs ORDER BY created_at DESC"
        )
        .fetch_all(pool)
        .await?;

        Ok(target_dirs)
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        sqlx::query("DELETE FROM target_dirs WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(())
    }
}

// Tauri commands
#[tauri::command]
pub async fn add_target_dir(
    name: &str,
    path: &str,
    description: Option<&str>,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<TargetDir, String> {
    let create = CreateTargetDir {
        name: name.to_string(),
        path: path.to_string(),
        description: description.map(|d| d.to_string()),
    };

    TargetDir::create(&pool, create)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_target_dirs(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Vec<TargetDir>, String> {
    TargetDir::list(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_target_dir(
    id: &str,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<(), String> {
    TargetDir::delete(&pool, id)
        .await
        .map_err(|e| e.to_string())
}
