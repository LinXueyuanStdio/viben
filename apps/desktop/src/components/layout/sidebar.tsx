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
  Loader2,
  ListTodo,
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
} from "@/components/ui/dropdown-menu";
import { McpStatusIndicator } from "@/components/status/mcp-status-indicator";
import { GatewayStatusIndicator } from "@/components/status/gateway-status-indicator";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import { SidebarSection } from "./sidebar-section";
import { SidebarIconButton } from "./sidebar-icon-button";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { CreateTaskDialog } from "@/components/workspace/kanban/create-task-dialog";
import type { CreateTaskData } from "@/components/workspace/kanban/create-task-dialog";
import { createTask } from "@/lib/vibe-kanban/api";
import { useAgents } from "@/hooks/use-workspace-resources";
import { useModels } from "@/hooks/use-models";
import { toast } from "@/hooks/use-toast";
import type { AgentInfo, WorkspaceModel } from "@/lib/gateway";

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

const workspaceNavItems: WorkspaceNavItem[] = [
  { titleKey: "workspace.chat", path: "chat", icon: MessageSquare },
  { titleKey: "workspace.kanban", path: "kanban", icon: LayoutDashboard },
  { titleKey: "workspace.scheduledTasks", path: "cron", icon: Clock },
  { titleKey: "workspace.sections.agents", path: "agents", icon: Bot },
  { titleKey: "workspace.files", path: "files", icon: FolderOpen },
];

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

export function Sidebar() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const {
    workspaces,
    activeWorkspaceId,
    addWorkspace,
    selectWorkspace,
  } = useLocalWorkspaces();

  const [isAdding, setIsAdding] = useState(false);

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
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Load agents and models for task creation
  const { agents, loading: isLoadingAgents } = useAgents({ workspacePath: activeWorkspace?.path });
  const { models, loading: isLoadingModels } = useModels();

  const handleAddWorkspace = async () => {
    setIsAdding(true);
    try {
      const workspace = await addWorkspace();
      if (workspace) {
        selectWorkspace(workspace.id);
        navigate(`/workspace/${workspace.id}/chat`);
      }
    } catch {
      // Error handled in hook
    } finally {
      setIsAdding(false);
    }
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    selectWorkspace(workspaceId);
    navigate(`/workspace/${workspaceId}/chat`);
  };

  // Handle create task submission
  const handleCreateTask = async (data: CreateTaskData) => {
    if (!activeWorkspace) {
      toast.error(t("sidebar.noWorkspaceSelected"));
      return;
    }

    setIsCreatingTask(true);
    try {
      await createTask({
        title: data.title,
        description: data.description,
        workspace_path: activeWorkspace.path,
        agent_id: data.agentId,
        model_id: data.modelId,
        branch: data.branch,
        auto_start: data.autoStart,
        status: "todo",
      });
      toast.success(t("sidebar.taskCreated"));
      // Navigate to kanban board to see the new task
      navigate(`/workspace/${activeWorkspaceId}/kanban`);
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error(t("sidebar.taskCreateFailed"));
    } finally {
      setIsCreatingTask(false);
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
                {activeWorkspace?.name || t("sidebar.expand")}
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
                        {activeWorkspace?.name || t("workspace.noWorkspaces")}
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {workspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => handleSelectWorkspace(ws.id)}
                      className="flex items-center justify-between"
                    >
                      <span className="truncate">{ws.name}</span>
                      {ws.id === activeWorkspaceId && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  {workspaces.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={handleAddWorkspace}
                    disabled={isAdding}
                    className="text-primary"
                  >
                    {isAdding ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
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
            {/* User Menu (when authenticated) */}
            {isAuthenticated && (
              <div className="grid place-items-center w-full">
                <UserMenu collapsed={collapsed} />
              </div>
            )}
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
            {/* User Menu (when authenticated) */}
            {isAuthenticated && (
              <div className="mt-2">
                <UserMenu collapsed={collapsed} />
              </div>
            )}
            {/* New Task Button */}
            <div className="mt-2">
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
          isSubmitting={isCreatingTask}
          availableAgents={agents.map((a: AgentInfo) => ({
            id: a.id,
            name: a.name,
            description: a.description,
          }))}
          availableModels={models.map((m: WorkspaceModel) => ({
            id: m.id,
            name: m.name,
            provider: m.provider,
          }))}
          isLoadingOptions={isLoadingAgents || isLoadingModels}
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
