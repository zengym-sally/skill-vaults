import { useEffect, useRef, useState, memo, useCallback } from "react";
import { useSkillStore } from "../store/skillStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  RefreshCw,
  Edit,
  Trash2,
  Search,
  AlertCircle,
  Send,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { DispatchDialog } from "../components/skills/DispatchDialog";
import { Skill } from "../types/skill";
import { useDispatchStore } from "@/store/dispatchStore";
import { DispatchMethod } from "@/types/dispatch";
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
  onDelete: (id: string, name: string) => void;
  getStatusColor: (status: string) => string;
  getSourceTypeColor: (sourceType: string) => string;
}

const SkillCard = memo(
  ({
    skill,
    isSelected,
    onToggleSelect,
    onDispatch,
    onDelete,
    getStatusColor,
    getSourceTypeColor,
  }: SkillCardProps) => {
    return (
      <Card className="hover:scale-[1.01] hover:bg-white/75">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3">
              <button
                onClick={() => onToggleSelect(skill.id)}
                className="mt-1 focus:outline-none cursor-pointer"
              >
                {isSelected ? (
                  <CheckSquare className="h-5 w-5 text-teal-500" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground/50" />
                )}
              </button>
              <CardTitle className="text-xl font-semibold">
                {skill.name}
              </CardTitle>
            </div>
            <Badge className={getStatusColor(skill.status)}>
              {skill.status}
            </Badge>
          </div>
          <CardDescription className="flex items-center gap-2 mt-1">
            <Badge className={getSourceTypeColor(skill.sourceType)}>
              {skill.sourceType}
            </Badge>
            <Badge className="bg-white/60 text-foreground/70 border-white/30">
              {skill.type}
            </Badge>
            {skill.qualityScore && (
              <Badge className="bg-teal-500/10 text-teal-600 border-teal-500/20">
                {skill.qualityScore}/100
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {skill.description && (
            <p className="text-muted-foreground mb-4 line-clamp-2">
              {skill.description}
            </p>
          )}
          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {skill.tags.map((tag) => (
                <Badge
                  key={tag}
                  className="bg-white/60 text-foreground/70 border-white/30"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {skill.dependencies.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              <span className="font-medium">Dependencies: </span>
              {skill.dependencies.length}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-xs text-muted-foreground">
            Updated {new Date(skill.updatedAt).toLocaleDateString()}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onDispatch(skill)}>
              <Send className="h-4 w-4 mr-1" />
              Dispatch
            </Button>
            <Button variant="ghost" size="sm" disabled>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50/50"
              onClick={() => onDelete(skill.id, skill.name)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </CardFooter>
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
    deleteSkill,
    setSearchQuery,
    clearError,
  } = useSkillStore();
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkDispatchDialogOpen, setBulkDispatchDialogOpen] = useState(false);
  const [selectedTargetDirId, setSelectedTargetDirId] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<DispatchMethod>(
    DispatchMethod.Symlink,
  );
  const [isBulkDispatching, setIsBulkDispatching] = useState(false);
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

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (window.confirm(`Are you sure you want to delete skill "${name}"?`)) {
        deleteSkill(id)
          .then(() => {
            toast.success("Skill deleted successfully");
          })
          .catch((error) => {
            toast.error(`Failed to delete skill: ${error.message}`);
          });
      }
    },
    [deleteSkill],
  );

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "archived":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "broken":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  }, []);

  const getSourceTypeColor = useCallback((sourceType: string) => {
    switch (sourceType) {
      case "github":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "private-git":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "local":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  }, []);

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
        `Successfully dispatched ${result.successful.length} skills`,
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
            placeholder="Search skills by name, description, or tags..."
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
              onDelete={handleDelete}
              getStatusColor={getStatusColor}
              getSourceTypeColor={getSourceTypeColor}
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
                  setSelectedMethod(value as DispatchMethod)
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
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={DispatchMethod.Hardlink}
                    id="bulk-hardlink"
                  />
                  <Label htmlFor="bulk-hardlink">Hardlink</Label>
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

      <DispatchDialog
        skill={selectedSkill}
        open={dispatchDialogOpen}
        onOpenChange={setDispatchDialogOpen}
      />
    </div>
  );
}
