import { useEffect, useState, useMemo } from "react";
import { useDispatchStore } from "@/store/dispatchStore";
import { useSkillStore } from "@/store/skillStore";
import { toast } from "sonner";
import {
  DispatchMethod,
  SyncStatus,
  parseDispatchMethod,
  type Dispatch,
  type TargetDir,
} from "@/types/dispatch";
import { Skill } from "@/types/skill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Plus,
  Trash2,
  Send,
  FolderOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  FolderPlus,
  Eye,
  ChevronDown,
  ChevronRight,
  Search,
  Pencil,
} from "lucide-react";
import { open as openFolderPicker } from "@tauri-apps/plugin-dialog";
import { SkillDetailDialog } from "@/components/skills/SkillDetailDialog";
import { SkillPicker } from "@/components/skills/SkillPicker";

// --- Shared helpers ---

const getStatusColor = (status: SyncStatus) => {
  switch (status) {
    case SyncStatus.Synced:
      return "bg-teal-500/10 text-teal-600 border-teal-500/20";
    case SyncStatus.Outdated:
      return "bg-teal-500/8 text-teal-500 border-teal-500/15";
    case SyncStatus.Conflict:
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case SyncStatus.Error:
      return "bg-red-500/10 text-red-600 border-red-500/20";
  }
};

const getStatusIcon = (status: SyncStatus) => {
  switch (status) {
    case SyncStatus.Synced:
      return <CheckCircle2 className="h-3 w-3 mr-1" />;
    case SyncStatus.Outdated:
      return <Clock className="h-3 w-3 mr-1" />;
    case SyncStatus.Conflict:
      return <AlertTriangle className="h-3 w-3 mr-1" />;
    case SyncStatus.Error:
      return <AlertCircle className="h-3 w-3 mr-1" />;
  }
};

const getMethodColor = (method: DispatchMethod) => {
  switch (method) {
    case DispatchMethod.Symlink:
      return "bg-teal-500/10 text-teal-600 border-teal-500/20";
    case DispatchMethod.Copy:
      return "bg-teal-500/8 text-teal-500 border-teal-500/15";
  }
};

// --- Sub-components ---

