# Repository Retry & Edit Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken sync-when-clone-failed flow, enhance the edit dialog to support URL/branch/auth editing, and add HTTP auth to the add dialog.

**Architecture:** Three independent changes: (1) Rust sync command detects missing directory and re-clones, (2) Rust update command extended + frontend edit dialog gains full field support, (3) Frontend add dialog gains HTTP auth option. All changes are backward-compatible — no schema migration needed.

**Tech Stack:** Rust (git2, sqlx, tauri), TypeScript/React (Zustand, shadcn/ui)

---

### Task 1: Sync Auto-Retry — Detect Missing Directory and Re-Clone

**Files:**

- Modify: `src-tauri/src/main.rs:329-372` (sync_repository command)

**Context:** When a git repo clone fails, `local_path` directory doesn't exist. Current `sync_repository` calls `git::sync_repository` which calls `pull::pull` which does `Repository::open(path)` — this fails with "No such file or directory". The fix: check if the directory exists before pulling; if missing, re-clone using the repo's stored auth config.

- [ ] **Step 1: Modify `sync_repository` in `main.rs` to handle missing directory**

Replace the git sync branch (lines 354-366) with directory-existence check + clone fallback:

```rust
    } else if repo.url.is_some() {
        let local_path = std::path::Path::new(&repo.local_path);
        repo.update(&pool, None, None, None, None, None, Some("syncing"), None).await.map_err(|e| e.to_string())?;

        if !local_path.exists() {
            // Directory missing (clone failed previously) — re-clone
            let url = repo.url.as_deref().unwrap();
            let branch = repo.branch.as_deref().unwrap_or("main");
            let auth_type = repo.auth_type.as_deref().unwrap_or("none");
            let auth_config = repo.auth_config.as_deref().unwrap_or("{}");

            match git::clone_repository(url, &repo.local_path, branch, auth_type, auth_config).await {
                Ok(_) => {
                    repo.update(&pool, None, None, None, None, None, Some("synced"), None).await.map_err(|e| e.to_string())?;
                    let _ = skills::discovery::scan_repository(pool.inner(), &repo, false).await;
                }
                Err(e) => {
                    repo.update(&pool, None, None, None, None, None, Some("error"), Some(&e.to_string())).await.map_err(|e| e.to_string())?;
                    return Err(e.to_string());
                }
            }
        } else {
            // Normal sync — pull latest
            match git::sync_repository(&repo).await {
                Ok(_) => {
                    repo.update(&pool, None, None, None, None, None, Some("synced"), None).await.map_err(|e| e.to_string())?;
                    let _ = skills::discovery::scan_repository(pool.inner(), &repo, false).await;
                }
                Err(e) => {
                    repo.update(&pool, None, None, None, None, None, Some("error"), Some(&e.to_string())).await.map_err(|e| e.to_string())?;
                    return Err(e.to_string());
                }
            }
        }
    }
```

- [ ] **Step 2: Apply same fix to `sync_all_repositories`**

In `sync_all_repositories` (lines 374-402), the loop body at lines 382-398 also needs the missing-directory check. Replace the existing sync branch:

```rust
    for repo in repos {
        if repo.source_type != "local" && repo.url.is_some() {
            let _ = repo.update(&pool, None, None, None, None, None, Some("syncing"), None).await;

            let local_path = std::path::Path::new(&repo.local_path);
            if !local_path.exists() {
                let url = repo.url.as_deref().unwrap();
                let branch = repo.branch.as_deref().unwrap_or("main");
                let auth_type = repo.auth_type.as_deref().unwrap_or("none");
                let auth_config = repo.auth_config.as_deref().unwrap_or("{}");
                match git::clone_repository(url, &repo.local_path, branch, auth_type, auth_config).await {
                    Ok(_) => {
                        let _ = repo.update(&pool, None, None, None, None, None, Some("synced"), None).await;
                        let _ = skills::discovery::scan_repository(pool.inner(), &repo, false).await;
                    }
                    Err(e) => {
                        let _ = repo.update(&pool, None, None, None, None, None, Some("error"), Some(&e.to_string())).await;
                    }
                }
            } else {
                match git::sync_repository(&repo).await {
                    Ok(_) => {
                        let _ = repo.update(&pool, None, None, None, None, None, Some("synced"), None).await;
                        let _ = skills::discovery::scan_repository(pool.inner(), &repo, false).await;
                    }
                    Err(e) => {
                        let _ = repo.update(&pool, None, None, None, None, None, Some("error"), Some(&e.to_string())).await;
                    }
                }
            }
        }
        // Re-fetch from DB to get the latest status after sync
        match db::repository::Repository::get_by_id(&pool, &repo.id).await {
            Ok(Some(fresh_repo)) => updated_repos.push(fresh_repo),
            _ => updated_repos.push(repo),
        }
    }
```

