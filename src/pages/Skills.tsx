import { useEffect, useRef, useState, memo, useCallback } from "react";
import { useSkillStore } from "../store/skillStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import {
  RefreshCw,
  Edit,
  Search,
  AlertCircle,
  Send,
  CheckSquare,
  Square,
  X,
  Plus,
  Tag,
  Folder,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { DispatchDialog } from "../components/skills/DispatchDialog";
import { SkillDetailDialog } from "../components/skills/SkillDetailDialog";
import { Skill } from "../types/skill";
import { useDispatchStore } from "@/store/dispatchStore";
import { DispatchMethod, parseDispatchMethod } from "@/types/dispatch";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const Badge = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium transition-colors ${className}`}
  >
    {children}
  </span>
);

interface SkillCardProps {
  skill: Skill;
  isSelected: boolean;
  onToggleSelect: (skillId: string) => void;
  onDispatch: (skill: Skill) => void;
  onEditTags: (skill: Skill) => void;
  onDetail: (skill: Skill) => void;
}

const SkillCard = memo(
  ({
    skill,
    isSelected,
    onToggleSelect,
    onDispatch,
    onEditTags,
    onDetail,
  }: SkillCardProps) => {
    return (
      <Card className="grid grid-rows-[auto_auto_1fr_auto] gap-0 py-0 h-full hover:scale-[1.01] hover:bg-white/75">
        {/* Row 1: Checkbox + Name + Dispatch Count */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-3">
          <button
            onClick={() => onToggleSelect(skill.id)}
            className="focus:outline-none cursor-pointer"
          >
            {isSelected ? (
              <CheckSquare className="h-4.5 w-4.5 text-teal-500" />
            ) : (
              <Square className="h-4.5 w-4.5 text-muted-foreground/40" />
            )}
          </button>
          <h3 className="text-base font-semibold truncate flex-1">
            {skill.name}
          </h3>
          {skill.dispatchCount > 0 ? (
            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
              <Send className="h-3 w-3 mr-0.5" />
              {skill.dispatchCount}
            </Badge>
          ) : (
            <Badge className="bg-white/40 text-foreground/40 border-white/20">
              —
            </Badge>
          )}
        </div>

        {/* Row 2: Description (max 2 lines) */}
        <div className="px-4 pb-2">
          {skill.description ? (
            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
              {skill.description}
            </p>
          ) : (
            <p className="text-muted-foreground/40 text-sm italic">
              No description
            </p>
          )}
        </div>

        {/* Row 3: Repo name + Tags (max 3) */}
        <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
          {skill.repositoryName && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/60 text-foreground/70 px-2 py-0.5 text-xs font-medium border border-white/30">
              <Folder className="h-3 w-3" />
              {skill.repositoryName}
            </span>
          )}
          {skill.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 text-teal-700 px-2 py-0.5 text-xs font-medium"
            >
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
          {skill.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{skill.tags.length - 3}
            </span>
          )}
        </div>

        {/* Row 4: Time + Buttons */}
        <div className="glass-footer flex items-center justify-between px-4 py-3 rounded-b-2xl mt-auto">
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(skill.updatedAt).toLocaleString("sv-SE", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onDetail(skill)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEditTags(skill)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDispatch(skill)}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  },
);

SkillCard.displayName = "SkillCard";

export function Skills() {
  const {
    skills,
    loading,
    error,
    searchQuery,
    fetchSkills,
    discoverSkills,
    updateSkill,
    setSearchQuery,
    clearError,
  } = useSkillStore();
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkDispatchDialogOpen, setBulkDispatchDialogOpen] = useState(false);
  const [selectedTargetDirId, setSelectedTargetDirId] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<DispatchMethod>(
    DispatchMethod.Symlink,
  );
  const [isBulkDispatching, setIsBulkDispatching] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [editTagsDialogOpen, setEditTagsDialogOpen] = useState(false);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { targetDirs, fetchTargetDirs, bulkDispatch } = useDispatchStore();

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  useEffect(() => {
    const handleOpenSearch = () => {
      searchInputRef.current?.focus();
    };
    window.addEventListener("skill-vault:open-search", handleOpenSearch);
    return () =>
      window.removeEventListener("skill-vault:open-search", handleOpenSearch);
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  useEffect(() => {
    if (bulkDispatchDialogOpen) {
      fetchTargetDirs().catch((error) => {
        toast.error(`Failed to fetch target directories: ${error.message}`);
      });
    }
  }, [bulkDispatchDialogOpen, fetchTargetDirs]);

  useEffect(() => {
    if (
      bulkDispatchDialogOpen &&
      targetDirs.length > 0 &&
      !selectedTargetDirId
    ) {
      setSelectedTargetDirId(targetDirs[0].id);
    }
    if (!bulkDispatchDialogOpen) {
      setSelectedTargetDirId("");
      setSelectedMethod(DispatchMethod.Symlink);
    }
  }, [bulkDispatchDialogOpen, targetDirs, selectedTargetDirId]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    fetchSkills({ search: query });
  };

  const handleDiscover = () => {
    discoverSkills({ force: true })
      .then(() => {
        toast.success("Skills discovered successfully");
      })
      .catch((error) => {
        toast.error(`Failed to discover skills: ${error.message}`);
      });
  };

  const toggleSkillSelection = useCallback((skillId: string) => {
    setSelectedSkillIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(skillId)) {
        newSet.delete(skillId);
      } else {
        newSet.add(skillId);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSkillIds(new Set());
  }, []);

  const handleDispatch = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
    setDispatchDialogOpen(true);
  }, []);

  const handleDetail = useCallback((skill: Skill) => {
    setDetailSkill(skill);
    setDetailDialogOpen(true);
  }, []);

  const handleEditTags = useCallback((skill: Skill) => {
    setEditingSkill(skill);
    setEditTags([...skill.tags]);
    setNewTagInput("");
    setEditTagsDialogOpen(true);
  }, []);

  const handleAddTag = useCallback(() => {
    const tag = newTagInput.trim().toLowerCase();
    if (tag && !editTags.includes(tag)) {
      setEditTags((prev) => [...prev, tag]);
      setNewTagInput("");
    }
  }, [newTagInput, editTags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setEditTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleSaveTags = useCallback(async () => {
    if (!editingSkill) return;
    try {
      await updateSkill(editingSkill.id, { tags: editTags });
      toast.success("Tags updated");
      setEditTagsDialogOpen(false);
    } catch (error) {
      toast.error(
        `Failed to update tags: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [editingSkill, editTags, updateSkill]);

  const handleBulkDispatch = async () => {
    if (selectedSkillIds.size === 0 || !selectedTargetDirId) {
      toast.error("Please select a target directory");
      return;
    }

    setIsBulkDispatching(true);
    try {
      const result = await bulkDispatch(
        Array.from(selectedSkillIds),
        selectedTargetDirId,
        selectedMethod,
      );

      toast.success(
        `Successfully dispatched ${result.successful.length} skills. Manage them in the Dispatches page.`,
      );

      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} skills failed to dispatch`);
        console.error("Bulk dispatch errors:", result.errors);
      }

      clearSelection();
      setBulkDispatchDialogOpen(false);
    } catch (error) {
      toast.error(
        `Failed to bulk dispatch: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsBulkDispatching(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Skills</h1>
          <p className="text-muted-foreground">
            {selectedSkillIds.size > 0
              ? `${selectedSkillIds.size} skills selected`
              : "Manage your skill library"}
          </p>
        </div>
        <div className="flex gap-3">
          {selectedSkillIds.size > 0 ? (
            <>
              <Button
                variant="outline"
                onClick={clearSelection}
                disabled={loading}
              >
                Clear Selection
              </Button>
              <Button
                onClick={() => setBulkDispatchDialogOpen(true)}
                disabled={loading}
              >
                <Send className="mr-2 h-4 w-4" />
                Bulk Dispatch ({selectedSkillIds.size})
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleDiscover} disabled={loading}>
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Discover Skills
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            ref={searchInputRef}
            placeholder="Search skills by name, description, or tags... (⌘K)"
            value={searchQuery}
            onChange={handleSearch}
            className="pl-10 glass-input rounded-xl"
          />
        </div>
      </div>

      {loading && skills.length === 0 && (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground/40" />
        </div>
      )}

      {!loading && skills.length === 0 && (
        <div className="flex flex-col justify-center items-center py-20 text-center">
          <div className="w-16 h-16 bg-white/50 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-medium mb-2">No skills found</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            {searchQuery
              ? "No skills match your search criteria. Try adjusting your search terms."
              : 'You haven\'t added any skills yet. Click "Discover Skills" to scan your repositories for skills.'}
          </p>
          {!searchQuery && (
            <Button onClick={handleDiscover}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Discover Skills
            </Button>
          )}
        </div>
      )}

      {skills.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              isSelected={selectedSkillIds.has(skill.id)}
              onToggleSelect={toggleSkillSelection}
              onDispatch={handleDispatch}
              onEditTags={handleEditTags}
              onDetail={handleDetail}
            />
          ))}
        </div>
      )}

      {/* Bulk Dispatch Dialog */}
      <Dialog
        open={bulkDispatchDialogOpen}
        onOpenChange={setBulkDispatchDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Dispatch Skills</DialogTitle>
            <DialogDescription>
              Dispatch {selectedSkillIds.size} selected skills to a target
              directory
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bulk-target-directory">Target Directory</Label>
              <Select
                value={selectedTargetDirId}
                onValueChange={setSelectedTargetDirId}
                disabled={isBulkDispatching || targetDirs.length === 0}
              >
                <SelectTrigger id="bulk-target-directory">
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
                  No target directories configured
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Dispatch Method</Label>
              <RadioGroup
                value={selectedMethod}
                onValueChange={(value) =>
                  setSelectedMethod(parseDispatchMethod(value))
                }
                className="flex flex-col space-y-2"
                disabled={isBulkDispatching}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={DispatchMethod.Symlink}
                    id="bulk-symlink"
                  />
                  <Label htmlFor="bulk-symlink">Symlink (Recommended)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={DispatchMethod.Copy} id="bulk-copy" />
                  <Label htmlFor="bulk-copy">Copy</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDispatchDialogOpen(false)}
              disabled={isBulkDispatching}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkDispatch}
              disabled={
                isBulkDispatching ||
                !selectedTargetDirId ||
                selectedSkillIds.size === 0
              }
            >
              {isBulkDispatching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Dispatching {selectedSkillIds.size} skills...
                </>
              ) : (
                `Dispatch ${selectedSkillIds.size} Skills`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tags Dialog */}
      <Dialog open={editTagsDialogOpen} onOpenChange={setEditTagsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tags</DialogTitle>
            <DialogDescription>
              Manage tags for "{editingSkill?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-wrap gap-2 min-h-[2rem]">
              {editTags.length === 0 && (
                <span className="text-sm text-muted-foreground">No tags</span>
              )}
              {editTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 text-teal-700 px-2.5 py-1 text-sm font-medium"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-0.5 hover:text-red-500 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <Input
                placeholder="Add a tag..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="pr-9"
              />
              <button
                onClick={handleAddTag}
                disabled={!newTagInput.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-teal-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTagsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTags}>Save Tags</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DispatchDialog
        skill={selectedSkill}
        open={dispatchDialogOpen}
        onOpenChange={setDispatchDialogOpen}
      />

      <SkillDetailDialog
        skill={detailSkill}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}
