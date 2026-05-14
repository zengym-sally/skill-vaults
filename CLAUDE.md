# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SkillVault is a Tauri 2.x desktop application for managing OpenCode/OhMyOpenCode skill libraries. Users discover skills from Git repositories, manage them with search/filter, and dispatch (symlink/copy/hardlink) them to target project directories. All data is stored locally in SQLite.

## Commands

```bash
# Development (starts both Vite dev server and Rust backend)
npm run tauri dev

# Frontend-only dev (browser at localhost:1420, no native features)
npm run dev

# Build production app
npm run tauri build

# Frontend-only build
npm run build

# Run frontend tests
npm run test              # watch mode
npm run test:run          # single run
npm run test:ui           # vitest UI
npm run test:coverage     # with coverage

# Rust formatting
cd src-tauri && cargo fmt
```

## Architecture

### Dual-process: Rust Backend + React Frontend

**Rust backend** (`src-tauri/src/`) exposes Tauri commands that the frontend calls via `invoke()` from `@tauri-apps/api/core`. The `SqlitePool` is created in `main.rs` setup and managed as Tauri state — all database modules accept `&SqlitePool` as their first parameter.

Rust modules:

- `db/` — Schema (`schema.rs`/INIT_SQL), CRUD for repositories, skills, dispatches, config (key-value), dispatch templates. Uses sqlx with SQLite.
- `skills/` — `discovery.rs` (walkdir-based skill scanning from repository dirs), `crud.rs` (list/update/delete), `analyzer.rs` (LLM-powered skill analysis)
- `dispatch/` — `target_dir.rs` (manage dispatch target dirs), `symlink.rs`/`copy.rs` (dispatch methods), `sync.rs` (sync dispatched skills)
- `git/` — `clone.rs`, `pull.rs`, `auth.rs` (git2-rs based repo management with SSH/token auth)
- `llm/` — `client.rs` (OpenAI-compatible API client with mockall support), `prompts.rs`
- `config/` — `base_path.rs` (skill repository root directory config)

**React frontend** (`src/`) uses:

- **Zustand** stores in `store/` — each store wraps `invoke()` calls to Tauri commands. `configStore` handles base path and onboarding flow, `skillStore` manages skill CRUD, `dispatchStore` handles dispatch operations, `settingsStore` manages theme.
- **React Router** (HashRouter) with routes: `/` (Skills), `/dispatches`, `/settings`. Onboarding shows when `basePath` is null.
- **shadcn/ui** components in `components/ui/` (Radix UI + Tailwind CSS)
- **Path alias**: `@/*` maps to `./src/*`

### Data Flow

Frontend Zustand store → `invoke("command_name", { args })` → Rust `#[tauri::command]` function → sqlx database operation or filesystem/git operation → Result returned to frontend.

### Database

SQLite via sqlx. Schema is defined as `INIT_SQL` constant in `src-tauri/src/db/schema.rs` and applied on startup. Database location: `{app_data_dir}/.skillvault/vault.db`. Tables: `repositories`, `skills`, `dispatch`, `config`, `target_dirs`, `dispatch_templates`.

### Key Domain Concepts

- **Repository** — A Git or local directory containing skill files. Sources: `github`, `private-git`, `local`.
- **Skill** — A discovered skill file/directory within a repository. Has type, tags, quality score, and optional LLM analysis.
- **Dispatch** — Linking a skill to a target project directory via symlink/copy/hardlink. Tracks sync status (`synced`/`outdated`/`conflict`/`error`).
- **Dispatch Template** — A named group of skill IDs for bulk dispatch.

## Testing

Frontend tests use **Vitest** with jsdom environment and `@testing-library/react`. Test setup at `src/test/setup.ts` imports jest-dom matchers. Tests live alongside source in `__tests__/` directories. Test environment variables are in `vite.config.ts` test.env block.

Rust tests use `mockall` for trait mocking (e.g., `LLMClient`), `tokio-test`, `tempfile`, and `serial_test`. Test utilities in `src-tauri/src/test_utils.rs`.

## Project Rules

1. **禁止硬编码配置** — 重要参数（API 地址、端口、密钥占位符、超时时间、文件路径等）不得写在业务逻辑中，必须收敛到统一的配置层（Rust 侧通过 `config` 模块 + SQLite `config` 表，前端侧通过环境变量或 Zustand store）。避免同一配置散落在多处。
2. **变更后回归测试** — 新增功能、Bug 修复、重构等重大变动完成后，必须运行 `npm run test:run`（前端）和 `cd src-tauri && cargo test`（后端），确认现有测试通过。若无对应测试，至少手动验证核心流程未回归。
3. **文件长度控制** — 目标 200–400 行，上限 800 行。超出时按职责拆分为独立模块，保持单一职责。`main.rs` 中的 Tauri command 函数应拆分到对应领域模块中。
4. **精简注释** — 不写冗余注释，但以下位置必须保留简要说明：模块入口（mod.rs / 文件顶部）、公开 API / command 函数、复杂逻辑块和非常规 workarounds。

## Build Notes

- Vite dev server runs on port **1420** (strict mode in vite.config.ts)
- `src-tauri/` is excluded from Vite file watching
- Release profile uses aggressive optimization: LTO fat, opt-level "z", strip enabled
- macOS signing identity is null by default (unsigned dev builds)
- CSP policy in tauri.conf.json restricts to self + https connect-src
