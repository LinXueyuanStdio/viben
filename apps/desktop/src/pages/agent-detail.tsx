import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
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
  Users,
  MessageSquare,
  FileCode,
  ChevronRight,
  ChevronLeft,
  Wrench,
  Cpu,
  FileJson,
  FormInput,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { WorkspaceHeader } from "@/components/workspace";
import {
  useLocalWorkspaces,
  useWorkspaceAgents,
  useWorkspaceMcpServers,
  useWorkspaceSkills,
  useWorkspaceAgentConfigs,
  useWorkspaceCommands,
} from "@/hooks";
import { useTranslation } from "react-i18next";
import { CodeEditor } from "@/components/skill-files";
import { cn } from "@/lib/utils";
import type { WorkspaceMcpServer, WorkspaceSkill, WorkspaceAgentConfig, WorkspaceCommand } from "@/types";

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
  const {
    configs: agentConfigs,
    loading: agentConfigsLoading,
    loadConfigs: loadAgentConfigs,
  } = useWorkspaceAgentConfigs(workspaceId || null, agentId || null);
  const {
    commands,
    loading: commandsLoading,
    loadCommands,
  } = useWorkspaceCommands(workspaceId || null, agentId || null);

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
            <Link to="/mcp-services/dashboard">
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

  return (
    <PageWrapper className="flex flex-col h-full">
      {/* Header with Breadcrumb */}
      <WorkspaceHeader
        workspace={workspace}
        segments={[
          { label: agent.name, href: `/workspace/${workspaceId}/agent/${agentId}` },
        ]}
        showRefresh={false}
        showRemove={false}
        rightContent={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Terminal className="h-4 w-4" />
            <code className="font-mono text-xs bg-muted px-2 py-1 rounded max-w-[300px] truncate">
              {agent.config_path}
            </code>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full">

        {/* Tabs for MCP, Skills, Agents, and Commands */}
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
            <TabsTrigger value="agents" className="gap-2">
              <Users className="h-4 w-4" />
              {t("workspace.agentConfigs")}
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {agentConfigs.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="commands" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              {t("workspace.commands")}
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {commands.length}
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

          {/* Agent Configs Tab */}
          <TabsContent value="agents">
            <AgentConfigsSection
              configs={agentConfigs}
              loading={agentConfigsLoading}
              onRefresh={loadAgentConfigs}
            />
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands">
            <CommandsSection
              commands={commands}
              loading={commandsLoading}
              onRefresh={loadCommands}
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

type AddMethod = "form" | "json";
type FormType = "command" | "url";
type Step = "method" | "config" | "preview";

function AddMcpServerDialog({
  open,
  onOpenChange,
  onAdd,
}: AddMcpServerDialogProps) {
  const { t } = useTranslation();

  // Step management
  const [step, setStep] = useState<Step>("method");
  const [addMethod, setAddMethod] = useState<AddMethod>("form");

  // Form-based state
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [formType, setFormType] = useState<FormType>("command");

  // JSON-based state
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Parsed server for preview
  const [parsedServer, setParsedServer] = useState<WorkspaceMcpServer | null>(null);

  const [isAdding, setIsAdding] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("method");
      setAddMethod("form");
      setName("");
      setCommand("");
      setArgs("");
      setUrl("");
      setFormType("command");
      setJsonInput("");
      setJsonError(null);
      setParsedServer(null);
    }
  }, [open]);

  // Build server from form inputs
  const buildServerFromForm = (): WorkspaceMcpServer | null => {
    if (!name.trim()) return null;

    if (formType === "url") {
      if (!url.trim()) return null;
      return {
        name: name.trim(),
        url: url.trim(),
        transport: "sse",
      };
    } else {
      if (!command.trim()) return null;
      return {
        name: name.trim(),
        command: command.trim(),
        args: args
          .split(" ")
          .map((a) => a.trim())
          .filter(Boolean),
      };
    }
  };

  // Parse JSON input
  const parseJsonInput = (): { server: WorkspaceMcpServer | null; error: string | null } => {
    if (!jsonInput.trim()) {
      return { server: null, error: t("workspace.jsonRequired") };
    }

    try {
      const parsed = JSON.parse(jsonInput);

      // Validate required fields
      if (!parsed.name || typeof parsed.name !== "string") {
        return { server: null, error: t("workspace.jsonNameRequired") };
      }

      // Must have either command or url
      if (!parsed.command && !parsed.url) {
        return { server: null, error: t("workspace.jsonCommandOrUrlRequired") };
      }

      // Build server object
      const server: WorkspaceMcpServer = {
        name: parsed.name,
      };

      if (parsed.command) {
        server.command = parsed.command;
        if (parsed.args) {
          server.args = Array.isArray(parsed.args) ? parsed.args : [parsed.args];
        }
        if (parsed.env && typeof parsed.env === "object") {
          server.env = parsed.env;
        }
      }

      if (parsed.url) {
        server.url = parsed.url;
        server.transport = parsed.transport || "sse";
        if (parsed.headers && typeof parsed.headers === "object") {
          server.headers = parsed.headers;
        }
      }

      if (parsed.disabled !== undefined) {
        server.disabled = parsed.disabled;
      }

      return { server, error: null };
    } catch (e) {
      return { server: null, error: t("workspace.jsonParseError") };
    }
  };

  // Handle next step
  const handleNext = () => {
    if (step === "method") {
      setStep("config");
    } else if (step === "config") {
      let server: WorkspaceMcpServer | null = null;

      if (addMethod === "form") {
        server = buildServerFromForm();
        if (!server) return;
      } else {
        const { server: parsedSrv, error } = parseJsonInput();
        if (error) {
          setJsonError(error);
          return;
        }
        server = parsedSrv;
      }

      setParsedServer(server);
      setStep("preview");
    }
  };

  // Handle back
  const handleBack = () => {
    if (step === "config") {
      setStep("method");
    } else if (step === "preview") {
      setStep("config");
    }
  };

  // Handle add
  const handleAdd = async () => {
    if (!parsedServer) return;

    setIsAdding(true);
    try {
      await onAdd(parsedServer);
      onOpenChange(false);
    } finally {
      setIsAdding(false);
    }
  };

  // Check if can proceed to next step
  const canProceed = () => {
    if (step === "method") return true;
    if (step === "config") {
      if (addMethod === "form") {
        return buildServerFromForm() !== null;
      } else {
        return jsonInput.trim().length > 0;
      }
    }
    return false;
  };

  // Get step number for progress indicator
  const stepNumber = step === "method" ? 1 : step === "config" ? 2 : 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t("workspace.addMcpServer")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("workspace.addMcpServer")}</DialogTitle>
          <DialogDescription>
            {t("workspace.addMcpServerDesc")}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`flex items-center ${n < 3 ? "flex-1" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  n <= stepNumber
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {n}
              </div>
              {n < 3 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    n < stepNumber ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Choose method */}
        {step === "method" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t("workspace.chooseAddMethod")}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setAddMethod("form")}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  addMethod === "form"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                }`}
              >
                <FormInput className="h-8 w-8 mb-2 text-primary" />
                <h4 className="font-medium">{t("workspace.formMethod")}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("workspace.formMethodDesc")}
                </p>
              </button>
              <button
                onClick={() => setAddMethod("json")}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  addMethod === "json"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                }`}
              >
                <FileJson className="h-8 w-8 mb-2 text-primary" />
                <h4 className="font-medium">{t("workspace.jsonMethod")}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("workspace.jsonMethodDesc")}
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === "config" && addMethod === "form" && (
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
                variant={formType === "command" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormType("command")}
              >
                <Terminal className="h-4 w-4 mr-2" />
                {t("workspace.commandBased")}
              </Button>
              <Button
                variant={formType === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormType("url")}
              >
                <Globe className="h-4 w-4 mr-2" />
                {t("workspace.urlBased")}
              </Button>
            </div>

            {formType === "url" ? (
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
        )}

        {step === "config" && addMethod === "json" && (
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("workspace.jsonConfig")}
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setJsonError(null);
                }}
                className="w-full h-48 p-3 rounded-md border bg-muted/50 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={`{
  "name": "my-server",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
}`}
              />
              {jsonError && (
                <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {jsonError}
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{t("workspace.jsonHint")}</p>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && parsedServer && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t("workspace.previewConfirm")}
            </p>
            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="font-medium mb-3">{parsedServer.name}</h4>
              <div className="space-y-2 text-sm">
                {parsedServer.command && (
                  <div>
                    <span className="text-muted-foreground">{t("workspace.command")}:</span>{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded">
                      {parsedServer.command}
                    </code>
                  </div>
                )}
                {parsedServer.args && parsedServer.args.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">{t("workspace.arguments")}:</span>{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded">
                      {parsedServer.args.join(" ")}
                    </code>
                  </div>
                )}
                {parsedServer.url && (
                  <div>
                    <span className="text-muted-foreground">URL:</span>{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded">
                      {parsedServer.url}
                    </code>
                  </div>
                )}
                {parsedServer.transport && (
                  <div>
                    <span className="text-muted-foreground">Transport:</span>{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded">
                      {parsedServer.transport}
                    </code>
                  </div>
                )}
                {parsedServer.env && Object.keys(parsedServer.env).length > 0 && (
                  <div>
                    <span className="text-muted-foreground">{t("workspace.envVars")}:</span>
                    <div className="mt-1 space-y-1">
                      {Object.entries(parsedServer.env).map(([key, value]) => (
                        <div key={key} className="pl-4">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                            {key}={value}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step !== "method" && (
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t("common.previous")}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {step !== "preview" ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              {t("common.next")}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleAdd} disabled={isAdding}>
              {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.add")}
            </Button>
          )}
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

// ============================================================================
// Agent Configs Section
// ============================================================================

interface AgentConfigsSectionProps {
  configs: WorkspaceAgentConfig[];
  loading: boolean;
  onRefresh: () => void;
}

function AgentConfigsSection({
  configs,
  loading,
  onRefresh,
}: AgentConfigsSectionProps) {
  const { t } = useTranslation();
  const [selectedConfig, setSelectedConfig] = useState<WorkspaceAgentConfig | null>(null);

  // Auto-select first config when loaded
  useEffect(() => {
    if (configs.length > 0 && !selectedConfig) {
      setSelectedConfig(configs[0]);
    }
  }, [configs, selectedConfig]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {t("workspace.agentConfigsDesc")}
        </p>
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
      </div>

      {loading && configs.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : configs.length === 0 ? (
        <Card interactive={false}>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">{t("workspace.noAgentConfigs")}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t("workspace.noAgentConfigsDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 h-[500px]">
          {/* Left sidebar - Config list */}
          <div className="w-64 border rounded-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-muted/30">
              <h3 className="text-sm font-medium">{t("workspace.agentConfigs")}</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {configs.map((config) => (
                  <button
                    key={config.id}
                    onClick={() => setSelectedConfig(config)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left",
                      "hover:bg-accent transition-colors",
                      selectedConfig?.id === config.id && "bg-accent"
                    )}
                  >
                    <FileCode className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{config.name}</div>
                      {config.model && (
                        <div className="text-xs text-muted-foreground truncate">
                          {config.model}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right content - Config details */}
          <div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
            {selectedConfig ? (
              <>
                {/* Header with metadata */}
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{selectedConfig.name}</h3>
                      {selectedConfig.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {selectedConfig.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedConfig.model && (
                      <div className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded">
                        <Cpu className="h-3 w-3" />
                        {selectedConfig.model}
                      </div>
                    )}
                    {selectedConfig.tools.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded">
                        <Wrench className="h-3 w-3" />
                        {selectedConfig.tools.length} {t("inspector.tools").toLowerCase()}
                      </div>
                    )}
                  </div>
                  {selectedConfig.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedConfig.tools.map((tool) => (
                        <span
                          key={tool}
                          className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 overflow-hidden">
                  <CodeEditor
                    value={selectedConfig.content}
                    filename={`${selectedConfig.id}.md`}
                    height="100%"
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>{t("workspace.selectAgentConfig")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Commands Section
// ============================================================================

interface CommandsSectionProps {
  commands: WorkspaceCommand[];
  loading: boolean;
  onRefresh: () => void;
}

function CommandsSection({
  commands,
  loading,
  onRefresh,
}: CommandsSectionProps) {
  const { t } = useTranslation();
  const [selectedCommand, setSelectedCommand] = useState<WorkspaceCommand | null>(null);

  // Group commands by namespace
  const groupedCommands = commands.reduce<Record<string, WorkspaceCommand[]>>(
    (acc, cmd) => {
      const ns = cmd.namespace || "(root)";
      if (!acc[ns]) {
        acc[ns] = [];
      }
      acc[ns].push(cmd);
      return acc;
    },
    {}
  );

  // Auto-select first command when loaded
  useEffect(() => {
    if (commands.length > 0 && !selectedCommand) {
      setSelectedCommand(commands[0]);
    }
  }, [commands, selectedCommand]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {t("workspace.commandsDesc")}
        </p>
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
      </div>

      {loading && commands.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : commands.length === 0 ? (
        <Card interactive={false}>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">{t("workspace.noCommands")}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t("workspace.noCommandsDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 h-[500px]">
          {/* Left sidebar - Command list grouped by namespace */}
          <div className="w-64 border rounded-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-muted/30">
              <h3 className="text-sm font-medium">{t("workspace.commands")}</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-3">
                {Object.entries(groupedCommands).map(([namespace, cmds]) => (
                  <div key={namespace}>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {namespace === "(root)" ? t("workspace.rootNamespace") : namespace}
                    </div>
                    <div className="space-y-0.5">
                      {cmds.map((cmd) => (
                        <button
                          key={cmd.id}
                          onClick={() => setSelectedCommand(cmd)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left",
                            "hover:bg-accent transition-colors",
                            selectedCommand?.id === cmd.id && "bg-accent"
                          )}
                        >
                          <MessageSquare className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span className="truncate">{cmd.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right content - Command content */}
          <div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
            {selectedCommand ? (
              <>
                {/* Header */}
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                    <div>
                      <h3 className="font-semibold">{selectedCommand.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">
                        {selectedCommand.id}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-hidden">
                  <CodeEditor
                    value={selectedCommand.content}
                    filename={`${selectedCommand.name}.md`}
                    height="100%"
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>{t("workspace.selectCommand")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
