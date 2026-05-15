import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRepositoryStore } from "@/store/repositoryStore";
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
import {
  RefreshCw,
  Plus,
  FolderGit2,
  FolderOpen,
  MoreVertical,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { AddRepositoryDialog } from "@/components/AddRepositoryDialog";
import { Repository } from "@/types/repository";

const Badge = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
  >
    {children}
  </span>
);

function getStatusStyle(status: string) {
  switch (status) {
    case "synced":
      return {
        badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        border: "",
        label: "synced",
      };
    case "syncing":
      return {
        badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        border: "border-amber-500/20",
        label: "syncing",
      };
    case "error":
      return {
        badge: "bg-red-500/10 text-red-500 border-red-500/20",
        border: "border-red-500/20",
        label: "error",
      };
    case "pending":
    default:
      return {
        badge: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        border: "",
        label: "pending",
      };
  }
}

function getRelativeTime(dateStr?: string): string {
  if (!dateStr) return "not synced yet";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface RepoRowProps {
  repo: Repository;
  skillCount: number;
  syncingId: string | null;
  onSync: (id: string) => void;
  onEdit: (repo: Repository) => void;
  onDelete: (repo: Repository) => void;
}

function RepoRow({
  repo,
  skillCount,
  syncingId,
  onSync,
  onEdit,
  onDelete,
}: RepoRowProps) {
  const status = getStatusStyle(repo.status);
  const isRemote = repo.source_type !== "local";
  const isSyncing = syncingId === repo.id || repo.status === "syncing";

  const subtitleParts: string[] = [];
  if (isRemote && repo.url) {
    try {
      const url = new URL(
        repo.url.replace("git@", "https://").replace(":", "/"),
      );
      subtitleParts.push(url.host + url.pathname.replace(".git", ""));
    } catch {
      subtitleParts.push(repo.url);
    }
    if (repo.branch) subtitleParts.push(repo.branch);
  } else {
    subtitleParts.push(repo.path);
  }
  if (repo.status === "synced" && repo.last_synced_at) {
    subtitleParts.push(getRelativeTime(repo.last_synced_at));
  }

  return (
    <div
      className={`flex items-center justify-between rounded-xl border bg-white/40 backdrop-blur-sm p-4 transition-all hover:bg-white/60 ${status.border}`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isRemote ? "bg-teal-500/10" : "bg-blue-500/10"
          }`}
        >
          {isRemote ? (
            <FolderGit2 className="h-4.5 w-4.5 text-teal-600" />
          ) : (
            <FolderOpen className="h-4.5 w-4.5 text-blue-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{repo.name}</span>
            <Badge className={status.badge}>{status.label}</Badge>
            <Badge className="bg-foreground/5 text-foreground/60 border-foreground/10">
              {skillCount} skill{skillCount !== 1 ? "s" : ""}
            </Badge>
          </div>
          <p
            className={`text-xs mt-0.5 truncate ${
              repo.status === "error" && repo.error_message
                ? "text-red-500"
                : "text-muted-foreground"
            }`}
          >
            {repo.status === "error" && repo.error_message
              ? repo.error_message
              : subtitleParts.join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0 ml-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSync(repo.id)}
          disabled={isSyncing}
          className={
            repo.status === "pending"
              ? "border-teal-500/30 text-teal-600 hover:bg-teal-500/10"
              : ""
          }
        >
          {isSyncing ? (
            <>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Syncing...
            </>
          ) : repo.status === "error" ? (
            "Retry"
          ) : (
            "Sync"
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(repo)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => onDelete(repo)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function EditRepoForm({
  repo,
  onSave,
  onCancel,
}: {
  repo: Repository;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(repo.name);
  const [skillsPath, setSkillsPath] = useState(repo.skills_path);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await invoke("update_repository", {
        id: repo.id,
        name: name.trim(),
        skillsPath: skillsPath.trim() || "skills",
      });
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
    <div className="grid gap-4 py-4">
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
    </div>
  );
}

export function Repositories() {
  const {
    repositories,
    skillCounts,
    loading,
    getRepositories,
    getSkillCounts,
    syncRepository,
    syncAllRepositories,
    deleteRepository,
  } = useRepositoryStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRepo, setEditingRepo] = useState<Repository | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Repository | null>(null);

  const loadData = useCallback(async () => {
    await Promise.all([getRepositories(), getSkillCounts()]);
  }, [getRepositories, getSkillCounts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh while any repo is syncing
  useEffect(() => {
    const hasSyncing = repositories.some((r) => r.status === "syncing");
    if (!hasSyncing) return;
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [repositories, loadData]);

  const handleSync = useCallback(
    async (id: string) => {
      setSyncingId(id);
      try {
        const updated = await syncRepository(id);
        // Store already updated repos array, but also refresh skill counts
        await getSkillCounts();
        if (updated.status === "synced") {
          toast.success("Repository synced successfully");
        } else if (updated.status === "error") {
          toast.error(
            `Sync failed: ${updated.error_message ?? "Unknown error"}`,
          );
        }
      } catch (error) {
        toast.error(
          `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Re-fetch to get the error status from backend
        await getRepositories();
      } finally {
        setSyncingId(null);
      }
    },
    [syncRepository, getSkillCounts, getRepositories],
  );

  const handleSyncAll = useCallback(async () => {
    setSyncingAll(true);
    try {
      await syncAllRepositories();
      await getSkillCounts();
      toast.success("All repositories synced");
    } catch (error) {
      toast.error(
        `Sync all failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setSyncingAll(false);
    }
  }, [syncAllRepositories, getSkillCounts]);

  const handleDelete = useCallback(
    async (repo: Repository) => {
      setDeleteTarget(null);
      try {
        await deleteRepository(repo.id);
        toast.success(`Repository "${repo.name}" deleted`);
        await loadData();
      } catch (error) {
        toast.error(
          `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [deleteRepository, loadData],
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Repositories</h1>
          <p className="text-muted-foreground">
            Manage your skill source repositories
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSyncAll}
            disabled={syncingAll || repositories.length === 0}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${syncingAll ? "animate-spin" : ""}`}
            />
            Sync All
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Repository
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && repositories.length === 0 && (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground/40" />
        </div>
      )}

      {/* Empty state */}
      {!loading && repositories.length === 0 && (
        <div className="flex flex-col justify-center items-center py-20 text-center">
          <div className="w-16 h-16 bg-white/50 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4">
            <FolderGit2 className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-medium mb-2">No repositories yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Add a repository to start discovering skills.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Repository
          </Button>
        </div>
      )}

      {/* Repository list */}
      {repositories.length > 0 && (
        <div className="flex flex-col gap-3">
          {repositories.map((repo) => (
            <RepoRow
              key={repo.id}
              repo={repo}
              skillCount={skillCounts[repo.id] ?? 0}
              syncingId={syncingId}
              onSync={handleSync}
              onEdit={setEditingRepo}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Add Repository Dialog */}
      <AddRepositoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={loadData}
      />

      {/* Edit Repository Dialog */}
      <Dialog
        open={!!editingRepo}
        onOpenChange={(v) => {
          if (!v) setEditingRepo(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Repository</DialogTitle>
            <DialogDescription>
              Update repository settings for &quot;{editingRepo?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          {editingRepo && (
            <EditRepoForm
              repo={editingRepo}
              onSave={async () => {
                setEditingRepo(null);
                await loadData();
              }}
              onCancel={() => setEditingRepo(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Repository</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This will remove the repository and its skill records. Already
              dispatched files in target directories will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) handleDelete(deleteTarget);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
