import { BrowserRouter, Routes, Route } from "react-router-dom";
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
  SkillsMarketPage,
  MarketplacePage,
} from "@/pages";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="providers" element={<ProvidersPage />} />
          <Route path="search-service" element={<SearchServicePage />} />
          <Route path="inspector" element={<InspectorPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="skills-market" element={<SkillsMarketPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
