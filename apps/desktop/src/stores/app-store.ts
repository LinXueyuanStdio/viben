import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PythonInfo, Provider, McpServerInstance, ServiceApiKey, AgentMcpAssignment } from "@/types";

// Provider definitions with all 18 sources
// Note: enabled is removed - providers only track installation/API key status
// Source selection is now per-server in McpServerInstance.enabledSources
const DEFAULT_PROVIDERS: Provider[] = [
  // Free & Open Access
  { id: "arxiv", name: "arXiv", category: "free", requiresApiKey: false, description: "Pre-prints in physics, mathematics, computer science" },
  { id: "pubmed", name: "PubMed", category: "free", requiresApiKey: false, description: "Biomedical literature from MEDLINE" },
  { id: "pmc", name: "PMC", category: "free", requiresApiKey: false, description: "Full-text archive of biomedical articles" },
  { id: "biorxiv", name: "bioRxiv", category: "free", requiresApiKey: false, description: "Pre-prints in biology" },
  { id: "medrxiv", name: "medRxiv", category: "free", requiresApiKey: false, description: "Pre-prints in health sciences" },
  { id: "semantic", name: "Semantic Scholar", category: "free", requiresApiKey: false, description: "AI-powered research tool" },
  { id: "core", name: "CORE", category: "free", requiresApiKey: false, description: "World's largest collection of open access papers" },
  { id: "crossref", name: "Crossref", category: "free", requiresApiKey: false, description: "DOI registration agency metadata" },
  { id: "google_scholar", name: "Google Scholar", category: "free", requiresApiKey: false, description: "Google's academic search" },
  { id: "iacr", name: "IACR", category: "free", requiresApiKey: false, description: "Cryptology ePrint Archive" },
  // API Key Required
  { id: "sciencedirect", name: "ScienceDirect", category: "api_key", requiresApiKey: true, hasApiKey: false, description: "Elsevier's platform for peer-reviewed literature" },
  { id: "springer", name: "Springer", category: "api_key", requiresApiKey: true, hasApiKey: false, description: "Scientific, technical and medical publications" },
  { id: "ieee", name: "IEEE Xplore", category: "api_key", requiresApiKey: true, hasApiKey: false, description: "IEEE and IET technical literature" },
  { id: "scopus", name: "Scopus", category: "api_key", requiresApiKey: true, hasApiKey: false, description: "Elsevier's abstract and citation database" },
  // Institutional Access
  { id: "acm", name: "ACM Digital Library", category: "institutional", requiresApiKey: false, description: "Computing and IT research" },
  { id: "wos", name: "Web of Science", category: "institutional", requiresApiKey: false, description: "Clarivate's citation database" },
  { id: "jstor", name: "JSTOR", category: "institutional", requiresApiKey: false, description: "Digital library of academic journals" },
  { id: "researchgate", name: "ResearchGate", category: "institutional", requiresApiKey: false, description: "Social network for researchers" },
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

  // API Keys stored separately (for security)
  apiKeys: ApiKeys;
  setApiKey: (provider: string, key: string | undefined) => void;

  // MCP Servers (multiple instances)
  mcpServers: McpServerInstance[];
  addMcpServer: (server: Omit<McpServerInstance, "id" | "status" | "apiKeys">) => string;
  updateMcpServer: (id: string, updates: Partial<McpServerInstance>) => void;
  deleteMcpServer: (id: string) => void;
  getMcpServer: (id: string) => McpServerInstance | undefined;
  setMcpServerStatus: (id: string, status: "stopped" | "running", pid?: number) => void;
  addServerApiKey: (serverId: string, apiKey: ServiceApiKey) => void;
  deleteServerApiKey: (serverId: string, keyId: string) => void;

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
}

// Generate unique ID
const generateId = () => `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
      setMcpServerStatus: (id, status, pid) =>
        set((state) => ({
          mcpServers: state.mcpServers.map((s) =>
            s.id === id ? { ...s, status, pid } : s
          ),
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
      downloadPath: "~/Downloads/browse-mcp",
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
    }),
    {
      name: "browse-mcp-storage",
      partialize: (state) => ({
        selectedPython: state.selectedPython,
        providers: state.providers,
        apiKeys: state.apiKeys,
        mcpServers: state.mcpServers,
        agentAssignments: state.agentAssignments,
        mcpTransport: state.mcpTransport,
        mcpPort: state.mcpPort,
        downloadPath: state.downloadPath,
        totalSearches: state.totalSearches,
        theme: state.theme,
        language: state.language,
        setupBannerDismissed: state.setupBannerDismissed,
        setupStatus: state.setupStatus,
      }),
    }
  )
);
