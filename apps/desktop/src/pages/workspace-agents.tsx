/**
 * Workspace Agents Page - WeChat-style layout
 *
 * 主要智能体管理入口：
 * - 显示当前工作空间的执行器（自动发现）
 * - 显示智能体列表（全局存储）
 * - 支持新增智能体（创建到全局目录）
 * - Left: List (执行器 + 智能体)
 * - Right: Detail panel with inline editing
 */
import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Bot,
  Plus,
  Loader2,
  Search,
  ArrowLeft,
  Sparkles,
  Workflow,
  Code2,
  ChevronDown,
  Terminal,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AgentListItem,
  ExecutorListItem,
  ExecutorDetailPanel,
  AgentDetailPanel,
} from "@/components/chat";
import { Separator } from "@/components/ui/separator";
import { useLocalWorkspaces, useVibenAgents, useVibenModels, useWorkspaceAgents, useWorkspaceAgentsFromGateway } from "@/hooks";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/types";
import { homeDir } from "@tauri-apps/api/path";
import { FolderOpen, Globe } from "lucide-react";
// ============================================================================
// Agent Templates
// ============================================================================

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "blank",
    name: "空白创建",
    description: "从零开始创建智能体",
    icon: <Plus className="h-5 w-5" />,
    color: "bg-muted",
  },
  {
    id: "general",
    name: "通用结构",
    description: "适用于多种场景的提示词结构",
    icon: <Sparkles className="h-5 w-5" />,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    id: "task",
    name: "任务执行",
    description: "适用于明确工作步骤的任务执行",
    icon: <Workflow className="h-5 w-5" />,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    id: "roleplay",
    name: "角色扮演",
    description: "适用于聊天场景",
    icon: <MessageSquare className="h-5 w-5" />,
    color: "bg-green-500/10 text-green-500",
  },
  {
    id: "coding",
    name: "编程助手",
    description: "专为代码开发优化",
    icon: <Code2 className="h-5 w-5" />,
    color: "bg-orange-500/10 text-orange-500",
  },
];

// ============================================================================
// Main Component
// ============================================================================

// ============================================================================
// List Item Type (for unified display)
// ============================================================================

interface ListItem {
  id: string;
  name: string;
  description?: string;
  type: "executor" | "agent" | "workspace-agent";
  executorType?: string; // e.g., "claude-code", "codex"
  /** Path to the agent configuration */
  path?: string;
  /** Workspace path this agent belongs to (for workspace-agent type) */
  workspacePath?: string;
  /** Source of config: "global", "project", "merged", or "workspace" */
  source?: "global" | "project" | "merged" | "workspace";
  /** Project-level config path (for executors with merged configs) */
  projectConfigPath?: string;
  /** Global config path (for executors) */
  globalConfigPath?: string;
  // For agents
  model?: string;
  provider?: string;
  mcp_servers?: string[];
  skills?: string[];
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Props for WorkspaceAgentsPage
// ============================================================================

interface WorkspaceAgentsPageProps {
  /**
   * When true, the page is rendered inside the Settings page
   * - Hides the workspace header
   * - Uses workspaceOverride instead of route params
   */
  settingsMode?: boolean;
  /**
   * Override workspace object (used in settings mode)
   * Pass the full workspace object so the component has access to path, id, etc.
   */
  workspaceOverride?: Workspace;
}

export function WorkspaceAgentsPage({
  settingsMode = false,
  workspaceOverride,
}: WorkspaceAgentsPageProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId: routeWorkspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();

  // Use override if provided (settings mode), otherwise use route param
  const workspaceId = workspaceOverride?.id ?? routeWorkspaceId;
  const workspace = workspaceOverride ?? (workspaceId ? getWorkspace(workspaceId) : undefined);

  // Workspace executors (auto-discovered from Tauri)
  const {
    agents: workspaceExecutorsList,
    loading: loadingWorkspaceExecutors,
    loadAgents: loadWorkspaceExecutors,
  } = useWorkspaceAgents(workspaceId || null);

  // All agents from Gateway API (combined global + workspace)
  const {
    loading: loadingGatewayAgents,
    refresh: refreshGatewayAgents,
    getVibenAgents,
  } = useWorkspaceAgentsFromGateway(workspace?.path || null);

  // Viben agents for CRUD operations (we still need this for create/update/delete)
  const {
    defaultAgentId,
    loading: loadingAgents,
    createAgent,
    removeAgent,
    updateAgent,
    setDefaultAgent,
    refresh: refreshVibenAgents,
  } = useVibenAgents();

  const {
    models,
    loading: loadingModels,
  } = useVibenModels();

  // UI state
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<"executor" | "agent" | "workspace-agent">("agent");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createLocation, setCreateLocation] = useState<"workspace" | "global">("workspace");
  const [globalVibenPath, setGlobalVibenPath] = useState<string>("");

