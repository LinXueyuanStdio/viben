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
import { useParams } from "react-router-dom";
import {
  Bot,
  Plus,
  Loader2,
  Search,
  ArrowLeft,
  Terminal,
  LayoutTemplate,
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
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
} from "@/pages/conversation/components";
import { Separator } from "@/components/ui/separator";
import { useLocalWorkspaces, useModels, useAgentList } from "@/hooks";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Executor, ExecutorType } from "@/types";
import { homeDir } from "@tauri-apps/api/path";
import { FolderOpen, Globe } from "lucide-react";
import { getGatewayClient, type AgentResponse as GatewayAgentTemplate } from "@/lib/gateway";
import { useChatConfigStore } from "@/stores/chat-config-store";
import { buildWorkspaceSectionHeaderSegment } from "@/navigation/page-index";
import type { ListItem, WorkspaceAgentsPageProps } from "./types";

export function WorkspaceAgentsPage({
  settingsMode = false,
  workspaceOverride,
}: WorkspaceAgentsPageProps = {}) {
  const { t } = useTranslation();
  const {
    openDashboard,
    openWorkspaceAgentDetail,
    openWorkspaceExecutorDetail,
    openWorkspaceSection,
  } = useDesktopRouting();

  // Translate agent templates
  // API templates from gateway
  const [apiTemplates, setApiTemplates] = useState<GatewayAgentTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Load templates from API
  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const client = getGatewayClient();
        const templates = await client.listAgentTemplates();
        setApiTemplates(templates);
      } catch (err) {
        console.error("Failed to load templates:", err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, []);

  const { workspaceId: routeWorkspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();

  // Use override if provided (settings mode), otherwise use route param
  const workspaceId = workspaceOverride?.id ?? routeWorkspaceId;
  const workspace = workspaceOverride ?? (workspaceId ? getWorkspace(workspaceId) : undefined);

  // Combined executors + agents from Gateway API
  const {
    executors: agentListExecutors,
    agents: agentListAgents,
    loading: loadingAgentList,
    refresh: refreshAgentList,
    agentOperations: {
      defaultAgentId,
      setDefaultAgent,
      removeAgent,
      updateAgent,
      createAgent,
    },
  } = useAgentList({ workspacePath: workspace?.path });

  const {
    models,
    loading: loadingModels,
  } = useModels();

  // UI state
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<"executor" | "agent" | "workspace-agent">("agent");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<GatewayAgentTemplate | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createLocation, setCreateLocation] = useState<"workspace" | "global">("workspace");
  const [globalVibenPath, setGlobalVibenPath] = useState<string>("");

  // Load global viben path
  useEffect(() => {
    homeDir().then((home) => {
      const homePath = home.endsWith("/") ? home : `${home}/`;
      setGlobalVibenPath(`${homePath}.viben/agents/`);
    });
  }, []);

  const loading = loadingAgentList || loadingModels;

  // Refresh all
  const refreshAll = async () => {
    await refreshAgentList();
  };

  // Convert executors to list items for display
  // executor.id is the type (e.g., "CLAUDE_CODE") - already merged by API
  const executorItems: ListItem[] = useMemo(() => {
    return agentListExecutors.map((e) => ({
      id: e.id,
      name: e.name,
      type: "executor" as const,
      executorType: e.id,
      path: e.config_path,
      source: e.source === "workspace" ? "project" as const : "global" as const,
      projectConfigPath: e.config_path,
      globalConfigPath: e.global_config_path,
    }));
  }, [agentListExecutors]);

  // Convert agents to list items for display
  const agentItems: ListItem[] = useMemo(() => {
    return agentListAgents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description || undefined, // Show description if available
      type: a.source === "workspace" ? "workspace-agent" as const : "agent" as const,
      source: a.source,
      path: a.config_path,
      workspacePath: a.config_path ? a.config_path.replace(/\/[^/]+\.json$/, "/") : undefined,
      // Template fields
      isTemplate: a.is_template,
      templateDescription: a.template_description,
    }));
  }, [agentListAgents]);

  // All items combined
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

  // Selected agent data (from Agent List - includes both global and workspace agents)
  const selectedAgent = useMemo(() => {
    if (selectedItemType !== "agent" && selectedItemType !== "workspace-agent") return undefined;
    const agent = agentListAgents.find((a) => a.id === selectedItemId);
    if (!agent) return undefined;
    // Gateway API now returns model/provider info
    return {
      id: agent.id,
      name: agent.name,
      path: agent.config_path,
      description: agent.description,
      model: agent.model,
      provider: agent.provider,
      system_prompt: undefined as string | undefined,
      temperature: undefined as number | undefined,
      max_tokens: undefined as number | undefined,
      mcp_servers: [] as string[],
      skills: [] as string[],
      created_at: "",
      updated_at: "",
      // New fields for capabilities and config display
      executor_type: agent.executor_type,
      global_config_path: agent.global_config_path,
      source: agent.source as "global" | "workspace" | "merged",
    };
  }, [agentListAgents, selectedItemId, selectedItemType]);

  // For workspace-scoped agents
  const isWorkspaceAgent = useMemo(() => {
    const agent = agentListAgents.find((a) => a.id === selectedItemId);
    return agent?.source === "workspace";
  }, [agentListAgents, selectedItemId]);

  // Selected executor (from executor list)
  const selectedExecutor = useMemo(() => {
    if (selectedItemType !== "executor") return undefined;
    const executor = agentListExecutors.find((e) => e.id === selectedItemId);
    if (!executor) return undefined;
    // Transform to the format expected by ExecutorDetailPanel
    // Use workspace_config_path directly from API (not the computed config_path)
    const hasWorkspaceConfig = !!executor.workspace_config_path;
    const hasGlobalConfig = !!executor.global_config_path;
    const source = hasWorkspaceConfig && hasGlobalConfig
      ? "merged" as const
      : hasWorkspaceConfig
        ? "workspace" as const
        : "global" as const;

    return {
      id: executor.id,
      workspace_id: workspace?.id || "",
      name: executor.name,
      type: (executor.id || "UNKNOWN") as ExecutorType,
      // Use workspace_config_path for workspace config, empty if none
      config_path: executor.workspace_config_path || "",
      global_config_path: executor.global_config_path,
      source,
      mcp_config_file: null,
      skills_config_file: null,
    };
  }, [agentListExecutors, selectedItemId, selectedItemType, workspace?.id]);

  // Auto-select first item when list changes
  useEffect(() => {
    if (!selectedItemId && filteredItems.length > 0) {
      const first = filteredItems[0];
      setSelectedItemId(first.id);
      setSelectedItemType(first.type);
    } else if (selectedItemId && !filteredItems.find((a) => a.id === selectedItemId && a.type === selectedItemType)) {
      // Current selection no longer exists in filtered list, select first item
      const first = filteredItems[0];
      if (first) {
        setSelectedItemId(first.id);
        setSelectedItemType(first.type);
      } else {
        setSelectedItemId(null);
      }
    }
  }, [filteredItems, selectedItemId, selectedItemType]);

  // Open create dialog - blank or with template
  const openCreateDialog = (template?: GatewayAgentTemplate | null) => {
    setSelectedTemplate(template || null);
    setNewAgentName(template ? template.name : "");
    setNewAgentDescription(template?.description || "");
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
        // Pass template ID if creating from template
        from_template: selectedTemplate?.id,
      });
      // Refresh the agent list to show the new agent
      await refreshAgentList();
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
        name: t("settingsAgents.copyName", { name: agentName }),
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

  // Toggle template status
  const handleToggleTemplate = async (agentId: string, isCurrentlyTemplate: boolean) => {
    try {
      const agent = agentListAgents.find((a) => a.id === agentId);
      if (!agent) return;

      await updateAgent(agentId, {
        is_template: !isCurrentlyTemplate,
        workspace_path: agent.source === "workspace" ? workspace?.path : undefined,
      });

      await refreshAgentList();
    } catch (err) {
      console.error("Failed to toggle template:", err);
    }
  };

  // Promote workspace template to global
  const handlePromoteToGlobal = async (agentId: string, agentName: string) => {
    if (!workspace?.path) return;
    if (!confirm(t("agent.promoteTemplateConfirm", { defaultValue: 'Promote "{{agentName}}" to a global template?', agentName }))) return;
    try {
      const client = getGatewayClient();
      // Call the promote endpoint
      await client.promoteTemplateToGlobal(agentId, {
        workspace_path: workspace.path,
      });
      await refreshAgentList();
    } catch (err) {
      console.error("Failed to promote template:", err);
    }
  };

  // Navigate to detail/edit page
  const handleEditItem = (itemId: string, itemType: "executor" | "agent" | "workspace-agent") => {
    if (!workspace?.id) {
      return;
    }

    if (itemType === "executor") {
      openWorkspaceExecutorDetail(workspace.id, itemId);
    } else {
      openWorkspaceAgentDetail(workspace.id, itemId);
    }
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
        {!settingsMode ? (
          <Button
            type="button"
            onClick={() => openDashboard()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("workspace.backToDashboard")}
          </Button>
        ) : null}
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

  const agentHeaderSegments = [
    buildWorkspaceSectionHeaderSegment(
      workspace.id,
      "agent",
      (key, fallback) => t(key, fallback)
    ),
  ];

  // Content wrapper - different based on mode
  const content = (
    <>
      {/* Header with breadcrumb - only in normal mode */}
      {!settingsMode && (
        <WorkspaceHeader
          workspace={workspace}
          segments={agentHeaderSegments}
          onRefresh={refreshAll}
          isRefreshing={loading}
          showRemove={false}
        />
      )}

      {/* WeChat-style layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Agent List */}
        <div className="w-60 border-r flex flex-col bg-muted/20">
          {/* Search and Create */}
          <div className="px-3 py-2.5 border-b h-10 flex items-center">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("common.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => openCreateDialog(null)}>
                  <Bot className="h-4 w-4 mr-2" />
                  {t("agent.createAgent", "Create Agent")}
                </DropdownMenuItem>
                {apiTemplates.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <LayoutTemplate className="h-4 w-4 mr-2" />
                      {t("settingsAgents.createFromTemplate", "Create from Template")}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-64">
                      {loadingTemplates ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        apiTemplates.map((template) => {
                          // Determine source from template config or ID
                          const isGlobal = !template.source || template.source === "global";
                          return (
                            <DropdownMenuItem key={template.id} onClick={() => openCreateDialog(template)}>
                              <LayoutTemplate className="h-4 w-4 mr-2 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{template.name}</span>
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                    {isGlobal ? t("agent.globalTemplate", "Global") : t("agent.workspaceTemplate", "Workspace")}
                                  </Badge>
                                </div>
                                {template.description && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {template.description}
                                  </div>
                                )}
                              </div>
                            </DropdownMenuItem>
                          );
                        })
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                      // Convert ListItem to Executor format expected by ExecutorListItem
                      // Use item data directly since it was derived from agentListExecutors
                      const executor: Executor = {
                        id: item.id,
                        workspace_id: workspace?.id || "",
                        name: item.name,
                        type: (item.executorType || "UNKNOWN") as ExecutorType,
                        config_path: item.path || "",
                        mcp_config_file: null,
                        skills_config_file: null,
                      };
                      return (
                        <ExecutorListItem
                          key={`executor-${item.id}`}
                          executor={executor}
                          isSelected={selectedItemId === item.id && selectedItemType === "executor"}
                          source={item.path ? { type: item.source === "project" ? "workspace" : "global", path: item.path } : undefined}
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
                      const isTemplate = item.isTemplate || false;

                      // Build badges array
                      const badges: Array<{ label: string; variant: "primary" | "secondary" | "default" }> = [];
                      if (isTemplate) {
                        badges.push({ label: t("agent.template", "Template"), variant: "secondary" });
                      }

                      return (
                        <AgentListItem
                          key={`${item.type}-${item.id}`}
                          agent={{
                            id: item.id,
                            name: item.name,
                            description: item.templateDescription || item.description,
                          }}
                          isSelected={selectedItemId === item.id && selectedItemType === item.type}
                          isDefault={isDefault}
                          source={item.workspacePath ? {
                            type: isWorkspaceAgent ? "workspace" : "global",
                            path: item.workspacePath,
                          } : undefined}
                          badges={badges.length > 0 ? badges : undefined}
                          onSelect={() => {
                            setSelectedItemId(item.id);
                            setSelectedItemType(item.type);
                          }}
                          onSettings={() => handleEditItem(item.id, item.type)}
                          onCopy={() => handleCopyAgent(item.id, item.name)}
                          onSetDefault={!isDefault && !isWorkspaceAgent ? () => setDefaultAgent(item.id) : undefined}
                          onDelete={() => handleDeleteAgent(item.id, item.name)}
                          onToggleTemplate={() => handleToggleTemplate(item.id, isTemplate)}
                          onPromoteToGlobal={isTemplate && isWorkspaceAgent ? () => handlePromoteToGlobal(item.id, item.name) : undefined}
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
              workspacePath={workspace?.path || ""}
              isDefault={!isWorkspaceAgent && selectedAgent.id === defaultAgentId}
              models={models.map((m) => ({
                id: m.id,
                name: m.name,
                provider: m.provider_id,
                provider_id: m.provider_id,
                enabled: m.is_available,
              }))}
              onUpdate={updateAgent}
              onSetDefault={isWorkspaceAgent ? () => {} : () => setDefaultAgent(selectedAgent.id)}
              onDelete={() => handleDeleteAgent(selectedAgent.id, selectedAgent.name)}
              onNavigateToEdit={() => handleEditItem(selectedAgent.id, isWorkspaceAgent ? "workspace-agent" : "agent")}
              onNavigateToChat={workspace?.id ? () => {
                useChatConfigStore.getState().setSelectedAgentId(selectedAgent.id);
                openWorkspaceSection(workspace.id, "chat", { stackMode: "push" });
              } : undefined}
              isWorkspaceScoped={isWorkspaceAgent}
            />
          ) : selectedExecutor ? (
            <ExecutorDetailPanel
              executor={selectedExecutor}
              workspacePath={workspace?.path || ""}
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
              {selectedTemplate
                ? t("settingsAgents.createFromTemplateDescription")
                : t("settingsAgents.addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selected Template */}
            {selectedTemplate && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <LayoutTemplate className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{selectedTemplate.name}</p>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      {!selectedTemplate.source || selectedTemplate.source === "global"
                        ? t("agent.globalTemplate", "Global")
                        : t("agent.workspaceTemplate", "Workspace")}
                    </Badge>
                  </div>
                  {selectedTemplate.description && (
                    <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                  )}
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
