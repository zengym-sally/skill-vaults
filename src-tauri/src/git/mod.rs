//! Git 操作模块
//! 提供仓库克隆、拉取、认证等功能

pub mod auth;
pub mod clone;
pub mod pull;

use crate::db::repository::Repository;
use anyhow::{anyhow, Result};
use std::process::Command;

/// Shell out to system git for clone — uses native SSH agent, ~/.ssh/config, etc.
pub async fn clone_via_cli(url: &str, path: &str, branch: &str) -> Result<()> {
    let path = std::path::Path::new(path);
    if path.exists() {
        return Err(anyhow!("Directory already exists: {}", path.display()));
    }

    let output = Command::new("git")
        .args(["clone", "--branch", branch, "--", url])
        .arg(path)
        .output()
        .map_err(|e| anyhow!("Failed to run git: {}. Is git installed?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("git clone failed: {}", stderr.trim()));
    }
    Ok(())
}

/// Shell out to system git for pull — uses native SSH agent, ~/.ssh/config, etc.
pub async fn pull_via_cli(path: &str, branch: &str) -> Result<()> {
    let path = std::path::Path::new(path);
    if !path.exists() {
        return Err(anyhow!("Repository directory does not exist: {}", path.display()));
    }

    let output = Command::new("git")
        .args(["pull", "--ff-only", "origin", branch])
        .current_dir(path)
        .output()
        .map_err(|e| anyhow!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("git pull failed: {}", stderr.trim()));
    }
    Ok(())
}

/// 同步单个仓库（拉取最新代码）
pub async fn sync_repository(repo: &Repository) -> Result<()> {
    let auth_type = repo.auth_type.as_deref().unwrap_or("none");
    let branch = repo.branch.as_deref().unwrap_or("main");
    let auth_config = repo.auth_config.as_deref().unwrap_or("{}");

    if auth_type == "none" {
        // Use system git for default auth — handles SSH agent, ~/.ssh/config, all key formats
        pull_via_cli(&repo.local_path, branch).await
    } else {
        pull::pull(&repo.local_path, branch, auth_type, auth_config).await
    }
}

/// 克隆新仓库
pub async fn clone_repository(url: &str, path: &str, branch: &str, auth_type: &str, auth_config: &str) -> Result<()> {
    if auth_type == "none" {
        clone_via_cli(url, path, branch).await
    } else {
        clone::clone(url, path, branch, auth_type, auth_config).await
    }
}
