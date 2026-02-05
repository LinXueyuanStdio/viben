import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Server,
  Sparkles,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Loader2,
  Terminal,
  Globe,
  Save,
  FolderOpen,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageWrapper, StaggerContainer, StaggerItem } from "@/components/layout";
import {
  useLocalWorkspaces,
  useWorkspaceAgents,
  useWorkspaceMcpServers,
  useWorkspaceSkills,
} from "@/hooks";
import { useTranslation } from "react-i18next";
import type { WorkspaceMcpServer, WorkspaceSkill } from "@/types";

export function AgentDetailPage() {
  const { t } = useTranslation();
  const { workspaceId, agentId } = useParams<{
    workspaceId: string;
    agentId: string;
  }>();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();
  const { agents, loading: isDiscoveringAgents, loadAgents } = useWorkspaceAgents(workspaceId || null);
  const initialLoadDoneRef = useRef<string | null>(null);
  const {
    servers,
    loading: serversLoading,
    loadServers,
    addServer,
    updateServer,
    deleteServer,
  } = useWorkspaceMcpServers(workspaceId || null, agentId || null);
  const {
    skills,
    loading: skillsLoading,
    loadSkills,
    addSkill,
    deleteSkill,
  } = useWorkspaceSkills(workspaceId || null, agentId || null);

  const [activeTab, setActiveTab] = useState("mcp");

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;
  const agent = agents.find((a) => a.id === agentId);

  // Auto-trigger discovery if agents haven't been loaded yet
  // Must wait until workspaces are loaded to run discovery
  useEffect(() => {
    if (!workspaceId || !workspace || isLoadingWorkspaces) {
      return;
    }

    // Only load if this is a new workspace (not already loaded)
    if (initialLoadDoneRef.current !== workspaceId && agents.length === 0 && !isDiscoveringAgents) {
      initialLoadDoneRef.current = workspaceId;
      loadAgents();
    }
  }, [workspaceId, workspace, isLoadingWorkspaces, agents.length, isDiscoveringAgents, loadAgents]);

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

  // Workspace not found after loading
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
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("workspace.backToDashboard")}
            </Link>
          </Button>
        </div>
      </PageWrapper>
    );
  }

  // Show loading while discovering agents (no agents yet)
  if (isDiscoveringAgents || agents.length === 0) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("workspace.discoveringAgents")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Agent not found after discovery complete (agents exist but this one not found)
  // Also handles case where workspace is undefined (shouldn't happen but guard for TypeScript)
  if (!agent || !workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("workspace.agentNotFound")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("workspace.agentNotFoundDesc")}
          </p>
          <Button asChild>
            <Link to={workspaceId ? `/workspace/${workspaceId}` : "/"}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("workspace.backToWorkspace")}
            </Link>
          </Button>
        </div>
      </PageWrapper>
    );
  }

  const agentIcons: Record<string, string> = {
    "claude-code": "CC",
    codex: "Cx",
    cursor: "Cu",
    windsurf: "W",
    vscode: "VS",
    continue: "Co",
    zed: "Z",
    unknown: "?",
  };

  return (
    <PageWrapper>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to={`/workspace/${workspaceId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
                {agentIcons[agent.type] || agent.name[0]}
              </div>
              <div>
                <h1 className="text-2xl font-bold font-serif">{agent.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {workspace.name}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Config Path */}
        <Card className="mb-6" interactive={false}>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-sm">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {t("workspace.configPath")}:
              </span>
              <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                {agent.config_path}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for MCP and Skills */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="mcp" className="gap-2">
              <Server className="h-4 w-4" />
              {t("workspace.mcpServers")}
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {servers.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="skills" className="gap-2">
              <Sparkles className="h-4 w-4" />
              {t("workspace.skills")}
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {skills.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* MCP Servers Tab */}
          <TabsContent value="mcp">
            <McpServersSection
              servers={servers}
              loading={serversLoading}
              onRefresh={loadServers}
              onAdd={addServer}
              onUpdate={updateServer}
              onDelete={deleteServer}
            />
          </TabsContent>

          {/* Skills Tab */}
          <TabsContent value="skills">
            <SkillsSection
              skills={skills}
              loading={skillsLoading}
              workspaceId={workspaceId!}
              agentId={agentId!}
              onRefresh={loadSkills}
              onAdd={addSkill}
              onDelete={deleteSkill}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PageWrapper>
  );
}

interface McpServersSectionProps {
  servers: WorkspaceMcpServer[];
  loading: boolean;
  onRefresh: () => void;
  onAdd: (server: WorkspaceMcpServer) => Promise<void>;
  onUpdate: (name: string, server: WorkspaceMcpServer) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}

function McpServersSection({
  servers,
  loading,
  onRefresh,
  onAdd,
  onUpdate,
  onDelete,
}: McpServersSectionProps) {
  const { t } = useTranslation();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<WorkspaceMcpServer | null>(
    null
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {t("workspace.mcpServersDesc")}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <AddMcpServerDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            onAdd={onAdd}
          />
        </div>
      </div>

      {loading && servers.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : servers.length === 0 ? (
        <Card interactive={false}>
          <CardContent className="py-12 text-center">
            <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">
              {t("workspace.noMcpServers")}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              {t("workspace.noMcpServersDesc")}
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("workspace.addMcpServer")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <StaggerContainer delay={0.05} className="grid gap-3">
          {servers.map((server) => (
            <StaggerItem key={server.name}>
              <McpServerCard
                server={server}
                onEdit={() => setEditingServer(server)}
                onDelete={() => onDelete(server.name)}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Edit Dialog */}
      {editingServer && (
        <EditMcpServerDialog
          server={editingServer}
          open={!!editingServer}
          onOpenChange={(open) => !open && setEditingServer(null)}
          onSave={(server) => {
            onUpdate(editingServer.name, server);
            setEditingServer(null);
          }}
        />
      )}
    </div>
  );
}

interface McpServerCardProps {
  server: WorkspaceMcpServer;
  onEdit: () => void;
  onDelete: () => void;
}

function McpServerCard({ server, onEdit, onDelete }: McpServerCardProps) {
  const { t } = useTranslation();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isUrlBased = !!server.url;

  return (
    <Card interactive={false}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isUrlBased ? (
              <Globe className="h-5 w-5 text-blue-500" />
            ) : (
              <Terminal className="h-5 w-5 text-green-500" />
            )}
            <div>
              <h4 className="font-semibold">{server.name}</h4>
              <p className="text-xs text-muted-foreground font-mono">
                {isUrlBased
                  ? server.url
                  : `${server.command} ${server.args?.join(" ") || ""}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {server.disabled && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                {t("common.disabled")}
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("workspace.deleteMcpServer")}</DialogTitle>
                  <DialogDescription>
                    {t("workspace.deleteMcpServerConfirm", {
                      name: server.name,
                    })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm(false)}
                  >
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

interface AddMcpServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (server: WorkspaceMcpServer) => Promise<void>;
}

function AddMcpServerDialog({
  open,
  onOpenChange,
  onAdd,
}: AddMcpServerDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [isUrlBased, setIsUrlBased] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;

    setIsAdding(true);
    try {
      const server: WorkspaceMcpServer = {
        name: name.trim(),
        ...(isUrlBased
          ? { url: url.trim(), transport: "sse" }
          : {
              command: command.trim(),
              args: args
                .split(" ")
                .map((a) => a.trim())
                .filter(Boolean),
            }),
      };
      await onAdd(server);
      onOpenChange(false);
      // Reset form
      setName("");
      setCommand("");
      setArgs("");
      setUrl("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t("workspace.addMcpServer")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("workspace.addMcpServer")}</DialogTitle>
          <DialogDescription>
            {t("workspace.addMcpServerDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("workspace.serverName")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-server"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant={!isUrlBased ? "default" : "outline"}
              size="sm"
              onClick={() => setIsUrlBased(false)}
            >
              <Terminal className="h-4 w-4 mr-2" />
              {t("workspace.commandBased")}
            </Button>
            <Button
              variant={isUrlBased ? "default" : "outline"}
              size="sm"
              onClick={() => setIsUrlBased(true)}
            >
              <Globe className="h-4 w-4 mr-2" />
              {t("workspace.urlBased")}
            </Button>
          </div>

          {isUrlBased ? (
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("workspace.serverUrl")}
              </label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:3000/sse"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("workspace.command")}
                </label>
                <Input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("workspace.arguments")}
                </label>
                <Input
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="-y @modelcontextprotocol/server-filesystem /path"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleAdd} disabled={!name.trim() || isAdding}>
            {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditMcpServerDialogProps {
  server: WorkspaceMcpServer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (server: WorkspaceMcpServer) => void;
}

function EditMcpServerDialog({
  server,
  open,
  onOpenChange,
  onSave,
}: EditMcpServerDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(server.name);
  const [command, setCommand] = useState(server.command || "");
  const [args, setArgs] = useState(server.args?.join(" ") || "");
  const [url, setUrl] = useState(server.url || "");
  const [isUrlBased, setIsUrlBased] = useState(!!server.url);

  const handleSave = () => {
    const updated: WorkspaceMcpServer = {
      name: name.trim(),
      ...(isUrlBased
        ? { url: url.trim(), transport: server.transport || "sse" }
        : {
            command: command.trim(),
            args: args
              .split(" ")
              .map((a) => a.trim())
              .filter(Boolean),
          }),
      env: server.env,
      headers: server.headers,
      disabled: server.disabled,
    };
    onSave(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("workspace.editMcpServer")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("workspace.serverName")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-server"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant={!isUrlBased ? "default" : "outline"}
              size="sm"
              onClick={() => setIsUrlBased(false)}
            >
              <Terminal className="h-4 w-4 mr-2" />
              {t("workspace.commandBased")}
            </Button>
            <Button
              variant={isUrlBased ? "default" : "outline"}
              size="sm"
              onClick={() => setIsUrlBased(true)}
            >
              <Globe className="h-4 w-4 mr-2" />
              {t("workspace.urlBased")}
            </Button>
          </div>

          {isUrlBased ? (
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("workspace.serverUrl")}
              </label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:3000/sse"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("workspace.command")}
                </label>
                <Input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("workspace.arguments")}
                </label>
                <Input
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="-y @modelcontextprotocol/server-filesystem /path"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            <Save className="h-4 w-4 mr-2" />
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SkillsSectionProps {
  skills: WorkspaceSkill[];
  loading: boolean;
  workspaceId: string;
  agentId: string;
  onRefresh: () => void;
  onAdd: (skill: WorkspaceSkill) => Promise<void>;
  onDelete: (skillId: string) => Promise<void>;
}

function SkillsSection({
  skills,
  loading,
  workspaceId,
  agentId,
  onRefresh,
  onAdd,
  onDelete,
}: SkillsSectionProps) {
  const { t } = useTranslation();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {t("workspace.skillsDesc")}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <AddSkillDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            onAdd={onAdd}
          />
        </div>
      </div>

      {loading && skills.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : skills.length === 0 ? (
        <Card interactive={false}>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">{t("workspace.noSkills")}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              {t("workspace.noSkillsDesc")}
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("workspace.addSkill")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <StaggerContainer delay={0.05} className="grid gap-3">
          {skills.map((skill) => (
            <StaggerItem key={skill.id}>
              <SkillCard
                skill={skill}
                workspaceId={workspaceId}
                agentId={agentId}
                onDelete={() => onDelete(skill.id)}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </div>
  );
}

interface SkillCardProps {
  skill: WorkspaceSkill;
  workspaceId: string;
  agentId: string;
  onDelete: () => void;
}

function SkillCard({ skill, workspaceId, agentId, onDelete }: SkillCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);

  const handleClick = () => {
    navigate(`/workspace/${workspaceId}/agent/${agentId}/skill/${skill.id}`);
  };

  // Truncate path for display
  const truncatePath = (path: string, maxLength: number = 50) => {
    if (path.length <= maxLength) return path;
    const parts = path.split('/');
    if (parts.length <= 2) return '...' + path.slice(-maxLength);
    return '.../' + parts.slice(-2).join('/');
  };

  // Copy path to clipboard
  const handleCopyPath = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!skill.path) return;
    try {
      await navigator.clipboard.writeText(skill.path);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = skill.path;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    }
  };

  return (
    <Card
      className="cursor-pointer hover:border-primary/30 hover:shadow-md transition-all"
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Sparkles className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold">{skill.name}</h4>

              {/* Description */}
              {skill.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {skill.description}
                </p>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <span>v{skill.version}</span>
                <span className="bg-muted px-1.5 py-0.5 rounded">
                  {skill.source === "marketplace"
                    ? t("workspace.fromMarketplace")
                    : skill.source}
                </span>
              </div>

              {/* Path with Tooltip */}
              {skill.path && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="group flex items-center gap-1 text-xs text-muted-foreground mt-2 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FolderOpen className="h-3 w-3 flex-shrink-0" />
                        <code className="font-mono truncate max-w-[200px]">
                          {truncatePath(skill.path)}
                        </code>
                        <button
                          onClick={handleCopyPath}
                          className="p-0.5 rounded hover:bg-muted transition-colors"
                        >
                          {pathCopied ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-lg">
                      <p className="font-mono text-xs break-all">{skill.path}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("workspace.copyPath")}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("workspace.deleteSkill")}</DialogTitle>
                <DialogDescription>
                  {t("workspace.deleteSkillConfirm", { name: skill.name })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(false)}
                >
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
      </CardContent>
    </Card>
  );
}

interface AddSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (skill: WorkspaceSkill) => Promise<void>;
}

function AddSkillDialog({ open, onOpenChange, onAdd }: AddSkillDialogProps) {
  const { t } = useTranslation();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [source, setSource] = useState<"marketplace" | "local">("marketplace");
  const [path, setPath] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!id.trim() || !name.trim()) return;

    setIsAdding(true);
    try {
      const skill: WorkspaceSkill = {
        id: id.trim(),
        name: name.trim(),
        version: version.trim(),
        source,
        ...(source === "local" && path.trim() ? { path: path.trim() } : {}),
      };
      await onAdd(skill);
      onOpenChange(false);
      // Reset form
      setId("");
      setName("");
      setVersion("1.0.0");
      setPath("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t("workspace.addSkill")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("workspace.addSkill")}</DialogTitle>
          <DialogDescription>{t("workspace.addSkillDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("workspace.skillId")}
            </label>
            <Input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="skill-pdf-tools"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("workspace.skillName")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PDF Tools"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("common.version")}
            </label>
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant={source === "marketplace" ? "default" : "outline"}
              size="sm"
              onClick={() => setSource("marketplace")}
            >
              {t("workspace.fromMarketplace")}
            </Button>
            <Button
              variant={source === "local" ? "default" : "outline"}
              size="sm"
              onClick={() => setSource("local")}
            >
              {t("workspace.fromLocal")}
            </Button>
          </div>

          {source === "local" && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("workspace.localPath")}
              </label>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="./local-skills/my-skill"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!id.trim() || !name.trim() || isAdding}
          >
            {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
