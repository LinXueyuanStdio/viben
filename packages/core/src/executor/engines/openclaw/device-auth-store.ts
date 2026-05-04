/**
 * Device Auth Store
 *
 * Persists device tokens issued by OpenClaw gateway.
 * Storage: ~/.openclaw/identity/device-auth.json
 */

import fs from "node:fs";
import path from "node:path";
import { getOpenClawStateDir } from "./config";

export interface DeviceAuthEntry {
  token: string;
  role: string;
  scopes: string[];
  updatedAtMs: number;
}

interface DeviceAuthStore {
  version: 1;
  deviceId: string;
  tokens: Record<string, DeviceAuthEntry>;
}

function getAuthStorePath(): string {
  return path.join(getOpenClawStateDir(), "identity", "device-auth.json");
}

function readStore(): DeviceAuthStore | null {
  const filePath = getAuthStorePath();
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as DeviceAuthStore;
    if (parsed?.version !== 1 || typeof parsed.deviceId !== "string") return null;
    if (!parsed.tokens || typeof parsed.tokens !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStore(store: DeviceAuthStore): void {
  const filePath = getAuthStorePath();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
    try { fs.chmodSync(filePath, 0o600); } catch { /* best-effort */ }
  } catch {
    // Silently ignore write failures
  }
}

/**
 * Load cached device auth token for a device/role
 */
export function loadDeviceAuthToken(params: { deviceId: string; role: string }): DeviceAuthEntry | null {
  const store = readStore();
  if (!store || store.deviceId !== params.deviceId) return null;
  const entry = store.tokens[params.role.trim()];
  if (!entry || typeof entry.token !== "string") return null;
  return entry;
}

/**
 * Store device auth token
 */
export function storeDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  token: string;
  scopes?: string[];
}): void {
  const existing = readStore();
  const role = params.role.trim();
  const store: DeviceAuthStore = {
    version: 1,
    deviceId: params.deviceId,
    tokens: existing && existing.deviceId === params.deviceId ? { ...existing.tokens } : {},
  };
  store.tokens[role] = {
    token: params.token,
    role,
    scopes: params.scopes ?? [],
    updatedAtMs: Date.now(),
  };
  writeStore(store);
}

/**
 * Clear device auth token for a role
 */
export function clearDeviceAuthToken(params: { deviceId: string; role: string }): void {
  const store = readStore();
  if (!store || store.deviceId !== params.deviceId) return;
  const role = params.role.trim();
  if (!store.tokens[role]) return;
  const next: DeviceAuthStore = { ...store, tokens: { ...store.tokens } };
  delete next.tokens[role];
  writeStore(next);
}
