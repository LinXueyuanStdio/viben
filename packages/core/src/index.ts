/**
 * @viben/core - Shared core library for Viben
 *
 * This library provides configuration management, agent/provider/model management
 * for both the CLI and Desktop applications.
 */

// Types
export * from "./types";

// Config management
export {
  ConfigManager,
  ProvidersConfigManager,
  ModelsConfigManager,
  configManager,
  providersConfigManager,
  modelsConfigManager,
  getStateDir,
  getConfigPath,
  getProvidersPath,
  getModelsPath,
  getAgentsDir,
  getAgentDir,
  getAgentConfigPath,
  getAgentMcpServersPath,
  getAgentSkillsDir,
  getAgentMemoryDir,
  getAgentSessionsDir,
  getTemplatesDir,
  getTemplateDir,
  getSharedMcpDir,
  getSharedSkillsDir,
  readYaml,
  writeYaml,
  readJson,
  writeJson,
  ensureDir,
  fileExists,
} from "./config";

// Agent management
export {
  AgentManager,
  agentManager,
  type AgentConfigFile,
  type SessionFile,
} from "./agents";

// Provider management
export {
  ProviderManager,
  providerManager,
  type ProviderEntry,
  type ProvidersFile,
} from "./providers";

// Model management
export {
  ModelManager,
  modelManager,
  KNOWN_MODELS,
  DEFAULT_ALIASES,
  getKnownModel,
  getModelsByProvider,
  type ModelsFile,
  type ModelConfigEntry,
  type KnownModel,
} from "./models";

// MCP management
export {
  McpManager,
  mcpManager,
  type McpServersFile,
  type McpServerEntry,
  type InstalledMcpFile,
  type InstalledMcpEntry,
} from "./mcp";

// Skills management
export {
  SkillsManager,
  skillsManager,
  type InstalledSkillsFile,
  type InstalledSkillEntry,
  type SkillMetadata,
} from "./skills";

// Channels management
export {
  sendChannelMessage,
  sendTestMessage,
  testChannel,
  sendTelegramMessage,
  testTelegramChannel,
  sendDiscordMessage,
  testDiscordChannel,
  sendFeishuMessage,
  testFeishuChannel,
  sendWhatsAppMessage,
  testWhatsAppChannel,
  type ChannelType,
  type ChannelConfig,
  type TelegramChannelConfig,
  type DiscordChannelConfig,
  type FeishuChannelConfig,
  type WhatsAppChannelConfig,
  type ChannelsFile,
  type SendMessageOptions,
  type SendMessageResult,
  type TestChannelResult,
} from "./channels";

/**
 * Initialize all core managers
 * Call this once at application startup
 */
export async function initializeCore(): Promise<void> {
  const { configManager } = await import("./config");
  const { agentManager } = await import("./agents");
  const { mcpManager } = await import("./mcp");
  const { skillsManager } = await import("./skills");

  await configManager.initialize();
  await agentManager.initialize();
  await mcpManager.initialize();
  await skillsManager.initialize();
}
