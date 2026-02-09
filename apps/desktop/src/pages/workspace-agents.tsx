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
  ChevronRight,
  MoreHorizontal,
  Server,
  Save,
  X,
  Check,
  Pencil,
  Terminal,
  Database,
  FileText,
  Command,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLocalWorkspaces, useVibenAgents, useVibenModels, useWorkspaceAgents } from "@/hooks";
import {
  useWorkspaceMcpServers,
  useWorkspaceSkills,
} from "@/hooks/use-workspaces";
import {
  useWorkspaceAgentConfigs,
  useWorkspaceCommands,
} from "@/hooks/use-agent-configs";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { WorkspaceAgent } from "@/types";

// ============================================================================
// Collapsible Section Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  icon,
  badge,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b last:border-b-0">
      <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-1 hover:bg-muted/50 rounded-lg transition-colors">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-sm font-medium">{title}</span>
          {badge}
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

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
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                        {filteredExecutors.length}
                      </Badge>
                    </div>
                    {filteredExecutors.map((item) => (
                      <div
                        key={`executor-${item.id}`}
                        className={cn(
                          "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all",
                          selectedItemId === item.id && selectedItemType === "executor"
                            ? "bg-orange-500/10 border border-orange-500/30 shadow-sm"
                            : "hover:bg-muted/60 border border-transparent"
                        )}
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setSelectedItemType("executor");
                        }}
                      >
                        <Avatar className="h-11 w-11 shrink-0 ring-2 ring-orange-500/20">
                          <AvatarFallback
                            className={cn(
                              "text-sm font-semibold",
                              selectedItemId === item.id && selectedItemType === "executor"
                                ? "bg-orange-500/20 text-orange-600"
                                : "bg-orange-500/10 text-orange-600/70"
                            )}
                          >
                            {item.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium truncate text-sm">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-orange-500/30 text-orange-600">
                              <Terminal className="h-2.5 w-2.5 mr-0.5" />
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
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                        {filteredAgents.length}
                      </Badge>
                    </div>
                    {filteredAgents.map((item) => {
                      // Check if this agent is based on a template
                      const template = AGENT_TEMPLATES.find(
                        (t) => t.id !== "blank" && item.name.includes(t.name)
                      );
                      const isDefault = item.id === defaultAgentId;

                      return (
                        <div
                          key={`agent-${item.id}`}
                          className={cn(
                            "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all",
                            selectedItemId === item.id && selectedItemType === "agent"
                              ? "bg-primary/10 border border-primary/30 shadow-sm"
                              : "hover:bg-muted/60 border border-transparent"
                          )}
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setSelectedItemType("agent");
                          }}
                        >
                          {/* Default indicator */}
                          {isDefault && (
                            <div className="absolute -top-1 -right-1 z-10">
                              <div className="bg-yellow-500 rounded-full p-0.5 shadow-sm">
                                <Star className="h-2.5 w-2.5 text-white fill-white" />
                              </div>
                            </div>
                          )}

                          <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/20">
                            <AvatarFallback
                              className={cn(
                                "text-sm font-semibold",
                                selectedItemId === item.id && selectedItemType === "agent"
                                  ? "bg-primary/20 text-primary"
                                  : "bg-primary/10 text-primary/70"
                              )}
                            >
                              {item.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium truncate text-sm">{item.name}</span>
                            </div>
                            {item.description ? (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.description}
                              </p>
                            ) : (
                              <div className="flex items-center gap-1.5 mt-1">
                                {isDefault && (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                    {t("common.default")}
                                  </Badge>
                                )}
                                {template && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                    {t("settingsAgents.templates")}
                                  </Badge>
                                )}
                                {item.model && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                    {item.model.split("/").pop() || item.model}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {item.description && (
                              <div className="flex items-center gap-1.5 mt-1">
                                {isDefault && (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                    {t("common.default")}
                                  </Badge>
                                )}
                                {template && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                    {t("settingsAgents.templates")}
                                  </Badge>
                                )}
                              </div>
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
                              {!isDefault && (
                                <DropdownMenuItem onClick={() => setDefaultAgent(item.id)}>
                                  <Star className="h-4 w-4 mr-2" />
                                  {t("agents.setDefault")}
                                </DropdownMenuItem>
                              )}
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
// Same style as settings-agents.tsx DetailPanel for executors
// ============================================================================

interface ExecutorDetailPanelProps {
  executor: WorkspaceAgent;
  workspaceId: string;
  onNavigateToEdit: () => void;
}

function ExecutorDetailPanel({
  executor,
  workspaceId,
  onNavigateToEdit,
}: ExecutorDetailPanelProps) {
  const { t } = useTranslation();

  // Load data for executor
  const { servers: mcpServers, loading: mcpLoading } = useWorkspaceMcpServers(
    workspaceId,
    executor.id
  );
  const { skills, loading: skillsLoading } = useWorkspaceSkills(
    workspaceId,
    executor.id
  );
  const { configs: agentConfigs, loading: configsLoading } = useWorkspaceAgentConfigs(
    workspaceId,
    executor.id
  );
  const { commands, loading: commandsLoading } = useWorkspaceCommands(
    workspaceId,
    executor.id
  );

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
          <Button onClick={onNavigateToEdit}>
            <Settings2 className="h-4 w-4 mr-2" />
            {t("settingsAgents.configuration")}
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-1">
          {/* Config Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {t("workspace.configuration")}
            </h4>

            <CollapsibleSection
              title={t("workspace.configPath")}
              icon={<Terminal className="h-4 w-4" />}
              defaultOpen
            >
              <code className="block text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                {executor.config_path || "-"}
              </code>
            </CollapsibleSection>
          </div>

          {/* Capabilities Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {t("settingsAgents.capabilities")}
            </h4>

            {/* MCP */}
            <CollapsibleSection
              title="MCP"
              icon={<Database className="h-4 w-4" />}
              badge={
                mcpLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Badge variant="secondary" className="text-xs">{mcpServers.length}</Badge>
                )
              }
              defaultOpen
            >
              <div className="py-2 space-y-1">
                {mcpServers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.noMcp")}
                  </p>
                ) : (
                  mcpServers.map((server) => (
                    <div
                      key={server.name}
                      className={cn(
                        "flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50",
                        server.disabled && "opacity-60"
                      )}
                    >
                      <Server className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{server.name}</span>
                      {server.transport && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                          {server.transport}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CollapsibleSection>

            {/* Skills */}
            <CollapsibleSection
              title={t("chat.skills")}
              icon={<Sparkles className="h-4 w-4" />}
              badge={
                skillsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Badge variant="secondary" className="text-xs">{skills.length}</Badge>
                )
              }
            >
              <div className="py-2 space-y-1">
                {skills.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.noSkills")}
                  </p>
                ) : (
                  skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                    >
                      <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{skill.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                        v{skill.version}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleSection>

            {/* Prompts */}
            <CollapsibleSection
              title={t("settingsAgents.prompts")}
              icon={<MessageSquare className="h-4 w-4" />}
              badge={
                configsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Badge variant="secondary" className="text-xs">{agentConfigs.length}</Badge>
                )
              }
            >
              <div className="py-2 space-y-1">
                {agentConfigs.length === 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {t("settingsAgents.noPrompts")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {t("settingsAgents.noPromptsHint")}
                    </p>
                  </>
                ) : (
                  agentConfigs.map((config) => (
                    <div
                      key={config.id}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                    >
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{config.name}</span>
                      {config.model && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                          {config.model}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CollapsibleSection>

            {/* Commands */}
            <CollapsibleSection
              title={t("settingsAgents.commands")}
              icon={<Command className="h-4 w-4" />}
              badge={
                commandsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Badge variant="secondary" className="text-xs">{commands.length}</Badge>
                )
              }
            >
              <div className="py-2 space-y-1">
                {commands.length === 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {t("settingsAgents.noCommands")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {t("settingsAgents.noCommandsHint")}
                    </p>
                  </>
                ) : (
                  commands.map((command) => (
                    <div
                      key={command.id}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                    >
                      <Command className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate font-mono">/{command.id}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {command.namespace}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleSection>
          </div>

          {/* Info */}
          <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.executorsDesc")}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Agent Detail Panel with Inline Editing (Sub Agent / Viben Agent)
// Same style as settings-agents.tsx DetailPanel for agents with collapsible sections
// ============================================================================

interface AgentDetailPanelProps {
  agent: {
    id: string;
    name: string;
    path?: string;
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
  const [saving, setSaving] = useState(false);

  // Reset edit states when agent changes
  useEffect(() => {
    setEditName(agent.name);
    setEditDescription(agent.description || "");
    setEditSystemPrompt(agent.system_prompt || "");
    setEditTemperature(agent.temperature ?? 0.7);
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
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {t("settingsAgents.agents")}
                  </Badge>
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
          <Button onClick={onNavigateToEdit}>
            <Settings2 className="h-4 w-4 mr-2" />
            {t("settingsAgents.configuration")}
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-1">
          {/* Config Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {t("workspace.configuration")}
            </h4>

            <CollapsibleSection
              title={t("workspace.configPath")}
              icon={<Terminal className="h-4 w-4" />}
              defaultOpen
            >
              <code className="block text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                {agent.path || "-"}
              </code>
            </CollapsibleSection>
          </div>

          {/* Model Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {t("settingsAgents.modelSettings")}
            </h4>

            <CollapsibleSection
              title={t("workspace.createTaskDialog.model")}
              icon={<Sparkles className="h-4 w-4" />}
              badge={
                agentModel && (
                  <Badge variant="secondary" className="text-xs">
                    {agentModel.name.split("/").pop() || agentModel.name}
                  </Badge>
                )
              }
              defaultOpen
            >
              <div className="py-2">
                <Select value={agent.model || ""} onValueChange={handleModelChange}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder={t("settingsAgents.selectModel")}>
                      {agentModel ? (
                        <div className="flex items-center gap-2">
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
                {agent.provider && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Provider: {agent.provider}
                  </p>
                )}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title={t("settingsAgents.temperature")}
              icon={<Settings2 className="h-4 w-4" />}
              badge={
                <Badge variant="secondary" className="text-xs">
                  {(agent.temperature ?? 0.7).toFixed(2)}
                </Badge>
              }
            >
              <div className="py-2 space-y-3">
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
            </CollapsibleSection>
          </div>

          {/* System Prompt Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {t("settingsAgents.persona")}
            </h4>

            <CollapsibleSection
              title={t("settingsAgents.systemPrompt")}
              icon={<MessageSquare className="h-4 w-4" />}
              defaultOpen
            >
              <div className="py-2">
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
                ) : (
                  <div className="group">
                    {agent.system_prompt ? (
                      <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-lg max-h-48 overflow-auto">
                        {agent.system_prompt}
                      </pre>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        {t("settingsAgents.systemPromptPlaceholder")}
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7"
                      onClick={() => setEditingField("system_prompt")}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      {t("common.edit")}
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          </div>

          {/* Capabilities Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {t("settingsAgents.capabilities")}
            </h4>

            <CollapsibleSection
              title="MCP"
              icon={<Database className="h-4 w-4" />}
              badge={
                <Badge variant="secondary" className="text-xs">
                  {agent.mcp_servers?.length || 0}
                </Badge>
              }
            >
              <div className="py-2">
                {agent.mcp_servers && agent.mcp_servers.length > 0 ? (
                  <div className="space-y-1">
                    {agent.mcp_servers.map((server) => (
                      <div
                        key={server}
                        className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                      >
                        <Server className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{server}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.noMcp")}
                  </p>
                )}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title={t("chat.skills")}
              icon={<Sparkles className="h-4 w-4" />}
              badge={
                <Badge variant="secondary" className="text-xs">
                  {agent.skills?.length || 0}
                </Badge>
              }
            >
              <div className="py-2">
                {agent.skills && agent.skills.length > 0 ? (
                  <div className="space-y-1">
                    {agent.skills.map((skill) => (
                      <div
                        key={skill}
                        className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                      >
                        <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{skill}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.noSkills")}
                  </p>
                )}
              </div>
            </CollapsibleSection>
          </div>

          {/* Memory Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {t("settingsAgents.memory")}
            </h4>

            <CollapsibleSection
              title="MEMORY.md"
              icon={<Brain className="h-4 w-4" />}
            >
              <p className="text-xs text-muted-foreground py-2">
                {t("settingsAgents.memoryDesc")}
              </p>
            </CollapsibleSection>
          </div>

          {/* Timestamps */}
          {(agent.created_at || agent.updated_at) && (
            <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
              {agent.created_at && (
                <p>
                  {t("common.created")}: {new Date(agent.created_at).toLocaleString()}
                </p>
              )}
              {agent.updated_at && (
                <p>
                  {t("workspace.updated")}: {new Date(agent.updated_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Danger Zone - kept at bottom */}
          <div className="pt-4 mt-4 border-t">
            <div className="flex items-center justify-between">
              {!isDefault && (
                <Button variant="outline" size="sm" onClick={onSetDefault}>
                  <Star className="h-4 w-4 mr-2" />
                  {t("agents.setDefault")}
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={onDelete} className="ml-auto">
                <Trash2 className="h-4 w-4 mr-2" />
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
