import { useState, useMemo } from "react";
import { Skill } from "@/types/skill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckSquare, Square, Search, Tag, Folder } from "lucide-react";

interface SkillPickerProps {
  skills: Skill[];
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export function SkillPicker({
  skills,
  selected,
  onSelectionChange,
  open,
  onOpenChange,
  title = "Select Skills",
  description = "Choose skills to add.",
  confirmLabel = "Confirm",
  onConfirm,
}: SkillPickerProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return skills;
    const q = search.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [skills, search]);

  const toggleSkill = (id: string) => {
    onSelectionChange(
      (() => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      })(),
    );
  };

  const selectAll = () => {
    onSelectionChange(new Set(filtered.map((s) => s.id)));
  };

  const clearAll = () => {
    onSelectionChange(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {title}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({selected.size} selected)
            </span>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Search + Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, description, or tags..."
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={selectAll}>
            All
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll}>
            None
          </Button>
        </div>

        {/* Skill List */}
        <div className="flex-1 overflow-y-auto border rounded-xl">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No skills found
            </div>
          ) : (
            filtered.map((skill) => {
              const isSelected = selected.has(skill.id);
              return (
                <button
                  key={skill.id}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 flex items-start gap-3 transition-colors ${
                    isSelected ? "bg-teal-500/5" : "hover:bg-white/40"
                  }`}
                  onClick={() => toggleSkill(skill.id)}
                >
                  <div className="mt-0.5 shrink-0">
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-teal-500" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {skill.name}
                      </span>
                      {skill.dispatchCount > 0 && (
                        <span className="inline-flex items-center rounded-md bg-blue-500/10 text-blue-600 px-1.5 py-0.5 text-[10px] font-medium">
                          {skill.dispatchCount} dispatched
                        </span>
                      )}
                    </div>
                    {skill.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {skill.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {skill.repositoryName && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-white/60 px-1.5 py-0.5 rounded border border-white/30">
                          <Folder className="h-2.5 w-2.5" />
                          {skill.repositoryName}
                        </span>
                      )}
                      {skill.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 text-[10px] text-teal-700 bg-teal-500/10 px-1.5 py-0.5 rounded"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </span>
                      ))}
                      {skill.tags.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{skill.tags.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={selected.size === 0}>
            {confirmLabel} ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
