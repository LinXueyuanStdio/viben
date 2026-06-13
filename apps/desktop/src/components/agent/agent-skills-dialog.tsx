/**
 * Agent Skills Configuration Dialog
 *
 * Single-page layout with an embedded SkillMarketGrid at the top
 * and a local path section at the bottom.
 */
import { useState, useEffect } from "react";
import { FolderOpen, Plus, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { setsEqual } from "@/lib/utils";
import { SkillMarketGrid } from "./skill-market-grid";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentSkillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSkillIds: string[];
  onSkillsChange: (skillIds: string[]) => void;
  /** Used to compute relative paths for local skill directories. */
  workspacePath?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when `id` looks like a local file-system path. */
function isLocalPath(id: string): boolean {
  return id.startsWith("./") || id.startsWith("/");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentSkillsDialog({
  open: dialogOpen,
  onOpenChange,
  selectedSkillIds,
  onSkillsChange,
  workspacePath,
}: AgentSkillsDialogProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedSkillIds);
  const [pathInput, setPathInput] = useState("");

  // Sync local state when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      setLocalSelected(selectedSkillIds);
      setPathInput("");
    }
  }, [dialogOpen, selectedSkillIds]);

  // Derived
  const marketplaceIds = localSelected.filter((id) => !isLocalPath(id));
  const localPaths = localSelected.filter(isLocalPath);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleToggle(skillId: string) {
    setLocalSelected((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId],
    );
  }

  function handleAddPath() {
    const trimmed = pathInput.trim();
    if (trimmed && !localSelected.includes(trimmed)) {
      setLocalSelected((prev) => [...prev, trimmed]);
      setPathInput("");
    }
  }

  async function handleBrowse() {
    const result = await open({
      directory: true,
      title: "选择 Skill 目录",
    });
    if (result) {
      const path = workspacePath
        ? "./" + result.replace(workspacePath + "/", "")
        : result;
      if (!localSelected.includes(path)) {
        setLocalSelected((prev) => [...prev, path]);
      }
    }
  }

  function handleRemovePath(path: string) {
    setLocalSelected((prev) => prev.filter((id) => id !== path));
  }

  const hasChanges = !setsEqual(localSelected, selectedSkillIds);

  function handleSave() {
    onSkillsChange(localSelected);
    onOpenChange(false);
  }

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>配置 Skills</DialogTitle>
          <DialogDescription>从市场选择 Skills 或添加本地路径</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Marketplace grid */}
            <SkillMarketGrid
              selectedIds={marketplaceIds}
              onToggle={handleToggle}
            />

            {/* Local Path section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground font-medium">本地路径</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="./skills/my-skill 或 /abs/path"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  className="h-8 flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddPath()}
                />
                <Button variant="outline" size="sm" onClick={handleBrowse}>
                  <FolderOpen className="h-3.5 w-3.5 mr-1" />
                  浏览
                </Button>
                <Button variant="outline" size="sm" onClick={handleAddPath} disabled={!pathInput.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  添加
                </Button>
              </div>

              {localPaths.length > 0 && (
                <div className="space-y-1.5">
                  {localPaths.map((path) => (
                    <div key={path} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 group">
                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate font-mono">{path}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePath(path)}
                        className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={!hasChanges}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
