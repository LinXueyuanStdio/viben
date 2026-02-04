import { useState } from "react";
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
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageWrapper, StaggerContainer, StaggerItem } from "@/components/layout";
import { useLocalWorkspaces, useWorkspaceAgents } from "@/hooks";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { WorkspaceAgent } from "@/types";

export function WorkspaceDetailPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { removeWorkspace, getWorkspace } = useLocalWorkspaces();
  const { agents, loading: agentsLoading, loadAgents } = useWorkspaceAgents(
    workspaceId || null
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  if (!workspace) {
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
                <p
                  className="text-sm text-muted-foreground font-mono truncate max-w-md"
                  title={workspace.path}
                >
                  {workspace.path}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAgents()}
              disabled={agentsLoading}
            >
              {agentsLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t("common.refresh")}
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

          {agentsLoading && agents.length === 0 ? (
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
            <StaggerContainer delay={0.05} className="grid gap-4">
              {agents.map((agent) => (
                <StaggerItem key={agent.id}>
                  <AgentCard
                    agent={agent}
                    workspaceId={workspace.id}
                  />
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </div>

        {/* Quick Actions */}
        <Card interactive={false}>
          <CardHeader>
            <CardTitle className="text-base">
              {t("workspace.quickActions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`file://${workspace.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t("workspace.openInFinder")}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
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
