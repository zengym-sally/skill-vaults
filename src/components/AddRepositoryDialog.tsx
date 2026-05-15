import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

type RepoType = "remote" | "local";
type AuthType = "none" | "token" | "ssh" | "http";

interface AddRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function detectSourceType(url: string): "github" | "private-git" {
  if (url.includes("github.com")) {
    return "github";
  }
  return "private-git";
}

export function AddRepositoryDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddRepositoryDialogProps) {
  const [repoType, setRepoType] = useState<RepoType>("remote");
  const [name, setName] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [authType, setAuthType] = useState<AuthType>("none");
  const [token, setToken] = useState("");
  const [sshKeyPath, setSshKeyPath] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [skillsPath, setSkillsPath] = useState("skills");
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (repoType === "remote" && !gitUrl.trim()) {
      toast.error("Git URL is required");
      return;
    }

    if (repoType === "local" && !localPath.trim()) {
      toast.error("Directory path is required");
      return;
    }

    setSubmitting(true);

    try {
      if (repoType === "remote") {
        const sourceType = detectSourceType(gitUrl);
        const authConfig =
          authType === "token"
            ? JSON.stringify({ token })
            : authType === "ssh"
              ? JSON.stringify({ private_key: sshKeyPath })
              : authType === "http"
                ? JSON.stringify({ username, password })
                : "{}";

        await invoke("add_repository", {
          name: name.trim(),
          url: gitUrl.trim(),
          path: gitUrl.trim(),
          sourceType,
          authType: authType === "none" ? undefined : authType,
          authConfig: authConfig !== "{}" ? authConfig : undefined,
          branch: branch.trim() || undefined,
          skillsPath: skillsPath.trim() || undefined,
        });
      } else {
        await invoke("add_repository", {
          name: name.trim(),
          path: localPath.trim(),
          sourceType: "local",
          skillsPath: skillsPath.trim() || undefined,
          copy: true,
        });
      }

      toast.success(`Repository "${name}" added successfully`);
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        `Failed to add repository: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickDirectory = async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (selected) {
        setLocalPath(selected);
      }
    } catch {
      // User cancelled dialog
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Repository</DialogTitle>
          <DialogDescription>
            Add a skill source repository to discover and manage skills.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Type selector */}
          <div className="grid gap-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={repoType === "remote" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setRepoType("remote")}
                disabled={submitting}
              >
                Remote Git
              </Button>
              <Button
                type="button"
                variant={repoType === "local" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setRepoType("local")}
                disabled={submitting}
              >
                Local Directory
              </Button>
            </div>
          </div>

          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="repo-name">Name</Label>
            <Input
              id="repo-name"
              placeholder="e.g. open-skills"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Skills directory */}
          <div className="grid gap-2">
            <Label htmlFor="skills-path">
              Skills Directory{" "}
              <span className="text-muted-foreground">
                (subdirectory within repo, default: skills)
              </span>
            </Label>
            <Input
              id="skills-path"
              placeholder="skills"
              value={skillsPath}
              onChange={(e) => setSkillsPath(e.target.value)}
              disabled={submitting}
            />
          </div>

          {repoType === "remote" ? (
            <>
              {/* Git URL */}
              <div className="grid gap-2">
                <Label htmlFor="git-url">Git URL</Label>
                <Input
                  id="git-url"
                  placeholder="https://github.com/user/repo or git@github.com:user/repo"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Branch */}
              <div className="grid gap-2">
                <Label htmlFor="repo-branch">
                  Branch{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="repo-branch"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Auth type */}
              <div className="grid gap-2">
                <Label>Authentication</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={authType === "none" ? "secondary" : "ghost"}
                    onClick={() => setAuthType("none")}
                    disabled={submitting}
                  >
                    None (Public)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={authType === "token" ? "secondary" : "ghost"}
                    onClick={() => setAuthType("token")}
                    disabled={submitting}
                  >
                    Token
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={authType === "ssh" ? "secondary" : "ghost"}
                    onClick={() => setAuthType("ssh")}
                    disabled={submitting}
                  >
                    SSH Key
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={authType === "http" ? "secondary" : "ghost"}
                    onClick={() => setAuthType("http")}
                    disabled={submitting}
                  >
                    User/Pass
                  </Button>
                </div>
              </div>

              {/* Token input */}
              {authType === "token" && (
                <div className="grid gap-2">
                  <Label htmlFor="repo-token">Token</Label>
                  <Input
                    id="repo-token"
                    type="password"
                    placeholder="ghp_xxxx or personal access token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              )}

              {/* SSH key path input */}
              {authType === "ssh" && (
                <div className="grid gap-2">
                  <Label htmlFor="ssh-key">SSH Key Path</Label>
                  <Input
                    id="ssh-key"
                    placeholder="~/.ssh/id_ed25519"
                    value={sshKeyPath}
                    onChange={(e) => setSshKeyPath(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              )}

              {/* HTTP auth input */}
              {authType === "http" && (
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
              )}
            </>
          ) : (
            <>
              {/* Local directory path */}
              <div className="grid gap-2">
                <Label htmlFor="local-path">Directory Path</Label>
                <div className="flex gap-2">
                  <Input
                    id="local-path"
                    placeholder="/path/to/skills/directory"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    disabled={submitting}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePickDirectory}
                    disabled={submitting}
                  >
                    Browse
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Repository"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
