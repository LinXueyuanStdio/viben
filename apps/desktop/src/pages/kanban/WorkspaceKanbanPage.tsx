import { useMemo } from "react";
import { Loader2, FolderOpen, Plus, ArrowLeft, Settings, LayoutGrid, List, Table2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@viben/ui";
import { StatsPanel } from "@viben/kanban";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { useKanbanBoard } from "./hooks";
import {
  ErrorState,
  KanbanToolbar,
  KanbanBoardView,
  KanbanListView,
  KanbanTableView,
  KanbanModals,
} from "./components";

export function WorkspaceKanbanPage() {
  const board = useKanbanBoard();

  const {
    t,
    workspaceId,
    workspace,
    isLoadingWorkspaces,
    workspaces,
    tasksError,
    isLoadingTasks,
    viewMode,
    setViewMode,
    showStats,
    stats,
    createTask,
    handleAddTask,
    columnStatuses,
    setSettingsOpen,
    refetchTasks,
  } = board;

  // View mode tab list
  const tabList = useMemo(() => [
    { key: "kanban" as const, icon: LayoutGrid, label: t("workspace.viewMode.kanban", "Kanban") },
    { key: "list" as const, icon: List, label: t("workspace.viewMode.list", "List") },
    { key: "table" as const, icon: Table2, label: t("workspace.viewMode.table", "Table") },
  ], [t]);

  // Center content: view mode switcher tablist
  const centerContent = useMemo(() => (
    <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
      {tabList.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => setViewMode(key)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            viewMode === key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  ), [tabList, viewMode, setViewMode]);

  // Loading state for workspace
  if (isLoadingWorkspaces && !workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loadingWorkspace", "Loading workspace...")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Not found state
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

  // Error loading tasks
  if (tasksError) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <WorkspaceHeader
          workspace={workspace}
          segments={[{
            id: `workspace:${workspaceId}:kanban`,
            label: t("workspace.kanban", "Kanban"),
            href: `/workspace/${workspaceId}/kanban`,
            icon: { type: "lucide", value: "layout-dashboard" },
            descriptorId: "workspace-section:kanban",
            meta: {
              workspaceId,
              section: "kanban",
              routePath: "kanban",
            },
          }]}
          showRefresh={false}
          showRemove={false}
        />
        <ErrorState
          message={
            tasksError instanceof Error
              ? tasksError.message
              : t("workspace.failedToLoadTasks", "Failed to load tasks")
          }
          onRetry={() => refetchTasks()}
        />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      {/* Header with breadcrumb */}
      <WorkspaceHeader
        workspace={workspace}
        segments={[{
          id: `workspace:${workspaceId}:kanban`,
          label: t("workspace.kanban", "Kanban"),
          href: `/workspace/${workspaceId}/kanban`,
          icon: { type: "lucide", value: "layout-dashboard" },
          descriptorId: "workspace-section:kanban",
          meta: {
            workspaceId,
            section: "kanban",
            routePath: "kanban",
          },
        }]}
        onRefresh={refetchTasks}
        isRefreshing={isLoadingTasks}
        showRemove={false}
        centerContent={centerContent}
        rightContent={
          <>
            <Button
              size="sm"
              onClick={() => handleAddTask(columnStatuses[0]?.id || "backlog")}
              disabled={createTask.isPending}
              className="h-8"
            >
              {createTask.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {t("workspace.addTask", "Add Task")}
            </Button>
            {/* Board Settings Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {t("workspace.boardSettings", "Board Settings")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        }
      />

      {/* Filter and Sort Bar */}
      <KanbanToolbar board={board} />

      {/* Stats Panel */}
      {showStats && (
        <div className="px-4 py-3 border-b bg-muted/20">
          <StatsPanel stats={stats} />
        </div>
      )}

      {/* Main content */}
      {isLoadingTasks ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanBoardView board={board} />
      ) : viewMode === "list" ? (
        <KanbanListView board={board} />
      ) : (
        <KanbanTableView board={board} />
      )}

      {/* All modals */}
      <KanbanModals board={board} />
    </PageWrapper>
  );
}
