import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Settings,
  Bot,
  FileText,
  Info,
  Search,
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

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const mainNav: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Data Sources", href: "/providers", icon: Database },
  { title: "Search Service", href: "/search-service", icon: Search },
  { title: "Agents", href: "/agents", icon: Bot },
  { title: "Logs", href: "/logs", icon: FileText },
];

const bottomNav: NavItem[] = [
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "About", href: "/about", icon: Info },
];

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
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
              <NavItem key={item.href} item={item} collapsed={collapsed} />
            ))}
          </nav>
        </ScrollArea>

        {/* Bottom Navigation */}
        <div className="px-2 pb-4">
          <Separator className="mb-4 bg-sidebar-border" />
          <nav className="flex flex-col gap-1">
            {bottomNav.map((item) => (
              <NavItem key={item.href} item={item} collapsed={collapsed} />
            ))}
          </nav>
        </div>
      </aside>
    </TooltipProvider>
  );
}

interface NavItemProps {
  item: NavItem;
  collapsed: boolean;
}

function NavItem({ item, collapsed }: NavItemProps) {
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
      {!collapsed && <span>{item.title}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
