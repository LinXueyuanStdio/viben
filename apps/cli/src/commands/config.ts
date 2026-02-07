/**
 * viben config - Git-style configuration management
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parse, stringify } from "yaml";
import { outputResult } from "../lib/output.js";

interface ConfigOptions {
  showOrigin?: boolean;
}

interface GlobalOptions {
  json?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  global?: boolean;
  workspace?: boolean;
}

function getConfigPath(globalOptions: GlobalOptions): string {
  if (globalOptions.global) {
    return join(homedir(), ".viben", "config.yaml");
  }
  if (globalOptions.workspace) {
    return join(process.cwd(), ".viben", "config.yaml");
  }
  // Auto-detect: check workspace first, then global
  const workspacePath = join(process.cwd(), ".viben", "config.yaml");
  if (existsSync(workspacePath)) {
    return workspacePath;
  }
  return join(homedir(), ".viben", "config.yaml");
}

function loadConfig(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }
  const content = readFileSync(path, "utf-8");
  return parse(content) || {};
}

function saveConfig(path: string, config: Record<string, unknown>): void {
  writeFileSync(path, stringify(config), "utf-8");
}

function getNestedValue(
  obj: Record<string, unknown>,
  key: string
): unknown {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(
  obj: Record<string, unknown>,
  key: string,
  value: unknown
): void {
  const parts = key.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function deleteNestedValue(obj: Record<string, unknown>, key: string): boolean {
  const parts = key.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object") {
      return false;
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = parts[parts.length - 1];
  if (lastPart in current) {
    delete current[lastPart];
    return true;
  }
  return false;
}

function flattenConfig(
  obj: Record<string, unknown>,
  prefix = ""
): Array<{ key: string; value: unknown }> {
  const result: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result.push(
        ...flattenConfig(value as Record<string, unknown>, fullKey)
      );
    } else {
      result.push({ key: fullKey, value });
    }
  }
  return result;
}

export async function config(
  action: string | undefined,
  key: string | undefined,
  value: string | undefined,
  options: ConfigOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  const configPath = getConfigPath(globalOptions);

  switch (action) {
    case "get": {
      if (!key) {
        outputResult(
          {
            success: false,
            error: { code: "MISSING_KEY", message: "Key is required for get" },
          },
          globalOptions
        );
        return;
      }
      const cfg = loadConfig(configPath);
      const val = getNestedValue(cfg, key);
      if (val === undefined) {
        outputResult(
          {
            success: false,
            error: { code: "KEY_NOT_FOUND", message: `Key '${key}' not found` },
          },
          globalOptions
        );
      } else {
        outputResult(
          {
            success: true,
            data: { key, value: val },
            message: String(val),
          },
          globalOptions
        );
      }
      break;
    }

    case "set": {
      if (!key || value === undefined) {
        outputResult(
          {
            success: false,
            error: {
              code: "MISSING_ARGS",
              message: "Key and value are required for set",
            },
          },
          globalOptions
        );
        return;
      }
      const cfg = loadConfig(configPath);
      // Try to parse JSON value
      let parsedValue: unknown = value;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string if not valid JSON
      }
      setNestedValue(cfg, key, parsedValue);
      saveConfig(configPath, cfg);
      outputResult(
        {
          success: true,
          data: { key, value: parsedValue },
          message: `Set ${key} = ${value}`,
        },
        globalOptions
      );
      break;
    }

    case "unset": {
      if (!key) {
        outputResult(
          {
            success: false,
            error: { code: "MISSING_KEY", message: "Key is required for unset" },
          },
          globalOptions
        );
        return;
      }
      const cfg = loadConfig(configPath);
      const deleted = deleteNestedValue(cfg, key);
      if (deleted) {
        saveConfig(configPath, cfg);
        outputResult(
          {
            success: true,
            data: { key },
            message: `Unset ${key}`,
          },
          globalOptions
        );
      } else {
        outputResult(
          {
            success: false,
            error: { code: "KEY_NOT_FOUND", message: `Key '${key}' not found` },
          },
          globalOptions
        );
      }
      break;
    }

    case "list":
    default: {
      const cfg = loadConfig(configPath);
      const entries = flattenConfig(cfg);
      if (options.showOrigin) {
        outputResult(
          {
            success: true,
            data: {
              path: configPath,
              entries: entries.map((e) => ({
                ...e,
                origin: configPath,
              })),
            },
            message: entries
              .map((e) => `${configPath}\t${e.key}=${JSON.stringify(e.value)}`)
              .join("\n"),
          },
          globalOptions
        );
      } else {
        outputResult(
          {
            success: true,
            data: { entries },
            message: entries
              .map((e) => `${e.key}=${JSON.stringify(e.value)}`)
              .join("\n"),
          },
          globalOptions
        );
      }
      break;
    }

    case "edit": {
      const editor = process.env.EDITOR || "vim";
      const { spawn } = await import("child_process");
      spawn(editor, [configPath], { stdio: "inherit" });
      break;
    }
  }
}
