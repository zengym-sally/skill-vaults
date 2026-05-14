# Development Guide

This guide covers how to set up the development environment, run the app locally, and build for production.

## 📋 Prerequisites

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm** or **yarn** or **pnpm**: npm 9+ recommended
- **Rust**: 1.70.0 or higher (required for Tauri)
- **System dependencies**: For your specific OS, see [Tauri prerequisites](https://tauri.app/v2/guides/getting-started/prerequisites/)

### Install Rust

```bash
# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

For Windows, download from [rustup.rs](https://rustup.rs/).

## 🚀 Local Development

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/skill-vault.git
cd skill-vault
```

### 2. Install Node dependencies

```bash
npm install
```

### 3. Run development mode

```bash
npm run tauri dev
```

This will:

- Start the Vite dev server for the frontend
- Compile the Rust backend
- Open the application window

The app will automatically reload when you make changes to the frontend code.

### 4. Frontend-only development

If you only want to work on the frontend without the Tauri wrapper:

```bash
npm run dev
```

This will start Vite dev server accessible in your browser at `http://localhost:5173`.

Note: Some native features (file system access, dialogs, etc.) won't work in browser mode.

## 🏗️ Building for Production

### Build frontend + Tauri application

```bash
npm run tauri build
```

This will:

1. Compile the TypeScript frontend
2. Build the Vite output
3. Compile the Rust backend into a native binary
4. Package into an installer/application bundle for your OS

The output will be in `src-tauri/target/release/`.

### Build only frontend

```bash
npm run build
```

This compiles just the frontend assets to the `dist` directory.

## 📁 Project Structure

```
skill-vault/
├── src/                          # Frontend source code
│   ├── assets/                   # Static assets
│   ├── components/               # React components
│   │   └── ui/                   # shadcn/ui components
│   ├── pages/                    # Page components
│   ├── store/                    # Zustand state stores
│   ├── types/                    # TypeScript type definitions
│   ├── utils/                    # Utility functions
│   ├── App.tsx                   # Root application component
│   ├── main.tsx                  # React entry point
│   └── index.css                 # Global styles
├── src-tauri/                    # Tauri/Rust backend
│   ├── src/
│   │   ├── bin/
│   │   │   └── main.rs           # Entry point
│   │   ├── database.rs           # Database operations
│   │   ├── discovery.rs          # Skill discovery
│   │   ├── dispatch.rs           # Skill dispatch logic
│   │   ├── models.rs             # Data models
│   │   └── git.rs                # Git operations
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
├── public/                        # Public static files
├── dist/                          # Build output (generated)
├── index.html                     # HTML entry point
├── package.json                   # Node dependencies
├── tsconfig.json                  # TypeScript configuration
├── vite.config.ts                # Vite configuration
├── tailwind.config.js            # Tailwind CSS configuration
└── postcss.config.js             # PostCSS configuration
```

## 💻 Development Workflow

### Frontend Development

- The frontend uses React 19 with TypeScript
- Styling with Tailwind CSS
- Components from shadcn/ui
- State management with Zustand
- Routing with React Router v7

### Backend Development (Rust)

- All file system operations happen in Rust backend
- SQLite database for storing skill metadata
- Tauri commands are exposed to the frontend
- `git2-rs` is used for Git repository discovery

### Database

The application stores data in a SQLite database at:

- **macOS**: `~/Library/Application Support/com.skillvault.app/skillvault.db`
- **Windows**: `%APPDATA%\com.skillvault.app\data\skillvault.db`
- **Linux**: `~/.local/share/com.skillvault.app/skillvault.db`

## 🧪 Testing

Currently, there are no automated tests. We plan to add:

- Unit tests for backend Rust code
- Unit tests for frontend utility functions

## 🚢 Publishing

### Update version

1. Update version in `package.json`
2. Update version in `src-tauri/tauri.conf.json`

### Build for all platforms

Currently, we recommend using GitHub Actions or Tauri Cloud for cross-platform builds.

Example for local build on macOS:

```bash
npm run tauri build
```

The generated `.dmg` installer will be in `src-tauri/target/release/bundle/dmg/`.

## 🐛 Troubleshooting

### Rust compilation errors

Make sure you have the latest Rust toolchain:

```bash
rustup update
```

### Node module errors

Delete `node_modules` and `package-lock.json` and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Tauri build fails on macOS

Ensure you have Xcode command line tools installed:

```bash
xcode-select --install
```

## 📝 Code Style

- Frontend: Follow TypeScript conventions, use ESLint for linting
- Backend: Follow Rust standard formatting with `cargo fmt`

Format Rust code:

```bash
cd src-tauri
cargo fmt
```
