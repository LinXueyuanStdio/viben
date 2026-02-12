/**
 * Viben CLI Library Modules
 *
 * Re-exports all lib modules for convenient importing.
 *
 * Note: Core functionality (agents, executors, cron, providers, models, channels)
 * is available via NAPI bindings in ./native.ts
 */

// Config utilities
export * from './config';

// Scope utilities (excluding getStateDir which conflicts with native)
export {
  WORKSPACE_DIR,
  CONFIG_FILE,
  getGlobalConfigDir,
  GLOBAL_CONFIG_DIR,
  findWorkspaceRoot,
  getWorkspaceDir,
  resolveScope,
  getConfigPathForScope,
  ensureDir,
  type ResolveScopeOptions,
} from './scope';

// Output utilities
export * from './output';

// Native NAPI bindings
export * from './native';

// Channel utilities (avoiding conflict with native Channel type)
export {
  ChannelManager,
  type ChannelConfig as CliChannelConfig,
  type ChannelsConfig as CliChannelsConfig,
} from './channels';

// Model utilities
export * from './models';

// Skills utilities
export * from './skills';

// Workspace utilities
export * from './workspace';

// Service management
export * from './services';
