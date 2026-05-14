# SkillVault

> A modern desktop application for managing your OpenCode/OhMyOpenCode skill library.

SkillVault helps you organize, discover, and dispatch skills to your development projects. It provides a clean UI for browsing your skill collection, bulk dispatching to multiple projects, and managing your skill repository.

## ✨ Features

- **Skill Discovery** - Automatically scan and discover skills from your configured skill repository
- **Skill Management** - Browse, search, filter, and organize your skills with tags and metadata
- **Bulk Dispatch** - Dispatch multiple skills at once to target projects using symlinks, copies, or hardlinks
- **Dark/Light Mode** - Beautiful UI with built-in dark and light theme support
- **Local First** - All data stored locally in SQLite database, no cloud required
- **Cross Platform** - Built with Tauri, runs on Windows, macOS, and Linux

## 🔍 Key Features

- **Skill Discovery**: Auto-discover skills from your local Git repositories
- **Search**: Full-text search across skill names, descriptions, and tags
- **Filtering**: Filter by skill status, type, and source
- **Bulk Operations**: Select multiple skills and dispatch them to any configured project directory
- **Multiple Dispatch Methods**:
  - Symlink (recommended) - share skill files across multiple projects without duplicating
  - Copy - create a full copy of skill files in the target directory
  - Hardlink - create filesystem hardlinks to share the same files
- **Quality Scoring**: Track quality scores for your skills
- **Dependency Tracking**: Keep track of skill dependencies

## 🚀 Quick Start

### Download

Download the latest release from the [Releases](https://github.com/yourusername/skill-vault/releases) page.

### First Run

1. On first launch, you'll be guided through onboarding
2. Configure your skill repository base path (where your skills are stored)
3. Click "Discover Skills" to import all your skills
4. Add target directories for your projects in Settings
5. Start browsing and dispatching skills!

## 📋 Requirements

- Any modern OS that supports Tauri (Windows 10+, macOS 10.15+, Linux)
- Approximately 50MB disk space for the application
- Your skill repository (collection of OpenCode skills)

## 📖 Usage

### Skills Page

The main page lists all your discovered skills. You can:

- Search by name, description, or tags
- Select multiple skills for bulk dispatch
- Click "Discover Skills" to rescan for new skills
- Delete skills you no longer need
- Dispatch individual or bulk skills to your projects

### Dispatches Page

View your recent dispatch history and track what skills have been dispatched to which projects.

### Settings Page

- Configure application preferences
- Add/remove target project directories for dispatching
- Manage theme settings
- Configure your skill repository base path

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite, shadcn/ui
- **Backend**: Tauri 2.x (Rust)
- **Database**: SQLite via Tauri SQL plugin
- **State Management**: Zustand
- **Routing**: React Router
- **Icons**: Lucide React

## 📄 License

MIT

## 🙏 Acknowledgments

- Built for [OhMyOpenCode](https://github.com/ohmyopencode/ohmyopencode) ecosystem
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Powered by [Tauri](https://tauri.app/)
