/**
 * Git-style Configuration Manager
 *
 * Provides git-like config get/set/list/unset operations with dot notation keys.
 * Supports both global (~/.viben/config.yaml) and workspace (.viben/config.yaml) configs.
 *
 * Key format examples:
 * - `settings.editor` -> config.settings.editor
 * - `mcp.enabled[0]` -> config.mcp.enabled[0]
 * - `agents.default` -> config.agents.default
 */
import { join } from "node:path";
import { getConfigPath } from "./paths";
import { readYaml, writeYaml, fileExists } from "./yaml";

/**
 * Result of a config list operation
 */
export interface ConfigEntry {
  key: string;
  value: unknown;
  origin?: "global" | "workspace";
}

/**
 * Options for config operations
 */
export interface ConfigOptions {
  /** Use global config (~/.viben/config.yaml) */
  global?: boolean;
  /** Custom workspace path (defaults to cwd) */
  workspacePath?: string;
}

/**
 * Parse a dot notation key into path segments.
 * Handles array index notation like `mcp.enabled[0]`.
 *
 * @param key - Dot notation key (e.g., "settings.editor", "mcp.enabled[0]")
 * @returns Array of path segments
 *
 * @example
 * parseKey("settings.editor") // ["settings", "editor"]
 * parseKey("mcp.enabled[0]") // ["mcp", "enabled", 0]
 * parseKey("a.b[1].c[2]") // ["a", "b", 1, "c", 2]
 */
export function parseKey(key: string): (string | number)[] {
  if (!key || key.trim() === "") {
    return [];
  }

  const segments: (string | number)[] = [];
  const parts = key.split(".");

  for (const part of parts) {
    // Match array indices like "enabled[0]" or "items[123]"
    const arrayMatch = part.match(/^([^\[]+)(?:\[(\d+)\])+$/);

    if (arrayMatch) {
      // Add the base name
      segments.push(arrayMatch[1]);

      // Extract all array indices from the part using exec loop
      const indexRegex = /\[(\d+)\]/g;
      let match: RegExpExecArray | null;
      while ((match = indexRegex.exec(part)) !== null) {
        segments.push(parseInt(match[1], 10));
      }
    } else if (/^\d+$/.test(part)) {
      // Pure numeric string - could be array index in dot notation
      segments.push(parseInt(part, 10));
    } else {
      segments.push(part);
    }
  }

  return segments;
}

/**
 * Get a value from an object using path segments.
 *
 * @param obj - Object to get value from
 * @param segments - Path segments from parseKey
 * @returns Value at the path, or undefined if not found
 */
export function getValueByPath(
  obj: unknown,
  segments: (string | number)[]
): unknown {
  if (segments.length === 0) {
    return obj;
  }

  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof segment === "number") {
      // Array access
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[segment];
    } else {
      // Object access
      if (typeof current !== "object" || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current;
}

/**
 * Set a value in an object using path segments.
 * Creates intermediate objects/arrays as needed.
 *
 * @param obj - Object to set value in (will be mutated)
 * @param segments - Path segments from parseKey
 * @param value - Value to set
 * @returns The modified object
 */
export function setValueByPath(
  obj: Record<string, unknown>,
  segments: (string | number)[],
  value: unknown
): Record<string, unknown> {
  if (segments.length === 0) {
    return obj;
  }

  let current: unknown = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];

    if (typeof segment === "number") {
      // Current is an array index
      if (!Array.isArray(current)) {
        throw new Error(`Cannot set index ${segment} on non-array`);
      }
      // Ensure the array has enough elements
      while (current.length <= segment) {
        current.push(undefined);
      }
      // Create next level if needed
      if (current[segment] === null || current[segment] === undefined) {
        current[segment] = typeof nextSegment === "number" ? [] : {};
      }
      current = current[segment];
    } else {
      // Current is an object key
      if (typeof current !== "object" || current === null) {
        throw new Error(`Cannot set key ${segment} on non-object`);
      }
      const obj = current as Record<string, unknown>;
      // Create next level if needed
      if (obj[segment] === null || obj[segment] === undefined) {
        obj[segment] = typeof nextSegment === "number" ? [] : {};
      }
      current = obj[segment];
    }
  }

  // Set the final value
  const lastSegment = segments[segments.length - 1];
  if (typeof lastSegment === "number") {
    if (!Array.isArray(current)) {
      throw new Error(`Cannot set index ${lastSegment} on non-array`);
    }
    while (current.length <= lastSegment) {
      current.push(undefined);
    }
    current[lastSegment] = value;
  } else {
    if (typeof current !== "object" || current === null) {
      throw new Error(`Cannot set key ${lastSegment} on non-object`);
    }
    (current as Record<string, unknown>)[lastSegment] = value;
  }

  return obj;
}

