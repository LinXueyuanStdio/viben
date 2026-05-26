import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout, McpServicesLayout } from "@/components/layout";
import { OverlayRoot } from "@/components/overlay";
import { ActionApprovalDialog } from "@/components/action-system";
import { PresentationActionProvider } from "@/components/overlay/layers/presentation-action-provider";
import {
  DashboardPage,
  ProvidersPage,
  SearchServicePage,
  InspectorPage,
  LogsPage,
  SettingsPage,
  AboutPage,
  TrayPopupPage,
  WorkspaceDetailPage,
  WorkspaceChatPage,
  WorkspaceKanbanPage,
  WorkspaceFilesPage,
  WorkspaceCronPage,
  WorkspaceIdeasPage,
  AgentDetailPage,
  SkillDetailPage,
  ExecutorDetailPage,
  McpServerDetailPage,
  SubAgentDetailPage,
  PromptDetailPage,
  CommandDetailPage,
  WorkspaceAgentsPage,
  WorkspaceGitHubPage,
  HomeRedirect,
  OnboardingPage,
  PublishPage,
  MyPackagesPage,
  AnalyticsPage,
  DocumentsPage,
  ChatMonitorPage,
  PageDebugPage,
  WorkspacePage,
  WorkspaceWebPage,
  OsPage,
  ConnectPage,
  DeviceListPage,
  MobileChatPage,
  DevicePairPage,
} from "@/pages";

// Lazy load marketplace pages for code splitting
// These pages are less frequently accessed and contain more complex components
const MarketplacePage = lazy(() =>
  import("@/pages/marketplace").then((m) => ({ default: m.MarketplacePage }))
);
const SkillsMarketPage = lazy(() =>
  import("@/pages/skills-market").then((m) => ({ default: m.SkillsMarketPage }))
);

import { useTranslation } from "react-i18next";
import { isMobile } from "@/lib/platform";
import { MobileLayout } from "@/components/mobile/mobile-layout";
import { useMemo, Component, type ReactNode } from "react";

/**
 * Loading fallback component for lazy-loaded pages
 */
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

