/**
 * Shared exports from @viben/core
 *
 * This module exports only types and pure functions that work in both
 * browser and Node.js environments. Use this for shared code.
 *
 * For Node.js-only features (file I/O, CLI), use the main index.ts instead.
 */

// Re-export all types (types are always browser-safe)
// This includes ExecutorType, AgentTypeInfo, AGENT_TYPES, getAgentTypeInfo
export * from "./types";

// Re-export model aliases (pure data, no file I/O)
export { DEFAULT_ALIASES } from "./models/known-models";

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
  SkillTarget,
  AvailableSkill,
  AgentSkillConfig,
} from "./skill/ops/types";

// Re-export cron types (browser-safe, only primitives)
export type {
  JobStatus,
  CronJobType,
  CronNotificationSettings,
  CronJob,
  CreateCronJob,
  UpdateCronJob,
  CronExecutionLog,
} from "./cron/ops/types";

// Re-export channel types (browser-safe, only primitives)
export type {
  ChannelType,
  BindingType,
  AgentBinding,
  NotificationMode,
} from "./channels/types";