/**
 * Delete a value from an object using path segments.
 *
 * @param obj - Object to delete value from (will be mutated)
 * @param segments - Path segments from parseKey
 * @returns True if the key was deleted, false if not found
 */
export function deleteValueByPath(
  obj: Record<string, unknown>,
  segments: (string | number)[]
): boolean {
  if (segments.length === 0) {
    return false;
  }

  let current: unknown = obj;

  // Navigate to the parent of the target
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];

    if (typeof segment === "number") {
      if (!Array.isArray(current)) {
        return false;
      }
      if (segment >= current.length) {
        return false;
      }
      current = current[segment];
    } else {
      if (typeof current !== "object" || current === null) {
        return false;
      }
      const obj = current as Record<string, unknown>;
      if (!(segment in obj)) {
        return false;
      }
      current = obj[segment];
    }
  }

  // Delete the final key
  const lastSegment = segments[segments.length - 1];
  if (typeof lastSegment === "number") {
    if (!Array.isArray(current)) {
      return false;
    }
    if (lastSegment >= current.length) {
      return false;
    }
    current.splice(lastSegment, 1);
    return true;
  } else {
    if (typeof current !== "object" || current === null) {
      return false;
    }
    const obj = current as Record<string, unknown>;
    if (!(lastSegment in obj)) {
      return false;
    }
    delete obj[lastSegment];
    return true;
  }
}

/**
 * Flatten an object into dot notation key-value pairs.
 *
 * @param obj - Object to flatten
 * @param prefix - Prefix for keys (used in recursion)
 * @returns Array of ConfigEntry objects
 */
export function flattenObject(
  obj: unknown,
  prefix = "",
  origin?: "global" | "workspace"
): ConfigEntry[] {
  const entries: ConfigEntry[] = [];

  if (obj === null || obj === undefined) {
    return entries;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const key = prefix ? `${prefix}[${i}]` : `[${i}]`;
      const value = obj[i];

      if (typeof value === "object" && value !== null) {
        entries.push(...flattenObject(value, key, origin));
      } else {
        entries.push({ key, value, origin });
      }
    }
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;

      if (typeof v === "object" && v !== null) {
        entries.push(...flattenObject(v, key, origin));
      } else {
        entries.push({ key, value: v, origin });
      }
    }
  }

  return entries;
}

/**
 * Parse a string value into appropriate type.
 * Attempts to parse as number, boolean, null, or keeps as string.
 *
 * @param value - String value to parse
 * @returns Parsed value
 */
export function parseValue(value: string): unknown {
  // Handle empty string
  if (value === "") {
    return "";
  }

  // Handle null
  if (value === "null") {
    return null;
  }

  // Handle booleans
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  // Handle numbers (integers and floats)
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  // Handle JSON arrays and objects
  if ((value.startsWith("[") && value.endsWith("]")) ||
      (value.startsWith("{") && value.endsWith("}"))) {
    try {
      return JSON.parse(value);
    } catch {
      // Not valid JSON, return as string
    }
  }

  // Return as string
  return value;
}

/**
 * Get the workspace config path.
 * Looks for .viben/config.yaml in the workspace directory.
 *
 * @param workspacePath - Path to the workspace root
 * @returns Path to workspace config file
 */
export function getWorkspaceConfigPath(workspacePath: string): string {
  return join(workspacePath, ".viben", "config.yaml");
}

/**
 * GitStyleConfigManager provides git-like configuration management.
 */
export class GitStyleConfigManager {
  /**
   * Get a configuration value by key.
   *
   * @param key - Dot notation key (e.g., "settings.editor")
   * @param options - Config options (global vs workspace)
   * @returns Value at the key, or undefined if not found
   */
  async get(key: string, options: ConfigOptions = {}): Promise<unknown> {
    const configPath = this.resolveConfigPath(options);

    if (!fileExists(configPath)) {
      return undefined;
    }

    const config = await readYaml<Record<string, unknown>>(configPath);
    if (!config) {
      return undefined;
    }

    const segments = parseKey(key);
    return getValueByPath(config, segments);
  }

