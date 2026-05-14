# SkillVault 开发计划

## 项目概述

SkillVault 是一款面向个人用户的跨平台（Windows / macOS）桌面应用，用于集中管理来自不同来源的 Skills（技能包/能力插件），并支持按需分发到各个工作目录中。

## 技术栈

- **桌面框架**: Tauri 2.x (Rust 后端)
- **前端框架**: React 19 + TypeScript
- **UI 组件库**: Shadcn/ui + Tailwind CSS
- **数据库**: SQLite (tauri-plugin-sql)
- **状态管理**: Zustand
- **Git 操作**: git2-rs
- **LLM 集成**: OpenAI API / Anthropic API

---

## 项目结构设计

### 前端结构 (src/)

```
src/
├── components/          # UI 组件
│   ├── layout/         # 布局组件
│   ├── repositories/   # 仓库管理相关组件
│   ├── skills/         # 技能管理相关组件
│   ├── dispatch/       # 分发管理相关组件
│   ├── settings/       # 设置相关组件
│   └── shared/         # 通用组件
├── store/              # Zustand 状态管理
│   ├── configStore.ts
│   ├── repositoryStore.ts
│   ├── skillStore.ts
│   └── dispatchStore.ts
├── hooks/              # 自定义 Hooks
│   ├── useCommand.ts   # Tauri Command 调用封装
│   ├── useToast.ts     # 消息提示
│   └── useDialog.ts    # 对话框封装
├── types/              # TypeScript 类型定义
│   ├── index.ts
│   ├── repository.ts
│   ├── skill.ts
│   ├── dispatch.ts
│   └── config.ts
├── utils/              # 工具函数
│   ├── format.ts
│   ├── validation.ts
│   └── constants.ts
├── pages/              # 页面组件
│   ├── Onboarding.tsx  # 首次启动引导页
│   ├── Dashboard.tsx   # 首页
│   ├── Repositories.tsx # 仓库管理页
│   ├── Skills.tsx      # 技能列表页
│   ├── Dispatch.tsx    # 分发管理页
│   └── Settings.tsx    # 设置页
├── App.tsx             # 主应用组件
├── main.tsx            # 应用入口
└── index.css           # 全局样式
```

### 后端结构 (src-tauri/src/)

```
src-tauri/src/
├── main.rs             # 主入口，注册 Tauri Commands
├── config/             # 配置管理
│   ├── mod.rs
│   └── base_path.rs    # 基础目录管理
├── db/                 # 数据库操作
│   ├── mod.rs
│   ├── schema.rs       # 数据库 schema
│   ├── repository.rs   # 仓库表操作
│   ├── skill.rs        # 技能表操作
│   └── dispatch.rs     # 分发记录表操作
├── git/                # Git 操作封装
│   ├── mod.rs
│   ├── clone.rs
│   ├── pull.rs
│   └── auth.rs
├── skills/             # 技能管理
│   ├── mod.rs
│   ├── discovery.rs    # 技能自动发现
│   ├── analyzer.rs     # LLM 智能分析
│   └── indexing.rs     # 索引构建
├── dispatch/           # 分发管理
│   ├── mod.rs
│   ├── symlink.rs      # 符号链接分发
│   ├── copy.rs         # 复制分发
│   └── sync.rs         # 同步检查
└── utils/              # 通用工具
    ├── mod.rs
    ├── fs.rs           # 文件系统操作
    └── error.rs        # 错误处理
```

---

## 开发阶段规划

### 阶段 1：基础框架搭建 (预计 2 天)

**目标**: 完成项目初始化、基础配置、首次启动运行

| 任务 ID | 任务描述                                      | 依赖       | 优先级 |
| ------- | --------------------------------------------- | ---------- | ------ |
| T101    | ✅ 初始化 Tauri 2.x + React + TypeScript 项目 | -          | 高     |
| T102    | ✅ 配置 Tailwind CSS + Shadcn/ui 组件库       | T101       | 高     |
| T103    | ✅ 配置 SQLite 数据库插件 (tauri-plugin-sql)  | T101       | 高     |
| T104    | ✅ 配置文件系统、对话框、更新等 Tauri 插件    | T101       | 中     |
| T105    | ✅ 实现基础目录结构创建逻辑                   | T104       | 高     |
| T106    | ✅ 实现首次启动引导页（基础目录选择）         | T102, T105 | 高     |
| T107    | ✅ 项目基础配置优化（构建、打包、签名）       | T101       | 中     |

### 阶段 2：仓库管理模块 (预计 3 天)

**目标**: 实现 Git 仓库的添加、同步、管理功能

