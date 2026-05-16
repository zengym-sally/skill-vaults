/// Create all tables SQL (for direct initialization if needed)
pub const INIT_SQL: &str = r#"
-- Create repositories table
CREATE TABLE IF NOT EXISTS repositories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT,
    path TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL,
    local_path TEXT NOT NULL,
    auth_type TEXT,
    auth_config TEXT,
    branch TEXT,
    skills_path TEXT NOT NULL DEFAULT 'skills',
    last_synced_at DATETIME,
    last_checked_at DATETIME,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create skills table
CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    source_type TEXT NOT NULL,
    repository_id TEXT,
    local_path TEXT NOT NULL,
    description TEXT,
    ai_summary TEXT,
    usage TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    dependencies TEXT NOT NULL DEFAULT '[]',
    llm_analyzed BOOLEAN NOT NULL DEFAULT 0,
    quality_score INTEGER,
    status TEXT NOT NULL,
    first_discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Create dispatch table
CREATE TABLE IF NOT EXISTS dispatch (
    id TEXT PRIMARY KEY,
    target_dir TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    method TEXT NOT NULL, -- symlink / copy / hardlink
    source_path TEXT NOT NULL,
    dest_path TEXT NOT NULL,
    dispatched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_synced_at DATETIME,
    sync_status TEXT NOT NULL, -- synced / outdated / conflict / error
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

-- Create config table
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create target_dirs table
CREATE TABLE IF NOT EXISTS target_dirs (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    skills_subdir TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create dispatch templates table
CREATE TABLE IF NOT EXISTS dispatch_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    skill_ids TEXT NOT NULL, -- JSON array of skill IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_skills_repository_id ON skills(repository_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_skill_id ON dispatch(skill_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_target_dir ON dispatch(target_dir);
CREATE INDEX IF NOT EXISTS idx_dispatch_sync_status ON dispatch(sync_status);
CREATE INDEX IF NOT EXISTS idx_target_dirs_path ON target_dirs(path);
CREATE INDEX IF NOT EXISTS idx_dispatch_templates_name ON dispatch_templates(name);
"#;
