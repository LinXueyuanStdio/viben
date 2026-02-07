import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Bot,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Star,
  StarOff,
  Copy,
  ArrowLeft,
  Cpu,
  MessageSquare,
  Globe,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageWrapper, StaggerContainer, StaggerItem } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { useLocalWorkspaces } from "@/hooks";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  type Agent,
  type AgentTemplate,
  type CreateAgentOptions,
} from "@viben/core/browser";

export function WorkspaceAgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [defaultAgentId, setDefaultAgentId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Load agents and templates
  // TODO: Replace with Tauri backend calls when available
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // For now, use empty lists since backend is not available
      // In production, this would call Tauri invoke commands
      setAgents([]);
      setTemplates([]);
      setDefaultAgentId(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create agent and navigate to detail page
  // TODO: Replace with Tauri backend calls when available
  const handleCreateAgent = async (options: CreateAgentOptions) => {
    try {
      const now = new Date().toISOString();
      const id = options.id || options.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const newAgent: Agent = {
        id,
        name: options.name,
        description: options.description,
        model: options.model,
        provider: options.provider,
        systemPrompt: options.systemPrompt,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        createdAt: now,
        updatedAt: now,
      };
      setAgents((prev) => [...prev, newAgent]);
      if (agents.length === 0) {
        setDefaultAgentId(id);
      }
      setCreateDialogOpen(false);
      // Navigate to the agent detail page
      navigate(`/workspace/${workspaceId}/agent/${id}`);
    } catch (err) {
      throw err;
    }
  };

  // Delete agent
  // TODO: Replace with Tauri backend calls when available
  const handleDeleteAgent = async (id: string) => {
    try {
      setAgents((prev) => prev.filter((a) => a.id !== id));
      if (defaultAgentId === id) {
        setDefaultAgentId(undefined);
      }
    } catch (err) {
      throw err;
    }
  };

  // Set default agent
  // TODO: Replace with Tauri backend calls when available
  const handleSetDefault = async (id: string) => {
    try {
      setDefaultAgentId(id);
    } catch (err) {
      throw err;
    }
  };

  // Clone agent
  const handleCloneAgent = async (agent: Agent) => {
    const cloneName = `${agent.name} (Copy)`;
    const cloneId = `${agent.id}-copy-${Date.now()}`;
    await handleCreateAgent({
      id: cloneId,
      name: cloneName,
      description: agent.description,
      model: agent.model,
      provider: agent.provider,
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    });
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
          { label: t("agents.title"), href: `/workspace/${workspaceId}/agents` },
        ]}
        onRefresh={loadData}
        isRefreshing={loading}
        showRemove={false}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full">
        {/* Header with create button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold font-serif flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {t("agents.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("agents.list")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <CreateAgentDialog
              open={createDialogOpen}
              onOpenChange={setCreateDialogOpen}
              onCreate={handleCreateAgent}
              templates={templates}
            />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loading && agents.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : agents.length === 0 ? (
          // Empty state
          <Card interactive={false}>
            <CardContent className="py-12 text-center">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">{t("agents.noAgents")}</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                {t("agents.noAgents")}
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t("agents.create")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Agents list
          <StaggerContainer delay={0.05} className="grid gap-4">
            {agents.map((agent) => (
              <StaggerItem key={agent.id}>
                <AgentCard
                  agent={agent}
                  workspaceId={workspaceId!}
                  isDefault={agent.id === defaultAgentId}
                  isGlobal={false} // TODO: Determine from agent.scope property
                  onDelete={() => handleDeleteAgent(agent.id)}
                  onSetDefault={() => handleSetDefault(agent.id)}
                  onClone={() => handleCloneAgent(agent)}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}

        {/* Templates section */}
        {templates.length > 0 && (
          <div className="mt-8">
            <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
              <Copy className="h-4 w-4 text-muted-foreground" />
              {t("agents.templates")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <h4 className="font-medium">{template.name}</h4>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => {
                        handleCreateAgent({
                          name: `${template.name} Agent`,
                          fromTemplate: template.id,
                        });
                      }}
                    >
                      {t("agents.createFromTemplate")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

// ============================================================================
// Agent Card Component
// ============================================================================

interface AgentCardProps {
  agent: Agent;
  workspaceId: string;
  isDefault: boolean;
  isGlobal?: boolean;
  onDelete: () => void;
  onSetDefault: () => void;
  onClone: () => void;
}

function AgentCard({
  agent,
  workspaceId,
  isDefault,
  isGlobal = false,
  onDelete,
  onSetDefault,
  onClone,
}: AgentCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleClick = () => {
    navigate(`/workspace/${workspaceId}/agent/${agent.id}`);
  };

  return (
    <Card
      className={cn(
        "transition-all cursor-pointer hover:shadow-md hover:border-primary/30",
        isDefault && "border-primary/50 bg-primary/5"
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold truncate">{agent.name}</h4>
                {isDefault && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {t("common.default")}
                  </span>
                )}
                {/* Scope indicator */}
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full flex items-center gap-1",
                    isGlobal
                      ? "bg-muted text-muted-foreground"
                      : "bg-blue-500/10 text-blue-600"
                  )}
                >
                  {isGlobal ? (
                    <>
                      <Globe className="h-3 w-3" />
                      {t("settingsAgents.globalScoped")}
                    </>
                  ) : (
                    <>
                      <FolderOpen className="h-3 w-3" />
                      {t("settingsAgents.workspaceScoped")}
                    </>
                  )}
                </span>
              </div>
              {agent.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {agent.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                {agent.model && (
                  <div className="flex items-center gap-1">
                    <Cpu className="h-3 w-3" />
                    <span>{agent.model}</span>
                  </div>
                )}
                {agent.provider && (
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>{agent.provider}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions - stop propagation to prevent card click */}
          <div className="flex items-center gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSetDefault}
              className={cn(
                "h-8 w-8",
                isDefault && "text-primary"
              )}
              title={t("agents.setDefault")}
            >
              {isDefault ? (
                <Star className="h-4 w-4 fill-current" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClone}
              className="h-8 w-8"
              title={t("agents.clone")}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("agents.remove")}</DialogTitle>
                  <DialogDescription>
                    {t("workspace.deleteSkillConfirm", { name: agent.name })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onDelete();
                      setDeleteConfirm(false);
                    }}
                  >
                    {t("common.delete")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Create Agent Dialog
// ============================================================================

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (options: CreateAgentOptions) => Promise<void>;
  templates: AgentTemplate[];
}

function CreateAgentDialog({
  open,
  onOpenChange,
  onCreate,
  templates,
}: CreateAgentDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [fromTemplate, setFromTemplate] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setModel("");
      setProvider("");
      setSystemPrompt("");
      setFromTemplate("");
      setError(null);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        model: model.trim() || undefined,
        provider: provider.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        fromTemplate: fromTemplate || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t("agents.create")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("agents.create")}</DialogTitle>
          <DialogDescription>
            {t("agents.list")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {templates.length > 0 && (
            <div>
              <Label>{t("agents.createFromTemplate")}</Label>
              <Select value={fromTemplate} onValueChange={setFromTemplate}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="agent-name">{t("common.name")} *</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Agent"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="agent-description">{t("workspace.description")}</Label>
            <Textarea
              id="agent-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A helpful assistant..."
              className="mt-1.5"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agent-model">{t("inspector.model")}</Label>
              <Input
                id="agent-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="claude-3-opus"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="agent-provider">Provider</Label>
              <Input
                id="agent-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="anthropic"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="agent-prompt">System Prompt</Label>
            <Textarea
              id="agent-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant..."
              className="mt-1.5"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
