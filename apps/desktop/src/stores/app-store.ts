import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PythonInfo, Provider, McpServerInstance, McpServerStatus, McpServerStatusInfo, ServiceApiKey, AgentMcpAssignment, InspectorConnectionStatus, InspectorNotification, InspectorHistoryEntry } from "@/types";
import type { CliToolsInfo } from "@/lib/gateway";
import { getGatewayClient } from "@/lib/gateway";
import i18n from "@/i18n";

/** Cached CLI tools detection result with timestamp */
interface CliToolsCache {
  data: CliToolsInfo | null;
  timestamp: number;
}

// Provider definitions with all 18 sources
// Note: enabled is removed - providers only track installation/API key status
// Source selection is now per-server in McpServerInstance.enabledSources
const DEFAULT_PROVIDERS: Provider[] = [
  // Free & Open Access
  { id: "arxiv", name: "arXiv", category: "free", requiresApiKey: false, description: i18n.t("providers.descriptions.arxiv", "Pre-prints in physics, mathematics, computer science") },
  { id: "pubmed", name: "PubMed", category: "free", requiresApiKey: false, description: i18n.t("providers.descriptions.pubmed", "Biomedical literature from MEDLINE") },
  { id: "pmc", name: "PMC", category: "free", requiresApiKey: false, description: i18n.t("providers.descriptions.pmc", "Full-text archive of biomedical articles") },
  { id: "biorxiv", name: "bioRxiv", category: "free", requiresApiKey: false, description: i18n.t("providers.descriptions.biorxiv", "Pre-prints in biology") },
  { id: "medrxiv", name: "medRxiv", category: "free", requiresApiKey: false, description: i18n.t("providers.descriptions.medrxiv", "Pre-prints in health sciences") },
  { id: "semantic", name: "Semantic Scholar", category: "free", requiresApiKey: false, description: i18n.t("providers.descriptions.semantic", "AI-powered research tool") },
  { id: "core", name: "CORE", category: "free", requiresApiKey: false, description: i18n.t("providers.descriptions.core", "World's largest collection of open access papers") },
  { id: "crossref", name: "Crossref", category: "free", requiresApiKey: false, description: i18n.t("providers.descriptions.crossref", "DOI registration agency metadata") },
  { id: "google_scholar", name: "Google Scholar", category: "free", requiresApiKey: false, description: i18n.t("providers.descriptions.google_scholar", "Google's academic search") },
  { id: "iacr", name: "IACR", category: "free", requiresApiKey: false, description: i18n.t("providers.descriptions.iacr", "Cryptology ePrint Archive") },
  // API Key Required
  { id: "sciencedirect", name: "ScienceDirect", category: "api_key", requiresApiKey: true, hasApiKey: false, description: i18n.t("providers.descriptions.sciencedirect", "Elsevier's platform for peer-reviewed literature") },
  { id: "springer", name: "Springer", category: "api_key", requiresApiKey: true, hasApiKey: false, description: i18n.t("providers.descriptions.springer", "Scientific, technical and medical publications") },
  { id: "ieee", name: "IEEE Xplore", category: "api_key", requiresApiKey: true, hasApiKey: false, description: i18n.t("providers.descriptions.ieee", "IEEE and IET technical literature") },
  { id: "scopus", name: "Scopus", category: "api_key", requiresApiKey: true, hasApiKey: false, description: i18n.t("providers.descriptions.scopus", "Elsevier's abstract and citation database") },
  // Institutional Access
  { id: "acm", name: "ACM Digital Library", category: "institutional", requiresApiKey: false, description: i18n.t("providers.descriptions.acm", "Computing and IT research") },
  { id: "wos", name: "Web of Science", category: "institutional", requiresApiKey: false, description: i18n.t("providers.descriptions.wos", "Clarivate's citation database") },
  { id: "jstor", name: "JSTOR", category: "institutional", requiresApiKey: false, description: i18n.t("providers.descriptions.jstor", "Digital library of academic journals") },
  { id: "researchgate", name: "ResearchGate", category: "institutional", requiresApiKey: false, description: i18n.t("providers.descriptions.researchgate", "Social network for researchers") },
];

