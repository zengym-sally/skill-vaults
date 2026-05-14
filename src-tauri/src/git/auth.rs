//! Git 认证处理模块

use anyhow::Result;
use git2::Cred;
use serde::Deserialize;

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

/// 获取Git认证凭证
pub fn get_auth(auth_type: &str, auth_config: &str) -> Result<Cred, git2::Error> {
    match auth_type {
        "none" => Cred::default(),
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
