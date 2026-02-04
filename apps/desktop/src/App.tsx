import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout";
import {
  DashboardPage,
  ProvidersPage,
  SearchServicePage,
  InspectorPage,
  AgentsPage,
  LogsPage,
  SettingsPage,
  AboutPage,
  TrayPopupPage,
  WorkspaceDetailPage,
  AgentDetailPage,
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
          <Route index element={<DashboardPage />} />
          <Route path="providers" element={<ProvidersPage />} />
          <Route path="search-service" element={<SearchServicePage />} />
          <Route path="inspector" element={<InspectorPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route
            path="mcp-marketplace"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <MarketplacePage />
              </Suspense>
            }
          />
          <Route
            path="skills-market"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <SkillsMarketPage />
              </Suspense>
            }
          />
          <Route path="logs" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="about" element={<AboutPage />} />
          {/* Workspace routes */}
          <Route path="workspace/:workspaceId" element={<WorkspaceDetailPage />} />
          <Route path="workspace/:workspaceId/agent/:agentId" element={<AgentDetailPage />} />
        </Route>
        {/* Tray popup - separate window without layout */}
        <Route path="/tray-popup" element={<TrayPopupPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
