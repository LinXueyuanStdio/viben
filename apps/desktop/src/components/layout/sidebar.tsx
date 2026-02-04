import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Settings,
  Bot,
  FileText,
  Info,
  Search,
  SearchCode,
  LogIn,
  Store,
  Sparkles,
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

// Home section navigation
const homeNav: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
];

// MCP section navigation
const mcpNav: NavItem[] = [
  { titleKey: "nav.mcpMarketplace", href: "/mcp-marketplace", icon: Store },
  { titleKey: "nav.dataSources", href: "/providers", icon: Database },
  { titleKey: "nav.searchService", href: "/search-service", icon: Search },
  { titleKey: "nav.inspector", href: "/inspector", icon: SearchCode },
  { titleKey: "nav.agents", href: "/agents", icon: Bot },
  { titleKey: "nav.logs", href: "/logs", icon: FileText },
];

// Skills section navigation
const skillsNav: NavItem[] = [
  { titleKey: "nav.skillsMarket", href: "/skills-market", icon: Sparkles },
];

// Preferences section navigation
const preferencesNav: NavItem[] = [
  { titleKey: "nav.settings", href: "/settings", icon: Settings },
  { titleKey: "nav.about", href: "/about", icon: Info },
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

            {/* Home Section */}
            <SidebarSection title={t("workspace.sections.home")} collapsed={collapsed}>
              <nav className="flex flex-col gap-1">
                {homeNav.map((item) => (
                  <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
                ))}
              </nav>
            </SidebarSection>

            {/* MCP Section */}
            <SidebarSection
              title={t("workspace.sections.mcp")}
              collapsible
              defaultOpen
              collapsed={collapsed}
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
              collapsed={collapsed}
            >
              <nav className="flex flex-col gap-1">
                {skillsNav.map((item) => (
                  <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
                ))}
              </nav>
            </SidebarSection>

            {/* Preferences Section */}
            <SidebarSection
              title={t("workspace.sections.preferences")}
              collapsible
              defaultOpen
              collapsed={collapsed}
            >
              <nav className="flex flex-col gap-1">
                {preferencesNav.map((item) => (
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

          {/* User Auth Section */}
          <div className="mt-3 pt-3 border-t border-sidebar-border">
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

interface NavItemComponentProps {
  item: NavItem;
  collapsed: boolean;
}

function NavItemComponent({ item, collapsed }: NavItemComponentProps) {
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
                "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                "before:h-6 before:w-1 before:rounded-r-full before:bg-primary",
              ]
            : [
                "text-sidebar-foreground/70",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              ],
          collapsed && "justify-center px-2"
        )
      }
    >
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors duration-200",
          "group-hover:text-primary"
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
