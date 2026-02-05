import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Settings,
  FileText,
  Search,
  SearchCode,
  LogIn,
  Store,
  Sparkles,
  Server,
  ChevronDown,
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
import { McpStatusIndicator } from "@/components/status/mcp-status-indicator";
import { OfflineIndicator } from "@/components/offline/offline-indicator";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/auth/user-menu";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Button } from "@/components/ui/button";
import { SidebarSection } from "./sidebar-section";
import { WorkspaceSection } from "./workspace-section";

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ElementType;
}

// MCP top-level navigation items
const mcpTopNav: NavItem[] = [
  { titleKey: "nav.mcpMarketplace", href: "/mcp-marketplace", icon: Store },
  { titleKey: "nav.inspector", href: "/inspector", icon: SearchCode },
];

// MCP Services secondary navigation
const mcpServicesNav: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/mcp-services/dashboard", icon: LayoutDashboard },
];

// MCP Services - Dedicated Search Services sub-section
const mcpSearchServicesNav: NavItem[] = [
  { titleKey: "nav.dataSources", href: "/mcp-services/data-sources", icon: Database },
  { titleKey: "nav.searchService", href: "/mcp-services/search-service", icon: Search },
];

// MCP Services - Logs
const mcpLogsNav: NavItem[] = [
  { titleKey: "nav.logs", href: "/mcp-services/logs", icon: FileText },
];

// Skills section navigation
const skillsNav: NavItem[] = [
  { titleKey: "nav.skillsMarket", href: "/skills-market", icon: Sparkles },
];

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform duration-200 hover:scale-105">
              <Search className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="font-serif font-semibold text-sidebar-foreground tracking-tight">
                Browse MCP
              </span>
            )}
          </div>
        </div>

        {/* Main Navigation with Sections */}
        <ScrollArea className="flex-1 px-2 py-4">
          <div className="space-y-4">
            {/* Workspaces Section */}
            <WorkspaceSection collapsed={collapsed} />

            <Separator className="bg-sidebar-border" />

            {/* MCP Section */}
            <SidebarSection
              title={t("workspace.sections.mcp")}
              collapsible
              defaultOpen
              collapsed={collapsed}
            >
              <nav className="flex flex-col gap-1">
                {/* MCP Marketplace */}
                <NavItemComponent
                  item={mcpTopNav[0]}
                  collapsed={collapsed}
                />

                {/* MCP Inspector */}
                <NavItemComponent
                  item={mcpTopNav[1]}
                  collapsed={collapsed}
                />

                {/* MCP Services (expandable) */}
                <McpServicesSection collapsed={collapsed} />
              </nav>
            </SidebarSection>

            {/* Skills Section */}
            <SidebarSection
              title={t("workspace.sections.skills")}
              collapsible
              defaultOpen
              collapsed={collapsed}
            >
              <nav className="flex flex-col gap-1">
                {skillsNav.map((item) => (
                  <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
                ))}
              </nav>
            </SidebarSection>
          </div>
        </ScrollArea>

        {/* Bottom Status & Auth */}
        <div className="px-2 pb-4">
          <Separator className="mb-4 bg-sidebar-border" />

          {/* Unified Status Indicator */}
          <div className="mt-3">
            <McpStatusIndicator collapsed={collapsed} />
          </div>

          {/* Offline Status Indicator */}
          <div className="mt-1">
            <OfflineIndicator collapsed={collapsed} />
          </div>

          {/* Settings Navigation */}
          <div className="mt-3 pt-3 border-t border-sidebar-border">
            <NavItemComponent
              item={{ titleKey: "nav.settings", href: "/settings", icon: Settings }}
              collapsed={collapsed}
            />
          </div>

          {/* User Auth Section */}
          <div className="mt-2">
            {isAuthenticated ? (
              <UserMenu collapsed={collapsed} />
            ) : (
              <LoginDialog
                trigger={
                  collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-full h-10"
                        >
                          <LogIn className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {t("auth.signIn")}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button variant="outline" className="w-full">
                      <LogIn className="mr-2 h-4 w-4" />
                      {t("auth.signIn")}
                    </Button>
                  )
                }
              />
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

/**
 * MCP Services expandable section with nested navigation
 */
interface McpServicesSectionProps {
  collapsed: boolean;
}

function McpServicesSection({ collapsed }: McpServicesSectionProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(() => {
    // Auto-expand if we're on an MCP Services route
    return location.pathname.startsWith("/mcp-services");
  });

  // Check if any child route is active
  const isChildActive = location.pathname.startsWith("/mcp-services");

  // Auto-expand when navigating to a child route
  React.useEffect(() => {
    if (isChildActive && !isOpen) {
      setIsOpen(true);
    }
  }, [isChildActive, isOpen]);

  if (collapsed) {
    // In collapsed mode, show MCP Services as a single icon that links to dashboard
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to="/mcp-services/dashboard"
            className={({ isActive }) =>
              cn(
                "group relative flex items-center justify-center rounded-lg px-2 py-2 text-sm",
                "transition-all duration-200",
                isActive || isChildActive
                  ? [
                      "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                      "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                      "before:h-6 before:w-1 before:rounded-r-full before:bg-primary",
                    ]
                  : [
                      "text-sidebar-foreground/70",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    ]
              )
            }
          >
            <Server className="h-4 w-4 shrink-0 transition-colors duration-200 group-hover:text-primary" />
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {t("nav.mcpServices")}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-1">
      {/* MCP Services header (expandable) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm",
          "transition-all duration-200",
          isChildActive
            ? [
                "bg-sidebar-accent/50 text-sidebar-accent-foreground font-medium",
              ]
            : [
                "text-sidebar-foreground/70",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              ]
        )}
      >
        <Server
          className={cn(
            "h-4 w-4 shrink-0 transition-colors duration-200",
            "group-hover:text-primary"
          )}
        />
        <span className="flex-1 text-left">{t("nav.mcpServices")}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            isOpen ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>

      {/* Expanded content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="ml-4 space-y-1 border-l border-sidebar-border pl-2">
          {/* Dashboard */}
          {mcpServicesNav.map((item) => (
            <NavItemComponent
              key={item.href}
              item={item}
              collapsed={collapsed}
              nested
            />
          ))}

          {/* Dedicated Search Services section header */}
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("nav.dedicatedSearchServices")}
          </div>

          {/* Search Services items */}
          {mcpSearchServicesNav.map((item) => (
            <NavItemComponent
              key={item.href}
              item={item}
              collapsed={collapsed}
              nested
            />
          ))}

          {/* Logs */}
          {mcpLogsNav.map((item) => (
            <NavItemComponent
              key={item.href}
              item={item}
              collapsed={collapsed}
              nested
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface NavItemComponentProps {
  item: NavItem;
  collapsed: boolean;
  nested?: boolean;
}

function NavItemComponent({ item, collapsed, nested = false }: NavItemComponentProps) {
  const { t } = useTranslation();
  const title = t(item.titleKey);

  const link = (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
          "transition-all duration-200",
          isActive
            ? [
                "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                !nested && "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                !nested && "before:h-6 before:w-1 before:rounded-r-full before:bg-primary",
              ]
            : [
                "text-sidebar-foreground/70",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              ],
          collapsed && "justify-center px-2",
          nested && "py-1.5"
        )
      }
    >
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors duration-200",
          "group-hover:text-primary",
          nested && "h-3.5 w-3.5"
        )}
      />
      {!collapsed && <span>{title}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