type ApiKeys = Record<string, string | undefined>;

interface AppState {
  // Python
  selectedPython: PythonInfo | null;
  setSelectedPython: (python: PythonInfo | null) => void;

  // Providers (only track installation/API key status, not enabled state)
  providers: Provider[];
  setProviderApiKey: (id: string, hasKey: boolean) => void;
  getAvailableProviders: () => Provider[]; // All providers that can be used (free or has API key)
  updateProvidersFromCli: (installedSources: { name: string; provider: string; enabled: boolean }[]) => void;

  // API Keys stored separately (for security)
  apiKeys: ApiKeys;
  setApiKey: (provider: string, key: string | undefined) => void;

  // MCP Servers (multiple instances)
  mcpServers: McpServerInstance[];
  addMcpServer: (server: Omit<McpServerInstance, "id" | "status" | "apiKeys">) => string;
  updateMcpServer: (id: string, updates: Partial<McpServerInstance>) => void;
  deleteMcpServer: (id: string) => void;
  getMcpServer: (id: string) => McpServerInstance | undefined;
  setMcpServerStatus: (id: string, status: McpServerStatus, pid?: number, error?: string) => void;
  addServerApiKey: (serverId: string, apiKey: ServiceApiKey) => void;
  deleteServerApiKey: (serverId: string, keyId: string) => void;

  // MCP Server Status Cache (for monitoring)
  mcpServerStatuses: Record<string, McpServerStatusInfo>;
  setMcpServerStatusInfo: (id: string, info: McpServerStatusInfo) => void;
  getMcpServerStatusInfo: (id: string) => McpServerStatusInfo | undefined;
  clearMcpServerStatuses: () => void;

  // Agent Assignments (which server+key each agent uses)
  agentAssignments: AgentMcpAssignment[];
  setAgentAssignment: (agentId: string, serverId: string, apiKeyId?: string) => void;
  removeAgentAssignment: (agentId: string) => void;
  getAgentAssignment: (agentId: string) => AgentMcpAssignment | undefined;

  // Legacy MCP Config (for backward compatibility with single-server mode)
  // These are used when no servers are configured
  mcpTransport: "stdio" | "sse" | "http";
  mcpPort: number;
  downloadPath: string;
  setMcpTransport: (transport: "stdio" | "sse" | "http") => void;
  setMcpPort: (port: number) => void;
  setDownloadPath: (path: string) => void;
  getEnabledSourceIds: () => string[]; // For legacy compatibility

  // Statistics
  totalSearches: number;
  incrementSearches: () => void;

  // Theme
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Language
  language: string;
  setLanguage: (lang: string) => void;

  // Preferences
  alwaysShowTextDirection: boolean;
  setAlwaysShowTextDirection: (value: boolean) => void;
  weekStartsOnMonday: boolean;
  setWeekStartsOnMonday: (value: boolean) => void;
  dateFormat: "relative" | "absolute";
  setDateFormat: (format: "relative" | "absolute") => void;
  autoSetTimezone: boolean;
  setAutoSetTimezone: (value: boolean) => void;
  timezone: string;
  setTimezone: (timezone: string) => void;

  // Setup Banner
  setupBannerDismissed: boolean;
  setSetupBannerDismissed: (dismissed: boolean) => void;

  // Setup Status (cached to avoid repeated checks)
  setupStatus: {
    isComplete: boolean;
    lastChecked: number; // timestamp
  } | null;
  setSetupStatus: (isComplete: boolean) => void;
  shouldCheckSetup: () => boolean; // Returns true if check is needed

  // Inspector State
  inspectorSelectedServerId: string | null;
  inspectorConnectionStatus: InspectorConnectionStatus;
  inspectorNotifications: InspectorNotification[];
  inspectorHistory: InspectorHistoryEntry[];
  setInspectorSelectedServerId: (id: string | null) => void;
  setInspectorConnectionStatus: (status: InspectorConnectionStatus) => void;
  addInspectorNotification: (notification: Omit<InspectorNotification, "id" | "timestamp">) => void;
  removeInspectorNotification: (id: string) => void;
  clearInspectorNotifications: () => void;
  addInspectorHistory: (entry: Omit<InspectorHistoryEntry, "id" | "timestamp">) => void;
  removeInspectorHistory: (id: string) => void;
  clearInspectorHistory: () => void;

