/**
 * Workspace Agents Page - WeChat-style layout
 * Left: Agent list
 * Right: Agent detail panel
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Bot,
  Plus,
  Trash2,
  RefreshCw,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useLocalWorkspaces, useVibenAgents, useVibenModels } from "@/hooks";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

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

export function WorkspaceAgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();

  // Viben agents and models
  const {
    agents,
    defaultAgentId,
    loading: loadingAgents,
    error,
    createAgent,
    removeAgent,
    setDefaultAgent,
    refresh: refreshAgents,
  } = useVibenAgents();

  const {
    models,
    loading: loadingModels,
  } = useVibenModels();

  // UI state
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;
  const loading = loadingAgents || loadingModels;

  // Filter agents by search
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query)
    );
  }, [agents, searchQuery]);

  // Selected agent data
  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId]
  );

  // Auto-select first agent when list changes
  useEffect(() => {
    if (!selectedAgentId && filteredAgents.length > 0) {
      setSelectedAgentId(filteredAgents[0].id);
    } else if (selectedAgentId && !filteredAgents.find((a) => a.id === selectedAgentId)) {
      setSelectedAgentId(filteredAgents[0]?.id || null);
    }
  }, [filteredAgents, selectedAgentId]);

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
      setSelectedAgentId(newAgent.id);
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setCreating(false);
    }
  };

  // Copy agent
  const handleCopyAgent = async (agentId: string, agentName: string) => {
    try {
      const newAgent = await createAgent({
        name: `${agentName} (副本)`,
      });
      setSelectedAgentId(newAgent.id);
    } catch (err) {
      console.error("Failed to copy agent:", err);
    }
  };

  // Delete agent
  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(t("settingsAgents.deleteConfirm", { name: agentName }))) return;
    try {
      await removeAgent(agentId);
      if (selectedAgentId === agentId) {
        setSelectedAgentId(null);
      }
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
  };

  // Navigate to agent detail/edit page
  const handleEditAgent = (agentId: string) => {
    navigate(`/workspace/${workspaceId}/agent/${agentId}`);
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
        onRefresh={refreshAgents}
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

          {/* Agent List */}
          <ScrollArea className="flex-1">
            {loading && agents.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="p-6 text-center">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? t("common.noResults") : t("settingsAgents.noAgents")}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className={cn(
                      "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      selectedAgentId === agent.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/60"
                    )}
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback
                        className={cn(
                          "text-sm font-medium",
                          selectedAgentId === agent.id
                            ? "bg-primary/20 text-primary"
                            : "bg-muted"
                        )}
                      >
                        {agent.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{agent.name}</span>
                        {agent.id === defaultAgentId && (
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                        )}
                      </div>
                      {agent.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {agent.description}
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
                        <DropdownMenuItem onClick={() => handleEditAgent(agent.id)}>
                          <Settings2 className="h-4 w-4 mr-2" />
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyAgent(agent.id, agent.name)}>
                          <Copy className="h-4 w-4 mr-2" />
                          {t("common.copy")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDefaultAgent(agent.id)}>
                          <Star className="h-4 w-4 mr-2" />
                          {t("agents.setDefault")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteAgent(agent.id, agent.name)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: Agent Detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedAgent ? (
            <AgentDetailPanel
              agent={selectedAgent}
              isDefault={selectedAgent.id === defaultAgentId}
              models={models}
              onEdit={() => handleEditAgent(selectedAgent.id)}
              onSetDefault={() => setDefaultAgent(selectedAgent.id)}
              onDelete={() => handleDeleteAgent(selectedAgent.id, selectedAgent.name)}
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
// Agent Detail Panel
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
  models: { id: string; name: string; provider: string }[];
  onEdit: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

function AgentDetailPanel({
  agent,
  isDefault,
  models,
  onEdit,
  onSetDefault,
  onDelete,
}: AgentDetailPanelProps) {
  const { t } = useTranslation();

  const agentModel = models.find((m) => m.id === agent.model);

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
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{agent.name}</h2>
                {isDefault && (
                  <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full">
                    <Star className="h-3 w-3 fill-current" />
                    {t("common.default")}
                  </span>
                )}
              </div>
              {agent.description && (
                <p className="text-muted-foreground mt-1">{agent.description}</p>
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
            <Button size="sm" onClick={onEdit}>
              <Settings2 className="h-4 w-4 mr-2" />
              {t("common.edit")}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Model & Provider */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t("workspace.createTaskDialog.model")}
            </h3>
            <Card>
              <CardContent className="p-4">
                {agentModel ? (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{agentModel.name}</p>
                      <p className="text-sm text-muted-foreground">{agentModel.provider}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {agent.model || t("common.notConfigured")}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          {/* System Prompt */}
          {agent.system_prompt && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                System Prompt
              </h3>
              <Card>
                <CardContent className="p-4">
                  <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-lg max-h-48 overflow-auto">
                    {agent.system_prompt}
                  </pre>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Parameters */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t("inspector.parameters")}
            </h3>
            <Card>
              <CardContent className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Temperature</p>
                  <p className="font-medium">{agent.temperature ?? 0.7}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Max Tokens</p>
                  <p className="font-medium">{agent.max_tokens ?? "Auto"}</p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* MCP Servers */}
          {agent.mcp_servers.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                MCP Servers
              </h3>
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {agent.mcp_servers.map((server) => (
                      <span
                        key={server}
                        className="text-sm bg-muted px-2.5 py-1 rounded-full"
                      >
                        {server}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Skills */}
          {agent.skills.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {t("chat.skills")}
              </h3>
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {agent.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-sm bg-primary/10 text-primary px-2.5 py-1 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

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
