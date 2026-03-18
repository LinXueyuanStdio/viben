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
  Check,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// Save file content via API
async function saveFileContent(filePath: string, content: string): Promise<boolean> {
  try {
    const client = getGatewayClient();
    const baseUrl = client.getBaseUrl();

    const response = await fetch(`${baseUrl}/api/files/content`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ path: filePath, content }),
    });

    if (!response.ok) {
      console.error("Failed to save file:", response.statusText);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to save file:", err);
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
  promptPath: string;
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

  // Generate dialog state
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedTypesForGenerate, setSelectedTypesForGenerate] = useState<Set<string>>(new Set());

  // Editor state
  const [editorContent, setEditorContent] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  // Update editor content when file content changes
  useEffect(() => {
    if (fileContent !== null) {
      setEditorContent(fileContent);
      setHasUnsavedChanges(false);
    }
  }, [fileContent]);

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
        setEditorContent("");
      }
      setHasUnsavedChanges(false);
    },
    [openTabs, readFile, clearContent]
  );

  // Open a tab for idea type (load prompt_path file)
  const openTypeTab = useCallback(
    (ideaType: IdeaType) => {
      const tabId = `type-${ideaType.name}`;
      const existingTab = openTabs.find((t) => t.id === tabId);

      if (!existingTab) {
        const newTab: TypeTab = {
          id: tabId,
          type: "type",
          ideaType,
          promptPath: ideaType.prompt_path,
        };
        setOpenTabs((prev) => [...prev, newTab]);
      }
      setActiveTabId(tabId);

      // Load prompt file content
      if (ideaType.prompt_path) {
        readFile(ideaType.prompt_path);
      } else {
        clearContent();
        setEditorContent("");
      }
      setHasUnsavedChanges(false);
    },
    [openTabs, readFile, clearContent]
  );

  // Close a tab
  const closeTab = useCallback(
    (tabId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();

      // Check for unsaved changes
      if (activeTabId === tabId && hasUnsavedChanges) {
        if (!confirm(t("ideas.unsavedChangesConfirm"))) {
          return;
        }
      }

      const newTabs = openTabs.filter((t) => t.id !== tabId);
      setOpenTabs(newTabs);

      // If closing active tab, switch to another tab
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          const newActiveTab = newTabs[newTabs.length - 1];
          setActiveTabId(newActiveTab.id);
          // Load content for new active tab
          const filePath = newActiveTab.type === "idea"
            ? newActiveTab.filePath
            : newActiveTab.promptPath;
          if (filePath) {
            readFile(filePath);
          } else {
            clearContent();
            setEditorContent("");
          }
        } else {
          setActiveTabId(null);
          clearContent();
          setEditorContent("");
        }
        setHasUnsavedChanges(false);
      }
    },
    [openTabs, activeTabId, hasUnsavedChanges, readFile, clearContent, t]
  );

  // Switch to a tab
  const switchToTab = useCallback(
    (tabId: string) => {
      // Check for unsaved changes before switching
      if (activeTabId && activeTabId !== tabId && hasUnsavedChanges) {
        if (!confirm(t("ideas.unsavedChangesConfirm"))) {
          return;
        }
      }

      setActiveTabId(tabId);
      const tab = openTabs.find((t) => t.id === tabId);
      const filePath = tab?.type === "idea" ? tab.filePath : tab?.type === "type" ? tab.promptPath : null;
      if (filePath) {
        readFile(filePath);
      } else {
        clearContent();
        setEditorContent("");
      }
      setHasUnsavedChanges(false);
    },
    [openTabs, activeTabId, hasUnsavedChanges, readFile, clearContent, t]
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

  // Open generate dialog with optional pre-selected type
  const openGenerateDialog = useCallback(
    (preSelectedType?: string) => {
      if (preSelectedType) {
        setSelectedTypesForGenerate(new Set([preSelectedType]));
      } else {
        // Select all types by default
        setSelectedTypesForGenerate(new Set(ideaTypes.map((t) => t.name)));
      }
      setIsGenerateDialogOpen(true);
    },
    [ideaTypes]
  );

  // Handle generate ideas from dialog
  const handleGenerateFromDialog = useCallback(async () => {
    if (!workspace?.path) return;

    const types = Array.from(selectedTypesForGenerate);
    if (types.length === 0) {
      toast.error(t("ideas.noTypesSelected"));
      return;
    }

    // Submit to command queue
    const command = `viben idea generate ${types.join(" ")}`;
    const success = await submitToQueue(command, workspace.path);

    if (success) {
      toast.success(t("ideas.generateTaskSubmitted"));
      setIsGenerateDialogOpen(false);
    } else {
      toast.error(t("ideas.generateTaskFailed"));
    }
  }, [workspace?.path, selectedTypesForGenerate, t]);

  // Toggle type selection for generate
  const toggleTypeForGenerate = useCallback((typeName: string) => {
    setSelectedTypesForGenerate((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(typeName)) {
        newSet.delete(typeName);
      } else {
        newSet.add(typeName);
      }
      return newSet;
    });
  }, []);

  // Select/deselect all types
  const toggleAllTypesForGenerate = useCallback(() => {
    setSelectedTypesForGenerate((prev) => {
      if (prev.size === ideaTypes.length) {
        return new Set();
      }
      return new Set(ideaTypes.map((t) => t.name));
    });
  }, [ideaTypes]);

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

  // Handle editor content change
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value);
      setHasUnsavedChanges(true);
    }
  }, []);

  // Handle save file
  const handleSaveFile = useCallback(async () => {
    if (!activeTab) return;

    const filePath = activeTab.type === "idea" ? activeTab.filePath : activeTab.promptPath;
    if (!filePath) {
      toast.error(t("ideas.noFilePath"));
      return;
    }

    setIsSaving(true);
    const success = await saveFileContent(filePath, editorContent);
    setIsSaving(false);

    if (success) {
      toast.success(t("ideas.fileSaved"));
      setHasUnsavedChanges(false);
    } else {
      toast.error(t("ideas.fileSaveFailed"));
    }
  }, [activeTab, editorContent, t]);

  // Get current file path for active tab
  const currentFilePath = useMemo(() => {
    if (!activeTab) return null;
    return activeTab.type === "idea" ? activeTab.filePath : activeTab.promptPath;
  }, [activeTab]);

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
            <Button onClick={() => openGenerateDialog()} variant="default">
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
          {/* List Header - height matches tab bar */}
          <div className="p-2 border-b flex items-center gap-2 h-[41px]">
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
                <DropdownMenuItem onClick={() => openGenerateDialog()}>
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
                <div className="space-y-0.5">
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
                        onGenerate={() => openGenerateDialog(type.name)}
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
                        onClick={() => openGenerateDialog()}
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
                        <div className="space-y-0.5">
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
          {/* Multi-Tab Bar - same height as left header */}
          {openTabs.length > 0 ? (
            <div className="border-b bg-muted/20 h-[41px] flex items-center">
              {/* Show panel button when collapsed */}
              {isPanelCollapsed && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 ml-1"
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
              <div className="flex overflow-x-auto flex-1 h-full">
                {openTabs.map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() => switchToTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 border-r cursor-pointer text-sm group h-full",
                      "hover:bg-accent/50 transition-colors",
                      activeTabId === tab.id
                        ? "bg-background border-b-2 border-b-primary"
                        : "bg-muted/30"
                    )}
                  >
                    {tab.type === "idea" ? (
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    )}
                    <span className="truncate max-w-[100px]">
                      {tab.type === "idea" ? tab.idea.title : tab.ideaType.name}
                    </span>
                    {activeTabId === tab.id && hasUnsavedChanges && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                    )}
                    <button
                      onClick={(e) => closeTab(tab.id, e)}
                      className="p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 px-2 shrink-0">
                {hasUnsavedChanges && currentFilePath && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveFile}
                    disabled={isSaving}
                    className="h-7"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1.5">{t("common.save")}</span>
                  </Button>
                )}
                {activeTab?.type === "type" && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => openGenerateDialog(activeTab.ideaType.name)}
                    className="h-7"
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    {t("ideas.generate")}
                  </Button>
                )}
                {activeTab?.type === "idea" && activeTab.idea.status === "pending" && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handlePromoteIdea(activeTab.idea)}
                    className="h-7"
                  >
                    <ListTodo className="h-3.5 w-3.5 mr-1" />
                    {t("ideas.promote")}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center border-b px-4 h-[41px]">
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
            ) : currentFilePath && editorContent !== null ? (
              <CodeEditor
                value={editorContent}
                filename={currentFilePath.split("/").pop() || "file"}
                height="100%"
                onChange={handleEditorChange}
              />
            ) : activeTab ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-sm">{t("ideas.noFileContent")}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Lightbulb className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-sm">{t("ideas.selectItemToView")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generate Ideas Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ideas.generateIdeasTitle")}</DialogTitle>
            <DialogDescription>
              {t("ideas.generateIdeasDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">{t("ideas.selectTypes")}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAllTypesForGenerate}
                className="h-7 text-xs"
              >
                {selectedTypesForGenerate.size === ideaTypes.length
                  ? t("common.deselectAll")
                  : t("common.selectAll")}
              </Button>
            </div>

            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {ideaTypes.map((type) => (
                  <label
                    key={type.name}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedTypesForGenerate.has(type.name)}
                      onCheckedChange={() => toggleTypeForGenerate(type.name)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{type.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            type.source === "builtin"
                              ? "border-blue-300 text-blue-600"
                              : "border-purple-300 text-purple-600"
                          )}
                        >
                          {type.source}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {type.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleGenerateFromDialog}
              disabled={selectedTypesForGenerate.size === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {t("ideas.generateSelected", { count: selectedTypesForGenerate.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <div className="w-full overflow-hidden">
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
        className="w-full"
      />
    </div>
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
    <div className="w-full overflow-hidden">
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
        className="w-full"
      />
    </div>
  );
}
