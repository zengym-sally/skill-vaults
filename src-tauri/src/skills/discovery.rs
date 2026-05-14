use anyhow::Result;
use std::path::Path;
use walkdir::WalkDir;

use sqlx::SqlitePool;
use serde::{Serialize, Deserialize};

use crate::db::skill::{Skill, CreateSkill};
use crate::db::repository::Repository;

/// Skill discovery options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryOptions {
    /// Optional repository ID to scan only one repository
    pub repository_id: Option<String>,
    /// Force re-scan even if skill already exists
    pub force: Option<bool>,
}

/// Discovery result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryResult {
    pub discovered_skills: Vec<Skill>,
    pub skipped_skills: Vec<String>,
    pub errors: Vec<String>,
}

/// Check if a directory is a skill
fn is_skill_directory(path: &Path) -> bool {
    // Check for skill indicator files
    let indicators = ["SKILL.md", "skill.json", "README.md"];
    for indicator in indicators {
        if path.join(indicator).exists() {
            return true;
        }
    }
    
    // Check if it's a Git repository itself (has .git directory)
    if path.join(".git").is_dir() {
        return true;
    }
    
    false
}

/// Extract skill name from directory
fn extract_skill_name(path: &Path) -> String {
    // First try to read from skill.json
    let skill_json_path = path.join("skill.json");
    if skill_json_path.exists() {
        if let Ok(content) = std::fs::read_to_string(skill_json_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(name) = json.get("name").and_then(|v| v.as_str()) {
                    return name.to_string();
                }
            }
        }
    }
    
    // Fallback to directory name
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown-skill")
        .to_string()
}

/// Skip hidden and special directories
fn should_skip_dir(entry: &walkdir::DirEntry) -> bool {
    let file_name = entry.file_name().to_string_lossy();
    
    // Skip hidden directories
    if file_name.starts_with('.') {
        return true;
    }
    
    // Skip common build and dependency directories
    let skip_dirs = ["node_modules", "target", "build", "dist", "vendor", "venv", "__pycache__"];
    skip_dirs.contains(&file_name.as_ref())
}

/// Scan a single repository for skills
async fn scan_repository(
    pool: &SqlitePool,
    repo: &Repository,
    force: bool,
) -> Result<DiscoveryResult> {
    let mut result = DiscoveryResult {
        discovered_skills: Vec::new(),
        skipped_skills: Vec::new(),
        errors: Vec::new(),
    };
    
    let repo_path = Path::new(&repo.local_path);
    if !repo_path.exists() || !repo_path.is_dir() {
        result.errors.push(format!("Repository path does not exist or is not a directory: {}", repo.local_path));
        return Ok(result);
    }
    
    // Walk through all directories in the repository
    for entry in WalkDir::new(repo_path)
        .into_iter()
        .filter_entry(|e| !should_skip_dir(e))
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_dir() {
            let path = entry.path();
            
            // Skip the root repository directory itself
            if path == repo_path {
                continue;
            }
            
            if is_skill_directory(path) {
                // Calculate relative path from repository root
                let relative_path = path.strip_prefix(repo_path)?;
                let full_path = path.to_string_lossy().to_string();
                
                // Check if skill already exists for this repository and path
                let existing = sqlx::query!(
                    "SELECT id FROM skills WHERE repository_id = ? AND local_path = ?",
                    repo.id,
                    full_path
                )
                .fetch_optional(pool)
                .await?;
                
                if existing.is_some() && !force {
                    result.skipped_skills.push(full_path);
                    continue;
                }
                
                // Extract skill information
                let name = extract_skill_name(path);
                
                // Create skill
                let create = CreateSkill {
                    name,
                    r#type: "skill".to_string(),
                    source_type: repo.source_type.clone(),
                    repository_id: Some(repo.id.clone()),
                    local_path: full_path.clone(),
                    description: None,
                    usage: None,
                    tags: Vec::new(),
                    dependencies: Vec::new(),
                    llm_analyzed: Some(false),
                    quality_score: None,
                    status: "active".to_string(),
                };
                
                match crate::db::skill::create_skill(pool, create).await {
                    Ok(skill) => {
                        result.discovered_skills.push(skill);
                    }
                    Err(e) => {
                        result.errors.push(format!("Failed to create skill for path {}: {}", full_path, e));
                    }
                }
            }
        }
    }
    
    Ok(result)
}

/// Discover skills in repositories
#[tauri::command]
pub async fn discover_skills(
    options: Option<DiscoveryOptions>,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<DiscoveryResult, String> {
    let options = options.unwrap_or(DiscoveryOptions {
        repository_id: None,
        force: Some(false),
    });
    
    let force = options.force.unwrap_or(false);
    let mut result = DiscoveryResult {
        discovered_skills: Vec::new(),
        skipped_skills: Vec::new(),
        errors: Vec::new(),
    };
    
    // Get repositories to scan
    let repos = if let Some(repo_id) = &options.repository_id {
        match Repository::get_by_id(&pool, repo_id).await {
            Ok(Some(repo)) => vec![repo],
            Ok(None) => {
                return Err(format!("Repository not found: {}", repo_id));
            }
            Err(e) => {
                return Err(format!("Failed to get repository: {}", e));
            }
        }
    } else {
        match Repository::get_all(&pool).await {
            Ok(repos) => repos,
            Err(e) => {
                return Err(format!("Failed to get repositories: {}", e));
            }
        }
    };
    
    // Scan each repository
    for repo in repos {
        match scan_repository(&pool, &repo, force).await {
            Ok(repo_result) => {
                result.discovered_skills.extend(repo_result.discovered_skills);
                result.skipped_skills.extend(repo_result.skipped_skills);
                result.errors.extend(repo_result.errors);
            }
            Err(e) => {
                result.errors.push(format!("Failed to scan repository {}: {}", repo.name, e));
            }
        }
    }
    
    Ok(result)
}
