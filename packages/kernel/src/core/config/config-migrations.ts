/**
 * Config migrations transform old config.json shapes to the current schema.
 *
 * Migrations run automatically during ConfigManager.load(), before Zod validation.
 * Each migration mutates the raw JSON object in place and returns true if it
 * made changes. They run sequentially in array order — new migrations should
 * always be appended at the end.
 *
 * If any migration fires, the updated config is written back to disk immediately,
 * so the file stays in sync with the in-memory representation.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createChildLogger } from "../utils/log.js";
const log = createChildLogger({ module: "config-migrations" });

type RawConfig = Record<string, unknown>;

/** Context passed to migrations that need filesystem access (e.g. looking up the instance registry). */
export interface MigrationContext {
  configDir: string;
}

/** A single config migration: a named transform applied to the raw config object. */
export interface Migration {
  name: string;
  /** Mutates `raw` in place. Returns `true` if the config was changed. */
  apply: (raw: RawConfig, ctx?: MigrationContext) => boolean;
}

/**
 * Ordered list of config migrations. Each runs once — idempotent guards
 * (checking if the field already exists) prevent re-application.
 */
export const migrations: Migration[] = [
  {
    // v2025.x: instanceName was added to support multi-instance setups.
    // Old configs lack this field — default to "Main" so the UI has a display name.
    name: "add-instance-name",
    apply(raw) {
      if (raw.instanceName) return false;
      raw.instanceName = "Main";
      log.info("Added instanceName to config");
      return true;
    },
  },
  {
    // displayVerbosity was replaced by outputMode — remove the legacy key
    // so it doesn't confuse Zod strict parsing or the config editor.
    name: "delete-display-verbosity",
    apply(raw) {
      if (!("displayVerbosity" in raw)) return false;
      delete raw.displayVerbosity;
      log.info("Removed legacy displayVerbosity key from config");
      return true;
    },
  },
  {
    // Instance IDs were originally only in instances.json (the global registry).
    // This migration copies the ID into config.json so each instance is self-identifying
    // without needing to cross-reference the registry.
    name: "add-instance-id",
    apply(raw, ctx) {
      if (raw.id) return false;
      if (!ctx?.configDir) return false;

      const instanceRoot = ctx.configDir;

      try {
        // Look up this instance's ID from the global registry
        const registryPath = path.join(os.homedir(), ".viben", "instances.json");
        const data = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
        const instances = data?.instances ?? {};
        const entry = Object.values(instances).find(
          (e: any) => e.root === instanceRoot,
        ) as { id?: string } | undefined;
        if (entry?.id) {
          raw.id = entry.id;
          log.info({ instanceRoot }, "Migrated: added id to config from registry");
          return true;
        }
      } catch {
        /* best-effort — registry may not exist on fresh installs */
      }

      return false;
    },
  },
];

/**
 * Applies all pending migrations to a raw config object (mutates in place).
 *
 * Called by ConfigManager.load() before Zod validation. Each migration is
 * idempotent — safe to run on configs that have already been migrated.
 *
 * @returns Whether any migration made changes (caller should persist if true)
 */
export function applyMigrations(
  raw: RawConfig,
  migrationList: Migration[] = migrations,
  ctx?: MigrationContext,
): { changed: boolean } {
  let changed = false;
  for (const migration of migrationList) {
    if (migration.apply(raw, ctx)) {
      changed = true;
    }
  }
  return { changed };
}