/**
 * Error boundary to catch rendering errors
 */
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AppErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-background text-foreground p-4">
          <div className="text-center max-w-md">
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || "Unknown error"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  // Memoize platform detection to avoid repeated calls during re-renders
  const mobile = useMemo(() => {
    try {
      return isMobile();
    } catch (e) {
      console.error("[App] isMobile() failed:", e);
      // Fallback: check user agent
      const ua = navigator.userAgent.toLowerCase();
      return ua.includes("android") || ua.includes("iphone") || ua.includes("ipad");
    }
  }, []);

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          {mobile ? (
            <>
              {/* Mobile routes with bottom tab layout */}
              <Route path="/m" element={<MobileLayout />}>
                <Route path="connect" element={<ConnectPage />} />
                <Route path="devices" element={<DeviceListPage />} />
                <Route path="chat" element={<MobileChatPage />} />
                <Route index element={<Navigate to="connect" replace />} />
              </Route>
              {/* Root redirects to mobile connect */}
              <Route path="*" element={<Navigate to="/m/connect" replace />} />
            </>
          ) : (
            <>
              {/* Main app routes with layout */}
              <Route path="/" element={<AppLayout />}>
                {/* Default route redirects to global workspace */}
                <Route index element={<HomeRedirect />} />

                {/* MCP Services routes - with secondary navigation layout */}
                <Route path="mcp-services" element={<McpServicesLayout />}>
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="data-sources" element={<ProvidersPage />} />
                  <Route path="search-service" element={<SearchServicePage />} />
                  <Route path="page-debug" element={<PageDebugPage />} />
                  <Route path="logs" element={<LogsPage />} />
                  {/* Default redirect for /mcp-services */}
                  <Route index element={<Navigate to="dashboard" replace />} />
                </Route>

                {/* Legacy route redirects for backward compatibility */}
                <Route path="providers" element={<Navigate to="/mcp-services/data-sources" replace />} />
                <Route path="search-service" element={<Navigate to="/mcp-services/search-service" replace />} />
                <Route path="logs" element={<Navigate to="/mcp-services/logs" replace />} />
                <Route path="agents" element={<Navigate to="/mcp-services/dashboard" replace />} />

                {/* OS - iPad-style GPU-rendered OS */}
                <Route path="os" element={<OsPage />} />

                {/* Top-level MCP routes (unchanged) */}
                <Route path="inspector" element={<InspectorPage />} />
                <Route
                  path="mcp-marketplace"
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <MarketplacePage />
                    </Suspense>
                  }
                />

                {/* Skills routes */}
                <Route
                  path="skills-market"
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <SkillsMarketPage />
                    </Suspense>
                  }
                />

                {/* Observability routes */}
                <Route path="chat-monitor" element={<ChatMonitorPage />} />

                {/* Device pairing */}
                <Route path="devices/pair" element={<DevicePairPage />} />

                {/* Documents, Settings and About */}
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="settings" element={<SettingsPage />}>
                  <Route index element={null} />
                  <Route path="general" element={null} />
                  <Route path="account" element={null} />
                  <Route path="shortcuts" element={null} />
                  <Route path="notifications" element={null} />
                  <Route path="gateway" element={null} />
                  <Route path="channels" element={null} />
                  <Route path="executors" element={null} />
                  <Route path="model" element={null} />
                  <Route path="agents" element={null} />
                  <Route path="mcp" element={null} />
                  <Route path="skills" element={null} />
                  <Route path="sandbox" element={null} />
                  <Route path="environment" element={null} />
                  <Route path="terminalFonts" element={null} />
                  <Route path="overlay" element={null} />
                  <Route path="voice" element={null} />
                  <Route path="storage" element={null} />
                  <Route path="developer" element={null} />
                  <Route path="about" element={null} />
                </Route>
                <Route path="about" element={<AboutPage />} />

                {/* Detail pages with query params: ?workspace_path=...&agent_id=... */}
                <Route path="agent/:agentId" element={<AgentDetailPage />} />
                <Route path="executor/:executorType" element={<ExecutorDetailPage />} />
                <Route path="skill/:skillId" element={<SkillDetailPage />} />
                <Route path="mcp-server/:serverName" element={<McpServerDetailPage />} />
                <Route path="subagent/:configId" element={<SubAgentDetailPage />} />
                <Route path="prompt/:promptId" element={<PromptDetailPage />} />
                <Route path="command/:commandId" element={<CommandDetailPage />} />

                {/* Creator routes (require authentication, handled in sidebar visibility) */}
                <Route path="publish" element={<PublishPage />} />
                <Route path="my-packages" element={<MyPackagesPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />

                {/* Workspace routes */}
                <Route path="workspace" element={<Navigate to="/workspace/global" replace />} />
                <Route path="workspace/:workspaceId" element={<WorkspaceDetailPage />} />
                <Route path="workspace/:workspaceId/chat" element={<WorkspaceChatPage />} />
                <Route path="workspace/:workspaceId/kanban" element={<WorkspaceKanbanPage />} />
                <Route path="workspace/:workspaceId/files" element={<WorkspaceFilesPage />} />
                <Route path="workspace/:workspaceId/cron" element={<WorkspaceCronPage />} />
                <Route path="workspace/:workspaceId/ideas" element={<WorkspaceIdeasPage />} />
                <Route path="workspace/:workspaceId/agent/:agentId" element={<AgentDetailPage />} />
                <Route path="workspace/:workspaceId/executor/:executorType" element={<ExecutorDetailPage />} />
                <Route path="workspace/:workspaceId/pages/*" element={<WorkspacePage />} />
                <Route path="workspace/:workspaceId/web" element={<WorkspaceWebPage />} />
                <Route path="workspace/:workspaceId/agent" element={<WorkspaceAgentsPage />} />
                <Route path="workspace/:workspaceId/github" element={<WorkspaceGitHubPage />} />
                <Route path="workspace/:workspaceId/chat-monitor" element={<ChatMonitorPage />} />

                {/* Catch-all redirect to workspace */}
                <Route path="*" element={<Navigate to="/workspace" replace />} />
              </Route>

              {/* Tray popup - separate window without layout */}
              <Route path="/tray-popup" element={<TrayPopupPage />} />

              {/* Onboarding - separate full-screen wizard without layout */}
              <Route path="/onboarding" element={<OnboardingPage />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
      <OverlayRoot />
      <ActionApprovalDialog />
      <PresentationActionProvider />
    </AppErrorBoundary>
  );
}

export default App;
