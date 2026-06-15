export { DashboardPage, BrowseMcpPage, ClientMcpPage, InspectorPage, TauriMcpPage, PythonMcpPage } from "./mcp";
export { LogsPage } from "./logs";
export { SettingsPage } from "./settings";
export { SettingsMcpPage } from "./settings/settings-mcp";
export { SettingsSkillsPage } from "./settings/settings-skills";
export { AboutPage } from "./about";
export { WorkspaceDetailPage } from "./workspace/detail";
export { WorkspaceChatPage } from "./conversation";
export { WorkspaceKanbanPage } from "./kanban";
export { WorkspaceFilesPage } from "./workspace-files";
export { WorkspaceCronPage } from "./workspace-cron";
export { WorkspaceIdeasPage } from "./workspace-ideas";
export { AgentDetailPage, ExecutorDetailPage, SubAgentDetailPage, WorkspaceAgentsPage } from "./agents";
export { SkillDetailPage } from "./skill-detail";
export { McpServerDetailPage } from "./mcp-server-detail";
export { PromptDetailPage } from "./prompt-detail";
export { CommandDetailPage } from "./command-detail";
export { WorkspaceGitHubPage } from "./workspace-github";
export { HomeRedirect } from "./home-redirect";
export { OnboardingPage } from "./onboarding";
export { PublishPage } from "./publish";
export { MyPackagesPage } from "./my-packages";
export { AnalyticsPage } from "./analytics";
export { DocumentsPage } from "./documents";
export { ChatMonitorPage } from "./conversation";
export { WorkspacePage as WorkspaceAppsPage } from "./apps/workspace-apps-page";
export { WorkspacePage } from "./apps/workspace-page";
export { WorkspaceWebPage } from "./workspace-web";
export { OsPage } from "./os";
export { ConnectPage } from "./mobile/connect-page";
export { DeviceListPage } from "./mobile/device-list-page";
export { MobileChatPage } from "./mobile/chat-page";
export { DevicePairPage } from "./devices/pair-page";
export { ScreenshotOverlayPage } from "./screenshot-overlay";
// Note: MarketplacePage and SkillsMarketPage are lazy-loaded in App.tsx for code splitting
// They should be imported directly from their modules when lazy loading
// Note: AgentsPage has been removed - agent configuration is now integrated into WorkspaceDetailPage