| 任务 ID | 任务描述                                   | 依赖       | 优先级 |
| ------- | ------------------------------------------ | ---------- | ------ |
| T201    | ✅ 数据库表设计与初始化 (repositories 表)  | T103       | 高     |
| T202    | ✅ Git 操作封装 (clone/pull/认证)          | T104       | 高     |
| T203    | ✅ 仓库添加功能（GitHub/私有Git/本地目录） | T201, T202 | 高     |
| T204    | ✅ 仓库列表展示与基础操作（删除/同步）     | T203       | 高     |
| T205    | ✅ 仓库状态监控与自动检查更新              | T203       | 中     |
| T206    | ✅ 批量同步功能                            | T204       | 中     |
| T207    | ✅ 仓库详情页                              | T204       | 中     |

### 阶段 3：技能索引与展示模块 (预计 3 天)

**目标**: 实现技能自动发现、索引、展示功能

| 任务 ID | 任务描述                                  | 依赖       | 优先级 |
| ------- | ----------------------------------------- | ---------- | ------ |
| T301    | ✅ 数据库表设计与初始化 (skills 表)       | T103       | 高     |
| T302    | ✅ 技能自动发现功能（扫描目录识别技能）   | T104       | 高     |
| T303    | ✅ 技能列表展示（列表视图+搜索过滤）      | T301, T302 | 高     |
| T304    | ✅ 技能详情页                             | T303       | 中     |
| T305    | ✅ 标签系统实现                           | T301       | 中     |
| T306    | ✅ LLM 分析集成（OpenAI API 配置与调用）  | T104       | 中     |
| T307    | ✅ LLM 智能分析功能（类型/简介/依赖分析） | T306       | 中     |

### 阶段 4：核心分发管理模块 (预计 4 天)

**目标**: 实现技能到工作目录的分发管理功能（核心功能）

| 任务 ID | 任务描述                              | 依赖       | 优先级 |
| ------- | ------------------------------------- | ---------- | ------ |
| T401    | ✅ 数据库表设计与初始化 (dispatch 表) | T103       | 高     |
| T402    | ✅ 目标目录管理功能（添加/删除/列表） | T401       | 高     |
| T403    | 符号链接分发实现                      | T104       | 高     |
| T404    | 直接复制分发实现                      | T104       | 高     |
| T405    | 技能选择与分发操作界面                | T303, T402 | 高     |
| T406    | 同步检查与冲突处理                    | T403, T404 | 高     |
| T407    | 批量分发功能                          | T405       | 中     |
| T408    | 分发模板功能                          | T405       | 中     |
| T409    | 分发关系追踪与状态展示                | T401       | 中     |

### 阶段 5：系统设置模块 (预计 2 天)

**目标**: 实现系统各项配置功能

| 任务 ID | 任务描述                       | 依赖 | 优先级 |
| ------- | ------------------------------ | ---- | ------ |
| T501    | 设置页面 UI 实现               | T102 | 高     |
| T502    | LLM 配置功能（提供商/API Key） | T306 | 高     |
| T503    | Git 全局配置                   | T202 | 中     |
| T504    | 同步策略配置                   | T205 | 中     |
| T505    | 主题与语言设置                 | T102 | 低     |
| T506    | 数据备份与恢复功能             | T103 | 中     |
| T507    | 快捷键与通知设置               | T104 | 低     |

### 阶段 6：产品化与优化 (预计 3 天)

**目标**: 完成 MVP 版本的打磨与发布准备

| 任务 ID | 任务描述                         | 依赖     | 优先级 |
| ------- | -------------------------------- | -------- | ------ |
| T601    | 错误处理与用户友好提示           | 所有模块 | 高     |
| T602    | 性能优化（大目录扫描、批量操作） | 所有模块 | 中     |
| T603    | 自动更新功能配置与测试           | T104     | 中     |
| T604    | 安装包构建与签名                 | T107     | 高     |
| T605    | 功能测试与 Bug 修复              | 所有模块 | 高     |
| T606    | 文档编写（使用说明、开发文档）   | -        | 中     |

---

## 数据库设计

### repositories 表

```sql
CREATE TABLE repositories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL, -- github / private-git / local
    url TEXT,
    local_path TEXT NOT NULL,
    auth_type TEXT, -- none / https / ssh / token
    auth_config TEXT, -- JSON 存储认证信息
    branch TEXT DEFAULT 'main',
    last_synced_at DATETIME,
    last_checked_at DATETIME,
    status TEXT NOT NULL, -- active / syncing / error / archived
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### skills 表

```sql
CREATE TABLE skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- development-tool / workflow / automation / prompt-template / data-processing / other
    source_type TEXT NOT NULL,
    repository_id TEXT,
    local_path TEXT NOT NULL,
    description TEXT,
    usage TEXT,
    tags TEXT, -- JSON 数组
    dependencies TEXT, -- JSON 数组
    llm_analyzed BOOLEAN DEFAULT 0,
    quality_score INTEGER,
    status TEXT NOT NULL, -- active / archived / broken
    first_discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);
