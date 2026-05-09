/**
 * OpenClaw Config Reader
 *
 * Reads OpenClaw configuration from ~/.openclaw/openclaw.json
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OpenClawGatewayAuth, OpenClawGatewayConfig } from "./types";
import { DEFAULT_GATEWAY_CONFIG } from "./types";

const DEFAULT_STATE_DIR = path.join(os.homedir(), ".openclaw");
const CONFIG_FILENAME = "openclaw.json";
const LEGACY_CONFIG_FILENAMES = ["clawdbot.json", "moltbot.json", "moldbot.json"];

interface OpenClawConfigFile {
  gateway?: {
    port?: number;
    auth?: OpenClawGatewayAuth;
  };
}

function resolveStateDir(): string {
  const override =
    process.env.OPENCLAW_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim();
  if (override) {
    return override.startsWith("~")
      ? path.resolve(override.replace(/^~(?=$|[\\/])/, os.homedir()))
      : path.resolve(override);
  }

  if (fs.existsSync(DEFAULT_STATE_DIR)) {
    return DEFAULT_STATE_DIR;
  }

  const legacyDirs = [".clawdbot", ".moltbot", ".moldbot"].map((dir) =>
    path.join(os.homedir(), dir)
  );
  const existing = legacyDirs.find((dir) => {
    try { return fs.existsSync(dir); } catch { return false; }
  });

  return existing ?? DEFAULT_STATE_DIR;
}

function findConfigPath(): string | null {
  const override = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (override) {
    return override.startsWith("~")
      ? path.resolve(override.replace(/^~(?=$|[\\/])/, os.homedir()))
      : path.resolve(override);
  }

  const stateDir = resolveStateDir();
  const candidates = [CONFIG_FILENAME, ...LEGACY_CONFIG_FILENAMES].map((name) =>
    path.join(stateDir, name)
  );

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function parseJsonc(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const cleaned = content.replace(
      /"(?:[^"\\]|\\.)*"|\/\/.*$|\/\*[\s\S]*?\*\//gm,
      (match) => (match.startsWith('"') ? match : "")
    );
    return JSON.parse(cleaned);
  }
}

/**
 * Read OpenClaw gateway config from filesystem
 * Merges file config with defaults
 */
export function loadGatewayConfig(overrides?: {
  host?: string;
  port?: number;
  token?: string;
  password?: string;
  cliPath?: string;
  autoStart?: boolean;
}): OpenClawGatewayConfig {
  const config: OpenClawGatewayConfig = { ...DEFAULT_GATEWAY_CONFIG };

  const configPath = findConfigPath();
  if (configPath) {
    try {
      const content = fs.readFileSync(configPath, "utf8");
      const parsed = parseJsonc(content) as OpenClawConfigFile;
      if (parsed?.gateway?.port) {
        config.port = parsed.gateway.port;
      }
      if (parsed?.gateway?.auth) {
        config.auth = parsed.gateway.auth;
      }
    } catch {
      // Ignore read errors, use defaults
    }
  }

  if (overrides?.host) config.host = overrides.host;
  if (overrides?.port) config.port = overrides.port;
  if (overrides?.cliPath) config.cliPath = overrides.cliPath;
  if (overrides?.autoStart !== undefined) config.autoStart = overrides.autoStart;
  if (overrides?.token) {
    config.auth = { mode: "token", token: overrides.token };
  } else if (overrides?.password) {
    config.auth = { mode: "password", password: overrides.password };
  }

  return config;
}

/**
 * Get the OpenClaw state directory path
 */
export function getOpenClawStateDir(): string {
  return resolveStateDir();
}