function DispatchSkillRow({
  dispatch,
  skill,
  onSync,
  onRemove,
  onDetail,
  loading,
}: {
  dispatch: Dispatch;
  skill: Skill | undefined;
  onSync: () => void;
  onRemove: () => void;
  onDetail: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/40 transition-colors group">
      <span
        className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium min-w-[72px] justify-center ${getStatusColor(dispatch.sync_status)}`}
      >
        {getStatusIcon(dispatch.sync_status)}
        {dispatch.sync_status}
      </span>
      <span
        className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${getMethodColor(dispatch.method)}`}
      >
        {dispatch.method}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium shrink-0">
          {skill?.name ?? "Unknown Skill"}
        </span>
        {skill?.aiSummary && (
          <span
            className="text-xs text-muted-foreground/70 truncate"
            title={skill.aiSummary}
          >
            {skill.aiSummary}
          </span>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onDetail}
          title="View skill detail"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={
            loading ||
            dispatch.sync_status === SyncStatus.Conflict ||
            dispatch.sync_status === SyncStatus.Error
          }
          onClick={onSync}
          title="Sync this skill"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
          disabled={loading}
          onClick={onRemove}
          title="Remove dispatch"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function AddTargetDirDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addTargetDir } = useDispatchStore();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [skillsSubdir, setSkillsSubdir] = useState("");
  const [description, setDescription] = useState("");

  const handlePickFolder = async () => {
    const selected = await openFolderPicker({
      directory: true,
      multiple: false,
    });
    if (selected) {
      setPath(selected);
      if (!name) {
        const parts = selected.split("/");
        setName(parts[parts.length - 1] || "New Project");
      }
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !path.trim()) {
      toast.error("Name and path are required");
      return;
    }
    try {
      await addTargetDir({
        name: name.trim(),
        path: path.trim(),
        skillsSubdir: skillsSubdir.trim() || undefined,
        description: description.trim() || null,
      });
      toast.success("Project directory added");
      onOpenChange(false);
      setName("");
      setPath("");
      setSkillsSubdir("");
      setDescription("");
    } catch (error) {
      toast.error(
        `Failed to add directory: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Project Directory</DialogTitle>
          <DialogDescription>
            Add a target directory to dispatch skills to.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Directory Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Frontend Project"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Directory Path</label>
            <div className="flex gap-2">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/project"
                className="flex-1"
              />
              <Button variant="outline" onClick={handlePickFolder}>
                <FolderPlus className="h-4 w-4 mr-1" />
                Browse
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Skills Subdirectory (optional)
            </label>
            <Input
              value={skillsSubdir}
              onChange={(e) => setSkillsSubdir(e.target.value)}
              placeholder="e.g., .claude/skills"
            />
            <p className="text-xs text-muted-foreground">
              Skills will be dispatched to [path]/[subdirectory]. Leave empty to
              use the root path.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Description (optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this project..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || !path.trim()}
          >
            Add Directory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createTemplate } = useDispatchStore();
  const { skills } = useSkillStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (selectedSkills.size === 0) {
      toast.error("Select at least one skill");
      return;
    }
    try {
      await createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        skillIds: Array.from(selectedSkills),
      });
      toast.success("Template created");
      onOpenChange(false);
      setName("");
      setDescription("");
      setSelectedSkills(new Set());
    } catch (error) {
      toast.error(
        `Failed to create template: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return (
    <>
      <Dialog
        open={open && !showPicker}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Dispatch Template</DialogTitle>
            <DialogDescription>
              Save a group of skills to dispatch together later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Frontend Project Setup"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Description (optional)
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this template is used for..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Skills ({selectedSkills.size} selected)
              </label>
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setShowPicker(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {selectedSkills.size > 0
                  ? `${selectedSkills.size} skills selected`
                  : "Click to select skills..."}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || selectedSkills.size === 0}
            >
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SkillPicker
        skills={skills}
        selected={selectedSkills}
        onSelectionChange={setSelectedSkills}
        open={showPicker}
        onOpenChange={(v) => {
          if (!v) setShowPicker(false);
        }}
        title="Select Skills for Template"
        description="Choose the skills to include in this template."
        confirmLabel="Done"
        onConfirm={() => setShowPicker(false)}
      />
    </>
  );
}

function EditTemplateDialog({
  templateId,
  open,
  onOpenChange,
}: {
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { templates, updateTemplate } = useDispatchStore();
  const { skills } = useSkillStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (open && templateId) {
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl) {
        setName(tpl.name);
        setDescription(tpl.description ?? "");
        try {
          setSelectedSkills(new Set(JSON.parse(tpl.skill_ids)));
        } catch {
          setSelectedSkills(new Set());
        }
      }
    }
  }, [open, templateId, templates]);

  const handleSave = async () => {
    if (!templateId || !name.trim()) return;
    try {
      await updateTemplate(templateId, {
        name: name.trim(),
        description: description.trim() || null,
        skillIds: Array.from(selectedSkills),
      });
      toast.success("Template updated");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        `Failed to update template: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return (
    <>
      <Dialog
        open={open && !showPicker}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Modify template skills and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Template description..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Skills ({selectedSkills.size} selected)
              </label>
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setShowPicker(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {selectedSkills.size > 0
                  ? `${selectedSkills.size} skills selected`
                  : "Click to select skills..."}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SkillPicker
        skills={skills}
        selected={selectedSkills}
        onSelectionChange={setSelectedSkills}
        open={showPicker}
        onOpenChange={(v) => {
          if (!v) setShowPicker(false);
        }}
        title="Edit Template Skills"
        description="Update the skills included in this template."
        confirmLabel="Done"
        onConfirm={() => setShowPicker(false)}
      />
    </>
  );
}

function ApplyTemplateDialog({
  templateId,
  open,
  onOpenChange,
}: {
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { targetDirs, dispatchTemplate } = useDispatchStore();
  const [targetDirId, setTargetDirId] = useState("");
  const [method, setMethod] = useState<DispatchMethod>(DispatchMethod.Symlink);

  useEffect(() => {
    if (!open) {
      setTargetDirId("");
      setMethod(DispatchMethod.Symlink);
    }
  }, [open]);

  const handleApply = async () => {
    if (!templateId || !targetDirId) {
      toast.error("Please select a target directory");
      return;
    }
    try {
      const result = await dispatchTemplate(templateId, targetDirId, method);
      if (result.errors.length > 0) {
        toast.warning(
          `Dispatched ${result.successful.length} skills, ${result.errors.length} failed`,
        );
      } else {
        toast.success(
          `Successfully dispatched ${result.successful.length} skills`,
        );
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        `Dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply Template</DialogTitle>
          <DialogDescription>
            Select target directory and dispatch method.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Directory</label>
            <Select value={targetDirId} onValueChange={setTargetDirId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a target directory" />
              </SelectTrigger>
              <SelectContent>
                {targetDirs.map((dir) => (
                  <SelectItem key={dir.id} value={dir.id}>
                    {dir.name} ({dir.path})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {targetDirs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No target directories. Add one first.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Dispatch Method</label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(parseDispatchMethod(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DispatchMethod.Symlink}>Symlink</SelectItem>
                <SelectItem value={DispatchMethod.Copy}>Copy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!targetDirId}>
            <Send className="mr-2 h-4 w-4" />
            Dispatch All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Page ---

export function DispatchPage() {
  const {
    targetDirs,
    dispatches,
    templates,
    loading,
    fetchTargetDirs,
    fetchDispatches,
    fetchTemplates,
    syncTargetDirDispatches,
    syncDispatchedSkill,
    bulkDispatch,
    deleteDispatch,
    deleteTargetDir,
    deleteTemplate,
  } = useDispatchStore();
  const { skills, fetchSkills } = useSkillStore();

  const [selectedDirId, setSelectedDirId] = useState<string | null>(null);
  const [showAddDir, setShowAddDir] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(
    null,
  );
  const [templatesExpanded, setTemplatesExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showDispatchPicker, setShowDispatchPicker] = useState(false);
  const [dispatchPickerSelected, setDispatchPickerSelected] = useState<
    Set<string>
  >(new Set());

  useEffect(() => {
    fetchTargetDirs().catch(() => {});
    fetchSkills().catch(() => {});
    fetchDispatches().catch(() => {});
    fetchTemplates().catch(() => {});
  }, [fetchTargetDirs, fetchSkills, fetchDispatches, fetchTemplates]);

  const selectedDir = targetDirs.find((d) => d.id === selectedDirId) ?? null;
  const skillMap = useMemo(() => {
    const map = new Map<string, Skill>();
    for (const s of skills) map.set(s.id, s);
    return map;
  }, [skills]);

  const dirDispatches = useMemo(() => {
    if (!selectedDirId) return [];
    return dispatches.filter((d) => d.target_dir === selectedDirId);
  }, [dispatches, selectedDirId]);

  const filteredDispatches = useMemo(() => {
    if (!searchQuery) return dirDispatches;
    const q = searchQuery.toLowerCase();
    return dirDispatches.filter((d) => {
      const skill = skillMap.get(d.skill_id);
      return skill?.name.toLowerCase().includes(q);
    });
  }, [dirDispatches, searchQuery, skillMap]);

  const getSkillName = (skillId: string) =>
    skillMap.get(skillId)?.name ?? "Unknown Skill";

  const getDirStats = (dirId: string) => {
    const dirDs = dispatches.filter((d) => d.target_dir === dirId);
    const synced = dirDs.filter(
      (d) => d.sync_status === SyncStatus.Synced,
    ).length;
    const outdated = dirDs.filter(
      (d) => d.sync_status === SyncStatus.Outdated,
    ).length;
    const errors = dirDs.filter(
      (d) =>
        d.sync_status === SyncStatus.Error ||
        d.sync_status === SyncStatus.Conflict,
    ).length;
    return { total: dirDs.length, synced, outdated, errors };
  };

  const handleSyncAll = async () => {
    if (!selectedDirId) return;
    try {
      const result = await syncTargetDirDispatches(selectedDirId);
      if (result.failed.length > 0) {
        toast.warning(
          `Synced ${result.synced.length} skills, ${result.failed.length} failed`,
        );
      } else {
        toast.success(`All ${result.synced.length} skills synced`);
      }
    } catch (error) {
      toast.error(
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleSyncOne = async (dispatchId: string) => {
    try {
      await syncDispatchedSkill(dispatchId);
    } catch (error) {
      toast.error(
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleDeleteDir = async (dir: TargetDir) => {
    const dirDs = dispatches.filter((d) => d.target_dir === dir.id);
    const msg =
      dirDs.length > 0
        ? `Delete "${dir.name}"? ${dirDs.length} dispatched skills will be removed from the list (files kept on disk).`
        : `Delete "${dir.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteTargetDir(dir.id);
      if (selectedDirId === dir.id) setSelectedDirId(null);
    } catch (error) {
      toast.error(
        `Failed to delete: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleRemoveDispatch = async (dispatchId: string) => {
    try {
      await deleteDispatch(dispatchId);
    } catch (error) {
      toast.error(
        `Failed to remove: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleSkillDetail = (skillId: string) => {
    const skill = skillMap.get(skillId);
    if (skill) {
      setDetailSkill(skill);
      setShowDetail(true);
    }
  };

  const handleDispatchSkills = async () => {
    if (!selectedDirId || dispatchPickerSelected.size === 0) return;
    try {
      const result = await bulkDispatch(
        Array.from(dispatchPickerSelected),
        selectedDirId,
        DispatchMethod.Symlink,
      );
      if (result.errors.length > 0) {
        toast.warning(
          `Dispatched ${result.successful.length} skills, ${result.errors.length} failed`,
        );
      } else {
        toast.success(
          `Successfully dispatched ${result.successful.length} skills`,
        );
      }
      setShowDispatchPicker(false);
      setDispatchPickerSelected(new Set());
    } catch (error) {
      toast.error(
        `Dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const alreadyDispatchedSkillIds = useMemo(() => {
    if (!selectedDirId) return new Set<string>();
    return new Set(
      dispatches
        .filter((d) => d.target_dir === selectedDirId)
        .map((d) => d.skill_id),
    );
  }, [dispatches, selectedDirId]);

  return (
    <div className="container mx-auto py-8 px-4 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dispatches</h1>
          <p className="text-muted-foreground">
            Manage skills across your project directories
          </p>
        </div>
        <Button onClick={() => setShowAddDir(true)}>
          <FolderPlus className="mr-2 h-4 w-4" />
          Add Project Directory
        </Button>
      </div>

      {/* Main Content: Sidebar + Detail */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left Sidebar: Target Directories */}
        <div className="w-72 shrink-0 border rounded-2xl bg-white/30 backdrop-blur-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Project Directories
          </div>
          <div className="flex-1 overflow-y-auto">
            {targetDirs.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No directories yet
              </div>
            ) : (
              targetDirs.map((dir) => {
                const stats = getDirStats(dir.id);
                const isActive = selectedDirId === dir.id;
                return (
                  <button
                    key={dir.id}
                    className={`w-full text-left px-4 py-3 border-b transition-colors ${
                      isActive
                        ? "bg-teal-500/10 border-l-2 border-l-teal-500"
                        : "hover:bg-white/40 border-l-2 border-l-transparent"
                    }`}
                    onClick={() => setSelectedDirId(dir.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">
                        {dir.name}
                      </span>
                      <button
                        className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDir(dir);
                        }}
                        title="Delete directory"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {dir.path}
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-xs text-muted-foreground">
                        {stats.total} skills
                      </span>
                      {stats.outdated > 0 && (
                        <span className="text-xs text-amber-600">
                          {stats.outdated} outdated
                        </span>
                      )}
                      {stats.errors > 0 && (
                        <span className="text-xs text-red-600">
                          {stats.errors} error
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Skills for selected directory */}
        <div className="flex-1 flex flex-col min-h-0 border rounded-2xl bg-white/30 backdrop-blur-sm overflow-hidden">
          {selectedDir ? (
            <>
              {/* Directory Header */}
              <div className="px-6 py-4 border-b shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedDir.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {selectedDir.path}
                      {selectedDir.description &&
                        ` — ${selectedDir.description}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      title="Dispatch Skills"
                      onClick={() => {
                        setDispatchPickerSelected(new Set());
                        setShowDispatchPicker(true);
                      }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-9 w-9"
                      title="Sync All"
                      onClick={handleSyncAll}
                      disabled={loading || dirDispatches.length === 0}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                      />
                    </Button>
                  </div>
                </div>
                {/* Search */}
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    placeholder="Search skills..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 glass-input rounded-xl"
                  />
                </div>
              </div>

              {/* Skills List */}
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {filteredDispatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FolderOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">
                      {dirDispatches.length === 0
                        ? "No skills dispatched to this directory"
                        : "No skills match your search"}
                    </p>
                    {dirDispatches.length === 0 && (
                      <p className="text-sm text-muted-foreground/60 mt-1">
                        Click "Dispatch Skills" above or use templates below
                      </p>
                    )}
                  </div>
                ) : (
                  filteredDispatches.map((dispatch) => (
                    <DispatchSkillRow
                      key={dispatch.id}
                      dispatch={dispatch}
                      skill={skillMap.get(dispatch.skill_id)}
                      onSync={() => handleSyncOne(dispatch.id)}
                      onRemove={() => handleRemoveDispatch(dispatch.id)}
                      onDetail={() => handleSkillDetail(dispatch.skill_id)}
                      loading={loading}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-medium mb-1">
                Select a project directory
              </h3>
              <p className="text-muted-foreground max-w-sm">
                Choose a directory from the left panel to view and manage its
                dispatched skills.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Templates Section (bottom, collapsible) */}
      <div className="mt-6 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            onClick={() => setTemplatesExpanded(!templatesExpanded)}
          >
            {templatesExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Dispatch Templates ({templates.length})
          </button>
          <Button size="sm" onClick={() => setShowCreateTemplate(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New Template
          </Button>
        </div>

        {templatesExpanded && (
          <div>
            {templates.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-center">
                <p className="text-muted-foreground">
                  No templates yet. Create one to save groups of skills for
                  quick dispatch.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((tpl) => {
                  let tplSkillIds: string[];
                  try {
                    tplSkillIds = JSON.parse(tpl.skill_ids);
                  } catch {
                    tplSkillIds = [];
                  }
                  return (
                    <div
                      key={tpl.id}
                      className="border rounded-xl p-4 hover:bg-white/40 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-sm">{tpl.name}</h4>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingTemplateId(tpl.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                            onClick={() => deleteTemplate(tpl.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {tpl.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mb-3">
                        {tplSkillIds.length} skills:{" "}
                        {tplSkillIds
                          .slice(0, 3)
                          .map((id) => getSkillName(id))
                          .join(", ")}
                        {tplSkillIds.length > 3 &&
                          ` +${tplSkillIds.length - 3} more`}
                      </p>
                      <Button
                        size="sm"
                        className="w-full h-8"
                        onClick={() => setApplyingTemplateId(tpl.id)}
                      >
                        <Send className="mr-1 h-3.5 w-3.5" />
                        Apply to Directory
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddTargetDirDialog open={showAddDir} onOpenChange={setShowAddDir} />
      <CreateTemplateDialog
        open={showCreateTemplate}
        onOpenChange={setShowCreateTemplate}
      />
      <EditTemplateDialog
        templateId={editingTemplateId}
        open={!!editingTemplateId}
        onOpenChange={(open) => {
          if (!open) setEditingTemplateId(null);
        }}
      />
      <ApplyTemplateDialog
        templateId={applyingTemplateId}
        open={!!applyingTemplateId}
        onOpenChange={(open) => {
          if (!open) setApplyingTemplateId(null);
        }}
      />
      <SkillDetailDialog
        skill={detailSkill}
        open={showDetail}
        onOpenChange={setShowDetail}
      />

      {/* Dispatch Skills Picker */}
      <SkillPicker
        skills={skills.filter((s) => !alreadyDispatchedSkillIds.has(s.id))}
        selected={dispatchPickerSelected}
        onSelectionChange={setDispatchPickerSelected}
        open={showDispatchPicker}
        onOpenChange={(v) => {
          if (!v) setShowDispatchPicker(false);
        }}
        title="Dispatch Skills to Directory"
        description={`Select skills to dispatch to "${selectedDir?.name ?? "directory"}".`}
        confirmLabel="Dispatch"
        onConfirm={handleDispatchSkills}
      />
    </div>
  );
}