```

### dispatch 表

```sql
CREATE TABLE dispatch (
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
```

### config 表

```sql
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 核心 Tauri Command 接口设计

### 配置管理

```rust
// 获取基础目录
#[tauri::command]
async fn get_base_path() -> Result<String, Error>;

// 设置基础目录
#[tauri::command]
async fn set_base_path(path: String) -> Result<(), Error>;

// 获取应用配置
#[tauri::command]
async fn get_config() -> Result<Config, Error>;

// 更新应用配置
#[tauri::command]
async fn update_config(config: Config) -> Result<(), Error>;
```

### 仓库管理

```rust
// 添加仓库
#[tauri::command]
async fn add_repository(repo: NewRepository) -> Result<Repository, Error>;

// 获取仓库列表
#[tauri::command]
async fn list_repositories() -> Result<Vec<Repository>, Error>;

// 删除仓库
#[tauri::command]
async fn delete_repository(id: String, delete_files: bool) -> Result<(), Error>;

// 同步仓库
#[tauri::command]
async fn sync_repository(id: String, force: bool) -> Result<SyncResult, Error>;

// 批量同步仓库
#[tauri::command]
async fn sync_all_repositories(source_type: Option<String>) -> Result<Vec<SyncResult>, Error>;

// 获取仓库详情
#[tauri::command]
async fn get_repository(id: String) -> Result<RepositoryWithSkills, Error>;
```

### 技能管理

```rust
// 扫描并发现技能
#[tauri::command]
async fn discover_skills(repository_id: Option<String>) -> Result<Vec<Skill>, Error>;

// 获取技能列表
#[tauri::command]
async fn list_skills(filter: SkillFilter) -> Result<Vec<SkillListItem>, Error>;

// 获取技能详情
#[tauri::command]
async fn get_skill(id: String) -> Result<SkillDetail, Error>;

// 更新技能信息
#[tauri::command]
async fn update_skill(id: String, data: UpdateSkillData) -> Result<Skill, Error>;

// LLM 分析技能
#[tauri::command]
async fn analyze_skill(id: String) -> Result<SkillAnalysis, Error>;

// 批量分析技能
#[tauri::command]
async fn analyze_all_skills(force: bool) -> Result<(), Error>;
```

### 分发管理

```rust
// 添加目标目录
#[tauri::command]
async fn add_target_dir(path: String, name: String, description: Option<String>) -> Result<TargetDir, Error>;

// 获取目标目录列表
#[tauri::command]
async fn list_target_dirs() -> Result<Vec<TargetDir>, Error>;

// 删除目标目录
#[tauri::command]
async fn delete_target_dir(id: String) -> Result<(), Error>;

// 分发技能到目标目录
#[tauri::command]
async fn dispatch_skill(skill_id: String, target_dir_id: String, method: DispatchMethod) -> Result<DispatchRecord, Error>;

// 批量分发技能
#[tauri::command]
async fn dispatch_skills(skill_ids: Vec<String>, target_dir_id: String, method: DispatchMethod) -> Result<Vec<DispatchRecord>, Error>;

// 移除已分发的技能
#[tauri::command]
async fn remove_dispatched_skill(dispatch_id: String) -> Result<(), Error>;

// 检查分发同步状态
#[tauri::command]
async fn check_dispatch_sync(dispatch_id: String) -> Result<SyncStatus, Error>;

// 同步已分发的技能
#[tauri::command]
async fn sync_dispatched_skill(dispatch_id: String) -> Result<SyncStatus, Error>;

// 获取目标目录的已分发技能列表
#[tauri::command]
async fn get_dispatched_skills(target_dir_id: String) -> Result<Vec<DispatchRecordWithSkill>, Error>;
```

---

## 执行说明

### 如何开始开发

1. 确保已安装 Rust、Node.js、npm 环境
2. 安装 Tauri CLI: `npm install -g @tauri-apps/cli`
3. 安装依赖: `npm install`
4. 启动开发服务器: `npm run tauri dev`

### 构建生产版本

```bash
npm run tauri build
```

### 下一步行动

运行 `/start-work` 命令开始执行本开发计划，系统将自动分配任务给执行代理完成开发工作。
