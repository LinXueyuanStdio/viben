/**
 * Workspace Ideas Management Page
 * 工作区想法管理页面
 *
 * Provides UI for managing AI-generated ideas in a workspace.
 * Features:
 * - List idea types and ideas
 * - Generate ideas via command queue
 * - View idea details in code editor
 * - Promote ideas to tasks
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Lightbulb,
  Plus,
  Loader2,
  Sparkles,
  Trash2,
  X,
  Search,
  ListTodo,
  PanelLeftClose,
  PanelLeft,
  FileText,
  Zap,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// Tabs removed - using custom multi-tab implementation
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { CodeEditor } from "@/components/skill-files/code-editor";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { getGatewayClient } from "@/lib/gateway";
import {
  useIdeas,
  useIdeaTypes,
  useIdeaDetail,
  useIdeaFileContent,
  type Idea,
  type IdeaType,
  type EffortLevel,
} from "@/hooks/use-ideas";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ListItem,
  getGradientByName,
  formatRelativeTime,
  type ListItemAction,
  type ListItemBadge,
} from "@/components/chat/list-item";

// =============================================================================
// Helpers
// =============================================================================

// Effort level badge variants
const EFFORT_BADGE_VARIANTS: Record<EffortLevel, ListItemBadge["variant"]> = {
  trivial: "primary",
  small: "secondary",
  medium: "default",
  large: "outline",
  complex: "destructive",
};

// Status badge variants
const STATUS_BADGE_VARIANTS: Record<string, ListItemBadge["variant"]> = {
  pending: "default",
  promoted: "primary",
  dismissed: "destructive",
};

// Format idea content as markdown for display
function formatIdeaAsMarkdown(idea: Idea): string {
  const lines: string[] = [];

  lines.push(`# ${idea.title}`);
  lines.push("");
  lines.push(`**Type:** ${idea.type}`);
  lines.push(`**Status:** ${idea.status}`);
  lines.push(`**Effort:** ${idea.estimated_effort}`);
  if (idea.promoted_to) {
    lines.push(`**Promoted To:** ${idea.promoted_to}`);
  }
  lines.push(`**Created:** ${idea.created_at}`);
  lines.push("");

  lines.push("## Description");
  lines.push("");
  lines.push(idea.description);
  lines.push("");

  lines.push("## Rationale");
  lines.push("");
  lines.push(idea.rationale);
  lines.push("");

  if (idea.implementation_approach) {
    lines.push("## Implementation Approach");
    lines.push("");
    lines.push(idea.implementation_approach);
    lines.push("");
  }

  if (idea.affected_files && idea.affected_files.length > 0) {
    lines.push("## Affected Files");
    lines.push("");
    idea.affected_files.forEach((file) => {
      lines.push(`- ${file}`);
    });
    lines.push("");
  }

  if (idea.existing_patterns && idea.existing_patterns.length > 0) {
    lines.push("## Existing Patterns");
    lines.push("");
    idea.existing_patterns.forEach((pattern) => {
      lines.push(`- ${pattern}`);
    });
    lines.push("");
  }

  if (idea.builds_upon && idea.builds_upon.length > 0) {
    lines.push("## Builds Upon");
    lines.push("");
    idea.builds_upon.forEach((item) => {
      lines.push(`- ${item}`);
    });
    lines.push("");
  }

  if (idea.user_stories && idea.user_stories.length > 0) {
    lines.push("## User Stories");
    lines.push("");
    idea.user_stories.forEach((story) => {
      lines.push(`- ${story}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

// Format idea type as markdown for display
function formatIdeaTypeAsMarkdown(type: IdeaType): string {
  const lines: string[] = [];

  lines.push(`# ${type.name}`);
  lines.push("");
  lines.push(`**Source:** ${type.source}`);
  if (type.max_ideas) {
    lines.push(`**Max Ideas:** ${type.max_ideas}`);
  }
  lines.push(`**Prompt Path:** ${type.prompt_path}`);
  lines.push("");

  lines.push("## Description");
  lines.push("");
  lines.push(type.description);
  lines.push("");

  return lines.join("\n");
}

// Submit command to queue
async function submitToQueue(command: string, cwd: string): Promise<boolean> {
  try {
    const client = getGatewayClient();
    const baseUrl = client.getBaseUrl();

    const response = await fetch(`${baseUrl}/api/command-queue/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ command, cwd }),
    });

    if (!response.ok) {
      console.error("Failed to submit to queue:", response.statusText);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to submit to queue:", err);
    return false;
  }
}

// =============================================================================
// Types
// =============================================================================

type SelectionType = "type" | "idea";

interface Selection {
  type: SelectionType;
  id: string;
}

// Tab types
interface IdeaTab {
  id: string;
  type: "idea";
  idea: Idea;
  filePath: string | null;
}

interface TypeTab {
  id: string;
  type: "type";
  ideaType: IdeaType;
}

type Tab = IdeaTab | TypeTab;

// =============================================================================
// Main Component
// =============================================================================

export function WorkspaceIdeasPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Multi-tab state
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Get workspace
  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Hooks for data fetching
  const {
    ideas,
    loading: loadingIdeas,
    error: ideasError,
    refresh: refreshIdeas,
    promoteIdea,
    dismissIdea,
    removeIdea,
  } = useIdeas({
    workspacePath: workspace?.path ?? null,
  });

  const {
    types: ideaTypes,
    loading: loadingTypes,
    error: typesError,
    refresh: refreshTypes,
  } = useIdeaTypes({
    workspacePath: workspace?.path ?? null,
  });

  // Get selected idea detail (for opening tabs)
  const selectedIdeaId = selection?.type === "idea" ? selection.id : null;
  const {
    idea: selectedIdea,
    filePath: ideaFilePath,
    loading: loadingDetail,
  } = useIdeaDetail({
    workspacePath: workspace?.path ?? null,
    ideaId: selectedIdeaId,
  });

  // File content reader for active tab
  const {
    content: fileContent,
    loading: fileLoading,
    readFile,
    clearContent,
  } = useIdeaFileContent();

  // Loading state
  const loading = loadingIdeas || loadingTypes || isLoadingWorkspaces;

  // Show errors via console
  if (ideasError) {
    console.error("Ideas fetch error:", ideasError);
  }
  if (typesError) {
    console.error("Types fetch error:", typesError);
  }

  // Filter ideas and types by search query
  const filteredTypes = useMemo(() => {
    if (!searchQuery) return ideaTypes;
    const query = searchQuery.toLowerCase();
    return ideaTypes.filter(
      (type) =>
        type.name.toLowerCase().includes(query) ||
        type.description.toLowerCase().includes(query)
    );
  }, [ideaTypes, searchQuery]);

  const filteredIdeas = useMemo(() => {
    if (!searchQuery) return ideas;
    const query = searchQuery.toLowerCase();
    return ideas.filter(
      (idea) =>
        idea.title.toLowerCase().includes(query) ||
        idea.description.toLowerCase().includes(query) ||
        idea.type.toLowerCase().includes(query)
    );
  }, [ideas, searchQuery]);

  // Group ideas by type
  const ideasByType = useMemo(() => {
    const grouped: Record<string, Idea[]> = {};
    filteredIdeas.forEach((idea) => {
      if (!grouped[idea.type]) {
        grouped[idea.type] = [];
      }
      grouped[idea.type].push(idea);
    });
    return grouped;
  }, [filteredIdeas]);

  // Selected type
  const selectedType = useMemo(() => {
    if (selection?.type !== "type") return null;
    return ideaTypes.find((t) => t.name === selection.id) ?? null;
  }, [selection, ideaTypes]);

  // Active tab
  const activeTab = useMemo(() => {
    return openTabs.find((tab) => tab.id === activeTabId) ?? null;
  }, [openTabs, activeTabId]);

  // Open a tab for idea (with file content loading)
  const openIdeaTab = useCallback(
    (idea: Idea, filePath: string | null) => {
      const tabId = `idea-${idea.id}`;
      const existingTab = openTabs.find((t) => t.id === tabId);

      if (!existingTab) {
        const newTab: IdeaTab = {
          id: tabId,
          type: "idea",
          idea,
          filePath,
        };
        setOpenTabs((prev) => [...prev, newTab]);
      }
      setActiveTabId(tabId);

      // Load file content if available
      if (filePath) {
        readFile(filePath);
      } else {
        clearContent();
      }
    },
    [openTabs, readFile, clearContent]
  );

  // Open a tab for idea type
  const openTypeTab = useCallback(
    (ideaType: IdeaType) => {
      const tabId = `type-${ideaType.name}`;
      const existingTab = openTabs.find((t) => t.id === tabId);

      if (!existingTab) {
        const newTab: TypeTab = {
          id: tabId,
          type: "type",
          ideaType,
        };
        setOpenTabs((prev) => [...prev, newTab]);
      }
      setActiveTabId(tabId);
      clearContent();
    },
    [openTabs, clearContent]
  );

  // Close a tab
  const closeTab = useCallback(
    (tabId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const newTabs = openTabs.filter((t) => t.id !== tabId);
      setOpenTabs(newTabs);

      // If closing active tab, switch to another tab
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          const newActiveTab = newTabs[newTabs.length - 1];
          setActiveTabId(newActiveTab.id);
          // Load content for new active tab
          if (newActiveTab.type === "idea" && newActiveTab.filePath) {
            readFile(newActiveTab.filePath);
          } else {
            clearContent();
          }
        } else {
          setActiveTabId(null);
          clearContent();
        }
      }
    },
    [openTabs, activeTabId, readFile, clearContent]
  );

  // Switch to a tab
  const switchToTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      const tab = openTabs.find((t) => t.id === tabId);
      if (tab?.type === "idea" && tab.filePath) {
        readFile(tab.filePath);
      } else {
        clearContent();
      }
    },
    [openTabs, readFile, clearContent]
  );

  // Track previous values to avoid unnecessary tab opens
  const prevIdeaIdRef = useRef<string | null>(null);
  const prevTypeNameRef = useRef<string | null>(null);

  // Effect to open tab when idea is selected and loaded
  useEffect(() => {
    if (selectedIdea && selection?.type === "idea" && prevIdeaIdRef.current !== selectedIdea.id) {
      prevIdeaIdRef.current = selectedIdea.id;
      openIdeaTab(selectedIdea, ideaFilePath);
    }
  }, [selectedIdea?.id, ideaFilePath, selection?.type, openIdeaTab]);

  // Effect to open tab when type is selected
  useEffect(() => {
    if (selectedType && selection?.type === "type" && prevTypeNameRef.current !== selectedType.name) {
      prevTypeNameRef.current = selectedType.name;
      openTypeTab(selectedType);
    }
  }, [selectedType?.name, selection?.type, openTypeTab]);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshIdeas(), refreshTypes()]);
  }, [refreshIdeas, refreshTypes]);

  // Handle generate ideas for a type
  const handleGenerateIdeas = useCallback(
    async (typeName?: string) => {
      if (!workspace?.path) return;

      const types = typeName ? [typeName] : ideaTypes.map((t) => t.name);
      if (types.length === 0) {
        toast.error(t("ideas.noTypesAvailable"));
        return;
      }

      // Submit to command queue
      const command = `viben idea generate ${types.join(" ")}`;
      const success = await submitToQueue(command, workspace.path);

      if (success) {
        toast.success(t("ideas.generateTaskSubmitted"));
      } else {
        toast.error(t("ideas.generateTaskFailed"));
      }
    },
    [workspace?.path, ideaTypes, t]
  );

  // Handle promote idea to task
  const handlePromoteIdea = useCallback(
    async (idea: Idea) => {
      const result = await promoteIdea(idea.id);
      if (result) {
        toast.success(t("ideas.promoteSuccess", { title: idea.title }));
      } else {
        toast.error(t("ideas.promoteFailed"));
      }
    },
    [promoteIdea, t]
  );

  // Handle dismiss idea
  const handleDismissIdea = useCallback(
    async (idea: Idea) => {
      const success = await dismissIdea(idea.id);
      if (success) {
        toast.success(t("ideas.dismissSuccess"));
      } else {
        toast.error(t("ideas.dismissFailed"));
      }
    },
    [dismissIdea, t]
  );

  // Handle remove idea
  const handleRemoveIdea = useCallback(
    async (idea: Idea) => {
      if (!confirm(t("ideas.removeConfirm", { title: idea.title }))) return;
      const success = await removeIdea(idea.id);
      if (success) {
        toast.success(t("ideas.removeSuccess"));
        // Close the tab if it's open
        const tabId = `idea-${idea.id}`;
        closeTab(tabId);
        if (selection?.id === idea.id) {
          setSelection(null);
        }
      } else {
        toast.error(t("ideas.removeFailed"));
      }
    },
    [removeIdea, selection, closeTab, t]
  );

  // Get content for the active tab
  const getTabContent = useCallback(
    (tab: Tab | null): { content: string; filename: string } | null => {
      if (!tab) return null;

      if (tab.type === "type") {
        return {
          content: formatIdeaTypeAsMarkdown(tab.ideaType),
          filename: `${tab.ideaType.name}.md`,
        };
      }

      // For idea tabs, prefer file content if available
      if (tab.type === "idea") {
        if (fileContent && tab.filePath) {
          // Use actual file content
          return {
            content: fileContent,
            filename: tab.filePath.split("/").pop() || `idea_${tab.idea.id}.yaml`,
          };
        }
        // Fallback to markdown format
        return {
          content: formatIdeaAsMarkdown(tab.idea),
          filename: `idea_${tab.idea.id}.md`,
        };
      }

      return null;
    },
    [fileContent]
  );

  const tabContent = getTabContent(activeTab);

  // Loading state
  if (isLoadingWorkspaces && !workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Workspace not found
  if (!workspace && workspaces.length > 0) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t("workspace.notFound")}</h2>
          <p className="text-muted-foreground mb-4">{t("workspace.notFoundDesc")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Fallback loading
  if (!workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      {/* Header */}
      <WorkspaceHeader
        workspace={workspace}
        segments={[{ label: t("ideas.title"), href: `/workspace/${workspaceId}/ideas` }]}
        onRefresh={handleRefresh}
        isRefreshing={loading}
        showRemove={false}
        rightContent={
          <div className="flex items-center gap-2">
            <Button onClick={() => handleGenerateIdeas()} variant="default">
              <Sparkles className="h-4 w-4 mr-2" />
              {t("ideas.generateIdeas")}
            </Button>
          </div>
        }
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - List */}
        <div
          className={cn(
            "flex flex-col border-r transition-all duration-200",
            isPanelCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-80"
          )}
        >
          {/* List Header */}
          <div className="p-3 border-b flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleGenerateIdeas()}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t("ideas.generateIdeas")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsPanelCollapsed(true)}>
                  <PanelLeftClose className="h-4 w-4 mr-2" />
                  {t("ideas.hidePanel")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* List Content */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-4">
              {/* Idea Types Section */}
              <div>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("ideas.ideaTypes")}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {filteredTypes.length}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {loadingTypes ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredTypes.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      {t("ideas.noTypes")}
                    </div>
                  ) : (
                    filteredTypes.map((type) => (
                      <IdeaTypeCard
                        key={type.name}
                        type={type}
                        isSelected={selection?.type === "type" && selection.id === type.name}
                        onSelect={() => setSelection({ type: "type", id: type.name })}
                        onGenerate={() => handleGenerateIdeas(type.name)}
                      />
                    ))
                  )}
                </div>
              </div>

              <Separator />

              {/* Ideas Section */}
              <div>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("ideas.ideas")}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {filteredIdeas.length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {loadingIdeas ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredIdeas.length === 0 ? (
                    <div className="px-2 py-8 text-center">
                      <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">{t("ideas.noIdeas")}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => handleGenerateIdeas()}
                      >
                        <Sparkles className="h-3 w-3 mr-1.5" />
                        {t("ideas.generateIdeas")}
                      </Button>
                    </div>
                  ) : (
                    Object.entries(ideasByType).map(([typeName, typeIdeas]) => (
                      <div key={typeName}>
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <FolderOpen className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{typeName}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {typeIdeas.length}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {typeIdeas.map((idea) => (
                            <IdeaCard
                              key={idea.id}
                              idea={idea}
                              isSelected={selection?.type === "idea" && selection.id === idea.id}
                              onSelect={() => setSelection({ type: "idea", id: idea.id })}
                              onPromote={() => handlePromoteIdea(idea)}
                              onDismiss={() => handleDismissIdea(idea)}
                              onRemove={() => handleRemoveIdea(idea)}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Detail */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Multi-Tab Bar */}
          {openTabs.length > 0 ? (
            <div className="border-b bg-muted/20">
              <div className="flex items-center">
                {/* Show panel button when collapsed */}
                {isPanelCollapsed && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 border-r"
                          onClick={() => setIsPanelCollapsed(false)}
                        >
                          <PanelLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{t("ideas.showPanel")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Tabs */}
                <div className="flex overflow-x-auto flex-1">
                  {openTabs.map((tab) => (
                    <div
                      key={tab.id}
                      onClick={() => switchToTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 border-r cursor-pointer text-sm group",
                        "hover:bg-accent/50 transition-colors",
                        activeTabId === tab.id
                          ? "bg-background border-b-2 border-b-primary"
                          : "bg-muted/30"
                      )}
                    >
                      {tab.type === "idea" ? (
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-blue-500" />
                      )}
                      <span className="truncate max-w-[120px]">
                        {tab.type === "idea" ? tab.idea.title : tab.ideaType.name}
                      </span>
                      <button
                        onClick={(e) => closeTab(tab.id, e)}
                        className="ml-1 p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                {activeTab && (
                  <div className="flex items-center gap-2 px-3 shrink-0">
                    {activeTab.type === "type" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleGenerateIdeas(activeTab.ideaType.name)}
                      >
                        <Zap className="h-3.5 w-3.5 mr-1.5" />
                        {t("ideas.generateThisType")}
                      </Button>
                    )}
                    {activeTab.type === "idea" && activeTab.idea.status === "pending" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handlePromoteIdea(activeTab.idea)}
                      >
                        <ListTodo className="h-3.5 w-3.5 mr-1.5" />
                        {t("ideas.createTaskFromIdea")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center border-b px-4 h-11 shrink-0">
              {isPanelCollapsed && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 mr-2"
                        onClick={() => setIsPanelCollapsed(false)}
                      >
                        <PanelLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{t("ideas.showPanel")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <span className="text-sm text-muted-foreground">{t("ideas.selectItem")}</span>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {loadingDetail || fileLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tabContent ? (
              <CodeEditor
                value={tabContent.content}
                filename={tabContent.filename}
                height="100%"
                readOnly
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Lightbulb className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-sm">{t("ideas.selectItemToView")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

// =============================================================================
// Sub Components
// =============================================================================

interface IdeaTypeCardProps {
  type: IdeaType;
  isSelected: boolean;
  onSelect: () => void;
  onGenerate: () => void;
}

function IdeaTypeCard({ type, isSelected, onSelect, onGenerate }: IdeaTypeCardProps) {
  const { t } = useTranslation();

  // Build actions
  const actions: ListItemAction[] = [
    {
      label: t("ideas.generateIdeas"),
      icon: Sparkles,
      onClick: onGenerate,
    },
  ];

  // Build badges
  const badges: ListItemBadge[] = [
    {
      label: type.source,
      variant: type.source === "builtin" ? "primary" : "secondary",
    },
  ];

  if (type.max_ideas) {
    badges.push({
      label: `max: ${type.max_ideas}`,
      variant: "outline",
    });
  }

  return (
    <ListItem
      name={type.name}
      description={type.description}
      avatar={{
        icon: FileText,
        gradient: getGradientByName(type.name),
      }}
      badges={badges}
      isSelected={isSelected}
      onClick={onSelect}
      actions={actions}
      contextMenu
    />
  );
}

interface IdeaCardProps {
  idea: Idea;
  isSelected: boolean;
  onSelect: () => void;
  onPromote: () => void;
  onDismiss: () => void;
  onRemove: () => void;
}

function IdeaCard({ idea, isSelected, onSelect, onPromote, onDismiss, onRemove }: IdeaCardProps) {
  const { t } = useTranslation();

  // Build actions based on status
  const actions: ListItemAction[] = [];

  if (idea.status === "pending") {
    actions.push({
      label: t("ideas.promoteToTask"),
      icon: ListTodo,
      onClick: onPromote,
    });
    actions.push({
      label: t("ideas.dismiss"),
      icon: X,
      onClick: onDismiss,
    });
  }

  actions.push({
    label: t("common.delete"),
    icon: Trash2,
    onClick: onRemove,
    destructive: true,
    separator: idea.status === "pending",
  });

  // Build badges
  const badges: ListItemBadge[] = [
    {
      label: idea.estimated_effort,
      variant: EFFORT_BADGE_VARIANTS[idea.estimated_effort],
    },
  ];

  if (idea.status !== "pending") {
    badges.push({
      label: idea.status,
      variant: STATUS_BADGE_VARIANTS[idea.status],
    });
  }

  return (
    <ListItem
      name={idea.title}
      description={idea.description}
      avatar={{
        icon: Lightbulb,
        gradient: getGradientByName(idea.type),
      }}
      badges={badges}
      meta={{
        text: formatRelativeTime(idea.created_at),
      }}
      isSelected={isSelected}
      onClick={onSelect}
      actions={actions}
      contextMenu
    />
  );
}
