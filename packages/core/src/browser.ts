/**
 * Browser-safe exports from @viben/core
 *
 * This module exports only types and pure functions that work in browsers.
 * Use this in frontend/browser environments (e.g., Tauri webview).
 *
 * For Node.js environments (CLI), use the main index.ts instead.
 */

// Re-export all types (types are always browser-safe)
export * from "./types";

// Re-export known models (pure data, no file I/O)
export {
  KNOWN_MODELS,
  DEFAULT_ALIASES,
  getKnownModel,
  getModelsByProvider,
} from "./models/known-models";
export type { KnownModel } from "./models/known-models";

// Re-export provider types
export type {
  ProviderEntry,
  ProvidersFile,
} from "./providers/types";

// Re-export model types
export type {
  ModelsFile,
  ModelConfigEntry,
} from "./models/types";

// Re-export agent types
export type {
  AgentConfigFile,
  SessionFile,
} from "./agents/types";

// Re-export mcp types
export type {
  McpServersFile,
  McpServerEntry,
  InstalledMcpFile,
  InstalledMcpEntry,
} from "./mcp/types";

// Re-export skill types
export type {
  InstalledSkillsFile,
  InstalledSkillEntry,
  SkillMetadata,
} from "./skills/types";
