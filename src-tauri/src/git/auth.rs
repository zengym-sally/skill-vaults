//! Git 认证处理模块

use anyhow::Result;
use git2::Cred;
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
struct TokenAuthConfig {
    token: String,
}

#[derive(Debug, Deserialize)]
struct SshAuthConfig {
    private_key: String,
    passphrase: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HttpAuthConfig {
    username: String,
    password: String,
}

/// Find first existing default SSH key in ~/.ssh/
fn find_default_ssh_key() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let ssh_dir = PathBuf::from(home).join(".ssh");
    for name in &["id_ed25519", "id_rsa", "id_ecdsa"] {
        let key_path = ssh_dir.join(name);
        if key_path.exists() {
            return Some(key_path);
        }
    }
    None
}

/// 获取Git认证凭证
pub fn get_auth(auth_type: &str, auth_config: &str, username_from_url: Option<&str>, allowed_types: git2::CredentialType) -> Result<Cred, git2::Error> {
    match auth_type {
        "none" => {
            // System default: try SSH agent → default key files → credential helper
            if allowed_types.contains(git2::CredentialType::SSH_KEY) {
                let username = username_from_url.unwrap_or("git");
                // Try SSH agent first (works in terminal, may fail in GUI apps)
                if let Ok(cred) = Cred::ssh_key_from_agent(username) {
                    return Ok(cred);
                }
                // Fallback: try default SSH key files from ~/.ssh/
                if let Some(key_path) = find_default_ssh_key() {
                    return Cred::ssh_key(username, None, &key_path, None);
                }
                Err(git2::Error::from_str("No SSH agent or default key found in ~/.ssh/"))
            } else {
                Cred::default()
            }
        }
        "token" => {
            let config: TokenAuthConfig = serde_json::from_str(auth_config)
                .map_err(|e| git2::Error::from_str(&format!("Invalid token auth config: {}", e)))?;
            Cred::userpass_plaintext("x-access-token", &config.token)
        }
        "ssh" => {
            let config: SshAuthConfig = serde_json::from_str(auth_config)
                .map_err(|e| git2::Error::from_str(&format!("Invalid SSH auth config: {}", e)))?;
            Cred::ssh_key_from_memory(
                "git",
                None,
                config.private_key.as_str(),
                config.passphrase.as_deref(),
            )
        }
        "http" => {
            let config: HttpAuthConfig = serde_json::from_str(auth_config)
                .map_err(|e| git2::Error::from_str(&format!("Invalid HTTP auth config: {}", e)))?;
            Cred::userpass_plaintext(&config.username, &config.password)
        }
        _ => Err(git2::Error::from_str(&format!("Unsupported auth type: {}", auth_type))),
    }
}
