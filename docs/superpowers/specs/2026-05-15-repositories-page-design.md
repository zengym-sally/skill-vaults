# Repositories Page Design

## Overview

Add a new Repositories page to SkillVault for managing skill source repositories. This page replaces the placeholder "Add Skill" button on the Skills page and provides a central place to add, sync, and manage repositories.

## Design Decisions

- **Layout**: List-style cards (single column), each row = one repository
- **Type classification**: Frontend shows "Remote Git" and "Local Directory"; maps to backend's `github`/`private-git`/`local` by auto-detecting from URL
- **Add flow**: Dialog with type selector that dynamically shows relevant fields
- **Sync**: In-card button with inline status indicator (no popup)
- **Delete**: Keep dispatched files, only remove repository + skill records from DB
- **Nav order**: Skills → Repositories → Dispatches → Settings

## Components

### 1. Repositories Page (`src/pages/Repositories.tsx`)

**Header**: Title "Repositories" + "Sync All" button + "Add Repository" button

**List area**: Each repository row contains:

- **Icon**: 🌐 for remote Git, 📁 for local directory
- **Name**: Repository name (bold)
- **Status badge**: `synced` (green), `pending` (blue), `syncing` (yellow), `error` (red)
- **Subtitle**: URL or path · branch (if remote) · skill count · last synced time
- **Actions**: Sync/Retry button + context menu (`···`) with Delete option
- **Error state**: Card border turns red, subtitle shows error message in red

**Empty state**: Centered layout with icon, text "No repositories yet. Add a repository to start discovering skills.", and "+ Add Repository" button.

**Status behavior**:

- `syncing`: Sync button disabled, shows "Syncing..." text
- `error`: Sync button shows "Retry", subtitle shows error message
- `pending`: Sync button highlighted (teal accent)
- `synced`: Sync button in default muted style, subtitle shows relative time

### 2. Add Repository Dialog (`src/components/AddRepositoryDialog.tsx`)

**Type selector**: Two toggle buttons — "Remote Git" / "Local Directory"

**Remote Git form fields**:

- Name (required)
- Git URL (required) — accepts HTTPS or SSH format
- Branch (optional, default: main)
- Authentication: None (Public) / Token / SSH Key — three toggle buttons
  - Token selected: shows Token input field (password type)
  - SSH Key selected: shows SSH key path input field

**Local Directory form fields**:

- Name (required)
- Directory Path (required) — with folder picker button

**Auto-detection**: When URL contains `github.com`, maps to `source_type: "github"`. Otherwise maps to `source_type: "private-git"`.

**Actions**: Cancel + "Add Repository" submit button

### 3. Skills Page Modification

Remove the "Add Skill" button (lines 393-396 in `src/pages/Skills.tsx`). The "Discover Skills" button remains for re-scanning existing repositories.

### 4. Navigation Update

Insert Repositories route in `src/App.tsx`:

- Nav item: `{ path: "/repositories", label: "Repositories", icon: <Database className="h-4 w-4" /> }`
- Position: after Skills (index 1)
- Route: `<Route path="/repositories" element={<Repositories />} />`
- Keyboard shortcut: Cmd/Ctrl+2 (shift existing Dispatches to +3, Settings to +4)

## Data Flow

### Adding a Repository

1. User clicks "+ Add Repository" → dialog opens
2. User selects type, fills fields, submits
3. Frontend maps type: Remote Git → auto-detect `github`/`private-git`, Local → `local`
4. Store calls `invoke("add_repository", { ...params })`
5. Backend creates repo record (status: `pending`), clones/copies to base path
6. On success: dialog closes, list refreshes, status shows `synced`
7. On error: dialog shows error, repo may appear with `error` status

### Syncing a Repository

1. User clicks "Sync" on a card
2. Store calls `invoke("sync_repository", { id })`
3. Backend sets status to `syncing`, performs git pull or file copy, re-scans skills
4. Frontend polls/updates status → `synced` or `error`
5. Skill count updates automatically

### Deleting a Repository

1. User clicks `···` → "Delete" on a card
2. Confirmation dialog appears
3. Store calls `invoke("delete_repository", { id })`
4. Backend removes repository record and associated skills from DB
5. Already dispatched files in target directories are NOT removed

## Files to Modify/Create

| File                                     | Action | Description               |
| ---------------------------------------- | ------ | ------------------------- |
| `src/pages/Repositories.tsx`             | Create | Main page component       |
| `src/components/AddRepositoryDialog.tsx` | Create | Add repository dialog     |
| `src/App.tsx`                            | Modify | Add route + nav item      |
| `src/pages/Skills.tsx`                   | Modify | Remove "Add Skill" button |

No backend changes required — all Tauri commands and store actions already exist.

## Edge Cases

- **Duplicate repo**: Backend `path` column is UNIQUE; backend returns error, frontend shows toast
- **Network failure during sync**: Backend sets status to `error` with error_message; frontend shows error state
- **Sync while already syncing**: Button is disabled, no double-trigger
- **Delete while syncing**: Confirm dialog warns about ongoing sync; if confirmed, cancel sync and delete