  // Onboarding
  onboardingCompleted: boolean;
  setOnboardingCompleted: (completed: boolean) => void;

  // Shortcuts
  shortcuts: {
    sendMessage: string;
    screenshot: string;
    lock: string;
    showHideWindow: string;
    createTask: string;
    newTab: string;
    closeTab: string;
    reopenClosedTab: string;
  };
  showHideWindowScope: "all" | "chatRelated";
  setShortcut: (key: keyof AppState["shortcuts"], value: string) => void;
  setShowHideWindowScope: (scope: "all" | "chatRelated") => void;
  resetShortcuts: () => void;

  // Developer Tools (synced to ~/.viben/config.yaml via Gateway)
  preferredIDE: string;
  setPreferredIDE: (ide: string) => void;
  preferredTerminal: string;
  setPreferredTerminal: (terminal: string) => void;
  dangerouslySkipPermissions: boolean;
  setDangerouslySkipPermissions: (enabled: boolean) => void;
  /** Load developer preferences from Gateway config file */
  loadDeveloperPreferences: () => Promise<void>;

  // CLI Tool Paths (custom user-configured paths)
  pythonPath: string;
  setPythonPath: (path: string) => void;
  gitPath: string;
  setGitPath: (path: string) => void;
  ghPath: string;
  setGhPath: (path: string) => void;
  claudePath: string;
  setClaudePath: (path: string) => void;
  codexPath: string;
  setCodexPath: (path: string) => void;
  aiderPath: string;
  setAiderPath: (path: string) => void;
  goosePath: string;
  setGoosePath: (path: string) => void;
  clinePath: string;
  setClinePath: (path: string) => void;
  continuePath: string;
  setContinuePath: (path: string) => void;
  cursorPath: string;
  setCursorPath: (path: string) => void;
  vibenPath: string;
  setVibenPath: (path: string) => void;

  // CLI Tools Detection Cache
  cliToolsCache: CliToolsCache;
  setCliToolsCache: (data: CliToolsInfo) => void;
  clearCliToolsCache: () => void;
}

