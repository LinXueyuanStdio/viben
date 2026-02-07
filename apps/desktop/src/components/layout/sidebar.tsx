import * as React from "react";
import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Settings,
  SearchCode,
  LogIn,
  Store,
  Sparkles,
  Server,
  PanelLeftClose,
  Upload,
  PackageSearch,
  BarChart3,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { VibenLogo } from "@/components/ui/viben-logo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { McpStatusIndicator } from "@/components/status/mcp-status-indicator";
import { GatewayStatusIndicator } from "@/components/status/gateway-status-indicator";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/auth/user-menu";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Button } from "@/components/ui/button";
import { SidebarSection } from "./sidebar-section";
import { SidebarIconButton } from "./sidebar-icon-button";
import { WorkspaceSection } from "./workspace-section";

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

// Creator section navigation (only visible when authenticated)
const creatorNav: NavItem[] = [
  { titleKey: "creator.publish", href: "/publish", icon: Upload },
  { titleKey: "creator.myPackages", href: "/my-packages", icon: PackageSearch },
  { titleKey: "creator.analytics", href: "/analytics", icon: BarChart3 },
];

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

export function Sidebar() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

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

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo & Collapse Toggle */}
        <div className={cn(
          "flex h-14 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "justify-between px-3"
        )}>
          {collapsed ? (
            // Collapsed: clickable logo to expand
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="transition-transform duration-200 hover:scale-105"
                >
                  <VibenLogo size="sm" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {t("sidebar.expand")}
              </TooltipContent>
            </Tooltip>
          ) : (
            // Expanded: show logo, title, and collapse button
            <>
              <VibenLogo size="sm" showText className="text-sidebar-foreground" />
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
              {/* Workspaces Section */}
              <WorkspaceSection collapsed={collapsed} />

              <div className="grid place-items-center w-full py-2">
                <Separator className="w-10 bg-sidebar-border" />
              </div>

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
              {/* Workspaces Section */}
              <WorkspaceSection collapsed={collapsed} />

              <Separator className="bg-sidebar-border" />

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

        {/* Bottom Status & Auth */}
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
            <div className="grid place-items-center w-full">
              {isAuthenticated ? (
                <UserMenu collapsed={collapsed} />
              ) : (
                <LoginDialog
                  trigger={
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                        >
                          <LogIn className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {t("auth.signIn")}
                      </TooltipContent>
                    </Tooltip>
                  }
                />
              )}
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
            <div className="mt-2">
              {isAuthenticated ? (
                <UserMenu collapsed={collapsed} />
              ) : (
                <LoginDialog
                  trigger={
                    <Button variant="outline" className="w-full">
                      <LogIn className="mr-2 h-4 w-4" />
                      {t("auth.signIn")}
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        )}
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
