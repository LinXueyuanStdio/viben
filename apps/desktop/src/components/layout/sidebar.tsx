import * as React from "react";
import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Settings,
  SearchCode,
  Store,
  Sparkles,
  Server,
  PanelLeftClose,
  Upload,
  PackageSearch,
  BarChart3,
  FileText,
  Activity,
  MessageSquare,
  LayoutDashboard,
  Clock,
  Bot,
  FolderOpen,
  ChevronDown,
  Plus,
  Check,
  ListTodo,
  Trash2,
  Github,
  ExternalLink,
  Lightbulb,
} from "lucide-react";
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
import { McpStatusIndicator } from "@/components/status/mcp-status-indicator";
import { GatewayStatusIndicator } from "@/components/status/gateway-status-indicator";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { SidebarSection } from "./sidebar-section";
import { SidebarIconButton } from "./sidebar-icon-button";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { AddWorkspaceModal } from "@/components/workspace";
import { WorkspaceSettingsDialog } from "@/components/workspace/workspace-settings-dialog";
import { CreateTaskDialog } from "@/components/workspace/kanban/create-task-dialog";
import type { CreateTaskData } from "@/components/workspace/kanban/create-task-dialog";
import { _useCreateTask } from "@/hooks/use-kanban";
import { useAgents } from "@/hooks/use-workspace-resources";
import { useModels } from "@/hooks/use-models";
import { useGitHubAuth, useGitHubRepository } from "@/hooks/use-github";
import { toast } from "@/hooks/use-toast";
import type { AgentInfo, WorkspaceModel } from "@/lib/gateway";
import { invoke } from "@tauri-apps/api/core";

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ElementType;
}

// MCP section navigation items
const mcpNav: NavItem[] = [
  { titleKey: "nav.mcpMarketplace", href: "/mcp-marketplace", icon: Store },
  { titleKey: "nav.inspector", href: "/inspector", icon: SearchCode },
  { titleKey: "nav.mcpServices", href: "/mcp-services", icon: Server },
];

// Skills section navigation
const skillsNav: NavItem[] = [
  { titleKey: "nav.skillsMarket", href: "/skills-market", icon: Sparkles },
];

// Observability section navigation
const observabilityNav: NavItem[] = [
  { titleKey: "nav.chatMonitor", href: "/chat-monitor", icon: Activity },
];

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
  { titleKey: "workspace.sections.agents", path: "agents", icon: Bot },
  { titleKey: "workspace.files", path: "files", icon: FolderOpen },
];

// GitHub navigation item (shown only when integrated)
const githubNavItem: WorkspaceNavItem = {
  titleKey: "workspace.github",
  path: "github",
  icon: Github,
};

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

