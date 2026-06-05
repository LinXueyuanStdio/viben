import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { applyMigrations } from "./config-migrations.js";
import { createChildLogger } from "../utils/log.js";
import type { SettingsManager } from "../plugin/settings-manager.js";
const log = createChildLogger({ module: "config" });

/** Log rotation and verbosity settings. */
const LoggingSchema = z
  .object({
    level: z
      .enum(["silent", "debug", "info", "warn", "error", "fatal"])
      .default("info"),
    logDir: z.string().default("~/.viben/logs"),
    maxFileSize: z.union([z.string(), z.number()]).default("10m"),
    maxFiles: z.number().default(7),
    sessionLogRetentionDays: z.number().default(30),
  })
  .default({
    level: "info",
    logDir: "~/.viben/logs",
    maxFileSize: "10m",
    maxFiles: 7,
    sessionLogRetentionDays: 30,
  });

/** Runtime logging configuration. Controls per-module log levels and output destinations. */
export type LoggingConfig = z.infer<typeof LoggingSchema>;

/**
 * Zod schema for the global Viben config file (`~/.viben/config.json`).
 *
 * Every field uses `.default()` or `.optional()` so that config files from older
 * versions — which lack newly added fields — still pass validation without error.
 * This is critical for backward compatibility: users should never have to manually
 * edit their config after upgrading.
 *
 * Plugin-specific settings live separately in per-plugin settings files
 * (`~/.viben/plugins/<name>/settings.json`), not here. This schema only
 * covers global, cross-cutting concerns.
 */
export const ConfigSchema = z.object({
  /** Instance UUID, written once at creation time. */
  id: z.string().optional(),
  instanceName: z.string().optional(),
  defaultAgent: z.string(),

  // --- Workspace security & path resolution ---
  workspace: z
    .object({
      allowExternalWorkspaces: z.boolean().default(true),
      security: z
        .object({
          allowedPaths: z.array(z.string()).default([]),
          envWhitelist: z.array(z.string()).default([]),
        })
        .default({ allowedPaths: [], envWhitelist: [] }),
    })
    .default({
      allowExternalWorkspaces: true,
      security: { allowedPaths: [], envWhitelist: [] },
    }),

  // --- Logging ---
  logging: LoggingSchema,

  // --- Process lifecycle ---
  runMode: z.enum(["foreground", "daemon"]).default("foreground"),
  autoStart: z.boolean().default(false),

  // --- Session persistence ---
  sessionStore: z
    .object({
      ttlDays: z.number().default(30),
    })
    .default({ ttlDays: 30 }),

  // --- Installed integration tracking (e.g. plugins installed via CLI) ---
  integrations: z
    .record(
      z.string(),
      z.object({
        installed: z.boolean(),
        installedAt: z.string().optional(),
      }),
    )
    .default({}),

  // --- Agent output verbosity control ---
  outputMode: z.enum(["low", "medium", "high"]).default("medium").optional(),

  // --- Multi-agent switching behavior ---
  agentSwitch: z.object({
    labelHistory: z.boolean().default(true),
  }).default({ labelHistory: true }),
});

/** Validated config object used throughout the codebase. Always obtained via `ConfigManager.get()` to ensure it's up-to-date. */
export type Config = z.infer<typeof ConfigSchema>;

