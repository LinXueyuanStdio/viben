/**
 * Agent Skills Configuration Dialog
 *
 * Dialog for configuring skills for an agent.
 * 3-tab layout: Marketplace, Local Path, Built-in.
 */
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  Plus,
  Check,
  ExternalLink,
  Search,
  Loader2,
  X,
  Package,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, setsEqual } from "@/lib/utils";
import {
  useCloudSkillPackages,
  type CloudSkillPackage,
} from "@/hooks/use-cloud-skills";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Skill {
  id: string;
  name: string;
  description: string | null;
  skillType: string;
  installed: boolean;
}

/** Placeholder for future built-in skills. */
const BUILTIN_SKILLS: Array<{
  id: string;
  name: string;
  description: string;
}> = [];

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
  const { t } = useTranslation();
  const { openSkillsMarket } = useDesktopRouting();
  const { packages, loading: isLoading, error } = useCloudSkillPackages();

  // Local copy of the selection -- synced from props when the dialog opens.
  const [localSelected, setLocalSelected] = useState<string[]>(selectedSkillIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("marketplace");
  const [localPathInput, setLocalPathInput] = useState("");

  // -----------------------------------------------------------------------
  // Sync local state when dialog opens
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (dialogOpen) {
      setLocalSelected(selectedSkillIds);
      setSearchQuery("");
      setActiveTab("marketplace");
      setLocalPathInput("");
    }
  }, [dialogOpen, selectedSkillIds]);

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  /** Transform cloud packages to Skill items and apply search filter. */
  const filteredSkills = useMemo(() => {
    const skills: Skill[] = packages.map((pkg: CloudSkillPackage) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      skillType: pkg.skillType || "general",
      installed: true,
    }));

    if (!searchQuery.trim()) return skills;

    const query = searchQuery.toLowerCase();
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query) ||
        skill.skillType.toLowerCase().includes(query),
    );
  }, [packages, searchQuery]);

  /** Local-path entries currently selected. */
  const localPaths = useMemo(
    () => localSelected.filter(isLocalPath),
    [localSelected],
  );

  /** Marketplace IDs currently selected. */
  const marketplaceIds = useMemo(
    () => localSelected.filter((id) => !isLocalPath(id)),
    [localSelected],
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleToggleSkill = (skillId: string) => {
    setLocalSelected((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId],
    );
  };

  const handleSelectAll = () => {
    const allMarketplaceIds = filteredSkills.map((s) => s.id);
    const allSelected = allMarketplaceIds.every((id) =>
      localSelected.includes(id),
    );
    if (allSelected) {
      // Deselect all marketplace IDs but keep local paths
      setLocalSelected((prev) => prev.filter(isLocalPath));
    } else {
      // Select all marketplace IDs, keeping local paths
      setLocalSelected((prev) => {
        const paths = prev.filter(isLocalPath);
        return [...paths, ...allMarketplaceIds];
      });
    }
  };

  const handleSave = () => {
    onSkillsChange(localSelected);
    onOpenChange(false);
  };

  const handleGoToMarketplace = () => {
    onOpenChange(false);
    openSkillsMarket();
  };

  const handleBrowseDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("settingsAgents.skillsLocalPath.browse", {
        defaultValue: "Browse",
      }),
    });

    if (selected && typeof selected === "string") {
      let path = selected;
      // If workspacePath is provided and the selected path falls within it,
      // compute the relative path.
      if (workspacePath && selected.startsWith(workspacePath)) {
        const relative = selected.slice(workspacePath.length);
        path = "./" + relative.replace(/^\//, "");
      }
      setLocalPathInput(path);
    }
  };

  const handleAddLocalPath = () => {
    const trimmed = localPathInput.trim();
    if (!trimmed) return;
    if (localSelected.includes(trimmed)) return;
    setLocalSelected((prev) => [...prev, trimmed]);
    setLocalPathInput("");
  };

  const handleRemoveLocalPath = (path: string) => {
    setLocalSelected((prev) => prev.filter((id) => id !== path));
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const getSkillTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      automation: {
        label: t("skillsMarket.typeAutomation", {
          defaultValue: "Automation",
        }),
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      },
      analysis: {
        label: t("skillsMarket.typeAnalysis", { defaultValue: "Analysis" }),
        className: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      },
      generation: {
        label: t("skillsMarket.typeGeneration", {
          defaultValue: "Generation",
        }),
        className: "bg-green-500/10 text-green-600 dark:text-green-400",
      },
    };
    const variant = variants[type.toLowerCase()] || {
      label: type,
      className: "bg-muted",
    };
    return (
      <Badge
        variant="secondary"
        className={cn("text-[10px] px-1.5 py-0", variant.className)}
      >
        {variant.label}
      </Badge>
    );
  };

  const hasChanges = !setsEqual(localSelected, selectedSkillIds);

  // -----------------------------------------------------------------------
  // JSX
  // -----------------------------------------------------------------------

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            {t("settingsAgents.configureSkills", {
              defaultValue: "Configure Skills",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("settingsAgents.configureSkillsDesc", {
              defaultValue:
                "Select skills to enhance your agent's capabilities",
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
          <TabsList className="w-full">
            <TabsTrigger
              value="marketplace"
              className={cn(
                activeTab === "marketplace" && "border-primary text-foreground",
              )}
            >
              {t("settingsAgents.skillsTab.marketplace", {
                defaultValue: "Marketplace",
              })}
            </TabsTrigger>
            <TabsTrigger
              value="local"
              className={cn(
                activeTab === "local" && "border-primary text-foreground",
              )}
            >
              {t("settingsAgents.skillsTab.local", {
                defaultValue: "Local Path",
              })}
              {localPaths.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-[10px] px-1.5 py-0"
                >
                  {localPaths.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="builtin"
              className={cn(
                activeTab === "builtin" && "border-primary text-foreground",
              )}
            >
              {t("settingsAgents.skillsTab.builtin", {
                defaultValue: "Built-in",
              })}
            </TabsTrigger>
          </TabsList>

          {/* ----------------------------------------------------------- */}
          {/* Tab 1: Marketplace                                          */}
          {/* ----------------------------------------------------------- */}
          <TabsContent value="marketplace" className="mt-3">
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("skillsMarket.searchPlaceholder", {
                    defaultValue: "Search skills...",
                  })}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Select all / count */}
              {packages.length > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 hover:text-foreground transition-colors"
                  >
                    <Checkbox
                      checked={
                        filteredSkills.length > 0 &&
                        filteredSkills.every((s) =>
                          localSelected.includes(s.id),
                        )
                      }
                      className="h-3.5 w-3.5"
                    />
                    <span>
                      {t("common.selectAll", { defaultValue: "Select all" })}
                    </span>
                  </button>
                  <span>
                    {marketplaceIds.length} / {packages.length}{" "}
                    {t("common.selected", { defaultValue: "selected" })}
                  </span>
                </div>
              )}
            </div>

            {/* Skill list */}
            <ScrollArea className="max-h-[280px] mt-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t("common.loading", { defaultValue: "Loading..." })}
                  </p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-destructive mb-4">
                    {t("common.error", { defaultValue: "Error" })}: {error}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGoToMarketplace}
                  >
                    {t("settingsAgents.browseMarketplace", {
                      defaultValue: "Browse Marketplace",
                    })}
                  </Button>
                </div>
              ) : packages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                    <Package className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium mb-1">
                    {t("settingsAgents.noSkillsAvailable", {
                      defaultValue:
                        "No skills installed. Browse the marketplace to install skills.",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t("settingsAgents.noSkillsHint", {
                      defaultValue:
                        "Install skills from the marketplace to extend your agent",
                    })}
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleGoToMarketplace}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("settingsAgents.browseMarketplace", {
                      defaultValue: "Browse Marketplace",
                    })}
                  </Button>
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("skillsMarket.noSearchResults", {
                      defaultValue: "No matching skills found",
                    })}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pb-2">
                  {filteredSkills.map((skill) => {
                    const isSelected = localSelected.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        onClick={() => handleToggleSkill(skill.id)}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/50 hover:bg-muted/50",
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">
                              {skill.name}
                            </span>
                            {getSkillTypeBadge(skill.skillType)}
                          </div>
                          {skill.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {skill.description}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Bottom link to marketplace */}
            <div className="pt-2 pb-1">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleGoToMarketplace}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {t("settingsAgents.browseMore", {
                  defaultValue: "Browse More",
                })}
              </Button>
            </div>
          </TabsContent>

          {/* ----------------------------------------------------------- */}
          {/* Tab 2: Local Path                                           */}
          {/* ----------------------------------------------------------- */}
          <TabsContent value="local" className="mt-3">
            <div className="space-y-3">
              {/* Add local path form */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={localPathInput}
                    onChange={(e) => setLocalPathInput(e.target.value)}
                    placeholder={t(
                      "settingsAgents.skillsLocalPath.pathPlaceholder",
                      {
                        defaultValue:
                          "Enter relative path (e.g., ./skills/my-skill)",
                      },
                    )}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddLocalPath();
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBrowseDirectory}
                    className="shrink-0"
                  >
                    <FolderOpen className="h-4 w-4 mr-1.5" />
                    {t("settingsAgents.skillsLocalPath.browse", {
                      defaultValue: "Browse",
                    })}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.skillsLocalPath.pathHint", {
                      defaultValue:
                        "Select a directory containing SKILL.md",
                    })}
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAddLocalPath}
                    disabled={
                      !localPathInput.trim() ||
                      localSelected.includes(localPathInput.trim())
                    }
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t("settingsAgents.skillsLocalPath.addPath", {
                      defaultValue: "Add Path",
                    })}
                  </Button>
                </div>
              </div>

              {/* List of added local paths */}
              <ScrollArea className="max-h-[200px]">
                {localPaths.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <FolderOpen className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("settingsAgents.skillsLocalPath.pathHint", {
                        defaultValue:
                          "Select a directory containing SKILL.md",
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 pb-2">
                    {localPaths.map((path) => (
                      <div
                        key={path}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30"
                      >
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 min-w-0 text-sm font-mono truncate">
                          {path}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveLocalPath(path)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* ----------------------------------------------------------- */}
          {/* Tab 3: Built-in                                             */}
          {/* ----------------------------------------------------------- */}
          <TabsContent value="builtin" className="mt-3">
            {BUILTIN_SKILLS.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                  <Package className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("settingsAgents.builtinComingSoon", {
                    defaultValue: "No built-in skills yet, stay tuned",
                  })}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[280px]">
                <div className="space-y-2 pb-2">
                  {BUILTIN_SKILLS.map((skill) => {
                    const isSelected = localSelected.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        onClick={() => handleToggleSkill(skill.id)}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/50 hover:bg-muted/50",
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">
                            {skill.name}
                          </span>
                          {skill.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {skill.description}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
          <div className="flex w-full items-center justify-end">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges}>
                {t("common.save", { defaultValue: "Save" })}
                {hasChanges && localSelected.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 text-[10px] px-1.5"
                  >
                    {localSelected.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
