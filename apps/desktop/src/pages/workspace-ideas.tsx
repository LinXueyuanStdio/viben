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
  Save,
  FilePlus,
  MoreHorizontal,
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

  // Left panel ScrollArea ref and width tracking for overflow fix
  const leftPanelScrollRef = useRef<HTMLDivElement>(null);
  const [leftPanelScrollWidth, setLeftPanelScrollWidth] = useState<number | null>(null);

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

  // Track left panel scroll area width using ResizeObserver
  useEffect(() => {
    const scrollArea = leftPanelScrollRef.current;
    if (!scrollArea) return;

    const updateWidth = () => {
      const width = scrollArea.getBoundingClientRect().width;
      setLeftPanelScrollWidth(width);
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(scrollArea);
    return () => resizeObserver.disconnect();
  }, []);

  // Constrain left panel content width to prevent overflow
  const leftPanelContentStyle: React.CSSProperties = leftPanelScrollWidth
    ? { width: leftPanelScrollWidth, maxWidth: leftPanelScrollWidth }
    : {};

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

  // Selected idea from the list (available immediately without API call)
  const selectedIdeaFromList = useMemo(() => {
    if (selection?.type !== "idea") return null;
    return ideas.find((i) => i.id === selection.id) ?? null;
  }, [selection, ideas]);

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

  // Effect to handle idea selection - switch to existing tab or create new tab
  // Uses selectedIdeaFromList (immediately available) for tab creation,
  // and ideaFilePath from useIdeaDetail for the file path
  useEffect(() => {
    if (selection?.type !== "idea" || !selectedIdeaFromList) return;

    const tabId = `idea-${selection.id}`;
    const existingTab = openTabs.find((t) => t.id === tabId);

    if (existingTab) {
      // Tab exists, switch to it
      if (activeTabId !== tabId) {
        setActiveTabId(tabId);
        if (existingTab.type === "idea" && existingTab.filePath) {
          readFile(existingTab.filePath);
        }
        setHasUnsavedChanges(false);
      }
    } else {
      // Create new tab using idea from list (immediately available)
      // Use ideaFilePath if loaded, otherwise null (will be updated when loaded)
      const filePath = selectedIdea?.id === selection.id ? ideaFilePath : null;
      openIdeaTab(selectedIdeaFromList, filePath);
    }
  }, [selection?.id, selection?.type, selectedIdeaFromList]);

  // Effect to update tab's filePath when ideaFilePath is loaded
  useEffect(() => {
    if (!selectedIdea || !ideaFilePath || selection?.type !== "idea") return;
    if (selection.id !== selectedIdea.id) return;

    const tabId = `idea-${selectedIdea.id}`;
    const existingTab = openTabs.find((t) => t.id === tabId);

    if (existingTab && existingTab.type === "idea" && !existingTab.filePath) {
      // Update tab with the loaded filePath
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.id === tabId && t.type === "idea" ? { ...t, filePath: ideaFilePath } : t
        )
      );
      // Load the file content
      readFile(ideaFilePath);
    }
  }, [selectedIdea?.id, ideaFilePath, selection?.id, selection?.type]);

  // Effect to switch to existing tab immediately when selection changes (for types)
  useEffect(() => {
    if (selection?.type === "type") {
      const tabId = `type-${selection.id}`;
      const existingTab = openTabs.find((t) => t.id === tabId);

      if (existingTab && activeTabId !== tabId) {
        // Tab exists, switch to it immediately
        setActiveTabId(tabId);
        if (existingTab.type === "type" && existingTab.promptPath) {
          readFile(existingTab.promptPath);
        }
        setHasUnsavedChanges(false);
      }
    }
  }, [selection?.id, selection?.type, openTabs, activeTabId, readFile]);

  // Effect to create new tab when type is selected
  useEffect(() => {
    if (selectedType && selection?.type === "type" && selection.id === selectedType.name) {
      const tabId = `type-${selectedType.name}`;
      const existingTab = openTabs.find((t) => t.id === tabId);

      if (!existingTab) {
        // Create new tab only when it doesn't exist
        openTypeTab(selectedType);
      }
    }
  }, [selectedType?.name, selection?.id, selection?.type, openTabs, openTypeTab]);

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
          <div className="p-2 border-b flex items-center gap-2 h-[57px]">
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
                <DropdownMenuItem onClick={() => {/* TODO: Create idea type */}}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  {t("ideas.createIdeaType")}
                </DropdownMenuItem>
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
          <ScrollArea className="flex-1" ref={leftPanelScrollRef}>
            <div className="p-2 space-y-4" style={leftPanelContentStyle}>
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
            <div className="border-b bg-muted/20 h-[57px] flex items-center">
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
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    {t("ideas.generateThisType")}
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
                    {t("ideas.createTaskFromIdea")}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center border-b px-4 h-[57px]">
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
  onDelete?: () => void;
}

