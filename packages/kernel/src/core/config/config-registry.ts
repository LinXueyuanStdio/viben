/**
 * Config registry — declarative metadata for config fields.
 *
 * Each registered field describes its UI type, whether it can be hot-reloaded,
 * and whether it's safe to expose via the API. This drives:
 * - The API server's PATCH /api/config endpoint (validates + applies changes)
 * - Hot-reload: fields marked `hotReload: true` take effect immediately via
 *   ConfigManager's `config:changed` event, without requiring a restart
 * - Security: only `scope: "safe"` fields are exposed to the REST API
 */
import type { Config } from "./config.js";

/**
 * Metadata for a single config field, describing how it should be
 * displayed, validated, and applied at runtime.
 */
export interface ConfigFieldDef {
  /** Dot-path into the Config object (e.g. "logging.level"). */
  path: string;
  /** Human-readable label for UI display. */
  displayName: string;
  /** Grouping key for organizing fields in the editor (e.g. "agent", "logging"). */
  group: string;
  /** UI control type — determines validation and rendering. */
  type: "toggle" | "select" | "number" | "string";
  /** For "select" type: allowed values, either static or derived from current config. */
  options?: string[] | ((config: Config) => string[]);
  /** "safe" fields can be exposed via the API; "sensitive" fields require direct file access. */
  scope: "safe" | "sensitive";
  /** Whether changes to this field take effect without restarting the server. */
  hotReload: boolean;
}

/**
 * Static registry of all config fields that support programmatic access.
 * Fields not listed here can still exist in config.json but won't be
 * editable via the API or shown in the config UI.
 */
export const CONFIG_REGISTRY: ConfigFieldDef[] = [
  {
    path: "defaultAgent",
    displayName: "Default Agent",
    group: "agent",
    type: "select",
    options: (config) => {
      // Full agent list is managed by AgentCatalog at runtime, not config registry
      const current = config.defaultAgent;
      return current ? [current] : [];
    },
    scope: "safe",
    hotReload: true,
  },
  {
    path: "logging.level",
    displayName: "Log Level",
    group: "logging",
    type: "select",
    options: ["silent", "debug", "info", "warn", "error", "fatal"],
    scope: "safe",
    hotReload: true,
  },
  {
    path: "sessionStore.ttlDays",
    displayName: "Session Store TTL (days)",
    group: "storage",
    type: "number",
    scope: "safe",
    hotReload: true,
  },
  {
    path: "agentSwitch.labelHistory",
    displayName: "Label Agent in History",
    group: "agent",
    type: "toggle",
    scope: "safe",
    hotReload: true,
  },
];

/** Looks up a field definition by its dot-path. */
export function getFieldDef(path: string): ConfigFieldDef | undefined {
  return CONFIG_REGISTRY.find((f) => f.path === path);
}

/** Returns only fields safe to expose via the REST API. */
export function getSafeFields(): ConfigFieldDef[] {
  return CONFIG_REGISTRY.filter((f) => f.scope === "safe");
}

/** Checks whether a config field can be changed without restarting the server. */
export function isHotReloadable(path: string): boolean {
  const def = getFieldDef(path);
  return def?.hotReload ?? false;
}

/** Resolves select options — evaluates the function form against the current config if needed. */
export function resolveOptions(
  def: ConfigFieldDef,
  config: Config,
): string[] | undefined {
  if (!def.options) return undefined;
  return typeof def.options === "function" ? def.options(config) : def.options;
}

/** Traverses a config object by dot-path (e.g. "logging.level") and returns the value. */
export function getConfigValue(config: Config, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = config;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Thrown when a config field value fails type validation against its registry definition. */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

/** Validates that a value matches the expected type for a registry field. */
function validateFieldValue(field: ConfigFieldDef, value: unknown): void {
  switch (field.type) {
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new ConfigValidationError(`"${field.path}" expects a number, got ${typeof value}`);
      }
      break;
    case "toggle":
      if (typeof value !== "boolean") {
        throw new ConfigValidationError(`"${field.path}" expects a boolean, got ${typeof value}`);
      }
      break;
    case "string":
      if (typeof value !== "string") {
        throw new ConfigValidationError(`"${field.path}" expects a string, got ${typeof value}`);
      }
      break;
    case "select": {
      if (typeof value !== "string") {
        throw new ConfigValidationError(`"${field.path}" expects a string, got ${typeof value}`);
      }
      break;
    }
  }
}

/**
 * Validates and persists a config field value via the ConfigManager.
 *
 * @returns Whether the change requires a server restart to take effect
 */
export async function setFieldValueAsync(
  field: ConfigFieldDef,
  value: unknown,
  configManager: { setPath(path: string, value: unknown): Promise<void>; emit?(event: string, data: unknown): void },
): Promise<{ needsRestart: boolean }> {
  validateFieldValue(field, value);
  await configManager.setPath(field.path, value);
  return { needsRestart: !field.hotReload };
}
