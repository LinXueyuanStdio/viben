/**
 * Path resolution utilities for MCP packages
 *
 * Pure functions, no side effects.
 */
import { join } from "node:path";
import { getSharedMcpDir } from "../../config/paths";
import type { McpTarget } from "./types";

// =============================================================================
// Base Directory Paths
// =============================================================================

/**
 * Get the project-level MCP directory path
 * Default: .viben/mcp
 */
export function getProjectMcpDir(): string {
  return join(process.cwd(), ".viben", "mcp");
}

/**
 * Get the global MCP directory path
 * Default: ~/.viben/mcp
 */
export function getGlobalMcpDir(): string {
  return getSharedMcpDir();
}

// =============================================================================
// MCP-Specific Paths
// =============================================================================

/**
 * Get the directory path for a specific MCP package
 *
 * @param target - Target location type
 * @param name - Name of the MCP package
 * @returns Path to the MCP directory
 */
export function getMcpDir(target: McpTarget, name: string): string {
  const targetDir = resolveTargetDir(target);
  return join(targetDir, name);
}

/**
 * Get the path to installed.yaml in a target directory
 *
 * @param targetDir - Target directory path
 * @returns Path to installed.yaml
 */
export function getInstalledYamlPath(targetDir: string): string {
  return join(targetDir, "installed.yaml");
}

// =============================================================================
// Target Resolution
// =============================================================================

/**
 * Resolve target directory based on target type
 *
 * @param target - Target location type
 * @returns Resolved directory path
 */
export function resolveTargetDir(target: McpTarget): string {
  switch (target) {
    case "project":
      return getProjectMcpDir();
    case "global":
      return getGlobalMcpDir();
    default:
      throw new Error(`Unknown target: ${target}`);
  }
}

/**
 * Validate target options
 *
 * @param target - Target location type
 * @returns Object with isValid and error message
 */
export function validateTargetOptions(target: McpTarget): {
  isValid: boolean;
  error?: string;
} {
  if (target !== "project" && target !== "global") {
    return { isValid: false, error: `Invalid target: ${target}` };
  }
  return { isValid: true };
}
