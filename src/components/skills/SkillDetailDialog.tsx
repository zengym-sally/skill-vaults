import { useEffect, useState } from "react";
import { useSkillStore } from "@/store/skillStore";
import { Skill } from "@/types/skill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Sparkles,
  FileText,
  Tag,
  Folder,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface SkillDetailDialogProps {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillDetailDialog({
  skill,
  open,
  onOpenChange,
}: SkillDetailDialogProps) {
  const { readSkillFile, analyzeSkill, updateSkill } = useSkillStore();
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");

  useEffect(() => {
    if (open && skill) {
      setLoadingContent(true);
      setFileContent(null);
      readSkillFile(skill.id)
        .then((content) => setFileContent(content))
        .catch(() => setFileContent("Failed to load skill content."))
        .finally(() => setLoadingContent(false));
    }
    if (!open) {
      setFileContent(null);
      setEditingSummary(false);
    }
  }, [open, skill, readSkillFile]);

  const handleAnalyze = async () => {
    if (!skill) return;
    setAnalyzing(true);
    try {
      await analyzeSkill(skill.id);
      toast.success("Skill analysis completed");
    } catch {
      // error handled in store
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!skill) return;
    try {
      await updateSkill(skill.id, {
        aiSummary: summaryDraft.trim() || undefined,
      });
      setEditingSummary(false);
      toast.success("Summary saved");
    } catch {
      toast.error("Failed to save summary");
    }
  };

  const startEditing = () => {
    const currentSkill = skill
      ? (useSkillStore.getState().skills.find((s) => s.id === skill.id) ??
        skill)
      : null;
    setSummaryDraft(currentSkill?.aiSummary ?? "");
    setEditingSummary(true);
  };

  // Re-read skill from store to get updated analysis
  const currentSkill = skill
    ? (useSkillStore.getState().skills.find((s) => s.id === skill.id) ?? skill)
    : null;

  if (!currentSkill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentSkill.name}
            {currentSkill.llmAnalyzed && (
              <span className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium bg-teal-500/10 text-teal-600 border-teal-500/20">
                <Sparkles className="h-3 w-3 mr-1" />
                Analyzed
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Skill details and AI-powered analysis
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 px-1 -mx-1">
          {/* Metadata Section */}
          <div className="space-y-3">
            {/* Type & Status */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium border-white/30">
                {currentSkill.type}
              </span>
              <span
                className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${
                  currentSkill.status === "active"
                    ? "border-emerald-500/30 text-emerald-600"
                    : "border-amber-500/30 text-amber-600"
                }`}
              >
                {currentSkill.status}
              </span>
              {currentSkill.qualityScore != null && (
                <span className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium border-blue-500/30 text-blue-600">
                  Score: {currentSkill.qualityScore}
                </span>
              )}
            </div>

            {/* Repository */}
            {currentSkill.repositoryName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Folder className="h-3.5 w-3.5" />
                {currentSkill.repositoryName}
              </div>
            )}

            {/* Tags */}
            {currentSkill.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentSkill.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 text-teal-700 px-2 py-0.5 text-xs font-medium"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {currentSkill.description && (
              <div>
                <h4 className="text-sm font-medium mb-1">Description</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {currentSkill.description}
                </p>
              </div>
            )}

            {/* AI Summary */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-medium">AI Summary</h4>
                <div className="flex gap-1">
                  {!editingSummary && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={startEditing}
                        title="Edit summary"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        title="AI regenerate summary"
                      >
                        {analyzing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                      </Button>
                    </>
                  )}
                  {editingSummary && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-emerald-600"
                        onClick={handleSaveSummary}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setEditingSummary(false)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {editingSummary ? (
                <Textarea
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  className="text-sm min-h-[60px] resize-none focus-visible:ring-offset-0"
                  maxLength={200}
                  placeholder="Write a brief summary..."
                  autoFocus
                />
              ) : currentSkill.aiSummary ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {currentSkill.aiSummary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground/60 italic">
                  No AI summary yet. Click{" "}
                  <Sparkles className="inline h-3 w-3" /> to generate one.
                </p>
              )}
            </div>

            {/* Usage */}
            {currentSkill.usage && (
              <div>
                <h4 className="text-sm font-medium mb-1">Usage</h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {currentSkill.usage}
                </p>
              </div>
            )}
          </div>

          {/* File Content */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Source Content</h4>
            </div>
            <div className="border rounded-xl bg-muted/30 p-4 max-h-64 overflow-y-auto">
              {loadingContent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">
                  {fileContent}
                </pre>
              )}
            </div>
          </div>

          {/* Dependencies */}
          {currentSkill.dependencies.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">Dependencies</h4>
              <div className="flex flex-wrap gap-1.5">
                {currentSkill.dependencies.map((dep) => (
                  <span
                    key={dep}
                    className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium bg-white/40 border-white/30"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
