/**
 * Onboarding library exports
 */

// Runtime policies
export * from "./runtime-policies";

// Polling utilities
export * from "./polling";

// Error types
export * from "./installer-issues";

// Gateway diagnostics
export * from "./gateway-diagnostics";

// Bootstrap diagnostics (failure views)
export * from "./bootstrap-diagnostics";

// Version policy
export * from "./version-policy";

// Node.js installer issues
export * from "./node-installer-issues";

// Environment check policy
export * from "./env-check-policy";

// CLI discovery (exclude compareVersions to avoid conflict with version-policy)
export {
  type CliOwnershipState,
  type CliDiscoveryResult,
  type CliSearchLocation,
  type BaselineBackup,
  CLI_SEARCH_LOCATIONS,
  MIN_CLI_VERSION,
  resolvePathVariables,
  parseCliVersion,
  isVersionSatisfied,
  inferCliOwnership,
  createBaselineBackupDescription,
} from "./cli-discovery";

// Cancellation support
export * from "./cancellation";

// DAG engine for environment check
export * from "./check-dag";