  // Load global viben path
  useEffect(() => {
    homeDir().then((home) => {
      setGlobalVibenPath(`${home}.viben/agents/`);
    });
  }, []);
  const loading = loadingAgents || loadingModels || loadingWorkspaceExecutors || loadingGatewayAgents;

  // Refresh all
  const refreshAll = async () => {
    await Promise.all([refreshVibenAgents(), refreshGatewayAgents(), loadWorkspaceExecutors()]);
  };

  // Convert workspace executors to list items
  const executorItems: ListItem[] = useMemo(() => {
    return workspaceExecutorsList.map((e) => ({
      id: e.id,
      name: e.name,
      type: "executor" as const,
      executorType: e.type,
      path: e.config_path,
      // Mark as workspace source since these come from workspace discovery
      source: "project" as const,
    }));
  }, [workspaceExecutorsList]);

  // Convert gateway agents (combined global + workspace) to list items
  const agentItems: ListItem[] = useMemo(() => {
    // Filter to only viben agents (not IDE configs)
    const vibenAgents = getVibenAgents();
    return vibenAgents.map((a) => ({
      id: a.id,
      name: a.name,
      description: undefined, // Gateway API doesn't return description, will load on select
      type: a.source === "workspace" ? "workspace-agent" as const : "agent" as const,
      source: (a.source === "workspace" ? "workspace" : "global") as "workspace" | "global",
      path: a.config_path,
      workspacePath: a.config_path ? a.config_path.replace(/\/[^/]+\.json$/, "/") : undefined,
    }));
  }, [getVibenAgents]);

