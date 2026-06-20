import React, { useState, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Settings,
  Upload,
  PackageSearch,
  BarChart3,
  Activity,
  MessageSquare,
  LayoutDashboard,
  Clock,
  Bot,
  FolderOpen,
  ChevronDown,
  Plus,
  Check,
  Trash2,
  ExternalLink,
  Lightbulb,
  Home,
  ArrowLeft,
} from "lucide-react";
import { GithubIcon as Github } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { SidebarSection } from "./sidebar-section";
import { SidebarIconButton } from "./sidebar-icon-button";
import { WakeWordTaskButton } from "./wake-word-task-button";
import { SidebarBottomDrawer } from "./sidebar-bottom-drawer";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { AddWorkspaceModal } from "@/components/workspace";
import { WorkspaceSettingsDialog } from "@/components/workspace/workspace-settings-dialog";
import { CreateTaskDialog } from "@/components/workspace/kanban/create-task-dialog";
import type { CreateTaskData } from "@/components/workspace/kanban/create-task-dialog";
import { _useCreateTask } from "@/hooks/use-kanban";
import { useAgents } from "@/hooks/use-workspace-resources";
import { useModels } from "@/hooks/use-models";
import { useGitHubAuth, useGitHubRepository } from "@/hooks/use-github";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { toast } from "@/hooks/use-toast";
import type { AgentInfo, WorkspaceModel } from "@/lib/gateway";
import { invoke } from "@tauri-apps/api/core";
import { PageSection } from "@/components/layout/page-section";
import { useUiStore } from "@/stores";
import { SettingsSidebarContent } from "@/pages/settings/settings-sidebar-content";
import {
  findPreviousNonSettingsHistoryIndex,
  isSettingsPathname,
} from "@/pages/settings/settings-sidebar-utils";
import { getCurrentWindowTabStore } from "@/stores/tab-store";
import type { IconData } from "@/components/ui/icon-picker";
import { normalizeWorkspaceSection } from "@/navigation/navigation-meta";

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ElementType;
}

// Creator section navigation (only visible when authenticated)
const creatorNav: NavItem[] = [
  { titleKey: "creator.publish", href: "/publish", icon: Upload },
  { titleKey: "creator.myPackages", href: "/my-packages", icon: PackageSearch },
  { titleKey: "creator.analytics", href: "/analytics", icon: BarChart3 },
];

// Workspace navigation items for the active workspace
interface WorkspaceNavItem {
  titleKey: string;
  path: string; // relative path suffix (e.g., "chat", "kanban")
  icon: React.ElementType;
}

// Base workspace navigation items (always visible)
const baseWorkspaceNavItems: WorkspaceNavItem[] = [
  { titleKey: "workspace.chat", path: "chat", icon: MessageSquare },
  { titleKey: "workspace.kanban", path: "kanban", icon: LayoutDashboard },
  { titleKey: "workspace.scheduledTasks", path: "cron", icon: Clock },
  { titleKey: "workspace.ideas", path: "ideas", icon: Lightbulb },
  { titleKey: "workspace.sections.agents", path: "agent", icon: Bot },
  { titleKey: "workspace.files", path: "files", icon: FolderOpen },
  { titleKey: "workspace.chatMonitor", path: "chat-monitor", icon: Activity },
];

// GitHub navigation item (shown only when integrated)
const githubNavItem: WorkspaceNavItem = {
  titleKey: "workspace.github.label",
  path: "github",
  icon: Github,
};

