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
  AgentDetailPage,
  WorkspaceSkillDetailPage,
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
          {/* Default route redirects to MCP Services Dashboard */}
          <Route index element={<Navigate to="/mcp-services/dashboard" replace />} />

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

          {/* Settings and About */}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="about" element={<AboutPage />} />

          {/* Workspace routes */}
          <Route path="workspace/:workspaceId" element={<WorkspaceDetailPage />} />
          <Route path="workspace/:workspaceId/agent/:agentId" element={<AgentDetailPage />} />
          <Route path="workspace/:workspaceId/agent/:agentId/skill/:skillId" element={<WorkspaceSkillDetailPage />} />
        </Route>

        {/* Tray popup - separate window without layout */}
        <Route path="/tray-popup" element={<TrayPopupPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
