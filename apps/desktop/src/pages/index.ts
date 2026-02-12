export { DashboardPage } from "./dashboard";
export { ProvidersPage } from "./providers";
export { SearchServicePage } from "./search-service";
export { LogsPage } from "./logs";
export { SettingsPage } from "./settings";
export { AboutPage } from "./about";
export { InspectorPage } from "./inspector";
export { TrayPopupPage } from "./tray-popup";
export { WorkspaceDetailPage } from "./workspace-detail";
export { WorkspaceChatPage } from "./workspace-chat";
export { WorkspaceKanbanPage } from "./workspace-kanban";
export { WorkspaceFilesPage } from "./workspace-files";
export { WorkspaceCronPage } from "./workspace-cron";
export { AgentDetailPage } from "./agent-detail";
export { WorkspaceSkillDetailPage } from "./workspace-skill-detail";
export { WorkspaceAgentsPage } from "./workspace-agents";
export { HomeRedirect } from "./home-redirect";
export { OnboardingPage } from "./onboarding";
export { PublishPage } from "./publish";
export { MyPackagesPage } from "./my-packages";
export { AnalyticsPage } from "./analytics";
export { DocumentsPage } from "./documents";
export { ChatMonitorPage } from "./chat-monitor";
// Note: MarketplacePage and SkillsMarketPage are lazy-loaded in App.tsx for code splitting
// They should be imported directly from their modules when lazy loading
// Note: AgentsPage has been removed - agent configuration is now integrated into WorkspaceDetailPage
