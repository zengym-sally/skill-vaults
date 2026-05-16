# Changelog

All notable changes to Skill Vaults are documented here.

## [0.2.0] - 2026-05-16

### Added

- Open-source release: MIT LICENSE and comprehensive README
- Product polish: security hardening, error handling, component extraction
- Dispatch page redesign with AI summary, skill subdirectory, and UX improvements
- HTTP username/password auth option for private repositories
- Edit dialog support for URL, branch, and auth configuration
- System default credentials support (SSH agent / credential helper)

### Fixed

- Restore `unsafe-inline` in CSP for Sonner toast styling
- Replace 6 `unwrap()` calls with safe error handling in Rust backend
- Refactor dynamic SQL construction to use sqlx::QueryBuilder
- Add toast notifications for 4 silently swallowed errors in Dispatch.tsx
- Auto re-clone corrupted repo when pull fails during sync
- Three critical sync bugs: token auth, auth persistence, blocking ops
- Fallback to default SSH key files when SSH agent unavailable
- Auto re-clone when repo directory missing during sync
- Use system git CLI for default auth mode to fix SSH compatibility

### Changed

- Rename app from SkillVault to Skill Vaults
- Split Dispatch.tsx (1151 lines) into 5 sub-components
- Tighten CSP connect-src from `https://*` to `self`
- Compact skill card layout for better information density

## [0.1.0] - 2026-05-14

### Added

- Initial release of Skill Vaults
- Skill discovery from Git repositories and local directories
- LLM-powered skill analysis (description, tags, quality score)
- Dispatch skills to target directories via Symlink / Copy / Hardlink
- Dispatch templates for bulk deployment
- Sync status tracking (Synced / Outdated / Conflict / Error)
- Cross-platform support (Windows, macOS, Linux)
