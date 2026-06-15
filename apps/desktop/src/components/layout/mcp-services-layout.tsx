import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  FileText,
  Server,
  Bug,
  Monitor,
  Terminal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Navigation section type
interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  titleKey?: string; // Optional section header
  items: NavItem[];
}

// MCP Services navigation structure
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { titleKey: "nav.dashboard", href: "/mcp-services/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    titleKey: "nav.dedicatedSearchServices",
    items: [
      { titleKey: "nav.browseMcp", href: "/mcp-services/browse-mcp", icon: Search },
      { titleKey: "nav.clientMcp", href: "/mcp-services/client-mcp", icon: Monitor },
    ],
  },
  {
    titleKey: "nav.tauriMcpServices",
    items: [
      { titleKey: "nav.tauriMcp", href: "/mcp-services/tauri-mcp", icon: Bug },
      { titleKey: "nav.pythonMcp", href: "/mcp-services/python-mcp", icon: Terminal },
    ],
  },
  {
    items: [
      { titleKey: "nav.logs", href: "/mcp-services/logs", icon: FileText },
    ],
  },
];

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export function McpServicesLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: easeOutExpo,
      },
    },
  };

  return (
    <motion.div
      className="h-full flex flex-col md:flex-row"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Left Navigation Sidebar */}
      <motion.nav
        className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r bg-muted/30 p-4"
        variants={itemVariants}
      >
        <div className="flex items-center gap-2 mb-4 px-2">
          <Server className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold font-serif">
            {t("nav.mcpServices")}
          </h1>
        </div>

        <div className="space-y-4">
          {NAV_SECTIONS.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-1">
              {/* Section header */}
              {section.titleKey && (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(section.titleKey)}
                </div>
              )}

              {/* Section items */}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;

                  return (
                    <li key={item.href}>
                      <NavLink
                        to={item.href}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm",
                          "transition-all duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isActive
                            ? [
                                "bg-primary text-primary-foreground font-medium",
                                "shadow-sm",
                              ]
                            : [
                                "text-muted-foreground",
                                "hover:bg-muted hover:text-foreground",
                              ]
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            "transition-transform duration-200",
                            isActive && "scale-110"
                          )}
                        />
                        <span>{t(item.titleKey)}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </motion.nav>

      {/* Right Content Area */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </motion.div>
  );
}