  // All items combined (executors + agents from gateway)
  const allItems = useMemo(() => {
    return [...executorItems, ...agentItems];
  }, [executorItems, agentItems]);

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const query = searchQuery.toLowerCase();
    return allItems.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query)
    );
  }, [allItems, searchQuery]);

  // Filtered by type
  const filteredExecutors = useMemo(
    () => filteredItems.filter((a) => a.type === "executor"),
    [filteredItems]
  );
  // Combined agents (both workspace and global)
  const filteredAllAgents = useMemo(
    () => filteredItems.filter((a) => a.type === "workspace-agent" || a.type === "agent"),
    [filteredItems]
  );

  // Get all viben agents from gateway for detail display
  const allVibenAgents = useMemo(() => getVibenAgents(), [getVibenAgents]);

  // Selected agent data (from Gateway API - includes both global and workspace agents)
  const selectedAgent = useMemo(() => {
    if (selectedItemType !== "agent" && selectedItemType !== "workspace-agent") return undefined;
    const gatewayAgent = allVibenAgents.find((a) => a.id === selectedItemId);
    if (!gatewayAgent) return undefined;
    // Gateway API returns minimal info, construct full agent structure
    // The detail panel will handle loading additional data if needed
    return {
      id: gatewayAgent.id,
      name: gatewayAgent.name,
      path: gatewayAgent.config_path,
      description: undefined as string | undefined, // Not available from gateway, could be loaded separately
      model: undefined as string | undefined,
      provider: undefined as string | undefined,
      system_prompt: undefined as string | undefined,
      temperature: undefined as number | undefined,
      max_tokens: undefined as number | undefined,
      mcp_servers: [] as string[],
      skills: [] as string[],
      created_at: "",
      updated_at: "",
    };
  }, [allVibenAgents, selectedItemId, selectedItemType]);

  // For workspace-scoped agents
  const isWorkspaceAgent = useMemo(() => {
    const gatewayAgent = allVibenAgents.find((a) => a.id === selectedItemId);
    return gatewayAgent?.source === "workspace";
  }, [allVibenAgents, selectedItemId]);

  // Selected executor (from workspace discovery)
  const selectedExecutor = useMemo(
    () => workspaceExecutorsList.find((e) => e.id === selectedItemId && selectedItemType === "executor"),
    [workspaceExecutorsList, selectedItemId, selectedItemType]
  );

  // Auto-select first item when list changes
  useEffect(() => {
    if (!selectedItemId && filteredItems.length > 0) {
      const first = filteredItems[0];
      setSelectedItemId(first.id);
      setSelectedItemType(first.type);
    } else if (selectedItemId && !filteredItems.find((a) => a.id === selectedItemId)) {
      const first = filteredItems[0];
      if (first) {
        setSelectedItemId(first.id);
        setSelectedItemType(first.type);
      } else {
        setSelectedItemId(null);
      }
    }
  }, [filteredItems, selectedItemId]);

  // Open create dialog with template
  const openCreateDialog = (template?: AgentTemplate) => {
    setSelectedTemplate(template || AGENT_TEMPLATES[0]);
    setNewAgentName(template && template.id !== "blank" ? template.name : "");
    setNewAgentDescription("");
    setCreateLocation("workspace");
    setCreateDialogOpen(true);
  };

  // Create agent
  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    setCreating(true);
    const isWorkspaceAgent = createLocation === "workspace" && workspace?.path;
    try {
      const newAgent = await createAgent({
        name: newAgentName.trim(),
        description: newAgentDescription.trim() || undefined,
        // Pass workspace path if creating in workspace, undefined for global
        base_path: isWorkspaceAgent ? workspace.path : undefined,
      });
      // Refresh the gateway agents list to show the new agent
      await refreshGatewayAgents();
      setCreateDialogOpen(false);
      setNewAgentName("");
      setNewAgentDescription("");
      setSelectedTemplate(null);
      setSelectedItemId(newAgent.id);
      setSelectedItemType(isWorkspaceAgent ? "workspace-agent" : "agent");
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setCreating(false);
    }
  };

  // Copy agent
  const handleCopyAgent = async (_agentId: string, agentName: string) => {
    try {
      const newAgent = await createAgent({
        name: `${agentName} (副本)`,
      });
      setSelectedItemId(newAgent.id);
      setSelectedItemType("agent");
    } catch (err) {
      console.error("Failed to copy agent:", err);
    }
  };

  // Delete agent
  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(t("settingsAgents.deleteConfirm", { name: agentName }))) return;
    try {
      await removeAgent(agentId);
      if (selectedItemId === agentId) {
        setSelectedItemId(null);
      }
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
  };

  // Navigate to detail/edit page
  // Both executors and agents use the same route
  const handleEditItem = (itemId: string, _itemType: "executor" | "agent" | "workspace-agent") => {
    navigate(`/workspace/${workspaceId}/agent/${itemId}`);
  };

  // Helper to wrap content based on mode
  const wrapContent = (children: React.ReactNode) => {
    if (settingsMode) {
      return <div className="flex flex-col items-center justify-center h-full">{children}</div>;
    }
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">{children}</div>
      </PageWrapper>
    );
  };

  // Show loading while workspaces are loading (skip in settings mode - already loaded)
  if (isLoadingWorkspaces && !settingsMode) {
    return wrapContent(
      <>
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  // Workspace not found
  if (!workspace && workspaces.length > 0) {
    return wrapContent(
      <>
        <Bot className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t("workspace.notFound")}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t("workspace.notFoundDesc")}
        </p>
        {!settingsMode && (
          <Button asChild>
            <Link to="/mcp-services/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("workspace.backToDashboard")}
            </Link>
          </Button>
        )}
      </>
    );
  }

  // Fallback loading
  if (!workspace) {
    return wrapContent(
      <>
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  // Content wrapper - different based on mode
  const content = (
    <>
      {/* Header with breadcrumb - only in normal mode */}
      {!settingsMode && (
        <WorkspaceHeader
          workspace={workspace}
          segments={[
            { label: t("settingsAgents.title"), href: `/workspace/${workspaceId}/agents` },
          ]}
          onRefresh={refreshAll}
          isRefreshing={loading}
          showRemove={false}
        />
      )}

      {/* WeChat-style layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Agent List */}
        <div className="w-80 border-r flex flex-col bg-muted/20">
          {/* Search and Create */}
          <div className="p-3 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("settingsAgents.add")}
                  <ChevronDown className="h-4 w-4 ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {AGENT_TEMPLATES.map((template, index) => (
                  <div key={template.id}>
                    {index === 1 && <DropdownMenuSeparator />}
                    <DropdownMenuItem onClick={() => openCreateDialog(template)}>
                      <span className={cn("mr-2 p-1.5 rounded", template.color)}>
                        {template.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {template.description}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            {loading && allItems.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-6 text-center">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? t("common.noResults") : t("settingsAgents.noAgents")}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {/* Executors Section */}
                {filteredExecutors.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 flex items-center gap-2">
                      <Terminal className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("settingsAgents.executors")}
                      </span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                        {filteredExecutors.length}
                      </Badge>
                    </div>
                    {filteredExecutors.map((item) => {
                      // Find the original executor from workspaceExecutorsList
                      const executor = workspaceExecutorsList.find((e) => e.id === item.id);
                      if (!executor) return null;
                      return (
                        <ExecutorListItem
                          key={`executor-${item.id}`}
                          executor={executor}
                          isSelected={selectedItemId === item.id && selectedItemType === "executor"}
                          source={item.path ? { type: "workspace", path: item.path } : undefined}
                          onSelect={() => {
                            setSelectedItemId(item.id);
                            setSelectedItemType("executor");
                          }}
                          onSettings={() => handleEditItem(item.id, "executor")}
                        />
                      );
                    })}
                  </>
                )}

                {/* Separator between executors and agents */}
                {filteredExecutors.length > 0 && filteredAllAgents.length > 0 && (
                  <Separator className="my-2" />
                )}

                {/* Unified Agents Section (智能体 - 包含工作空间和全局) */}
                {filteredAllAgents.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 flex items-center gap-2">
                      <Bot className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("settingsAgents.agents")}
                      </span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                        {filteredAllAgents.length}
                      </Badge>
                    </div>
                    {filteredAllAgents.map((item) => {
                      const isDefault = item.id === defaultAgentId;
                      const isWorkspaceAgent = item.type === "workspace-agent";

                      return (
                        <AgentListItem
                          key={`${item.type}-${item.id}`}
                          agent={{
                            id: item.id,
                            name: item.name,
                            description: item.description,
                          }}
                          isSelected={selectedItemId === item.id && selectedItemType === item.type}
                          isDefault={isDefault}
                          source={item.workspacePath ? {
                            type: isWorkspaceAgent ? "workspace" : "global",
                            path: item.workspacePath,
                          } : undefined}
                          onSelect={() => {
                            setSelectedItemId(item.id);
                            setSelectedItemType(item.type);
                          }}
                          onSettings={() => handleEditItem(item.id, item.type)}
                          onCopy={() => handleCopyAgent(item.id, item.name)}
                          onSetDefault={!isDefault && !isWorkspaceAgent ? () => setDefaultAgent(item.id) : undefined}
                          onDelete={() => handleDeleteAgent(item.id, item.name)}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: Detail Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedAgent ? (
            <AgentDetailPanel
              agent={selectedAgent}
              isDefault={!isWorkspaceAgent && selectedAgent.id === defaultAgentId}
              models={models}
              onUpdate={updateAgent}
              onSetDefault={isWorkspaceAgent ? () => {} : () => setDefaultAgent(selectedAgent.id)}
              onDelete={() => handleDeleteAgent(selectedAgent.id, selectedAgent.name)}
              onNavigateToEdit={() => handleEditItem(selectedAgent.id, isWorkspaceAgent ? "workspace-agent" : "agent")}
              isWorkspaceScoped={isWorkspaceAgent}
            />
          ) : selectedExecutor ? (
            <ExecutorDetailPanel
              executor={selectedExecutor}
              workspaceId={workspaceId || ""}
              onNavigateToEdit={() => handleEditItem(selectedExecutor.id, "executor")}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Bot className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>{t("settingsAgents.selectAgent")}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Agent Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settingsAgents.addAgent")}</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.id !== "blank"
                ? t("settingsAgents.createFromTemplateDescription")
                : t("settingsAgents.addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selected Template */}
            {selectedTemplate && selectedTemplate.id !== "blank" && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className={cn("p-2 rounded-lg", selectedTemplate.color)}>
                  {selectedTemplate.icon}
                </div>
                <div>
                  <p className="font-medium">{selectedTemplate.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                </div>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="agent-name">{t("settingsAgents.name")}</Label>
              <Input
                id="agent-name"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder={t("settingsAgents.namePlaceholder")}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="agent-description">{t("settingsAgents.descriptionLabel")}</Label>
              <Input
                id="agent-description"
                value={newAgentDescription}
                onChange={(e) => setNewAgentDescription(e.target.value)}
                placeholder={t("settingsAgents.descriptionPlaceholder")}
              />
            </div>

            {/* Location Selector */}
            <div className="space-y-2">
              <Label>{t("settingsAgents.createLocation")}</Label>
              <div className="grid grid-cols-1 gap-2">
                {/* Workspace Location */}
                <button
                  type="button"
                  onClick={() => setCreateLocation("workspace")}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                    createLocation === "workspace"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <FolderOpen className={cn(
                    "h-5 w-5 mt-0.5 shrink-0",
                    createLocation === "workspace" ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "font-medium text-sm",
                      createLocation === "workspace" && "text-primary"
                    )}>
                      {t("settingsAgents.workspaceLocation")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5" title={workspace?.path ? `${workspace.path}/.viben/agents/` : ""}>
                      {workspace?.path ? `${workspace.path}/.viben/agents/` : ""}
                    </p>
                  </div>
                </button>

                {/* Global Location */}
                <button
                  type="button"
                  onClick={() => setCreateLocation("global")}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                    createLocation === "global"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <Globe className={cn(
                    "h-5 w-5 mt-0.5 shrink-0",
                    createLocation === "global" ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "font-medium text-sm",
                      createLocation === "global" && "text-primary"
                    )}>
                      {t("settingsAgents.globalLocation")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5" title={globalVibenPath}>
                      {globalVibenPath}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreateAgent} disabled={!newAgentName.trim() || creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // In settings mode, don't wrap with PageWrapper (already wrapped by settings page)
  if (settingsMode) {
    return <div className="flex flex-col h-full">{content}</div>;
  }

  return <PageWrapper className="flex flex-col h-full">{content}</PageWrapper>;
}
