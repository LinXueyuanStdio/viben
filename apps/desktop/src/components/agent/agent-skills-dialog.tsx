/**
 * Agent Skills Configuration Dialog
 *
 * Layout:
 * 1. Executor-discovered skills (继承自 Executor, toggleable)
 * 2. Cloud marketplace (remote skill packages)
 * 3. Local path input
 */
import { useState, useEffect } from "react";
import { FolderOpen, Plus, X, Check, Loader2, Sparkles } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn, setsEqual } from "@/lib/utils";
import type { WorkspaceSkill } from "@/types";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";
import { getGatewayClient } from "@/lib/gateway";
import { toast } from "@/hooks/use-toast";
import { SkillMarketGrid } from "./skill-market-grid";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentSkillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSkillIds: string[];
  onSkillsChange: (skillIds: string[]) => void;
  workspacePath?: string;
  executorType?: string;
  /** Pre-loaded discovered skills from parent */
  discoveredSkills?: WorkspaceSkill[];
  discoveredSkillsLoading?: boolean;
  /** Agent folder name (used when installing skills from marketplace) */
  agentId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  executorType,
  discoveredSkills = [],
  discoveredSkillsLoading = false,
  agentId,
}: AgentSkillsDialogProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedSkillIds);
  const [pathInput, setPathInput] = useState("");
  const [activeTab, setActiveTab] = useState("discovered");

  // Sync local state when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      setLocalSelected(selectedSkillIds);
      setPathInput("");
      setActiveTab("discovered");
    }
  }, [dialogOpen, selectedSkillIds]);

  // Derived
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
      const path =
        workspacePath && result.startsWith(workspacePath + "/")
          ? "./" + result.slice(workspacePath.length + 1)
          : result;
      if (!localSelected.includes(path)) {
        setLocalSelected((prev) => [...prev, path]);
      }
    }
  }

  function handleRemovePath(path: string) {
    setLocalSelected((prev) => prev.filter((id) => id !== path));
  }

  async function handleInstallSkill(skill: ClawhubSkillDisplay): Promise<boolean> {
    if (!agentId) {
      // No agentId provided - just toggle selection without downloading
      handleToggle(skill.id);
      return true;
    }

    try {
      const client = getGatewayClient();
      const res = await client.post("/api/skill/install", {
        name: skill.slug,
        target: "agent",
        agent_id: agentId,
        registry: "clawhub",
      }) as { path?: string; version?: string };
      // Add to selected after successful install
      setLocalSelected((prev) =>
        prev.includes(skill.id) ? prev : [...prev, skill.id]
      );
      toast.success(`已安装 ${skill.name} v${res.version || "latest"}`, {
        description: res.path ? `路径: ${res.path}` : undefined,
      });
      return true;
    } catch (err) {
      console.error("[AgentSkillsDialog] Failed to install skill:", err);
      toast.error(`安装 ${skill.name} 失败`, {
        description: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
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
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            配置 Skills
            {localSelected.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {localSelected.length} 已选
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>从已发现的 Skills 中选择，或从市场添加</DialogDescription>
        </DialogHeader>

        <div className="px-6 flex-1 min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger
                value="discovered"
                className={cn(
                  "px-3 py-2 text-xs",
                  activeTab === "discovered" && "border-primary text-foreground"
                )}
              >
                已发现
                {discoveredSkills.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                    {discoveredSkills.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="market"
                className={cn(
                  "px-3 py-2 text-xs",
                  activeTab === "market" && "border-primary text-foreground"
                )}
              >
                市场
              </TabsTrigger>
              <TabsTrigger
                value="local"
                className={cn(
                  "px-3 py-2 text-xs",
                  activeTab === "local" && "border-primary text-foreground"
                )}
              >
                本地路径
                {localPaths.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                    {localPaths.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tab: Discovered (继承自 Executor) */}
            <TabsContent value="discovered" className="mt-3">
              <div className="max-h-[calc(80vh-240px)] overflow-y-auto">
                {discoveredSkillsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : discoveredSkills.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Sparkles className="h-6 w-6 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">未发现已安装的 Skills</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {executorType
                        ? `Executor "${executorType}" 未发现任何 Skill`
                        : "请先选择 Executor 类型"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 pb-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      继承自 Executor · 点击切换启用状态
                    </p>
                    {discoveredSkills.map((skill) => {
                      const isSelected = localSelected.includes(skill.id);
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => handleToggle(skill.id)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30"
                          )}
                        >
                          <div className="flex items-center justify-center h-4 w-4 shrink-0">
                            {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">{skill.name}</span>
                            {skill.description && (
                              <span className="text-xs text-muted-foreground line-clamp-1 block mt-0.5">
                                {skill.description}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {skill.version && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                v{skill.version}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {skill.source}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab: Marketplace (cloud) */}
            <TabsContent value="market" className="mt-3" forceMount hidden={activeTab !== "market"}>
              <SkillMarketGrid
                selectedIds={localSelected.filter(
                  (id) => !isLocalPath(id) && !discoveredSkills.some((s) => s.id === id)
                )}
                onToggle={handleToggle}
                onInstall={handleInstallSkill}
              />
            </TabsContent>

            {/* Tab: Local paths */}
            <TabsContent value="local" className="mt-3">
              <div className="space-y-3">
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

                <div className="max-h-[calc(80vh-280px)] overflow-y-auto">
                  {localPaths.length > 0 ? (
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
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <FolderOpen className="h-5 w-5 mx-auto text-muted-foreground/50 mb-1.5" />
                      <p className="text-xs text-muted-foreground">
                        添加本地 Skill 目录路径
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-6 pt-4 border-t bg-muted/30 mt-4">
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={handleSave} disabled={!hasChanges}>保存</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