/** Expands a leading `~` to the user's home directory. Returns the path unchanged if no `~` prefix. */
export function expandHome(p: string): string {
  if (p.startsWith("~")) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

const DEFAULT_CONFIG = {
  defaultAgent: "claude",
  sessionStore: { ttlDays: 30 },
};

/**
 * Manages loading, validating, and persisting the global config file.
 *
 * The load cycle is: read JSON -> apply migrations -> apply env overrides -> validate with Zod.
 * Emits `config:changed` events when individual fields are updated, enabling
 * hot-reload for fields marked as `hotReload` in the config registry.
 */
export class ConfigManager extends EventEmitter {
  private config!: Config;
  private configPath: string;

  constructor(configPath?: string) {
    super();
    this.configPath =
      process.env.VIBEN_CONFIG_PATH || configPath || expandHome("~/.viben/config.json");
  }

  /**
   * Loads config from disk through the full validation pipeline:
   * 1. Create default config if missing (first run)
   * 2. Apply migrations for older config formats
   * 3. Apply environment variable overrides
   * 4. Validate against Zod schema — exits on failure
   */
  async load(): Promise<void> {
    const dir = path.dirname(this.configPath);
    fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(DEFAULT_CONFIG, null, 2),
      );
      log.info({ configPath: this.configPath }, "Config created");
      log.info(
        "Run 'viben setup' to configure channels and agents, then restart.",
      );
      process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));

    // Auto-migrate before validation — transforms old config shapes to current schema
    const { changed: configUpdated } = applyMigrations(raw, undefined, { configDir: path.dirname(this.configPath) });
    if (configUpdated) {
      fs.writeFileSync(this.configPath, JSON.stringify(raw, null, 2));
    }

    this.applyEnvOverrides(raw);

    const result = ConfigSchema.safeParse(raw);
    if (!result.success) {
      log.error("Config validation failed");
      for (const issue of result.error.issues) {
        log.error(
          { path: issue.path.join("."), message: issue.message },
          "Validation error",
        );
      }
      process.exit(1);
    }
    this.config = result.data;
  }

  /** Returns a deep clone of the current config to prevent external mutation. */
  get(): Config {
    return structuredClone(this.config);
  }

  /**
   * Merges partial updates into the config file using atomic write (write tmp + rename).
   *
   * Validates the merged result before writing. If `changePath` is provided,
   * emits a `config:changed` event with old and new values for that path,
   * enabling hot-reload without restart.
   */
  async save(
    updates: Record<string, unknown>,
    changePath?: string,
  ): Promise<void> {
    const oldConfig = this.config ? structuredClone(this.config) : undefined;
    const raw = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
    this.deepMerge(raw, updates);
    // Validate BEFORE writing to disk
    const result = ConfigSchema.safeParse(raw);
    if (!result.success) {
      log.error({ errors: result.error.issues }, "Config validation failed, not saving");
      return;
    }
    // Atomic write: tmp file + rename prevents corruption if process crashes mid-write
    const tmpPath = this.configPath + `.tmp.${randomBytes(4).toString('hex')}`;
    fs.writeFileSync(tmpPath, JSON.stringify(raw, null, 2), "utf-8");
    fs.renameSync(tmpPath, this.configPath);
    this.config = result.data;
    if (changePath) {
      const { getConfigValue } = await import("./config-registry.js");
      const value = getConfigValue(this.config, changePath);
      const oldValue = oldConfig
        ? getConfigValue(oldConfig, changePath)
        : undefined;
      this.emit("config:changed", { path: changePath, value, oldValue });
    }
  }

  /**
   * Convenience wrapper for updating a single deeply-nested config field
   * without constructing the full update object manually.
   *
   * Accepts a dot-path (e.g. "logging.level") and builds the nested
   * update object internally before delegating to `save()`.
   * Throws if the path contains prototype-pollution keys.
   */
  async setPath(dotPath: string, value: unknown): Promise<void> {
    const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    const parts = dotPath.split('.');
    if (parts.some((p) => BLOCKED_KEYS.has(p))) {
      throw new Error(`Invalid config path: ${dotPath}`);
    }

    // Build nested updates object from dot-path
    const updates: Record<string, unknown> = {};
    let target = updates;
    for (let i = 0; i < parts.length - 1; i++) {
      target[parts[i]!] = {};
      target = target[parts[i]!] as Record<string, unknown>;
    }
    target[parts[parts.length - 1]!] = value;

    await this.save(updates, dotPath);
  }

  /**
   * Resolves a workspace path from user input.
   *
   * Supports three forms: no input (returns base dir), absolute/tilde paths
   * (validated against allowExternalWorkspaces), and named workspaces
   * (alphanumeric subdirectories under the base).
   */
  resolveWorkspace(input?: string): string {
    // configPath = /x/y/.viben/config.json → workspace = /x/y/
    const workspaceBase = path.dirname(path.dirname(this.configPath));

    if (!input) {
      fs.mkdirSync(workspaceBase, { recursive: true });
      return workspaceBase;
    }

    // Absolute or tilde path
    const expanded = input.startsWith("~") ? expandHome(input) : input;
    if (path.isAbsolute(expanded)) {
      const resolved = path.resolve(expanded);
      const base = path.resolve(workspaceBase);
      const isInternal = resolved === base || resolved.startsWith(base + path.sep);

      if (!isInternal) {
        if (!this.config.workspace.allowExternalWorkspaces) {
          throw new Error(
            `Workspace path "${input}" is outside base directory "${workspaceBase}". Set allowExternalWorkspaces: true to allow this.`,
          );
        }
        if (!fs.existsSync(resolved)) {
          throw new Error(`Workspace path "${resolved}" does not exist.`);
        }
        return resolved;
      }

      fs.mkdirSync(resolved, { recursive: true });
      return resolved;
    }

    // Named workspace
    if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
      throw new Error(
        `Invalid workspace name: "${input}". Only alphanumeric characters, hyphens, and underscores are allowed.`,
      );
    }
    const namedPath = path.join(workspaceBase, input.toLowerCase());
    fs.mkdirSync(namedPath, { recursive: true });
    return namedPath;
  }

  /** Checks whether the config file exists on disk. Wraps synchronous `fs.existsSync` behind an async interface for consistency with the rest of the ConfigManager API. */
  async exists(): Promise<boolean> {
    return fs.existsSync(this.configPath);
  }

  /** Returns the resolved path to the config JSON file. */
  getConfigPath(): string {
    return this.configPath;
  }

  /** Writes a complete config object to disk, creating the directory if needed. Used during initial setup. */
  async writeNew(config: Config): Promise<void> {
    const dir = path.dirname(this.configPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Applies `VIBEN_*` environment variables as overrides to per-plugin settings.
   *
   * This lets users configure plugin values (bot tokens, ports, etc.) via env vars
   * without editing settings files — useful for Docker, CI, and headless setups.
   */
  async applyEnvToPluginSettings(settingsManager: SettingsManager): Promise<void> {
    const pluginOverrides: Array<{
      envVar: string;
      pluginName: string;
      key: string;
      transform?: (v: string) => unknown;
    }> = [
      { envVar: 'VIBEN_TUNNEL_ENABLED', pluginName: '@viben/tunnel', key: 'enabled', transform: v => v === 'true' },
      { envVar: 'VIBEN_TUNNEL_PORT', pluginName: '@viben/tunnel', key: 'port', transform: v => Number(v) },
      { envVar: 'VIBEN_TUNNEL_PROVIDER', pluginName: '@viben/tunnel', key: 'provider' },
      { envVar: 'VIBEN_API_PORT', pluginName: '@viben/api-server', key: 'port', transform: v => Number(v) },
      { envVar: 'VIBEN_SPEECH_STT_PROVIDER', pluginName: '@viben/speech', key: 'sttProvider' },
      { envVar: 'VIBEN_SPEECH_GROQ_API_KEY', pluginName: '@viben/speech', key: 'groqApiKey' },
      { envVar: 'VIBEN_TELEGRAM_BOT_TOKEN', pluginName: '@viben/telegram', key: 'botToken' },
      { envVar: 'VIBEN_TELEGRAM_CHAT_ID', pluginName: '@viben/telegram', key: 'chatId', transform: v => Number(v) },
      // Future adapters — no-ops if plugin settings don't exist
      { envVar: 'VIBEN_DISCORD_BOT_TOKEN', pluginName: '@viben/discord-adapter', key: 'botToken' },
      { envVar: 'VIBEN_DISCORD_GUILD_ID', pluginName: '@viben/discord-adapter', key: 'guildId' },
      { envVar: 'VIBEN_SLACK_BOT_TOKEN', pluginName: '@viben/slack-adapter', key: 'botToken' },
      { envVar: 'VIBEN_SLACK_APP_TOKEN', pluginName: '@viben/slack-adapter', key: 'appToken' },
      { envVar: 'VIBEN_SLACK_SIGNING_SECRET', pluginName: '@viben/slack-adapter', key: 'signingSecret' },
    ];

    for (const { envVar, pluginName, key, transform } of pluginOverrides) {
      const value = process.env[envVar];
      if (value !== undefined) {
        const resolved = transform ? transform(value) : value;
        await settingsManager.updatePluginSettings(pluginName, { [key]: resolved });
        log.debug({ envVar, pluginName, key }, 'Env var override applied to plugin settings');
      }
    }
  }

  /** Applies env var overrides to the raw config object before Zod validation. */
  private applyEnvOverrides(raw: Record<string, unknown>): void {
    const overrides: [string, string[]][] = [
      ["VIBEN_DEFAULT_AGENT", ["defaultAgent"]],
      ["VIBEN_RUN_MODE", ["runMode"]],
    ];
    for (const [envVar, configPath] of overrides) {
      const value = process.env[envVar];
      if (value !== undefined) {
        let target: Record<string, unknown> = raw;
        for (let i = 0; i < configPath.length - 1; i++) {
          if (!target[configPath[i]]) target[configPath[i]] = {};
          target = target[configPath[i]] as Record<string, unknown>;
        }
        const key = configPath[configPath.length - 1];
        target[key] = value;
      }
    }

    // Logging env var overrides
    if (process.env.VIBEN_LOG_LEVEL) {
      raw.logging = raw.logging || {};
      (raw.logging as Record<string, unknown>).level =
        process.env.VIBEN_LOG_LEVEL;
    }
    if (process.env.VIBEN_LOG_DIR) {
      raw.logging = raw.logging || {};
      (raw.logging as Record<string, unknown>).logDir =
        process.env.VIBEN_LOG_DIR;
    }
    if (process.env.VIBEN_DEBUG && !process.env.VIBEN_LOG_LEVEL) {
      raw.logging = raw.logging || {};
      (raw.logging as Record<string, unknown>).level = "debug";
    }
  }

  /** Recursively merges source into target, skipping prototype-pollution keys. */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): void {
    // Prototype pollution guard — these keys must never be set via user input
    const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    for (const key of Object.keys(source)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      const val = source[key];
      if (val && typeof val === "object" && !Array.isArray(val)) {
        if (!target[key]) target[key] = {};
        this.deepMerge(
          target[key] as Record<string, unknown>,
          val as Record<string, unknown>,
        );
      } else {
        target[key] = val;
      }
    }
  }
}
