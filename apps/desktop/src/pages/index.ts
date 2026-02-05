export { DashboardPage } from "./dashboard";
export { ProvidersPage } from "./providers";
export { SearchServicePage } from "./search-service";
export { LogsPage } from "./logs";
export { SettingsPage } from "./settings";
export { AboutPage } from "./about";
export { InspectorPage } from "./inspector";
export { TrayPopupPage } from "./tray-popup";
export { WorkspaceDetailPage } from "./workspace-detail";
export { AgentDetailPage } from "./agent-detail";
export { WorkspaceSkillDetailPage } from "./workspace-skill-detail";
// Note: MarketplacePage and SkillsMarketPage are lazy-loaded in App.tsx for code splitting
// They should be imported directly from their modules when lazy loading
// Note: AgentsPage has been removed - agent configuration is now integrated into WorkspaceDetailPage
