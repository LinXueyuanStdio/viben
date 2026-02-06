import { useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  FolderOpen,
  Bot,
  Server,
  Sparkles,
  ChevronRight,
  MessageCircle,
  KanbanSquare,
  ArrowLeft,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { useLocalWorkspaces, useWorkspaceAgents } from "@/hooks";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { WorkspaceAgent } from "@/types";

// Auto-refresh interval (10 minutes)
const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000;

export function WorkspaceDetailPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const {
    removeWorkspace,
    getWorkspace,
    isLoading: isLoadingWorkspaces,
    workspaces,
  } = useLocalWorkspaces();
  const { agents, loading: isDiscovering, loadAgents } = useWorkspaceAgents(
    workspaceId || null
  );

  const initialLoadDoneRef = useRef<string | null>(null);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Auto-refresh on workspace enter (only once per workspace)
  useEffect(() => {
    if (!workspaceId || !workspace || isLoadingWorkspaces) {
      return;
    }

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
            <Link to="/mcp-services/dashboard">
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

  const handleRemove = async () => {
    if (workspaceId) {
      await removeWorkspace(workspaceId);
    }
  };

  return (
    <PageWrapper className="flex flex-col h-full">
      {/* Header with breadcrumb */}
      <WorkspaceHeader
        workspace={workspace}
        onRefresh={loadAgents}
        onRemove={handleRemove}
        isRefreshing={isDiscovering}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full">
        {/* Quick Actions: Chat, Kanban & Agents */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link to={`/workspace/${workspaceId}/chat`}>
            <Card className="h-full hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {t("chat.chatButton")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("workspace.chatDescription", "Start a conversation with AI")}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </CardContent>
            </Card>
          </Link>

          <Link to={`/workspace/${workspaceId}/kanban`}>
            <Card className="h-full hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <KanbanSquare className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {t("workspace.kanban", "Task Board")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("workspace.kanbanDescription", "Manage tasks with kanban board")}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </CardContent>
            </Card>
          </Link>

          <Link to={`/workspace/${workspaceId}/agents`}>
            <Card className="h-full hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {t("agents.title")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("agents.list", "Manage your AI agents")}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Agents Section */}
        <div>
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
