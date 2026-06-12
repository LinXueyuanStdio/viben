/**
 * Settings MCP Page - MCP management within settings
 *
 * 设置页面中的 MCP 管理，包含：
 * - MCP 市场：浏览和安装 MCP 包
 * - Inspector：调试和检查 MCP 服务器
 * - MCP 服务：管理已安装的 MCP 服务
 */
import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Store,
  SearchCode,
  LayoutDashboard,
  Search,
  FileText,
  Bug,
  Loader2,
  Server,
  Monitor,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { InspectorPage } from "@/pages/mcp/inspector";

// Lazy load marketplace page
const MarketplacePage = lazy(() =>
  import("@/pages/marketplace").then((m) => ({ default: m.MarketplacePage }))
);

// Lazy load MCP service pages
const DashboardPage = lazy(() =>
  import("@/pages/mcp/dashboard").then((m) => ({ default: m.DashboardPage }))
);

const BrowseMcpPage = lazy(() =>
  import("@/pages/mcp/browse-mcp").then((m) => ({ default: m.BrowseMcpPage }))
);

const PageDebugPage = lazy(() =>
  import("@/pages/mcp/page-debug").then((m) => ({ default: m.PageDebugPage }))
);

const ClientMcpPage = lazy(() =>
  import("@/pages/mcp/client-mcp").then((m) => ({ default: m.ClientMcpPage }))
);

const LogsPage = lazy(() =>
  import("@/pages/logs").then((m) => ({ default: m.LogsPage }))
);

// Navigation item type
interface NavItem {
  id: string;
  titleKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  titleKey?: string;
  items: NavItem[];
}

// Navigation structure
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { id: "marketplace", titleKey: "nav.mcpMarketplace", icon: Store },
      { id: "inspector", titleKey: "nav.inspector", icon: SearchCode },
    ],
  },
  {
    titleKey: "nav.mcpServices",
    items: [
      { id: "dashboard", titleKey: "nav.dashboard", icon: LayoutDashboard },
      { id: "browse-mcp", titleKey: "nav.browseMcp", icon: Search },
      { id: "client-mcp", titleKey: "nav.clientMcp", icon: Monitor },
      { id: "page-debug", titleKey: "nav.pageDebug", icon: Bug },
      { id: "logs", titleKey: "nav.logs", icon: FileText },
    ],
  },
];

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

function PageLoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">{t("common.loading")}</p>
      </div>
    </div>
  );
}

// Valid tab IDs
const VALID_TABS = ["marketplace", "inspector", "dashboard", "browse-mcp", "client-mcp", "page-debug", "logs"];

export function SettingsMcpPage() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get initial tab from URL or default to marketplace
  const tabFromUrl = searchParams.get("tab");
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : "marketplace";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab with URL when it changes externally
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && VALID_TABS.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab]);

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Animation variants
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

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "marketplace":
        return (
          <Suspense fallback={<PageLoadingFallback />}>
            <MarketplacePage />
          </Suspense>
        );
      case "inspector":
        return <InspectorPage />;
      case "dashboard":
        return (
          <Suspense fallback={<PageLoadingFallback />}>
            <DashboardPage />
          </Suspense>
        );
      case "browse-mcp":
        return (
          <Suspense fallback={<PageLoadingFallback />}>
            <BrowseMcpPage />
          </Suspense>
        );
      case "client-mcp":
        return (
          <Suspense fallback={<PageLoadingFallback />}>
            <ClientMcpPage />
          </Suspense>
        );
      case "page-debug":
        return (
          <Suspense fallback={<PageLoadingFallback />}>
            <PageDebugPage />
          </Suspense>
        );
      case "logs":
        return (
          <Suspense fallback={<PageLoadingFallback />}>
            <LogsPage />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="h-full flex flex-col md:flex-row"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Left Navigation Sidebar - matches settings page style */}
      <motion.nav
        className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r bg-muted/30 p-4"
        variants={itemVariants}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4 px-2">
          <Server className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold font-serif">{t("settings.mcp.title", "MCP")}</h1>
        </div>

        {/* Navigation sections */}
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
                  const isActive = activeTab === item.id;

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleTabChange(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm",
                          "transition-all duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isActive
                            ? "bg-primary text-primary-foreground font-medium shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
                      </button>
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
        {renderContent()}
      </div>
    </motion.div>
  );
}