  /**
   * Set a configuration value by key.
   *
   * @param key - Dot notation key (e.g., "settings.editor")
   * @param value - Value to set (string will be parsed)
   * @param options - Config options (global vs workspace)
   */
  async set(key: string, value: unknown, options: ConfigOptions = {}): Promise<void> {
    const configPath = this.resolveConfigPath(options);

    // Load existing config or create empty object
    let config = await readYaml<Record<string, unknown>>(configPath);
    if (!config) {
      config = {};
    }

    // Parse string values
    const parsedValue = typeof value === "string" ? parseValue(value) : value;

    // Set the value
    const segments = parseKey(key);
    setValueByPath(config, segments, parsedValue);

    // Save config
    await writeYaml(configPath, config);
  }

  /**
   * List all configuration entries as flat key-value pairs.
   *
   * @param options - Config options (global vs workspace)
   * @returns Array of ConfigEntry objects
   */
  async list(options: ConfigOptions = {}): Promise<ConfigEntry[]> {
    const configPath = this.resolveConfigPath(options);
    const origin = options.global ? "global" : "workspace";

    if (!fileExists(configPath)) {
      return [];
    }

    const config = await readYaml<Record<string, unknown>>(configPath);
    if (!config) {
      return [];
    }

    return flattenObject(config, "", origin);
  }

  /**
   * Remove a configuration key.
   *
   * @param key - Dot notation key to remove
   * @param options - Config options (global vs workspace)
   * @returns True if key was removed, false if not found
   */
  async unset(key: string, options: ConfigOptions = {}): Promise<boolean> {
    const configPath = this.resolveConfigPath(options);

    if (!fileExists(configPath)) {
      return false;
    }

    const config = await readYaml<Record<string, unknown>>(configPath);
    if (!config) {
      return false;
    }

    const segments = parseKey(key);
    const deleted = deleteValueByPath(config, segments);

    if (deleted) {
      await writeYaml(configPath, config);
    }

    return deleted;
  }

  /**
   * Get the full configuration object.
   *
   * @param options - Config options (global vs workspace)
   * @returns Full config object or empty object if not found
   */
  async getAll(options: ConfigOptions = {}): Promise<Record<string, unknown>> {
    const configPath = this.resolveConfigPath(options);

    if (!fileExists(configPath)) {
      return {};
    }

    const config = await readYaml<Record<string, unknown>>(configPath);
    return config || {};
  }

  /**
   * Get merged configuration (workspace overrides global).
   * Returns entries with their origin marked.
   *
   * @param workspacePath - Path to the workspace root
   * @returns Array of ConfigEntry objects with merged values
   */
  async getMerged(workspacePath?: string): Promise<ConfigEntry[]> {
    // Get global config
    const globalEntries = await this.list({ global: true });

    // Get workspace config if path provided
    let workspaceEntries: ConfigEntry[] = [];
    if (workspacePath) {
      workspaceEntries = await this.list({
        global: false,
        workspacePath,
      });
    }

    // Merge: workspace overrides global
    const merged = new Map<string, ConfigEntry>();

    for (const entry of globalEntries) {
      merged.set(entry.key, entry);
    }

    for (const entry of workspaceEntries) {
      merged.set(entry.key, entry);
    }

    return Array.from(merged.values());
  }

  /**
   * Check if a configuration key exists.
   *
   * @param key - Dot notation key to check
   * @param options - Config options (global vs workspace)
   * @returns True if key exists
   */
  async has(key: string, options: ConfigOptions = {}): Promise<boolean> {
    const value = await this.get(key, options);
    return value !== undefined;
  }

  /**
   * Resolve the config file path based on options.
   *
   * @param options - Config options
   * @returns Path to config file
   */
  private resolveConfigPath(options: ConfigOptions): string {
    if (options.global) {
      return getConfigPath();
    }

    const workspacePath = options.workspacePath || process.cwd();
    return getWorkspaceConfigPath(workspacePath);
  }
}

// Export singleton instance
export const gitConfigManager = new GitStyleConfigManager();