// Generate unique ID
const generateId = () => `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Default shortcuts
const DEFAULT_SHORTCUTS = {
  sendMessage: "Enter",
  screenshot: "Ctrl+Cmd+A",
  lock: "Cmd+L",
  showHideWindow: "Shift+Cmd+W",
  createTask: "Shift+Cmd+J",
  newTab: "Cmd+T",
  closeTab: "Cmd+W",
  reopenClosedTab: "Cmd+Shift+T",
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Python
      selectedPython: null,
      setSelectedPython: (python) => set({ selectedPython: python }),

      // Providers
      providers: DEFAULT_PROVIDERS,
      setProviderApiKey: (id, hasKey) =>
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, hasApiKey: hasKey } : p
          ),
        })),
      getAvailableProviders: () =>
        get().providers.filter((p) => !p.requiresApiKey || p.hasApiKey),
      updateProvidersFromCli: (installedSources) => {
        // Update providers based on CLI output
        // This merges installed sources with default providers
        set((state) => {
          const newProviders = [...state.providers];

          // Mark sources as installed and update info
          for (const source of installedSources) {
            const existing = newProviders.find((p) => p.id === source.name);
            if (existing) {
              // Source already in defaults, keep it
              continue;
            }
            // New source from plugin - add it
            newProviders.push({
              id: source.name,
              name: source.name.charAt(0).toUpperCase() + source.name.slice(1).replace(/_/g, ' '),
              category: source.provider as 'free' | 'api_key' | 'institutional',
              requiresApiKey: false,
              description: `${source.provider} source`,
            });
          }

          return { providers: newProviders };
        });
      },

      // API Keys
      apiKeys: {},
      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      // MCP Servers
      mcpServers: [],
      addMcpServer: (server) => {
        const id = generateId();
        // Ensure port has a default value for non-stdio transports
        const port = server.port ?? (server.transport === "stdio" ? undefined : 3000);
        const newServer: McpServerInstance = {
          ...server,
          id,
          port,
          status: "stopped",
          apiKeys: [],
        };
        set((state) => ({
          mcpServers: [...state.mcpServers, newServer],
        }));
        return id;
      },
      updateMcpServer: (id, updates) =>
        set((state) => ({
          mcpServers: state.mcpServers.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
      deleteMcpServer: (id) =>
        set((state) => ({
          mcpServers: state.mcpServers.filter((s) => s.id !== id),
          // Also remove any agent assignments to this server
          agentAssignments: state.agentAssignments.filter((a) => a.serverId !== id),
        })),
      getMcpServer: (id) => get().mcpServers.find((s) => s.id === id),
      setMcpServerStatus: (id, status, pid, error) =>
        set((state) => ({
          mcpServers: state.mcpServers.map((s) =>
            s.id === id ? { ...s, status, pid: status === "stopped" ? undefined : pid } : s
          ),
          // Also update the status cache
          mcpServerStatuses: {
            ...state.mcpServerStatuses,
            [id]: {
              status,
              lastChecked: Date.now(),
              error,
            },
          },
        })),
      addServerApiKey: (serverId, apiKey) =>
        set((state) => ({
          mcpServers: state.mcpServers.map((s) =>
            s.id === serverId
              ? { ...s, apiKeys: [...s.apiKeys, apiKey] }
              : s
          ),
        })),
      deleteServerApiKey: (serverId, keyId) =>
        set((state) => ({
          mcpServers: state.mcpServers.map((s) =>
            s.id === serverId
              ? { ...s, apiKeys: s.apiKeys.filter((k) => k.id !== keyId) }
              : s
          ),
        })),

      // MCP Server Status Cache
      mcpServerStatuses: {},
      setMcpServerStatusInfo: (id, info) =>
        set((state) => ({
          mcpServerStatuses: {
            ...state.mcpServerStatuses,
            [id]: info,
          },
        })),
      getMcpServerStatusInfo: (id) => get().mcpServerStatuses[id],
      clearMcpServerStatuses: () => set({ mcpServerStatuses: {} }),

      // Agent Assignments
      agentAssignments: [],
      setAgentAssignment: (agentId, serverId, apiKeyId) =>
        set((state) => {
          const existing = state.agentAssignments.find((a) => a.agentId === agentId);
          if (existing) {
            return {
              agentAssignments: state.agentAssignments.map((a) =>
                a.agentId === agentId ? { agentId, serverId, apiKeyId } : a
              ),
            };
          }
          return {
            agentAssignments: [...state.agentAssignments, { agentId, serverId, apiKeyId }],
          };
        }),
      removeAgentAssignment: (agentId) =>
        set((state) => ({
          agentAssignments: state.agentAssignments.filter((a) => a.agentId !== agentId),
        })),
      getAgentAssignment: (agentId) =>
        get().agentAssignments.find((a) => a.agentId === agentId),

      // Legacy MCP Config (single server mode)
      mcpTransport: "sse",
      mcpPort: 3000,
      downloadPath: "~/Downloads/viben",
      setMcpTransport: (transport) => set({ mcpTransport: transport }),
      setMcpPort: (port) => set({ mcpPort: port }),
      setDownloadPath: (path) => set({ downloadPath: path }),
      // Legacy: returns all available providers (free + has API key)
      getEnabledSourceIds: () =>
        get()
          .providers.filter((p) => !p.requiresApiKey || p.hasApiKey)
          .map((p) => p.id),

      // Statistics
      totalSearches: 0,
      incrementSearches: () =>
        set((state) => ({ totalSearches: state.totalSearches + 1 })),

      // Theme
      theme: "system",
      setTheme: (theme) => set({ theme }),

      // Language
      language: "en",
      setLanguage: (lang) => set({ language: lang }),

      // Preferences
      alwaysShowTextDirection: false,
      setAlwaysShowTextDirection: (value) => set({ alwaysShowTextDirection: value }),
      weekStartsOnMonday: true,
      setWeekStartsOnMonday: (value) => set({ weekStartsOnMonday: value }),
      dateFormat: "relative",
      setDateFormat: (format) => set({ dateFormat: format }),
      autoSetTimezone: true,
      setAutoSetTimezone: (value) => set({ autoSetTimezone: value }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      setTimezone: (timezone) => set({ timezone }),

      // Setup Banner
      setupBannerDismissed: false,
      setSetupBannerDismissed: (dismissed) => set({ setupBannerDismissed: dismissed }),

      // Setup Status
      setupStatus: null,
      setSetupStatus: (isComplete) =>
        set({
          setupStatus: {
            isComplete,
            lastChecked: Date.now(),
          },
        }),
      shouldCheckSetup: () => {
        const status = get().setupStatus;
        if (!status) return true; // Never checked before
        const fiveMinutes = 5 * 60 * 1000;
        return Date.now() - status.lastChecked > fiveMinutes; // Re-check every 5 minutes
      },

      // Inspector State
      inspectorSelectedServerId: null,
      inspectorConnectionStatus: "disconnected",
      inspectorNotifications: [],
      inspectorHistory: [],
      setInspectorSelectedServerId: (id) => set({ inspectorSelectedServerId: id }),
      setInspectorConnectionStatus: (status) => set({ inspectorConnectionStatus: status }),
      addInspectorNotification: (notification) =>
        set((state) => ({
          inspectorNotifications: [
            {
              ...notification,
              id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date(),
            },
            ...state.inspectorNotifications,
          ].slice(0, 100), // Keep max 100 notifications
        })),
      removeInspectorNotification: (id) =>
        set((state) => ({
          inspectorNotifications: state.inspectorNotifications.filter((n) => n.id !== id),
        })),
      clearInspectorNotifications: () => set({ inspectorNotifications: [] }),
      addInspectorHistory: (entry) =>
        set((state) => ({
          inspectorHistory: [
            {
              ...entry,
              id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date(),
            },
            ...state.inspectorHistory,
          ].slice(0, 100), // Keep max 100 history entries
        })),
      removeInspectorHistory: (id) =>
        set((state) => ({
          inspectorHistory: state.inspectorHistory.filter((h) => h.id !== id),
        })),
      clearInspectorHistory: () => set({ inspectorHistory: [] }),

      // Onboarding
      onboardingCompleted: false,
      setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),

      // Shortcuts
      shortcuts: { ...DEFAULT_SHORTCUTS },
      showHideWindowScope: "all",
      setShortcut: (key, value) =>
        set((state) => ({
          shortcuts: { ...state.shortcuts, [key]: value },
        })),
      setShowHideWindowScope: (scope) => set({ showHideWindowScope: scope }),
      resetShortcuts: () =>
        set({
          shortcuts: { ...DEFAULT_SHORTCUTS },
          showHideWindowScope: "all",
        }),

      // Developer Tools (synced to ~/.viben/config.yaml via Gateway)
      preferredIDE: "vscode",
      setPreferredIDE: (ide) => {
        set({ preferredIDE: ide });
        // Sync to Gateway in background
        getGatewayClient().setPreferredIDE(ide).catch((err) => {
          console.error("Failed to sync preferred IDE to config:", err);
        });
      },
      preferredTerminal: "system",
      setPreferredTerminal: (terminal) => {
        set({ preferredTerminal: terminal });
        // Sync to Gateway in background
        getGatewayClient().setPreferredTerminal(terminal).catch((err) => {
          console.error("Failed to sync preferred terminal to config:", err);
        });
      },
      dangerouslySkipPermissions: false,
      setDangerouslySkipPermissions: (enabled) => {
        set({ dangerouslySkipPermissions: enabled });
        // Sync to Gateway in background
        getGatewayClient().updateDeveloperPreferences({ dangerously_skip_permissions: enabled }).catch((err) => {
          console.error("Failed to sync dangerously_skip_permissions to config:", err);
        });
      },
      loadDeveloperPreferences: async () => {
        try {
          const client = getGatewayClient();
          const prefs = await client.getDeveloperPreferences();
          // Update store with values from config file (without triggering sync back)
          set({
            ...(prefs.preferred_ide && { preferredIDE: prefs.preferred_ide }),
            ...(prefs.preferred_terminal && { preferredTerminal: prefs.preferred_terminal }),
            ...(prefs.dangerously_skip_permissions !== undefined && { dangerouslySkipPermissions: prefs.dangerously_skip_permissions }),
          });
        } catch (err) {
          console.error("Failed to load developer preferences from config:", err);
        }
      },

      // CLI Tool Paths
      pythonPath: "",
      setPythonPath: (path) => set({ pythonPath: path }),
      gitPath: "",
      setGitPath: (path) => set({ gitPath: path }),
      ghPath: "",
      setGhPath: (path) => set({ ghPath: path }),
      claudePath: "",
      setClaudePath: (path) => set({ claudePath: path }),
      codexPath: "",
      setCodexPath: (path) => set({ codexPath: path }),
      aiderPath: "",
      setAiderPath: (path) => set({ aiderPath: path }),
      goosePath: "",
      setGoosePath: (path) => set({ goosePath: path }),
      clinePath: "",
      setClinePath: (path) => set({ clinePath: path }),
      continuePath: "",
      setContinuePath: (path) => set({ continuePath: path }),
      cursorPath: "",
      setCursorPath: (path) => set({ cursorPath: path }),
      vibenPath: "",
      setVibenPath: (path) => set({ vibenPath: path }),

      // CLI Tools Detection Cache
      cliToolsCache: { data: null, timestamp: 0 },
      setCliToolsCache: (data) => set({ cliToolsCache: { data, timestamp: Date.now() } }),
      clearCliToolsCache: () => set({ cliToolsCache: { data: null, timestamp: 0 } }),
    }),
    {
      name: "viben-storage",
      // Note: mcpServers and mcpServerStatuses are NOT persisted to localStorage
      // They are synced with Gateway's ~/.viben/mcp-servers.json via use-store-sync.ts
      // Merge persisted state with default state to handle new fields
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState>;
        return {
          ...currentState,
          ...persisted,
          // Merge shortcuts with defaults to handle new shortcut keys
          shortcuts: {
            ...DEFAULT_SHORTCUTS,
            ...(persisted.shortcuts || {}),
          },
        };
      },
      partialize: (state) => ({
        selectedPython: state.selectedPython,
        providers: state.providers,
        apiKeys: state.apiKeys,
        // mcpServers: removed - synced with Gateway file
        agentAssignments: state.agentAssignments,
        mcpTransport: state.mcpTransport,
        mcpPort: state.mcpPort,
        downloadPath: state.downloadPath,
        totalSearches: state.totalSearches,
        theme: state.theme,
        language: state.language,
        alwaysShowTextDirection: state.alwaysShowTextDirection,
        weekStartsOnMonday: state.weekStartsOnMonday,
        dateFormat: state.dateFormat,
        autoSetTimezone: state.autoSetTimezone,
        timezone: state.timezone,
        setupBannerDismissed: state.setupBannerDismissed,
        setupStatus: state.setupStatus,
        onboardingCompleted: state.onboardingCompleted,
        shortcuts: state.shortcuts,
        showHideWindowScope: state.showHideWindowScope,
        preferredIDE: state.preferredIDE,
        preferredTerminal: state.preferredTerminal,
        dangerouslySkipPermissions: state.dangerouslySkipPermissions,
        pythonPath: state.pythonPath,
        gitPath: state.gitPath,
        ghPath: state.ghPath,
        claudePath: state.claudePath,
        codexPath: state.codexPath,
        aiderPath: state.aiderPath,
        goosePath: state.goosePath,
        clinePath: state.clinePath,
        continuePath: state.continuePath,
        cursorPath: state.cursorPath,
        vibenPath: state.vibenPath,
        cliToolsCache: state.cliToolsCache,
      }),
    }
  )
);
