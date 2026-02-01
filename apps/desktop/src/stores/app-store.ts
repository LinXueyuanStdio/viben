import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PythonInfo, Provider, McpStatus } from "@/types";

// Provider definitions with all 18 sources
const DEFAULT_PROVIDERS: Provider[] = [
  // Free & Open Access
  { id: "arxiv", name: "arXiv", category: "free", enabled: true, requiresApiKey: false },
  { id: "pubmed", name: "PubMed", category: "free", enabled: true, requiresApiKey: false },
  { id: "pmc", name: "PMC", category: "free", enabled: true, requiresApiKey: false },
  { id: "biorxiv", name: "bioRxiv", category: "free", enabled: true, requiresApiKey: false },
  { id: "medrxiv", name: "medRxiv", category: "free", enabled: true, requiresApiKey: false },
  { id: "semantic", name: "Semantic Scholar", category: "free", enabled: true, requiresApiKey: false },
  { id: "core", name: "CORE", category: "free", enabled: false, requiresApiKey: false },
  { id: "crossref", name: "Crossref", category: "free", enabled: true, requiresApiKey: false },
  { id: "google_scholar", name: "Google Scholar", category: "free", enabled: true, requiresApiKey: false },
  { id: "iacr", name: "IACR", category: "free", enabled: true, requiresApiKey: false },
  // API Key Required
  { id: "sciencedirect", name: "ScienceDirect", category: "api_key", enabled: false, requiresApiKey: true, hasApiKey: false },
  { id: "springer", name: "Springer", category: "api_key", enabled: false, requiresApiKey: true, hasApiKey: false },
  { id: "ieee", name: "IEEE Xplore", category: "api_key", enabled: false, requiresApiKey: true, hasApiKey: false },
  { id: "scopus", name: "Scopus", category: "api_key", enabled: false, requiresApiKey: true, hasApiKey: false },
  // Institutional Access
  { id: "acm", name: "ACM Digital Library", category: "institutional", enabled: false, requiresApiKey: false },
  { id: "wos", name: "Web of Science", category: "institutional", enabled: false, requiresApiKey: false },
  { id: "jstor", name: "JSTOR", category: "institutional", enabled: false, requiresApiKey: false },
  { id: "researchgate", name: "ResearchGate", category: "institutional", enabled: false, requiresApiKey: false },
];

interface ApiKeys {
  semantic_scholar?: string;
  sciencedirect?: string;
  springer?: string;
  ieee?: string;
  scopus?: string;
  core?: string;
}

interface AppState {
  // Python
  selectedPython: PythonInfo | null;
  setSelectedPython: (python: PythonInfo | null) => void;

  // Providers
  providers: Provider[];
  setProviderEnabled: (id: string, enabled: boolean) => void;
  setProviderApiKey: (id: string, hasKey: boolean) => void;
  getEnabledProviders: () => Provider[];
  getEnabledSourceIds: () => string[];

  // API Keys stored separately (stored separately for security)
  apiKeys: ApiKeys;
  setApiKey: (provider: string, key: string | undefined) => void;

  // MCP Config
  mcpTransport: "stdio" | "sse" | "http";
  mcpPort: number;
  downloadPath: string;
  setMcpTransport: (transport: "stdio" | "sse" | "http") => void;
  setMcpPort: (port: number) => void;
  setDownloadPath: (path: string) => void;

  // Statistics
  totalSearches: number;
  incrementSearches: () => void;

  // Theme
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Language
  language: "en" | "zh";
  setLanguage: (lang: "en" | "zh") => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Python
      selectedPython: null,
      setSelectedPython: (python) => set({ selectedPython: python }),

      // Providers
      providers: DEFAULT_PROVIDERS,
      setProviderEnabled: (id, enabled) =>
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, enabled } : p
          ),
        })),
      setProviderApiKey: (id, hasKey) =>
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, hasApiKey: hasKey, enabled: hasKey ? p.enabled : false } : p
          ),
        })),
      getEnabledProviders: () => get().providers.filter((p) => p.enabled),
      getEnabledSourceIds: () =>
        get()
          .providers.filter((p) => p.enabled)
          .map((p) => p.id),

      // API Keys
      apiKeys: {},
      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      // MCP Config
      mcpTransport: "stdio",
      mcpPort: 3000,
      downloadPath: "~/Downloads/browse-mcp",
      setMcpTransport: (transport) => set({ mcpTransport: transport }),
      setMcpPort: (port) => set({ mcpPort: port }),
      setDownloadPath: (path) => set({ downloadPath: path }),

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
    }),
    {
      name: "browse-mcp-storage",
      partialize: (state) => ({
        selectedPython: state.selectedPython,
        providers: state.providers,
        apiKeys: state.apiKeys,
        mcpTransport: state.mcpTransport,
        mcpPort: state.mcpPort,
        downloadPath: state.downloadPath,
        totalSearches: state.totalSearches,
        theme: state.theme,
        language: state.language,
      }),
    }
  )
);
