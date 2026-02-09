import { useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  Clock,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardCard } from "@/components/ui/dashboard-card";
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
      <div className="flex-1 overflow-auto p-6 max-w-6xl mx-auto w-full">
        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {/* Chat Card - Blue gradient */}
          <Link to={`/workspace/${workspaceId}/chat`} className="group">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent hover:from-blue-500/20 hover:via-blue-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 h-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                    <MessageCircle className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium">{t("common.open", "打开")}</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-1">{t("chat.chatButton")}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {t("workspace.chatDescription", "Start a conversation with AI")}
                </p>
                <div className="mt-4 pt-4 border-t border-blue-500/10 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">{t("workspace.recentActivity", "最近活跃")}</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Kanban Card - Purple gradient */}
          <Link to={`/workspace/${workspaceId}/kanban`} className="group">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent hover:from-purple-500/20 hover:via-purple-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 h-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform duration-300">
                    <KanbanSquare className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium">{t("common.open", "打开")}</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-1">{t("workspace.kanban", "Task Board")}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {t("workspace.kanbanDescription", "Manage tasks with kanban board")}
                </p>
                <div className="mt-4 pt-4 border-t border-purple-500/10 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">{t("workspace.taskManagement", "任务管理")}</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Cron Card - Orange gradient */}
          <Link to={`/workspace/${workspaceId}/cron`} className="group">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent hover:from-orange-500/20 hover:via-orange-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10 h-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Clock className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium">{t("common.open", "打开")}</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-1">{t("workspace.scheduledTasks", "Scheduled Tasks")}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {t("workspace.scheduledTasksDescription", "Manage scheduled tasks and automation")}
                </p>
                <div className="mt-4 pt-4 border-t border-orange-500/10 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">{t("workspace.automation", "自动化")}</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Agents Card - Green gradient */}
          <Link to={`/workspace/${workspaceId}/agents`} className="group">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent hover:from-emerald-500/20 hover:via-emerald-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 h-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium">{t("common.open", "打开")}</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-1">{t("agents.title")}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {t("agents.list", "Manage your AI agents")}
                </p>
                <div className="mt-4 pt-4 border-t border-emerald-500/10 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">
                    {agents.length} {t("workspace.agentsDetected", "个智能体")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Files Card - Cyan gradient */}
          <Link to={`/workspace/${workspaceId}/files`} className="group">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent hover:from-cyan-500/20 hover:via-cyan-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 h-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform duration-300">
                    <FolderOpen className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium">{t("common.open", "打开")}</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-1">{t("workspace.files", "File System")}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {t("workspace.filesDescription", "Browse and manage files")}
                </p>
                <div className="mt-4 pt-4 border-t border-cyan-500/10 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-cyan-500" />
                  <span className="text-xs text-muted-foreground">{t("workspace.browseFiles", "浏览文件")}</span>
                </div>
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
