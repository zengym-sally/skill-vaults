import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDispatchStore } from "@/store/dispatchStore";
import { Skill } from "@/types/skill";
import { DispatchMethod } from "@/types/dispatch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface DispatchDialogProps {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DispatchDialog({
  skill,
  open,
  onOpenChange,
}: DispatchDialogProps) {
  const { targetDirs, fetchTargetDirs } = useDispatchStore();
  const [selectedTargetDirId, setSelectedTargetDirId] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<DispatchMethod>(
    DispatchMethod.Symlink,
  );
  const [isDispatching, setIsDispatching] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTargetDirs().catch((error) => {
        toast.error(`Failed to fetch target directories: ${error.message}`);
      });
    }
  }, [open, fetchTargetDirs]);

  useEffect(() => {
    if (open && targetDirs.length > 0 && !selectedTargetDirId) {
      setSelectedTargetDirId(targetDirs[0].id);
    }
    if (!open) {
      setSelectedTargetDirId("");
      setSelectedMethod(DispatchMethod.Symlink);
    }
  }, [open, targetDirs, selectedTargetDirId]);

  const handleDispatch = async () => {
    if (!skill || !selectedTargetDirId) {
      toast.error("Please select a target directory");
      return;
    }

    setIsDispatching(true);
    try {
      await invoke("dispatch_skill", {
        skillId: skill.id,
        targetDirId: selectedTargetDirId,
        method: selectedMethod,
      });
      toast.success(`Skill "${skill.name}" dispatched successfully`);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        `Failed to dispatch skill: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dispatch Skill</DialogTitle>
          <DialogDescription>
            {skill
              ? `Dispatch "${skill.name}" to a target directory`
              : "Select a skill to dispatch"}
          </DialogDescription>
        </DialogHeader>

        {skill && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="target-directory">Target Directory</Label>
              <Select
                value={selectedTargetDirId}
                onValueChange={setSelectedTargetDirId}
                disabled={isDispatching || targetDirs.length === 0}
              >
                <SelectTrigger id="target-directory">
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
                disabled={isDispatching}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={DispatchMethod.Symlink} id="symlink" />
                  <Label htmlFor="symlink">Symlink (Recommended)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={DispatchMethod.Copy} id="copy" />
                  <Label htmlFor="copy">Copy</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={DispatchMethod.Hardlink}
                    id="hardlink"
                  />
                  <Label htmlFor="hardlink">Hardlink</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDispatching}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDispatch}
            disabled={isDispatching || !skill || !selectedTargetDirId}
          >
            {isDispatching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Dispatching...
              </>
            ) : (
              "Dispatch"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
