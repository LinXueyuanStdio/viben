import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Settings,
  Bot,
  FileText,
  Info,
  Search,
  CheckCircle2,
  AlertCircle,
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
import { useAppStore } from "@/stores";
import { useTranslation } from "react-i18next";

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ElementType;
}

const mainNav: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { titleKey: "nav.dataSources", href: "/providers", icon: Database },
  { titleKey: "nav.searchService", href: "/search-service", icon: Search },
  { titleKey: "nav.agents", href: "/agents", icon: Bot },
  { titleKey: "nav.logs", href: "/logs", icon: FileText },
];

const bottomNav: NavItem[] = [
  { titleKey: "nav.settings", href: "/settings", icon: Settings },
  { titleKey: "nav.about", href: "/about", icon: Info },
];

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const { t } = useTranslation();
  // Read global setup status from store (calculated in AppLayout)
  const { setupStatus } = useAppStore();

  // Only show as complete if cache explicitly says so
  const isSetupComplete = setupStatus?.isComplete === true;

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

        {/* Main Navigation */}
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="flex flex-col gap-1">
            {mainNav.map((item) => (
              <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
            ))}
          </nav>
        </ScrollArea>

        {/* Bottom Navigation */}
        <div className="px-2 pb-4">
          <Separator className="mb-4 bg-sidebar-border" />
          <nav className="flex flex-col gap-1">
            {bottomNav.map((item) => (
              <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
            ))}
          </nav>

          {/* Setup Status Indicator */}
          <div className="mt-3 px-3 py-2">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-center">
                    {isSetupComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {isSetupComplete ? t("sidebar.setupComplete") : t("sidebar.setupRequired")}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                {isSetupComplete ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="text-sidebar-foreground/70">{t("sidebar.setupComplete")}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    <span className="text-sidebar-foreground/70">{t("sidebar.setupRequired")}</span>
                  </>
                )}
              </div>
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