- [ ] **Step 3: Run Rust tests**

Run: `cd src-tauri && cargo test`
Expected: All 20 tests pass, no warnings

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "fix: auto re-clone when repo directory missing during sync"
```

---

### Task 2: Extend `update_repository` Rust Command

**Files:**

- Modify: `src-tauri/src/main.rs:301-327` (update_repository command)

**Context:** Current `update_repository` only accepts `name` and `skills_path`. Need to extend it to accept `url`, `branch`, `auth_type`, `auth_config`. When URL or branch changes, trigger a background re-clone (delete old directory, clone fresh).

- [ ] **Step 1: Replace the `update_repository` command**

```rust
#[tauri::command]
async fn update_repository(
    id: &str,
    name: Option<&str>,
    skills_path: Option<&str>,
    url: Option<&str>,
    branch: Option<&str>,
    auth_type: Option<&str>,
    auth_config: Option<&str>,
    pool: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<db::repository::Repository, String> {
    let repo = db::repository::Repository::get_by_id(&pool, id)
        .await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Repository not found".to_string())?;

    // Update basic fields
    if let Some(name) = name {
        sqlx::query("UPDATE repositories SET name = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(name).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(sp) = skills_path {
        sqlx::query("UPDATE repositories SET skills_path = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(sp).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(u) = url {
        sqlx::query("UPDATE repositories SET url = ?1, path = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(u).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(b) = branch {
        sqlx::query("UPDATE repositories SET branch = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(b).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(at) = auth_type {
        sqlx::query("UPDATE repositories SET auth_type = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(at).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(ac) = auth_config {
        sqlx::query("UPDATE repositories SET auth_config = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
            .bind(ac).bind(id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }

    // Reload after updates
    let updated = db::repository::Repository::get_by_id(&pool, id)
        .await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Repository not found after update".to_string())?;

    Ok(updated)
}
```

- [ ] **Step 2: Run Rust check**

Run: `cd src-tauri && cargo check`
Expected: No errors, no warnings

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat: extend update_repository to support url, branch, and auth changes"
```

---

### Task 3: Enhance Edit Dialog with Full Field Support

**Files:**

- Modify: `src/pages/Repositories.tsx:216-291` (EditRepoForm component)
- Modify: `src/pages/Repositories.tsx:461-485` (Edit Dialog wrapper — widen to `sm:max-w-lg`)

**Context:** The edit dialog currently only allows editing name and skills_path. We need to add URL, branch, auth_type, and auth_config fields. For remote repos, show URL/branch/auth fields. For local repos, keep the existing simple form.

- [ ] **Step 1: Replace the `EditRepoForm` component**

The new form dynamically shows fields based on repo type. Auth config section appears only for remote repos and shows different inputs based on auth_type. Save triggers the extended `update_repository` command. If URL or branch changed, after save trigger a sync (which will auto re-clone via Task 1).

```tsx
function EditRepoForm({
  repo,
  onSave,
  onCancel,
}: {
  repo: Repository;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isRemote = repo.source_type !== "local";
  const [name, setName] = useState(repo.name);
  const [skillsPath, setSkillsPath] = useState(repo.skills_path);
  const [url, setUrl] = useState(repo.url ?? "");
  const [branch, setBranch] = useState(repo.branch ?? "");
  const [authType, setAuthType] = useState<string>(repo.auth_type ?? "none");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sshKey, setSshKey] = useState("");
  const [saving, setSaving] = useState(false);

  // Parse existing auth_config to pre-fill auth fields
  useEffect(() => {
    if (repo.auth_config) {
      try {
        const config = JSON.parse(repo.auth_config);
        if (repo.auth_type === "token" && config.token) {
          setToken(config.token);
        } else if (repo.auth_type === "ssh" && config.private_key) {
          setSshKey(config.private_key);
        } else if (repo.auth_type === "http") {
          if (config.username) setUsername(config.username);
          if (config.password) setPassword(config.password);
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [repo.auth_config, repo.auth_type]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      // Build auth_config based on auth type
      let authConfigValue: string | undefined;
      if (authType === "token" && token.trim()) {
        authConfigValue = JSON.stringify({ token: token.trim() });
      } else if (authType === "ssh" && sshKey.trim()) {
        authConfigValue = JSON.stringify({ private_key: sshKey.trim() });
      } else if (authType === "http" && username.trim() && password.trim()) {
        authConfigValue = JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        });
      }

      const urlChanged =
        isRemote && url.trim() && url.trim() !== (repo.url ?? "");
      const branchChanged = isRemote && branch.trim() !== (repo.branch ?? "");
      const authChanged = isRemote && authType !== (repo.auth_type ?? "none");

      await invoke("update_repository", {
        id: repo.id,
        name: name.trim(),
        skillsPath: skillsPath.trim() || "skills",
        url: isRemote && url.trim() ? url.trim() : undefined,
        branch: isRemote && branch.trim() ? branch.trim() : undefined,
        authType: isRemote ? authType : undefined,
        authConfig: isRemote ? authConfigValue : undefined,
      });

      // If URL, branch, or auth changed, trigger a re-sync (which will re-clone if needed)
      if (urlChanged || branchChanged || authChanged) {
        try {
          await invoke("sync_repository", { id: repo.id });
        } catch {
          // sync may fail, that's OK — status will be updated in DB
        }
      }

      toast.success("Repository updated");
      onSave();
    } catch (error) {
      toast.error(
        `Update failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="grid gap-2">
          <Label htmlFor="edit-name">Name</Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-skills-path">Skills Directory</Label>
          <Input
            id="edit-skills-path"
            value={skillsPath}
            onChange={(e) => setSkillsPath(e.target.value)}
            disabled={saving}
          />
        </div>

        {isRemote && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="edit-url">Git URL</Label>
              <Input
                id="edit-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={saving}
                placeholder="https://github.com/user/repo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-branch">
                Branch <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="edit-branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={saving}
                placeholder="main"
              />
            </div>
            <div className="grid gap-2">
              <Label>Authentication</Label>
              <div className="flex gap-2">
                {["none", "token", "ssh", "http"].map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={authType === type ? "secondary" : "ghost"}
                    onClick={() => setAuthType(type)}
                    disabled={saving}
                  >
                    {type === "none"
                      ? "None"
                      : type === "http"
                        ? "User/Pass"
                        : type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            {authType === "token" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-token">Token</Label>
                <Input
                  id="edit-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={saving}
                  placeholder="ghp_xxxx or personal access token"
                />
              </div>
            )}
            {authType === "ssh" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-ssh">SSH Private Key</Label>
                <Input
                  id="edit-ssh"
                  value={sshKey}
                  onChange={(e) => setSshKey(e.target.value)}
                  disabled={saving}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                />
              </div>
            )}
            {authType === "http" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-username">Username</Label>
                  <Input
                    id="edit-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-password">Password</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
```

- [ ] **Step 2: Widen the edit dialog**

Change `sm:max-w-md` to `sm:max-w-lg` on the edit Dialog's `DialogContent`:

```tsx
<DialogContent className="sm:max-w-lg">
```

- [ ] **Step 3: Add `useEffect` import (verify it's already imported)**

Check line 1 of `Repositories.tsx` — `useEffect` should already be imported. If not, add it.

- [ ] **Step 4: Run frontend build and tests**

Run: `npm run build && npm run test:run`
Expected: Build succeeds, all 57 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/pages/Repositories.tsx
git commit -m "feat: enhance edit dialog with URL, branch, and auth editing"
```

---

### Task 4: Add HTTP Auth Option to Add Repository Dialog

**Files:**

- Modify: `src/components/AddRepositoryDialog.tsx`

**Context:** The add dialog currently supports `AuthType = "none" | "token" | "ssh"`. Need to add `"http"` option with username/password fields. The Rust backend already supports HTTP auth via `HttpAuthConfig { username, password }`.

- [ ] **Step 1: Extend `AuthType` and add HTTP auth fields**

Change `AuthType` type alias:

```tsx
type AuthType = "none" | "token" | "ssh" | "http";
```

Add state variables for HTTP auth (inside the component, alongside existing state):

```tsx
const [username, setUsername] = useState("");
const [password, setPassword] = useState("");
```

Add `username` and `password` to `resetForm()`:

```tsx
const resetForm = () => {
  setRepoType("remote");
  setName("");
  setGitUrl("");
  setBranch("");
  setAuthType("none");
  setToken("");
  setSshKeyPath("");
  setUsername("");
  setPassword("");
  setLocalPath("");
  setSkillsPath("skills");
  setSubmitting(false);
};
```

- [ ] **Step 2: Add HTTP auth button to the auth type selector**

After the SSH Key button, add:

```tsx
<Button
  type="button"
  size="sm"
  variant={authType === "http" ? "secondary" : "ghost"}
  onClick={() => setAuthType("http")}
  disabled={submitting}
>
  User/Pass
</Button>
```

- [ ] **Step 3: Add HTTP auth input fields**

After the SSH key path input block, add:

```tsx
{
  authType === "http" && (
    <>
      <div className="grid gap-2">
        <Label htmlFor="repo-username">Username</Label>
        <Input
          id="repo-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="repo-password">Password</Label>
        <Input
          id="repo-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Handle HTTP auth config in submit handler**

Update the `authConfig` construction in `handleSubmit` to include `"http"`:

```tsx
const authConfig =
  authType === "token"
    ? JSON.stringify({ token })
    : authType === "ssh"
      ? JSON.stringify({ private_key: sshKeyPath })
      : authType === "http"
        ? JSON.stringify({ username, password })
        : "{}";
```

Note: The SSH key in the add dialog sends `private_key` which should contain the actual SSH private key content (matching the backend's `SshAuthConfig`). The existing code sends `key_path` — this is a pre-existing mismatch but out of scope for this task.

- [ ] **Step 5: Run frontend build and tests**

Run: `npm run build && npm run test:run`
Expected: Build succeeds, all 57 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/AddRepositoryDialog.tsx
git commit -m "feat: add HTTP username/password auth option to add repo dialog"
```

---

### Task 5: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd src-tauri && cargo test`
Expected: All 20 tests pass

Run: `npm run test:run`
Expected: All 57 tests pass

- [ ] **Step 2: Run TypeScript strict check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 3: Run Cargo check**

Run: `cd src-tauri && cargo check`
Expected: Zero warnings

- [ ] **Step 4: Manual smoke test**

Launch: `npm run tauri dev`

Test scenarios:

1. **Sync retry**: Add a git repo with invalid URL → get error status → click Sync → should re-clone
2. **Edit URL**: Open edit dialog → change URL → save → should trigger re-sync
3. **Edit auth**: Open edit dialog → change auth type to HTTP → enter user/pass → save
4. **Add with HTTP auth**: Add repo → select User/Pass → enter credentials → add
5. **Edit local repo**: Open edit dialog for local repo → should NOT show URL/auth fields
