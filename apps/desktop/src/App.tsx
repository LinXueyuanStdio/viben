import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout, McpServicesLayout } from "@/components/layout";
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
  WorkspaceCronPage,
  AgentDetailPage,
  WorkspaceSkillDetailPage,
  WorkspaceAgentsPage,
  HomeRedirect,
  OnboardingPage,
  PublishPage,
  MyPackagesPage,
  AnalyticsPage,
  DocumentsPage,
} from "@/pages";

// Lazy load marketplace pages for code splitting
// These pages are less frequently accessed and contain more complex components
const MarketplacePage = lazy(() =>
  import("@/pages/marketplace").then((m) => ({ default: m.MarketplacePage }))
);
const SkillsMarketPage = lazy(() =>
  import("@/pages/skills-market").then((m) => ({ default: m.SkillsMarketPage }))
);

/**
 * Loading fallback component for lazy-loaded pages
 */
function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main app routes with layout */}
        <Route path="/" element={<AppLayout />}>
          {/* Default route redirects to global workspace */}
          <Route index element={<HomeRedirect />} />

          {/* MCP Services routes - with secondary navigation layout */}
          <Route path="mcp-services" element={<McpServicesLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="data-sources" element={<ProvidersPage />} />
            <Route path="search-service" element={<SearchServicePage />} />
            <Route path="logs" element={<LogsPage />} />
            {/* Default redirect for /mcp-services */}
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Legacy route redirects for backward compatibility */}
          <Route path="providers" element={<Navigate to="/mcp-services/data-sources" replace />} />
          <Route path="search-service" element={<Navigate to="/mcp-services/search-service" replace />} />
          <Route path="logs" element={<Navigate to="/mcp-services/logs" replace />} />
          <Route path="agents" element={<Navigate to="/mcp-services/dashboard" replace />} />

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

          {/* Documents, Settings and About */}
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="settings" element={<SettingsPage />}>
            <Route index element={null} />
            <Route path="general" element={null} />
            <Route path="shortcuts" element={null} />
            <Route path="gateway" element={null} />
            <Route path="channels" element={null} />
            <Route path="executors" element={null} />
            <Route path="model" element={null} />
            <Route path="agents" element={null} />
            <Route path="environment" element={null} />
            <Route path="storage" element={null} />
            <Route path="about" element={null} />
          </Route>
          <Route path="about" element={<AboutPage />} />

          {/* Agent detail page from settings */}
          <Route path="agents/:agentId" element={<AgentDetailPage />} />

          {/* Creator routes (require authentication, handled in sidebar visibility) */}
          <Route path="publish" element={<PublishPage />} />
          <Route path="my-packages" element={<MyPackagesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />

          {/* Workspace routes */}
          <Route path="workspace/:workspaceId" element={<WorkspaceDetailPage />} />
          <Route path="workspace/:workspaceId/chat" element={<WorkspaceChatPage />} />
          <Route path="workspace/:workspaceId/kanban" element={<WorkspaceKanbanPage />} />
          <Route path="workspace/:workspaceId/cron" element={<WorkspaceCronPage />} />
          <Route path="workspace/:workspaceId/agents" element={<WorkspaceAgentsPage />} />
          <Route path="workspace/:workspaceId/agent/:agentId" element={<AgentDetailPage />} />
          <Route path="workspace/:workspaceId/agent/:agentId/skill/:skillId" element={<WorkspaceSkillDetailPage />} />
        </Route>

        {/* Tray popup - separate window without layout */}
        <Route path="/tray-popup" element={<TrayPopupPage />} />

        {/* Onboarding - separate full-screen wizard without layout */}
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
