# Skill Vaults

A cross-platform desktop application for managing and dispatching AI skill libraries. Discover skills from GitHub, private Git, and local directories — then deploy them to any project with one click.

## Features

- **Multi-source Management** — Add skills from GitHub, GitLab, Gitee, or local directories
- **Auto Discovery** — Scan repositories and automatically identify skill files (SKILL.md, skill.json, etc.)
- **AI Analysis** — Connect an OpenAI-compatible API to auto-generate skill descriptions, tags, and quality scores
- **Smart Dispatch** — Deploy skills to project directories via Symlink, Copy, or Hardlink
- **Dispatch Templates** — Save groups of skills as templates for one-click bulk deployment
- **Sync Tracking** — Monitor dispatch status (Synced / Outdated / Conflict / Error) with one-click re-sync
- **Search & Filter** — Full-text search with filtering by name, tags, type, and source
- **Local First** — All data stored in local SQLite, no cloud account required
- **Cross Platform** — Built with Tauri 2.x, runs on Windows, macOS, and Linux

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (latest stable)
- OS: Windows 10+, macOS 10.15+, or Linux

### Development

```bash
# Clone the repository
git clone https://github.com/zengym-sally/skill-vaults.git
cd skill-vaults

# Install frontend dependencies
npm install

# Start development server (Vite + Rust backend)
npm run tauri dev
```

### Build

```bash
# Build production app
npm run tauri build
```

### First Run

1. Launch the app — you'll be guided through onboarding
2. Set your skill repository base path (where skills will be stored locally)
3. Add a Git repository URL (e.g., a GitHub repo containing skills)
4. Skills are automatically scanned and indexed
5. Go to **Dispatches** → add a target project directory → dispatch skills

## Usage

### Skills Page

Browse all discovered skills with search and filtering. View AI-generated summaries, tags, and quality scores. Select skills for bulk dispatch.

### Dispatches Page

Manage target project directories and deployed skills. Sync individual or all skills. Track status and resolve conflicts.

### Templates

Create dispatch templates — named groups of skills for quick deployment to new projects.

## Tech Stack

| Layer        | Technologies                                                 |
| ------------ | ------------------------------------------------------------ |
| **Frontend** | React 19, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Vite |
| **Backend**  | Rust, Tauri 2.x, sqlx + SQLite, git2-rs                      |
| **Build**    | Vite, Cargo, Tauri CLI                                       |

## Architecture

```
Frontend (React)                Backend (Rust)
┌──────────────────┐           ┌──────────────────┐
│  React Pages     │  invoke() │  Tauri Commands   │
│  Zustand Stores  │ ────────► │  Git Operations   │
│  shadcn/ui       │           │  LLM Client       │
│  Tailwind CSS    │           │  SQLite Database   │
└──────────────────┘           └──────────────────┘
```

## Project Structure

```
├── src/                    # React frontend
│   ├── pages/              # Page components (Skills, Dispatches, Settings)
│   ├── components/         # Reusable UI components
│   ├── store/              # Zustand state stores
│   ├── types/              # TypeScript type definitions
│   └── lib/                # Utility functions
├── src-tauri/              # Rust backend
│   └── src/
│       ├── main.rs         # Tauri command handlers
│       ├── db/             # Database schema and CRUD
│       ├── git/            # Git clone, pull, auth
│       ├── skills/         # Skill discovery, analysis
│       ├── dispatch/       # Dispatch methods, sync
│       ├── llm/            # OpenAI-compatible client
│       └── config/         # Configuration management
├── CLAUDE.md               # AI assistant development guide
└── LICENSE                 # MIT License
```

## Testing

```bash
# Frontend tests
npm run test:run

# Rust tests
cd src-tauri && cargo test
```

## License

[MIT](LICENSE)
