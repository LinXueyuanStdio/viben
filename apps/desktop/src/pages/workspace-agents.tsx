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
  Trash2,
  Loader2,
  Star,
  Search,
  Copy,
  ArrowLeft,
  Settings2,
  MessageSquare,
  Sparkles,
  Workflow,
  Code2,
  ChevronDown,
  MoreHorizontal,
  Server,
  Wrench,
  Save,
  X,
  Check,
  Pencil,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLocalWorkspaces, useVibenAgents, useVibenModels, useWorkspaceAgents } from "@/hooks";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { WorkspaceAgent } from "@/types";

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
  type: "executor" | "agent";
  executorType?: string; // e.g., "claude-code", "codex"
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

export function WorkspaceAgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();

  // Workspace executors (auto-discovered)
  const {
    agents: workspaceExecutorsList,
    loading: loadingWorkspaceExecutors,
    loadAgents: loadWorkspaceExecutors,
  } = useWorkspaceAgents(workspaceId || null);

  // Viben agents (global storage) and models
  const {
    agents: vibenAgents,
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
  const [selectedItemType, setSelectedItemType] = useState<"executor" | "agent">("agent");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;
  const loading = loadingAgents || loadingModels || loadingWorkspaceExecutors;

  // Refresh all
  const refreshAll = async () => {
    await Promise.all([refreshVibenAgents(), loadWorkspaceExecutors()]);
  };

  // Convert workspace executors to list items
  const executorItems: ListItem[] = useMemo(() => {
    return workspaceExecutorsList.map((a) => ({
      id: a.id,
      name: a.name,
      type: "executor" as const,
      executorType: a.type,
    }));
  }, [workspaceExecutorsList]);

  // Convert viben agents to list items
  const agentItems: ListItem[] = useMemo(() => {
    return vibenAgents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      type: "agent" as const,
      model: a.model,
      provider: a.provider,
      mcp_servers: a.mcp_servers,
      skills: a.skills,
      system_prompt: a.system_prompt,
      temperature: a.temperature,
      max_tokens: a.max_tokens,
      created_at: a.created_at,
      updated_at: a.updated_at,
    }));
  }, [vibenAgents]);

  // All items combined
  const allItems = useMemo(() => [...executorItems, ...agentItems], [executorItems, agentItems]);

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
  const filteredAgents = useMemo(
    () => filteredItems.filter((a) => a.type === "agent"),
    [filteredItems]
  );

  // Selected agent data (only for agents that can be edited)
  const selectedAgent = useMemo(
    () => vibenAgents.find((a) => a.id === selectedItemId && selectedItemType === "agent"),
    [vibenAgents, selectedItemId, selectedItemType]
  );

  // Selected executor (workspace)
  const selectedExecutor = useMemo(
    () => workspaceExecutorsList.find((a) => a.id === selectedItemId && selectedItemType === "executor"),
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
    setCreateDialogOpen(true);
  };

  // Create agent
  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    setCreating(true);
    try {
      const newAgent = await createAgent({
        name: newAgentName.trim(),
        description: newAgentDescription.trim() || undefined,
      });
      setCreateDialogOpen(false);
      setNewAgentName("");
      setNewAgentDescription("");
      setSelectedTemplate(null);
      setSelectedItemId(newAgent.id);
      setSelectedItemType("agent");
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
  const handleEditItem = (itemId: string, _itemType: "executor" | "agent") => {
    navigate(`/workspace/${workspaceId}/agent/${itemId}`);
  };

  // Show loading while workspaces are loading
  if (isLoadingWorkspaces) {
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
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("workspace.notFound")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("workspace.notFoundDesc")}
          </p>
          <Button asChild>
            <Link to="/mcp-services/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("workspace.backToDashboard")}
            </Link>
          </Button>
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
      {/* Header with breadcrumb */}
      <WorkspaceHeader
        workspace={workspace}
        segments={[
          { label: t("settingsAgents.title"), href: `/workspace/${workspaceId}/agents` },
        ]}
        onRefresh={refreshAll}
        isRefreshing={loading}
        showRemove={false}
      />

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
                    </div>
                    {filteredExecutors.map((item) => (
                      <div
                        key={`executor-${item.id}`}
                        className={cn(
                          "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                          selectedItemId === item.id && selectedItemType === "executor"
                            ? "bg-orange-500/10 border border-orange-500/30"
                            : "hover:bg-muted/60"
                        )}
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setSelectedItemType("executor");
                        }}
                      >
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback
                            className={cn(
                              "text-sm font-medium",
                              selectedItemId === item.id && selectedItemType === "executor"
                                ? "bg-orange-500/20 text-orange-600"
                                : "bg-muted"
                            )}
                          >
                            {item.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.name}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              {item.executorType}
                            </Badge>
                          </div>
                        </div>
                        {/* Actions on hover */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditItem(item.id, "executor")}>
                              <Settings2 className="h-4 w-4 mr-2" />
                              {t("settingsAgents.configuration")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </>
                )}

                {/* Separator */}
                {filteredExecutors.length > 0 && filteredAgents.length > 0 && (
                  <Separator className="my-2" />
                )}

                {/* Agents Section */}
                {filteredAgents.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 flex items-center gap-2">
                      <Sparkles className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("settingsAgents.agents")}
                      </span>
                    </div>
                    {filteredAgents.map((item) => (
                      <div
                        key={`agent-${item.id}`}
                        className={cn(
                          "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                          selectedItemId === item.id && selectedItemType === "agent"
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/60"
                        )}
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setSelectedItemType("agent");
                        }}
                      >
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback
                            className={cn(
                              "text-sm font-medium",
                              selectedItemId === item.id && selectedItemType === "agent"
                                ? "bg-primary/20 text-primary"
                                : "bg-muted"
                            )}
                          >
                            {item.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.name}</span>
                            {item.id === defaultAgentId && (
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {/* Actions on hover */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditItem(item.id, "agent")}>
                              <Settings2 className="h-4 w-4 mr-2" />
                              {t("settingsAgents.configuration")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyAgent(item.id, item.name)}>
                              <Copy className="h-4 w-4 mr-2" />
                              {t("common.copy")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDefaultAgent(item.id)}>
                              <Star className="h-4 w-4 mr-2" />
                              {t("agents.setDefault")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteAgent(item.id, item.name)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
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
              isDefault={selectedAgent.id === defaultAgentId}
              models={models}
              onUpdate={updateAgent}
              onSetDefault={() => setDefaultAgent(selectedAgent.id)}
              onDelete={() => handleDeleteAgent(selectedAgent.id, selectedAgent.name)}
              onNavigateToEdit={() => handleEditItem(selectedAgent.id, "agent")}
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
    </PageWrapper>
  );
}

// ============================================================================
// Executor Detail Panel (Auto-discovered from Workspace - Read Only)
// ============================================================================

interface ExecutorDetailPanelProps {
  executor: WorkspaceAgent;
  workspaceId: string;
  onNavigateToEdit: () => void;
}

function ExecutorDetailPanel({
  executor,
  workspaceId: _workspaceId,
  onNavigateToEdit,
}: ExecutorDetailPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b bg-orange-500/5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-orange-500/20 text-orange-600 text-xl font-semibold">
                {executor.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{executor.name}</h2>
                <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-600">
                  <Terminal className="h-3 w-3 mr-1" />
                  {t("settingsAgents.executors")}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                {executor.type}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={onNavigateToEdit}>
            <Settings2 className="h-4 w-4 mr-2" />
            {t("settingsAgents.configuration")}
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Config Path */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              {t("workspace.configPath")}
            </h3>
            <Card>
              <CardContent className="p-4">
                <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
                  {executor.config_path}
                </code>
              </CardContent>
            </Card>
          </section>

          {/* MCP Config */}
          {executor.mcp_config_file && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Server className="h-4 w-4" />
                MCP {t("workspace.configuration")}
              </h3>
              <Card>
                <CardContent className="p-4">
                  <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
                    {executor.mcp_config_file}
                  </code>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Skills Config */}
          {executor.skills_config_file && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                {t("chat.skills")} {t("workspace.configuration")}
              </h3>
              <Card>
                <CardContent className="p-4">
                  <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
                    {executor.skills_config_file}
                  </code>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Description */}
          <section>
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  {t("settingsAgents.executorsDesc")}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 mt-2"
                  onClick={onNavigateToEdit}
                >
                  {t("settingsAgents.configuration")}
                  <Settings2 className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Agent Detail Panel with Inline Editing (Sub Agent / Viben Agent)
// ============================================================================

interface AgentDetailPanelProps {
  agent: {
    id: string;
    name: string;
    description?: string;
    model?: string;
    provider?: string;
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
    mcp_servers: string[];
    skills: string[];
    created_at: string;
    updated_at: string;
  };
  isDefault: boolean;
  models: { id: string; name: string; provider: string; enabled: boolean }[];
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
  onSetDefault: () => void;
  onDelete: () => void;
  onNavigateToEdit: () => void;
}

function AgentDetailPanel({
  agent,
  isDefault,
  models,
  onUpdate,
  onSetDefault,
  onDelete,
  onNavigateToEdit,
}: AgentDetailPanelProps) {
  const { t } = useTranslation();

  // Inline editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editName, setEditName] = useState(agent.name);
  const [editDescription, setEditDescription] = useState(agent.description || "");
  const [editSystemPrompt, setEditSystemPrompt] = useState(agent.system_prompt || "");
  const [editTemperature, setEditTemperature] = useState(agent.temperature ?? 0.7);
  const [editMaxTokens, setEditMaxTokens] = useState(agent.max_tokens?.toString() || "");
  const [saving, setSaving] = useState(false);

  // Reset edit states when agent changes
  useEffect(() => {
    setEditName(agent.name);
    setEditDescription(agent.description || "");
    setEditSystemPrompt(agent.system_prompt || "");
    setEditTemperature(agent.temperature ?? 0.7);
    setEditMaxTokens(agent.max_tokens?.toString() || "");
    setEditingField(null);
  }, [agent.id]);

  const enabledModels = models.filter((m) => m.enabled);
  const agentModel = models.find((m) => m.id === agent.model);

  const handleSave = async (field: string, value: unknown) => {
    setSaving(true);
    try {
      await onUpdate(agent.id, { [field]: value });
      setEditingField(null);
    } catch (err) {
      console.error("Failed to update agent:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleModelChange = async (modelId: string) => {
    await handleSave("model", modelId);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b bg-muted/10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/20 text-primary text-xl font-semibold">
                {agent.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {/* Editable Name */}
              {editingField === "name" ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-lg font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave("name", editName);
                      if (e.key === "Escape") setEditingField(null);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleSave("name", editName)}
                    disabled={saving}
                  >
                    <Check className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingField(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h2 className="text-xl font-semibold">{agent.name}</h2>
                  {isDefault && (
                    <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full">
                      <Star className="h-3 w-3 fill-current" />
                      {t("common.default")}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setEditingField("name")}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Editable Description */}
              {editingField === "description" ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="h-7 text-sm"
                    placeholder={t("settingsAgents.descriptionPlaceholder")}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave("description", editDescription || null);
                      if (e.key === "Escape") setEditingField(null);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleSave("description", editDescription || null)}
                    disabled={saving}
                  >
                    <Check className="h-3 w-3 text-green-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditingField(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group mt-1">
                  <p className="text-muted-foreground text-sm">
                    {agent.description || t("settingsAgents.descriptionPlaceholder")}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setEditingField("description")}
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isDefault && (
              <Button variant="outline" size="sm" onClick={onSetDefault}>
                <Star className="h-4 w-4 mr-2" />
                {t("agents.setDefault")}
              </Button>
            )}
            <Button size="sm" onClick={onNavigateToEdit}>
              <Settings2 className="h-4 w-4 mr-2" />
              {t("settingsAgents.configuration")}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Model Selection */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t("workspace.createTaskDialog.model")}
            </h3>
            <Card>
              <CardContent className="p-4">
                <Select value={agent.model || ""} onValueChange={handleModelChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("settingsAgents.selectModel")}>
                      {agentModel ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span>{agentModel.name}</span>
                          <span className="text-xs text-muted-foreground">({agentModel.provider})</span>
                        </div>
                      ) : (
                        t("settingsAgents.selectModel")
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {enabledModels.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        {t("chat.noModels")}
                      </div>
                    ) : (
                      enabledModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center gap-2">
                            <span>{model.name}</span>
                            <span className="text-xs text-muted-foreground">({model.provider})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </section>

          {/* System Prompt */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t("settingsAgents.systemPrompt")}
              </h3>
              {editingField !== "system_prompt" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingField("system_prompt")}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  {t("common.edit")}
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-4">
                {editingField === "system_prompt" ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editSystemPrompt}
                      onChange={(e) => setEditSystemPrompt(e.target.value)}
                      placeholder={t("settingsAgents.systemPromptPlaceholder")}
                      className="min-h-[200px] font-mono text-sm"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingField(null)}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave("system_prompt", editSystemPrompt || null)}
                        disabled={saving}
                      >
                        {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        <Save className="h-3 w-3 mr-1" />
                        {t("common.save")}
                      </Button>
                    </div>
                  </div>
                ) : agent.system_prompt ? (
                  <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-lg max-h-48 overflow-auto">
                    {agent.system_prompt}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t("settingsAgents.systemPromptPlaceholder")}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Parameters */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t("inspector.parameters")}
            </h3>
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* Temperature */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Temperature</Label>
                    <span className="text-sm font-mono text-muted-foreground">
                      {editingField === "temperature" ? editTemperature.toFixed(2) : (agent.temperature ?? 0.7).toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[editingField === "temperature" ? editTemperature : (agent.temperature ?? 0.7)]}
                    min={0}
                    max={2}
                    step={0.01}
                    onValueChange={([val]) => {
                      setEditTemperature(val);
                      setEditingField("temperature");
                    }}
                    onValueCommit={([val]) => handleSave("temperature", val)}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.temperatureHint")}
                  </p>
                </div>

                {/* Max Tokens */}
                <div className="space-y-2">
                  <Label className="text-sm">Max Tokens</Label>
                  <Input
                    type="number"
                    value={editMaxTokens}
                    onChange={(e) => setEditMaxTokens(e.target.value)}
                    onBlur={() => {
                      const val = editMaxTokens ? parseInt(editMaxTokens, 10) : null;
                      if (val !== agent.max_tokens) {
                        handleSave("max_tokens", val);
                      }
                    }}
                    placeholder="Auto"
                    className="h-9"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.maxTokensHint")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* MCP Servers */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Server className="h-4 w-4" />
                MCP Servers
              </h3>
              <Button variant="ghost" size="sm" onClick={onNavigateToEdit}>
                <Plus className="h-3 w-3 mr-1" />
                {t("common.configure")}
              </Button>
            </div>
            <Card>
              <CardContent className="p-4">
                {agent.mcp_servers && agent.mcp_servers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {agent.mcp_servers.map((server) => (
                      <span
                        key={server}
                        className="text-sm bg-muted px-2.5 py-1 rounded-full flex items-center gap-1.5"
                      >
                        <Server className="h-3 w-3" />
                        {server}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t("common.notConfigured")}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Skills */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                {t("chat.skills")}
              </h3>
              <Button variant="ghost" size="sm" onClick={onNavigateToEdit}>
                <Plus className="h-3 w-3 mr-1" />
                {t("common.configure")}
              </Button>
            </div>
            <Card>
              <CardContent className="p-4">
                {agent.skills && agent.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {agent.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-sm bg-primary/10 text-primary px-2.5 py-1 rounded-full flex items-center gap-1.5"
                      >
                        <Wrench className="h-3 w-3" />
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t("common.notConfigured")}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Timestamps */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t("workspace.timestamps")}
            </h3>
            <Card>
              <CardContent className="p-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t("common.created")}</p>
                  <p>{new Date(agent.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("workspace.updated")}</p>
                  <p>{new Date(agent.updated_at).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Danger Zone */}
          <section>
            <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider mb-3">
              {t("settings.dangerZone")}
            </h3>
            <Card className="border-destructive/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settingsAgents.delete")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("settingsAgents.deleteWarning")}
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={onDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("common.delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