export function Sidebar() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

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

  // Load collapsed state from localStorage
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === "true";
  });

  // Persist collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  // Create Task Dialog state
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const createTaskMutation = _useCreateTask();

  // Load agents and models for task creation
  const { agents, loading: isLoadingAgents } = useAgents({ workspacePath: activeWorkspace?.path });
  const { models, loading: isLoadingModels } = useModels();

  // Check GitHub integration status
  const githubAuth = useGitHubAuth(activeWorkspace?.path ?? null);
  const githubRepo = useGitHubRepository(activeWorkspace?.path ?? null);
  const isGitHubIntegrated = !!(githubAuth.status?.authenticated && githubRepo.repository);

  // Build workspace nav items based on GitHub integration status
  const workspaceNavItems = React.useMemo(() => {
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
    navigate(`/workspace/${workspaceId}/chat`);
  };

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
        navigate("/");
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
        agent_id: data.agentId,
        model_id: data.modelId,
        auto_start: data.autoStart,
        worktree: data.worktree,
        status: "backlog",
      });
      toast.success(t("sidebar.taskCreated"));
      // Navigate to kanban board to see the new task
      navigate(`/workspace/${activeWorkspaceId}/kanban`);
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error(t("sidebar.taskCreateFailed"));
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Workspace Selector & Collapse Toggle */}
        <div className={cn(
          "flex h-14 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "justify-between px-3"
        )}>
          {collapsed ? (
            // Collapsed: clickable workspace icon to expand
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="transition-transform duration-200 hover:scale-105 p-2"
                >
                  <FolderOpen className="h-5 w-5 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {activeWorkspace?.type === "global"
                  ? t("workspace.global")
                  : (activeWorkspace?.name || t("sidebar.expand"))}
              </TooltipContent>
            </Tooltip>
          ) : (
            // Expanded: show workspace dropdown and collapse button
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 flex-1 justify-between px-2 text-sidebar-foreground hover:bg-sidebar-accent mr-1"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate text-sm font-medium">
                        {activeWorkspace?.type === "global"
                          ? t("workspace.global")
                          : (activeWorkspace?.name || t("workspace.noWorkspaces"))}
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {workspaces.map((ws) => (
                    <DropdownMenuSub key={ws.id}>
                      <DropdownMenuSubTrigger
                        className="flex items-center justify-between"
                        onClick={(e) => {
                          // Only switch workspace on direct click, not on hover
                          if (e.detail > 0) {
                            handleSelectWorkspace(ws.id);
                          }
                        }}
                      >
                        <span className="flex items-center gap-2 truncate flex-1">
                          <span className="truncate">
                            {ws.type === "global" ? t("workspace.global") : ws.name}
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
                        {ws.type !== "global" && (
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    onClick={toggleCollapsed}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t("sidebar.collapse")}
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Main Navigation with Sections */}
        <ScrollArea className="flex-1 py-4">
          {collapsed ? (
            // Collapsed: all items use SidebarIconButton with unified centering
            <div className="flex flex-col gap-1">
              {/* Workspace Pages Section (only when workspace is selected) */}
              {activeWorkspaceId && (
                <>
                  {workspaceNavItems.map((item) => (
                    <WorkspaceNavItemComponent
                      key={item.path}
                      item={item}
                      workspaceId={activeWorkspaceId}
                      collapsed={collapsed}
                    />
                  ))}
                  <div className="grid place-items-center w-full py-2">
                    <Separator className="w-10 bg-sidebar-border" />
                  </div>
                </>
              )}

              {/* MCP Section */}
              {mcpNav.map((item) => (
                <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
              ))}

              <div className="grid place-items-center w-full py-2">
                <Separator className="w-10 bg-sidebar-border" />
              </div>

              {/* Skills Section */}
              {skillsNav.map((item) => (
                <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
              ))}

              <div className="grid place-items-center w-full py-2">
                <Separator className="w-10 bg-sidebar-border" />
              </div>

              {/* Observability Section */}
              {observabilityNav.map((item) => (
                <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
              ))}

              {/* Creator Section (only when authenticated) */}
              {isAuthenticated && (
                <>
                  <div className="grid place-items-center w-full py-2">
                    <Separator className="w-10 bg-sidebar-border" />
                  </div>
                  {creatorNav.map((item) => (
                    <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
                  ))}
                </>
              )}
            </div>
          ) : (
            // Expanded: full layout with sections
            <div className="space-y-4 px-2">
              {/* Workspace Pages Section (only when workspace is selected) */}
              {activeWorkspaceId && (
                <>
                  <SidebarSection
                    title={t("sidebar.workspacePages")}
                    collapsible
                    defaultOpen
                  >
                    <nav className="flex flex-col gap-1">
                      {workspaceNavItems.map((item) => (
                        <WorkspaceNavItemComponent
                          key={item.path}
                          item={item}
                          workspaceId={activeWorkspaceId}
                          collapsed={collapsed}
                        />
                      ))}
                    </nav>
                  </SidebarSection>
                  <Separator className="bg-sidebar-border" />
                </>
              )}

              {/* MCP Section */}
              <SidebarSection
                title={t("workspace.sections.mcp")}
                collapsible
                defaultOpen
              >
                <nav className="flex flex-col gap-1">
                  {mcpNav.map((item) => (
                    <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
                  ))}
                </nav>
              </SidebarSection>

              {/* Skills Section */}
              <SidebarSection
                title={t("workspace.sections.skills")}
                collapsible
                defaultOpen
              >
                <nav className="flex flex-col gap-1">
                  {skillsNav.map((item) => (
                    <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
                  ))}
                </nav>
              </SidebarSection>

              {/* Observability Section */}
              <SidebarSection
                title={t("nav.observability")}
                collapsible
                defaultOpen
              >
                <nav className="flex flex-col gap-1">
                  {observabilityNav.map((item) => (
                    <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
                  ))}
                </nav>
              </SidebarSection>

              {/* Creator Section (only when authenticated) */}
              {isAuthenticated && (
                <SidebarSection
                  title={t("creator.title")}
                  collapsible
                  defaultOpen
                >
                  <nav className="flex flex-col gap-1">
                    {creatorNav.map((item) => (
                      <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
                    ))}
                  </nav>
                </SidebarSection>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Bottom Status & New Task */}
        {collapsed ? (
          // Collapsed: all items use grid centering
          <div className="pb-4 flex flex-col gap-1">
            <div className="grid place-items-center w-full py-2">
              <Separator className="w-10 bg-sidebar-border" />
            </div>
            <div className="grid place-items-center w-full">
              <GatewayStatusIndicator collapsed={collapsed} />
            </div>
            <div className="grid place-items-center w-full">
              <McpStatusIndicator collapsed={collapsed} />
            </div>
            <div className="grid place-items-center w-full py-2">
              <Separator className="w-10 bg-sidebar-border" />
            </div>
            <NavItemComponent
              item={{ titleKey: "nav.documents", href: "/documents", icon: FileText }}
              collapsed={collapsed}
            />
            <NavItemComponent
              item={{ titleKey: "nav.settings", href: "/settings", icon: Settings }}
              collapsed={collapsed}
            />
            {/* New Task Button */}
            <div className="grid place-items-center w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setIsCreateTaskOpen(true)}
                    disabled={!activeWorkspace}
                  >
                    <ListTodo className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t("sidebar.newTask")}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : (
          // Expanded: full layout
          <div className="pb-4 px-2">
            <Separator className="mb-4 bg-sidebar-border" />
            <GatewayStatusIndicator collapsed={collapsed} />
            <McpStatusIndicator collapsed={collapsed} />
            <div className="mt-3 pt-3 border-t border-sidebar-border">
              <NavItemComponent
                item={{ titleKey: "nav.documents", href: "/documents", icon: FileText }}
                collapsed={collapsed}
              />
              <NavItemComponent
                item={{ titleKey: "nav.settings", href: "/settings", icon: Settings }}
                collapsed={collapsed}
              />
            </div>
            {/* New Task Button */}
            <div className="mt-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsCreateTaskOpen(true)}
                disabled={!activeWorkspace}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("sidebar.newTask")}
              </Button>
            </div>
          </div>
        )}

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
                onClick={handleDeleteWorkspace}
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
      </aside>
    </TooltipProvider>
  );
}

interface NavItemComponentProps {
  item: NavItem;
  collapsed: boolean;
}

function NavItemComponent({ item, collapsed }: NavItemComponentProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const title = t(item.titleKey);

  // Check if this item or any of its children are active
  // This ensures /mcp-services is highlighted when on /mcp-services/dashboard etc.
  const isActiveOrChild = location.pathname === item.href ||
    location.pathname.startsWith(item.href + "/");

  // Collapsed view - use unified SidebarIconButton component with centering wrapper
  if (collapsed) {
    return (
      <div className="grid place-items-center w-full">
        <SidebarIconButton
          href={item.href}
          icon={<item.icon className="h-4 w-4" />}
          tooltip={title}
        />
      </div>
    );
  }

  // Expanded view - full link with text
  return (
    <NavLink
      to={item.href}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
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
    </NavLink>
  );
}

interface WorkspaceNavItemComponentProps {
  item: WorkspaceNavItem;
  workspaceId: string;
  collapsed: boolean;
}

function WorkspaceNavItemComponent({ item, workspaceId, collapsed }: WorkspaceNavItemComponentProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const title = t(item.titleKey);
  const href = `/workspace/${workspaceId}/${item.path}`;

  // Check if this item is active
  const isActive = location.pathname === href ||
    location.pathname.startsWith(href + "/");

  // Collapsed view - use unified SidebarIconButton component with centering wrapper
  if (collapsed) {
    return (
      <div className="grid place-items-center w-full">
        <SidebarIconButton
          href={href}
          icon={<item.icon className="h-4 w-4" />}
          tooltip={title}
        />
      </div>
    );
  }

  // Expanded view - full link with text
  return (
    <NavLink
      to={href}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
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
    </NavLink>
  );
}
