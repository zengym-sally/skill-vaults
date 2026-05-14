# SkillVault

A Tauri 2.x + React + TypeScript + Tailwind CSS desktop application for managing your skills and knowledge.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Backend**: Tauri 2.x (Rust)
- **Plugins**:
  - SQL (SQLite) for database storage
  - FS for file system operations
  - Dialog for native dialogs
  - Updater for auto-updates
  - Shell for running shell commands
  - git2-rs for Git operations

## Prerequisites

- Node.js (v18+)
- npm (v9+)
- Rust (v1.70+)
- Tauri CLI (v2.0+)

## Installation

```bash
npm install
```

## Development

```bash
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Project Structure

```
├── src/                      # Frontend source code
│   ├── assets/              # Static assets
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # React entry point
│   └── index.css            # Global styles
├── src-tauri/               # Tauri/Rust source code
│   ├── src/
│   │   └── main.rs          # Rust entry point
│   ├── Cargo.toml           # Rust dependencies
│   └── tauri.conf.json      # Tauri configuration
├── index.html               # HTML entry point
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── postcss.config.js        # PostCSS configuration
```
