/**
 * MCP ops module
 *
 * Entry point for MCP package management operations.
 */

// Types
export * from "./types";

// Path utilities
export * from "./paths";

// CRUD operations
export {
  installMcp,
  uninstallMcp,
  listMcps,
  getMcp,
  parseInstallSpec,
} from "./crud";

// Registry operations
export {
  searchMarketplace,
  getFromMarketplace,
  downloadFromMarketplace,
} from "./registry";
