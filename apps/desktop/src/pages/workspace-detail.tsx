import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Folder,
  Globe,
  Trash2,
  RefreshCw,
  Bot,
  Server,
  Sparkles,
  ChevronRight,
  Loader2,
  FolderOpen,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { PageWrapper } from "@/components/layout";
import { useLocalWorkspaces, useWorkspaceAgents } from "@/hooks";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { WorkspaceAgent } from "@/types";

// Auto-refresh interval (10 minutes)
const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000;

export function WorkspaceDetailPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { removeWorkspace, getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();
  const { agents, loading: isDiscovering, loadAgents } = useWorkspaceAgents(
    workspaceId || null
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);
  const initialLoadDoneRef = useRef<string | null>(null);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Copy path to clipboard
  const handleCopyPath = async () => {
    if (!workspace?.path) return;
    try {
      await navigator.clipboard.writeText(workspace.path);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = workspace.path;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    }
  };

  // Open path in Finder
  const handleOpenInFinder = () => {
    if (!workspace?.path) return;
    window.open(`file://${workspace.path}`, "_blank");
  };

  // Auto-refresh on workspace enter (only once per workspace)
  // Must wait until workspaces are loaded to run discovery
  useEffect(() => {
    // Don't run if no workspaceId or workspace not loaded yet
    if (!workspaceId || !workspace || isLoadingWorkspaces) {
      return;
    }

    // Only load if this is a new workspace (not already loaded)
    if (initialLoadDoneRef.current !== workspaceId) {
      initialLoadDoneRef.current = workspaceId;
      loadAgents();
    }
  }, [workspaceId, workspace, isLoadingWorkspaces, loadAgents]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    if (!workspaceId) return;

    const interval = setInterval(() => {
      loadAgents();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [workspaceId, loadAgents]);

  // Show loading state while workspaces are being fetched
  if (isLoadingWorkspaces && !workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </PageWrapper>
    );
  }

  // Only show "not found" after workspaces have loaded
  if (!workspace && workspaces.length > 0) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
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

  // Fallback - still loading or no workspaces
  if (!workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </PageWrapper>
    );
  }

  const isGlobal = workspace.type === "global";

  const handleDelete = async () => {
    if (!workspaceId || isGlobal) return;

    setIsDeleting(true);
    try {
      await removeWorkspace(workspaceId);
      navigate("/");
    } catch {
      // Error handled in hook
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <PageWrapper>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              {isGlobal ? (
                <Globe className="h-8 w-8 text-primary" />
              ) : (
                <Folder className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <h1 className="text-2xl font-bold font-serif">
                  {workspace.name}
                </h1>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleOpenInFinder}
                        className={cn(
                          "group flex items-center gap-1.5 text-sm text-muted-foreground font-mono",
                          "hover:text-foreground transition-colors cursor-pointer",
                          "max-w-md text-left"
                        )}
                      >
                        <span className="truncate">{workspace.path}</span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyPath();
                          }}
                          className={cn(
                            "shrink-0 p-0.5 rounded hover:bg-muted transition-colors",
                            pathCopied && "text-green-500"
                          )}
                        >
                          {pathCopied ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-lg">
                      <p className="font-mono text-xs break-all">{workspace.path}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("workspace.clickToOpenCopyHint")}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAgents}
              disabled={isDiscovering}
            >
              {isDiscovering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("workspace.discovering")}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t("common.refresh")}
                </>
              )}
            </Button>

            {!isGlobal && (
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("common.remove")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("workspace.removeWorkspace")}</DialogTitle>
                    <DialogDescription>
                      {t("workspace.removeWorkspaceConfirm", {
                        name: workspace.name,
                      })}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(false)}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {t("common.remove")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Workspace Info Card */}
        <Card className="mb-6" interactive={false}>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoItem
                label={t("workspace.type")}
                value={isGlobal ? t("workspace.global") : t("workspace.custom")}
              />
              <InfoItem
                label={t("workspace.agentsCount")}
                value={agents.length.toString()}
              />
              <InfoItem
                label={t("workspace.created")}
                value={new Date(workspace.created_at).toLocaleDateString()}
              />
              <InfoItem
                label={t("workspace.lastAccessed")}
                value={new Date(workspace.last_accessed).toLocaleDateString()}
              />
            </div>
          </CardContent>
        </Card>

        {/* Agents Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold font-serif flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {t("workspace.detectedAgents")}
            </h2>
          </div>

          {isDiscovering && agents.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <Card interactive={false}>
              <CardContent className="py-12 text-center">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">
                  {t("workspace.noAgentsFound")}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {t("workspace.noAgentsFoundDesc")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4" key={workspaceId}>
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  workspaceId={workspace.id}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </PageWrapper>
  );
}

interface InfoItemProps {
  label: string;
  value: string;
}

function InfoItem({ label, value }: InfoItemProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

interface AgentCardProps {
  agent: WorkspaceAgent;
  workspaceId: string;
}

function AgentCard({ agent, workspaceId }: AgentCardProps) {
  const { t } = useTranslation();

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
    <Link to={`/workspace/${workspaceId}/agent/${agent.id}`}>
      <Card
        className={cn(
          "cursor-pointer",
          "hover:border-primary/30 hover:shadow-md"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
                {agentIcons[agent.type] || agent.name[0]}
              </div>
              <div>
                <h3 className="font-semibold">{agent.name}</h3>
                <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                  {agent.config_path}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* MCP Config Status */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Server className="h-3 w-3" />
                <span>
                  {agent.mcp_config_file
                    ? t("workspace.mcpConfigured")
                    : t("workspace.mcpNotConfigured")}
                </span>
              </div>

              {/* Skills Config Status */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>
                  {agent.skills_config_file
                    ? t("workspace.skillsConfigured")
                    : t("workspace.skillsNotConfigured")}
                </span>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