function IdeaTypeCard({ type, isSelected, onSelect, onGenerate, onDelete }: IdeaTypeCardProps) {
  const { t } = useTranslation();

  // Build actions for context menu
  const actions: ListItemAction[] = [
    {
      label: t("ideas.generateThisType"),
      icon: Sparkles,
      onClick: onGenerate,
    },
  ];

  // Only custom types can be deleted
  if (type.source === "custom" && onDelete) {
    actions.push({
      label: t("common.delete"),
      icon: Trash2,
      onClick: onDelete,
      destructive: true,
      separator: true,
    });
  }

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
    <div
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all rounded-lg",
        isSelected ? "bg-accent" : "hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      {/* Avatar */}
      <div
        className={cn(
          "relative shrink-0 w-11 h-11 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm",
          getGradientByName(type.name)
        )}
      >
        <FileText className="h-5 w-5 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-medium text-sm truncate">{type.name}</span>
          {badges.map((badge, index) => (
            <span
              key={index}
              className={cn(
                "shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium",
                badge.variant === "primary" && "bg-primary/10 text-primary",
                badge.variant === "secondary" && "bg-secondary text-secondary-foreground",
                badge.variant === "outline" && "border border-border bg-transparent"
              )}
            >
              {badge.label}
            </span>
          ))}
        </div>
        {type.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {type.description}
          </p>
        )}
      </div>

      {/* Quick Actions - always visible generate button */}
      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                onClick={onGenerate}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("ideas.generateThisType")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onGenerate}>
              <Sparkles className="h-4 w-4 mr-2" />
              {t("ideas.generateThisType")}
            </DropdownMenuItem>
            {type.source === "custom" && onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("common.delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface IdeaCardProps {
  idea: Idea;
  isSelected: boolean;
  onSelect: () => void;
  onPromote: () => void;
  onRemove: () => void;
}

function IdeaCard({ idea, isSelected, onSelect, onPromote, onRemove }: IdeaCardProps) {
  const { t } = useTranslation();

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
    <div
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all rounded-lg",
        isSelected ? "bg-accent" : "hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      {/* Avatar */}
      <div
        className={cn(
          "relative shrink-0 w-11 h-11 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm",
          getGradientByName(idea.type)
        )}
      >
        <Lightbulb className="h-5 w-5 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-sm truncate">{idea.title}</span>
            {badges.map((badge, index) => (
              <span
                key={index}
                className={cn(
                  "shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium",
                  badge.variant === "primary" && "bg-primary/10 text-primary",
                  badge.variant === "secondary" && "bg-secondary text-secondary-foreground",
                  badge.variant === "default" && "bg-muted text-muted-foreground",
                  badge.variant === "outline" && "border border-border bg-transparent",
                  badge.variant === "destructive" && "bg-destructive/10 text-destructive"
                )}
              >
                {badge.label}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatRelativeTime(idea.created_at)}
          </span>
        </div>
        {idea.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {idea.description}
          </p>
        )}
      </div>

      {/* Quick Actions - delete button and more menu */}
      <div
        className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {/* More menu with create task option */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {idea.status === "pending" && (
              <DropdownMenuItem onClick={onPromote}>
                <ListTodo className="h-4 w-4 mr-2" />
                {t("ideas.createTaskFromIdea")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Delete button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("common.delete")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