export function Sidebar() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const {
    currentTab,
    openWorkspaceSection,
    openWorkspaceHome,
    openPath,
    openDashboard,
  } = useDesktopRouting();

  const {
    workspaces,
    activeWorkspaceId,
    selectWorkspace,
    removeWorkspace,
  } = useLocalWorkspaces();

  // Add Workspace Modal state
  const [isAddWorkspaceModalOpen, setIsAddWorkspaceModalOpen] = useState(false);

  // Delete workspace confirmation state
  const [workspaceToDelete, setWorkspaceToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Workspace settings dialog state
  const [workspaceToConfig, setWorkspaceToConfig] = useState<string | null>(null);

  // Get active workspace
  const activeWorkspace = workspaces.find(ws => ws.id === activeWorkspaceId);

  // Use global UI store for sidebar collapsed state
  const { sidebarCollapsed: collapsed } = useUiStore();

  // Hover state for auto-expand when collapsed
  const [isHovered, setIsHovered] = useState(false);
  const [hasOpenMenu, setHasOpenMenu] = useState(false);
  const enterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Handle mouse enter - expand after a short delay to avoid accidental triggers
  const handleMouseEnter = useCallback(() => {
    if (!collapsed) return;
    // Clear any pending leave timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    enterTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 100);
  }, [collapsed]);

  // Handle mouse leave - collapse after a small delay to avoid flicker
  // Don't collapse if a menu is open (menus render via Portal outside sidebar)
  const handleMouseLeave = useCallback(() => {
    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }
    if (hasOpenMenu) return; // Don't collapse while menu is open
    leaveTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 100);
  }, [hasOpenMenu]);

  // Track menu open state changes
  const handleMenuOpenChange = useCallback((open: boolean) => {
    setHasOpenMenu(open);
    // Clear any pending menu close timeout
    if (menuCloseTimeoutRef.current) {
      clearTimeout(menuCloseTimeoutRef.current);
      menuCloseTimeoutRef.current = null;
    }
    // When menu closes, check if mouse is still over sidebar
    if (!open && collapsed) {
      // Add a one-time mousemove listener to check position after menu closes
      const checkMousePosition = (e: MouseEvent) => {
        const rect = sidebarRef.current?.getBoundingClientRect();
        if (rect) {
          const isOverSidebar =
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom;
          if (!isOverSidebar) {
            setIsHovered(false);
          }
        }
      };
      // Small delay to let the menu close animation complete
      menuCloseTimeoutRef.current = setTimeout(() => {
        document.addEventListener("mousemove", checkMousePosition, { once: true });
        menuCloseTimeoutRef.current = null;
      }, 50);
    }
  }, [collapsed]);

  // Cleanup timeouts on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      if (enterTimeoutRef.current) {
        clearTimeout(enterTimeoutRef.current);
      }
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
      if (menuCloseTimeoutRef.current) {
        clearTimeout(menuCloseTimeoutRef.current);
      }
    };
  }, []);

  // Reset isHovered when collapsed state changes to avoid stale hover state
  React.useEffect(() => {
    if (!collapsed) {
      setIsHovered(false);
    }
  }, [collapsed]);

  // Whether to show expanded content (either not collapsed, or hovered while collapsed)
  const showExpanded = !collapsed || isHovered;
  const isSettingsMode = isSettingsPathname(location.pathname);

  const handleReturnFromSettings = useCallback(() => {
    if (currentTab) {
      const previousIndex = findPreviousNonSettingsHistoryIndex(
        currentTab.navigationHistory,
        currentTab.historyIndex,
      );

      if (previousIndex !== null) {
        getCurrentWindowTabStore()
          .getState()
          .jumpToHistory(currentTab.id, previousIndex);
        return;
      }
    }

    if (activeWorkspaceId) {
      openWorkspaceSection(activeWorkspaceId, "chat");
      return;
    }

    openDashboard();
  }, [activeWorkspaceId, currentTab, openDashboard, openWorkspaceSection]);

  // Create Task Dialog state (from global UI store for keyboard shortcut support)
  const { isCreateTaskDialogOpen: isCreateTaskOpen, setCreateTaskDialogOpen: setIsCreateTaskOpen } = useUiStore();
  const createTaskMutation = _useCreateTask();

  // Load agents and models for task creation
  const { agents, loading: isLoadingAgents } = useAgents({ workspacePath: activeWorkspace?.path });
  const { models, loading: isLoadingModels } = useModels();

  // Check GitHub integration status
  const githubAuth = useGitHubAuth(activeWorkspace?.path ?? null);
  const githubRepo = useGitHubRepository(activeWorkspace?.path ?? null);
  const isGitHubIntegrated = !!(githubAuth.status?.authenticated && githubRepo.repository);

  // Build workspace nav items based on GitHub integration status
  const workspaceNavItems = useMemo(() => {
    if (isGitHubIntegrated) {
      // Insert GitHub after agents, before files
      const items = [...baseWorkspaceNavItems];
      const filesIndex = items.findIndex(item => item.path === "files");
      items.splice(filesIndex, 0, githubNavItem);
      return items;
    }
    return baseWorkspaceNavItems;
  }, [isGitHubIntegrated]);

  const handleAddWorkspace = () => {
    setIsAddWorkspaceModalOpen(true);
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    selectWorkspace(workspaceId);
    openWorkspaceSection(workspaceId, "chat");
  };

  // Handle workspace nav item click - updates current tab
  const handleWorkspaceNavClick = useCallback(
    (workspaceId: string, viewPath: string, _viewName: string, _icon: IconData) => {
      openWorkspaceSection(workspaceId, normalizeWorkspaceSection(viewPath));
    },
    [openWorkspaceSection]
  );

  // Handle global nav item click - updates current tab
  const handleGlobalNavClick = useCallback(
    (href: string, name: string, icon: IconData) => {
      openPath(href, {
        title: name,
        icon,
        descriptorId: href.startsWith("/settings") ? "settings" : "workspace",
      });
    },
    [openPath]
  );

  const handleConfigureWorkspace = (workspaceId: string) => {
    setWorkspaceToConfig(workspaceId);
  };

  const handleOpenInNewWindow = async (workspaceId: string) => {
    try {
      await invoke("open_workspace_in_new_window", { workspaceId });
    } catch (error) {
      console.error("Failed to open workspace in new window:", error);
      toast.error(t("common.error"));
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;

    setIsDeleting(true);
    try {
      await removeWorkspace(workspaceToDelete.id);
      toast.success(t("workspace.deleteSuccess"));
      // If deleting active workspace, navigate to home
      if (workspaceToDelete.id === activeWorkspaceId) {
        openDashboard();
      }
    } catch (error) {
      console.error("Failed to delete workspace:", error);
      toast.error(t("workspace.deleteFailed"));
    } finally {
      setIsDeleting(false);
      setWorkspaceToDelete(null);
    }
  };

  // Handle create task submission
  const handleCreateTask = async (data: CreateTaskData) => {
    if (!activeWorkspace) {
      toast.error(t("sidebar.noWorkspaceSelected"));
      return;
    }

    try {
      await createTaskMutation.mutateAsync({
        title: data.title,
        description: data.description,
        workspace_path: activeWorkspace.path,
        agent_id: data.agentId,       // will be mapped to 'agent'
        model_id: data.modelId,       // will be mapped to 'model'
        auto_start: data.autoStart,   // will be mapped to 'start'
        worktree: data.worktree,
      });
      toast.success(t("sidebar.taskCreated"));
      // Navigate to kanban board to see the new task
      if (activeWorkspaceId) {
        openWorkspaceSection(activeWorkspaceId, "kanban");
      }
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error(t("sidebar.taskCreateFailed"));
    }
  };

  const ExpandedSettingsContent = (
    <>
      <div className="flex h-10 items-center border-b border-sidebar-border px-2">
        <Button
          variant="ghost"
          className="h-8 w-full justify-start gap-2 px-2 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleReturnFromSettings}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm font-medium">{t("common.back", "Back")}</span>
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 pt-2">
        <SettingsSidebarContent collapsed={false} showExpanded />
      </ScrollArea>

      <div className="px-2 pb-2">
        <Separator className="mb-2 bg-sidebar-border" />
        <SidebarBottomDrawer collapsed={false} onOpenChange={handleMenuOpenChange} />
        <WakeWordTaskButton
          collapsed={false}
          disabled={!activeWorkspace}
        />
      </div>
    </>
  );

  const CollapsedSettingsContent = (
    <>
      <div className="flex h-10 items-center justify-center border-b border-sidebar-border px-2">
        <SidebarIconButton
          icon={<ArrowLeft className="h-4 w-4" />}
          tooltip={t("common.back", "Back")}
          onClick={handleReturnFromSettings}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 pt-2">
        <SettingsSidebarContent collapsed showExpanded={false} />
      </ScrollArea>

      <div className="flex flex-col pb-2">
        <div className="grid w-full place-items-center py-2">
          <Separator className="w-10 bg-sidebar-border" />
        </div>
        <SidebarBottomDrawer collapsed onOpenChange={handleMenuOpenChange} />
        <WakeWordTaskButton
          collapsed
          disabled={!activeWorkspace}
        />
      </div>
    </>
  );

  // Expanded content component (reused in both modes)
  const ExpandedContent = (
    <>
      {/* Workspace Selector & Settings - Expanded */}
      <div className="flex h-10 items-center border-b border-sidebar-border justify-between px-2">
        <DropdownMenu onOpenChange={handleMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 flex-1 justify-between px-2 text-sidebar-foreground hover:bg-sidebar-accent mr-1"
            >
              <span className="flex items-center gap-2 truncate">
                <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-sm font-medium">
                  {activeWorkspace?.id === "global"
                    ? t("workspace.global")
                    : (activeWorkspace?.name || t("workspace.noWorkspaces"))}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-[60vh] overflow-y-auto">
            {workspaces.map((ws) => (
              <DropdownMenuSub key={ws.id}>
                <DropdownMenuSubTrigger
                  className="flex items-center justify-between"
                  onClick={(e) => {
                    if (e.detail > 0) {
                      handleSelectWorkspace(ws.id);
                    }
                  }}
                >
                  <span className="flex items-center gap-2 truncate flex-1">
                    <span className="truncate">
                      {ws.id === "global" ? t("workspace.global") : ws.name}
                    </span>
                    {ws.id === activeWorkspaceId && (
                      <Check className="h-3 w-3 text-primary shrink-0" />
                    )}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  <DropdownMenuItem
                    onClick={() => handleConfigureWorkspace(ws.id)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {t("workspace.configure")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleOpenInNewWindow(ws.id)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t("workspace.openInNewWindow")}
                  </DropdownMenuItem>
                  {ws.id !== "global" && (
                    <DropdownMenuItem
                      onClick={() => setWorkspaceToDelete({ id: ws.id, name: ws.name })}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("workspace.delete")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
            {workspaces.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={handleAddWorkspace}
              className="text-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("workspace.addWorkspace")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {activeWorkspaceId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                onClick={() => handleConfigureWorkspace(activeWorkspaceId)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t("workspace.configure")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Main Navigation - Expanded */}
      <ScrollArea className="flex-1 pt-2 px-2">
        <div className="space-y-4">
          {activeWorkspaceId && activeWorkspace && (
            <PageSection
              workspaceId={activeWorkspaceId}
              workspacePath={activeWorkspace.path}
              collapsed={false}
            />
          )}

          {activeWorkspaceId && (
            <SidebarSection
              title={t("sidebar.workspacePages")}
              collapsible
              defaultOpen
              headerAction={
                <div className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                        onClick={() => {
                          handleConfigureWorkspace(activeWorkspaceId);
                        }}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {t("workspace.configure")}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                        onClick={() => {
                          openWorkspaceHome(activeWorkspaceId);
                        }}
                      >
                        <Home className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {t("sidebar.workspaceHome")}
                    </TooltipContent>
                  </Tooltip>
                </div>
              }
            >
              <nav className="flex flex-col gap-1">
                {workspaceNavItems.map((item) => (
                  <WorkspaceNavItemComponent
                    key={item.path}
                    item={item}
                    workspaceId={activeWorkspaceId}
                    collapsed={false}
                    onNavigate={handleWorkspaceNavClick}
                  />
                ))}
              </nav>
            </SidebarSection>
          )}

          {isAuthenticated && (
            <SidebarSection
              title={t("creator.title")}
              collapsible
              defaultOpen
            >
              <nav className="flex flex-col gap-1">
                {creatorNav.map((item) => (
                  <NavItemComponent key={item.href} item={item} collapsed={false} onNavigate={handleGlobalNavClick} />
                ))}
              </nav>
            </SidebarSection>
          )}
        </div>
      </ScrollArea>

      {/* Bottom Navigation - Expanded */}
      <div className="pb-2 px-2">
        <SidebarBottomDrawer collapsed={false} onOpenChange={handleMenuOpenChange} />
        <WakeWordTaskButton
          collapsed={false}
          disabled={!activeWorkspace}
        />
      </div>
    </>
  );

  // Collapsed content component
  const CollapsedContent = (
    <>
      {/* Workspace icon - Collapsed */}
      <div className="flex h-10 items-center border-b border-sidebar-border justify-center px-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="transition-transform duration-200 hover:scale-105 p-2"
            >
              <FolderOpen className="h-6 w-6 text-primary" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {activeWorkspace?.id === "global"
              ? t("workspace.global")
              : (activeWorkspace?.name || t("workspace.selectWorkspace"))}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Main Navigation - Collapsed */}
      <ScrollArea className="flex-1 pt-2 px-2">
        <div className="flex flex-col gap-1">
          {activeWorkspaceId && activeWorkspace && (
            <>
              <PageSection
                workspaceId={activeWorkspaceId}
                workspacePath={activeWorkspace.path}
                collapsed={true}
              />
              <div className="grid place-items-center w-full py-2">
                <Separator className="w-10 bg-sidebar-border" />
              </div>
            </>
          )}

          {activeWorkspaceId && (
            <>
              {workspaceNavItems.map((item) => (
                <WorkspaceNavItemComponent
                  key={item.path}
                  item={item}
                  workspaceId={activeWorkspaceId}
                  collapsed={true}
                  onNavigate={handleWorkspaceNavClick}
                />
              ))}
            </>
          )}

          {isAuthenticated && (
            <>
              <div className="grid place-items-center w-full py-2">
                <Separator className="w-10 bg-sidebar-border" />
              </div>
              {creatorNav.map((item) => (
                <NavItemComponent key={item.href} item={item} collapsed={true} onNavigate={handleGlobalNavClick} />
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Bottom Navigation - Collapsed */}
      <div className="pb-2 flex flex-col">
        <SidebarBottomDrawer collapsed onOpenChange={handleMenuOpenChange} />
        <WakeWordTaskButton
          collapsed
          disabled={!activeWorkspace}
        />
      </div>
    </>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Container that reserves space - width changes with animation */}
      <div
        ref={sidebarRef}
        className={cn(
          "relative h-full shrink-0 transition-[width] duration-200 ease-out",
          collapsed ? "w-16" : "w-56"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Actual sidebar - when collapsed+hovered, overlays as absolute positioned */}
        <aside
          className={cn(
            "flex h-full flex-col border-r border-sidebar-border bg-sidebar",
            "transition-[width,box-shadow] duration-200 ease-out",
            collapsed
              ? isHovered
                ? "absolute inset-y-0 left-0 w-56 z-50 shadow-2xl"
                : "w-16"
              : "w-56"
          )}
        >
            {isSettingsMode
              ? showExpanded
                ? ExpandedSettingsContent
                : CollapsedSettingsContent
              : showExpanded
                ? ExpandedContent
                : CollapsedContent}
        </aside>
      </div>

      {/* Create Task Dialog */}
        <CreateTaskDialog
          open={isCreateTaskOpen}
          onOpenChange={setIsCreateTaskOpen}
          onSubmit={handleCreateTask}
          isSubmitting={createTaskMutation.isPending}
          availableAgents={agents.map((a: AgentInfo) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            executorType: a.executor_type,
          }))}
          availableModels={models
            .filter((m: WorkspaceModel) => m.is_available)
            .map((m: WorkspaceModel) => ({
              id: m.id,
              name: m.name,
              provider: m.provider_id,
              provider_id: m.provider_id,
            }))}
          isLoadingOptions={isLoadingAgents || isLoadingModels}
      />

      {/* Add Workspace Modal */}
        <AddWorkspaceModal
          open={isAddWorkspaceModalOpen}
          onOpenChange={setIsAddWorkspaceModalOpen}
      />

      {/* Delete Workspace Confirmation Dialog */}
        <AlertDialog
          open={!!workspaceToDelete}
          onOpenChange={(open) => !open && setWorkspaceToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("workspace.deleteConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("workspace.deleteConfirmDescription", { name: workspaceToDelete?.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteWorkspace();
                }}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? t("common.deleting") : t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      {/* Workspace Settings Dialog */}
        <WorkspaceSettingsDialog
          open={!!workspaceToConfig}
          onOpenChange={(open) => !open && setWorkspaceToConfig(null)}
          workspaceId={workspaceToConfig}
      />
    </TooltipProvider>
  );
}

interface NavItemComponentProps {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: (href: string, name: string, icon: IconData) => void;
}

function NavItemComponent({ item, collapsed, onNavigate }: NavItemComponentProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const title = t(item.titleKey);

  // Check if this item or any of its children are active
  // This ensures /mcp-services is highlighted when on /mcp-services/dashboard etc.
  const isActiveOrChild = location.pathname === item.href ||
    location.pathname.startsWith(item.href + "/");

  const iconName = getGlobalNavIconName(item.href);

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(item.href, title, { type: "lucide", value: iconName });
    }
  };

  // Collapsed view - use unified SidebarIconButton component with centering wrapper
  if (collapsed) {
    return (
      <div className="grid place-items-center w-full">
        <SidebarIconButton
          icon={<item.icon className="h-4 w-4" />}
          tooltip={title}
          onClick={handleClick}
        />
      </div>
    );
  }

  // Expanded view - full link with text
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group relative flex items-center gap-3 px-2 py-2 rounded-lg text-sm w-full text-left",
        "transition-all duration-200",
        isActiveOrChild
          ? [
              "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
              "before:h-6 before:w-1 before:rounded-r-full before:bg-primary",
            ]
          : [
              "text-sidebar-foreground/70",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            ]
      )}
    >
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors duration-200",
          "group-hover:text-primary"
        )}
      />
      <span>{title}</span>
    </button>
  );
}

function getGlobalNavIconName(href: string): string {
  switch (href) {
    case "/publish":
      return "upload";
    case "/my-packages":
      return "package-search";
    case "/analytics":
      return "bar-chart-3";
    case "/documents":
      return "file-text";
    case "/settings":
      return "settings";
    case "/devices/pair":
      return "smartphone";
    case "/mcp-services/dashboard":
      return "layout-dashboard";
    default:
      return href.split("/").filter(Boolean).pop() ?? "file";
  }
}

interface WorkspaceNavItemComponentProps {
  item: WorkspaceNavItem;
  workspaceId: string;
  collapsed: boolean;
  onNavigate?: (workspaceId: string, viewPath: string, viewName: string, icon: IconData) => void;
}

function WorkspaceNavItemComponent({ item, workspaceId, collapsed, onNavigate }: WorkspaceNavItemComponentProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const title = t(item.titleKey);
  const href = `/workspace/${workspaceId}/${item.path}`;
  const agentCompatHref = `/workspace/${workspaceId}/agent`;

  // Check if this item is active
  const isActive =
    location.pathname === href ||
    location.pathname.startsWith(href + "/") ||
    (item.path === "agents" &&
      (location.pathname === agentCompatHref ||
        location.pathname.startsWith(agentCompatHref + "/")));

  // Use item path as icon name
  const iconName = item.path;

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(workspaceId, item.path, title, { type: "lucide", value: iconName });
    }
  };

  // Collapsed view - use unified SidebarIconButton component with centering wrapper
  if (collapsed) {
    return (
      <div className="grid place-items-center w-full">
        <SidebarIconButton
          icon={<item.icon className="h-4 w-4" />}
          tooltip={title}
          onClick={handleClick}
        />
      </div>
    );
  }

  // Expanded view - full button with text
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group relative flex items-center gap-3 px-2 py-2 rounded-lg text-sm w-full text-left",
        "transition-all duration-200",
        isActive
          ? [
              "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
              "before:h-6 before:w-1 before:rounded-r-full before:bg-primary",
            ]
          : [
              "text-sidebar-foreground/70",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            ]
      )}
    >
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors duration-200",
          "group-hover:text-primary"
        )}
      />
      <span>{title}</span>
    </button>
  );
}
