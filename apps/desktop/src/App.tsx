import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout, McpServicesLayout } from "@/components/layout";
import { OverlayRoot } from "@/components/overlay";
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
  ScreenshotOverlayPage,
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

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          {isMobile() ? (
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
                <Route path="workspace/:workspaceId" element={<WorkspaceDetailPage />} />
                <Route path="workspace/page" element={<WorkspacePage />} />
                <Route path="workspace/:workspaceId/chat" element={<WorkspaceChatPage />} />
                <Route path="workspace/:workspaceId/kanban" element={<WorkspaceKanbanPage />} />
                <Route path="workspace/:workspaceId/files" element={<WorkspaceFilesPage />} />
                <Route path="workspace/:workspaceId/cron" element={<WorkspaceCronPage />} />
                <Route path="workspace/:workspaceId/ideas" element={<WorkspaceIdeasPage />} />
                <Route path="workspace/:workspaceId/agent/:agentId" element={<AgentDetailPage />} />
                <Route path="workspace/:workspaceId/executor/:executorType" element={<ExecutorDetailPage />} />
                <Route path="workspace/:workspaceId/page/*" element={<WorkspacePage />} />
                <Route path="workspace/:workspaceId/web" element={<WorkspaceWebPage />} />
                <Route path="workspace/:workspaceId/agent" element={<WorkspaceAgentsPage />} />
                <Route path="workspace/:workspaceId/agents" element={<WorkspaceAgentsPage />} />
                <Route path="workspace/:workspaceId/github" element={<WorkspaceGitHubPage />} />
                <Route path="workspace/:workspaceId/chat-monitor" element={<ChatMonitorPage />} />
              </Route>

              {/* Tray popup - separate window without layout */}
              <Route path="/tray-popup" element={<TrayPopupPage />} />

              {/* Onboarding - separate full-screen wizard without layout */}
              <Route path="/onboarding" element={<OnboardingPage />} />

              {/* Screenshot overlay - fullscreen region selection + annotation */}
              <Route path="/screenshot-overlay" element={<ScreenshotOverlayPage />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
      <OverlayRoot />
    </>
  );
}

export default App;
