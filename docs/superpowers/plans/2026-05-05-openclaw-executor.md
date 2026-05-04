# OpenClaw Executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an OpenClaw executor that connects to the OpenClaw gateway via WebSocket, enabling both automated task execution and interactive chat in the desktop app.

**Architecture:** Uses `@openclaw/sdk` for WebSocket communication, with custom process management (gateway spawn/kill) and device identity authentication (Ed25519). The executor integrates into the existing `BaseExecutor` registry pattern.

**Tech Stack:** TypeScript, `@openclaw/sdk`, Node.js `crypto` (Ed25519), WebSocket

---

## File Structure

```
packages/core/src/executor/engines/openclaw/
├── index.ts              # OpenClawExecutor class + registerExecutor
├── types.ts              # OpenClawExecutorConfig, internal types
├── config.ts             # Read ~/.openclaw/openclaw.json
├── device-identity.ts    # Ed25519 key management
├── device-auth-store.ts  # Device token persistence
├── process-manager.ts    # Gateway process lifecycle
├── connection.ts         # @openclaw/sdk client wrapper
├── event-mapper.ts       # OpenClawEvent → SSEMessage mapping
└── chat-proxy.ts         # Streaming chat proxy (AsyncGenerator<SSEMessage>)
```

**Also modified:**
- `packages/core/src/types/index.ts` — Add `"OPENCLAW"` to `ExecutorType`
- `packages/core/src/executor/engines/index.ts` — Import and re-export openclaw module
- `packages/core/package.json` — Add `@openclaw/sdk` dependency (link to local)
- `packages/core/src/gateway/routes/agent-ws.ts` — Add OPENCLAW executor branch

---

### Task 1: Register OPENCLAW in ExecutorType

**Files:**
- Modify: `packages/core/src/types/index.ts:18-37`
- Modify: `packages/core/src/types/index.ts:55-107` (AGENT_TYPES array)

- [ ] **Step 1: Add OPENCLAW to ExecutorType union**

```typescript
// In packages/core/src/types/index.ts, add after "DROID":
export type ExecutorType =
  // Runtime executors (can be spawned and executed)
  | "CLAUDE_CODE"
  | "AMP"
  | "GEMINI"
  | "CODEX"
  | "OPENCODE"
  | "CURSOR_AGENT"
  | "QWEN_CODE"
  | "COPILOT"
  | "DROID"
  | "OPENCLAW"
  // Template-only executors (for viben init configuration)
  | "CURSOR"
  | "IFLOW"
  | "KILO"
  | "KIRO"
  | "ANTIGRAVITY"
  | "WINDSURF"
  | "AIDER"
  | "CONTINUE";
```

- [ ] **Step 2: Add OPENCLAW to AGENT_TYPES array**

After the DROID entry:

```typescript
{
  id: "OPENCLAW",
  name: "OpenClaw",
  description: "Personal AI assistant gateway with multi-agent routing",
},
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types/index.ts
git commit -m "feat(core): add OPENCLAW to ExecutorType"
```

---

### Task 2: Create types.ts

**Files:**
- Create: `packages/core/src/executor/engines/openclaw/types.ts`

- [ ] **Step 1: Write internal types**

```typescript
/**
 * OpenClaw Executor Types
 */

import type { ExecutorConfig } from "../../ops/types";

/**
 * OpenClaw gateway authentication configuration
 */
export interface OpenClawGatewayAuth {
  mode: "none" | "token" | "password";
  token?: string;
  password?: string;
}

/**
 * OpenClaw gateway connection configuration
 */
export interface OpenClawGatewayConfig {
  host: string;
  port: number;
  auth: OpenClawGatewayAuth;
  cliPath: string;
  autoStart: boolean;
}

/**
 * OpenClaw executor configuration (extends base ExecutorConfig)
 */
export interface OpenClawExecutorConfig extends ExecutorConfig {
  /** Gateway connection overrides */
  gateway?: {
    host?: string;
    port?: number;
    token?: string;
    password?: string;
  };
  /** Auto-start gateway if not running (default: true) */
  autoStart?: boolean;
  /** Path to openclaw CLI binary (default: "openclaw") */
  cliPath?: string;
}

/**
 * Default gateway configuration
 */
export const DEFAULT_GATEWAY_CONFIG: OpenClawGatewayConfig = {
  host: "127.0.0.1",
  port: 18789,
  auth: { mode: "none" },
  cliPath: "openclaw",
  autoStart: true,
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/executor/engines/openclaw/types.ts
git commit -m "feat(core): add openclaw executor types"
```

---

### Task 3: Create config.ts

**Files:**
- Create: `packages/core/src/executor/engines/openclaw/config.ts`

- [ ] **Step 1: Write config reader (reference: AionUi openclawConfig.ts)**

```typescript
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
    const resolved = override.startsWith("~")
      ? path.resolve(override.replace(/^~(?=$|[\\/])/, os.homedir()))
      : path.resolve(override);
    return resolved;
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
    // Strip JSONC comments (// and /* */) outside strings
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

  // Read config file
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

  // Apply overrides
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/executor/engines/openclaw/config.ts
git commit -m "feat(core): add openclaw config reader"
```

---

### Task 4: Create device-identity.ts

**Files:**
- Create: `packages/core/src/executor/engines/openclaw/device-identity.ts`

- [ ] **Step 1: Write device identity module (reference: AionUi deviceIdentity.ts)**

```typescript
/**
 * Device Identity for OpenClaw Gateway Authentication
 *
 * Uses Ed25519 key pairs for device authentication.
 * Compatible with OpenClaw CLI's identity storage.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getOpenClawStateDir } from "./config";

export interface DeviceIdentity {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

interface StoredIdentity {
  version: 1;
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  createdAtMs: number;
}

// Ed25519 SPKI prefix for extracting raw 32-byte public key
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({ type: "spki", format: "der" }) as Buffer;
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function fingerprintPublicKey(publicKeyPem: string): string {
  const raw = derivePublicKeyRaw(publicKeyPem);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateIdentity(): DeviceIdentity {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const deviceId = fingerprintPublicKey(publicKeyPem);
  return { deviceId, publicKeyPem, privateKeyPem };
}

function getIdentityFilePath(): string {
  return path.join(getOpenClawStateDir(), "identity", "device.json");
}

/**
 * Load or create device identity
 * Uses ~/.openclaw/identity/device.json for compatibility with OpenClaw CLI
 */
export function loadOrCreateDeviceIdentity(): DeviceIdentity {
  const filePath = getIdentityFilePath();

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as StoredIdentity;
      if (
        parsed?.version === 1 &&
        typeof parsed.deviceId === "string" &&
        typeof parsed.publicKeyPem === "string" &&
        typeof parsed.privateKeyPem === "string"
      ) {
        const derivedId = fingerprintPublicKey(parsed.publicKeyPem);
        if (derivedId !== parsed.deviceId) {
          // Fix mismatched deviceId
          const updated: StoredIdentity = { ...parsed, deviceId: derivedId };
          fs.writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`, { mode: 0o600 });
          return { deviceId: derivedId, publicKeyPem: parsed.publicKeyPem, privateKeyPem: parsed.privateKeyPem };
        }
        return { deviceId: parsed.deviceId, publicKeyPem: parsed.publicKeyPem, privateKeyPem: parsed.privateKeyPem };
      }
    }
  } catch {
    // Fall through to regenerate
  }

  // Generate new identity
  const identity = generateIdentity();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const stored: StoredIdentity = {
    version: 1,
    deviceId: identity.deviceId,
    publicKeyPem: identity.publicKeyPem,
    privateKeyPem: identity.privateKeyPem,
    createdAtMs: Date.now(),
  };
  fs.writeFileSync(filePath, `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600 });
  try { fs.chmodSync(filePath, 0o600); } catch { /* best-effort */ }
  return identity;
}

/**
 * Sign a payload with the device's private key (Ed25519)
 */
export function signDevicePayload(privateKeyPem: string, payload: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, "utf8"), key);
  return base64UrlEncode(sig);
}

/**
 * Get raw base64url-encoded public key from PEM
 */
export function publicKeyToBase64Url(publicKeyPem: string): string {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

export interface DeviceAuthPayloadParams {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce?: string | null;
}

/**
 * Build the signing payload string for device auth
 * Format: version|deviceId|clientId|clientMode|role|scopes|signedAtMs|token[|nonce]
 */
export function buildDeviceAuthPayload(params: DeviceAuthPayloadParams): string {
  const version = params.nonce ? "v2" : "v1";
  const scopes = params.scopes.join(",");
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    params.token ?? "",
  ];
  if (version === "v2") {
    base.push(params.nonce ?? "");
  }
  return base.join("|");
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/executor/engines/openclaw/device-identity.ts
git commit -m "feat(core): add openclaw device identity (Ed25519)"
```

---

### Task 5: Create device-auth-store.ts

**Files:**
- Create: `packages/core/src/executor/engines/openclaw/device-auth-store.ts`

- [ ] **Step 1: Write device auth store (reference: AionUi deviceAuthStore.ts)**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/executor/engines/openclaw/device-auth-store.ts
git commit -m "feat(core): add openclaw device auth token store"
```

---

### Task 6: Create process-manager.ts

**Files:**
- Create: `packages/core/src/executor/engines/openclaw/process-manager.ts`

- [ ] **Step 1: Write process manager (reference: AionUi OpenClawGatewayManager.ts)**

```typescript
/**
 * OpenClaw Gateway Process Manager
 *
 * Manages the lifecycle of the `openclaw gateway` process.
 * Auto-starts if not running, monitors health, restarts on crash.
 */

import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import type { OpenClawGatewayConfig } from "./types";

const MIN_NODE_VERSION = { major: 22, minor: 12, patch: 0 };
const STARTUP_TIMEOUT_MS = 15_000;
const READY_SIGNALS = [
  "Gateway listening",
  "WebSocket server started",
  "gateway ready",
  "listening on",
];

/**
 * Check if a TCP port is already in use
 */
function isPortInUse(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function parseNodeVersion(raw: string): { major: number; minor: number; patch: number } | null {
  const m = raw.trim().match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function isVersionAtLeast(
  a: { major: number; minor: number; patch: number } | null,
  b: { major: number; minor: number; patch: number }
): boolean {
  if (!a) return false;
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
}

function resolveCommandPath(cmd: string, envPath?: string): string | null {
  if (cmd.includes("/") || cmd.includes("\\")) {
    try {
      fs.accessSync(cmd, fs.constants.X_OK);
      return cmd;
    } catch {
      return null;
    }
  }
  const sep = process.platform === "win32" ? ";" : ":";
  for (const dir of (envPath || process.env.PATH || "").split(sep)) {
    if (!dir) continue;
    const candidate = path.join(dir, cmd);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function findBestNode(envPath?: string): string | null {
  const sep = process.platform === "win32" ? ";" : ":";
  const nodeName = process.platform === "win32" ? "node.exe" : "node";
  let best: { file: string; ver: { major: number; minor: number; patch: number } } | null = null;

  for (const dir of (envPath || process.env.PATH || "").split(sep)) {
    if (!dir) continue;
    const candidate = path.join(dir, nodeName);
    try { fs.accessSync(candidate, fs.constants.X_OK); } catch { continue; }
    try {
      const raw = execFileSync(candidate, ["-v"], { encoding: "utf8" });
      const ver = parseNodeVersion(raw);
      if (!isVersionAtLeast(ver, MIN_NODE_VERSION)) continue;
      if (!best || isVersionAtLeast(ver, best.ver)) {
        best = { file: candidate, ver: ver! };
      }
    } catch {
      continue;
    }
  }
  return best?.file ?? null;
}

function shouldRunViaNode(cliPath: string): boolean {
  if (/\.(mjs|cjs|js)$/i.test(cliPath)) return true;
  try {
    const fd = fs.openSync(cliPath, "r");
    const buf = Buffer.alloc(128);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const head = buf.subarray(0, n).toString("utf8");
    return head.startsWith("#!") && head.includes("node");
  } catch {
    return false;
  }
}

export class OpenClawProcessManager {
  private process: ChildProcess | null = null;
  private config: OpenClawGatewayConfig;

  constructor(config: OpenClawGatewayConfig) {
    this.config = config;
  }

  /**
   * Ensure the gateway is running.
   * If port is already occupied, assumes gateway is running externally.
   * Otherwise spawns the gateway process.
   */
  async ensureRunning(): Promise<void> {
    const portUsed = await isPortInUse(this.config.port, this.config.host);
    if (portUsed) {
      return; // Gateway already running externally
    }

    if (!this.config.autoStart) {
      throw new Error(
        `OpenClaw gateway not running on ${this.config.host}:${this.config.port} and autoStart is disabled`
      );
    }

    await this.start();
  }

  /**
   * Start the gateway process
   */
  private async start(): Promise<void> {
    if (this.process && !this.process.killed) {
      return;
    }

    const resolvedCli = resolveCommandPath(this.config.cliPath);
    if (!resolvedCli) {
      throw new Error(
        `OpenClaw CLI not found: "${this.config.cliPath}". Install openclaw or set cliPath.`
      );
    }

    const bestNode = findBestNode();
    const runViaNode = bestNode && shouldRunViaNode(resolvedCli);
    const command = runViaNode ? bestNode : resolvedCli;
    const args = runViaNode
      ? [resolvedCli, "gateway", "--port", String(this.config.port)]
      : ["gateway", "--port", String(this.config.port)];

    return new Promise<void>((resolve, reject) => {
      this.process = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      });

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          // Resolve anyway — gateway might not emit expected signal but may be ready
          resolve();
        }
      }, STARTUP_TIMEOUT_MS);

      this.process.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        if (!resolved && READY_SIGNALS.some((sig) => output.includes(sig))) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        if (!resolved && READY_SIGNALS.some((sig) => output.includes(sig))) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      this.process.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`Failed to start openclaw gateway: ${err.message}`));
        }
      });

      this.process.on("exit", (code) => {
        this.process = null;
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`openclaw gateway exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Stop the managed gateway process
   */
  async stop(): Promise<void> {
    if (!this.process || this.process.killed) return;
    this.process.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.process?.kill("SIGKILL");
        resolve();
      }, 5000);
      this.process!.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.process = null;
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  getPort(): number {
    return this.config.port;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/executor/engines/openclaw/process-manager.ts
git commit -m "feat(core): add openclaw gateway process manager"
```

---

### Task 7: Create connection.ts

**Files:**
- Create: `packages/core/src/executor/engines/openclaw/connection.ts`

- [ ] **Step 1: Write connection manager using @openclaw/sdk**

```typescript
/**
 * OpenClaw Connection Manager
 *
 * Wraps @openclaw/sdk's OpenClaw client for use within viben.
 * Handles connection lifecycle and configuration.
 */

import { OpenClaw } from "@openclaw/sdk";
import type { OpenClawGatewayConfig } from "./types";

export class OpenClawConnectionManager {
  private client: OpenClaw | null = null;
  private config: OpenClawGatewayConfig;

  constructor(config: OpenClawGatewayConfig) {
    this.config = config;
  }

  /**
   * Connect to the OpenClaw gateway
   */
  async connect(): Promise<OpenClaw> {
    if (this.client) {
      return this.client;
    }

    const url = `ws://${this.config.host}:${this.config.port}`;
    const options: ConstructorParameters<typeof OpenClaw>[0] = { url };

    if (this.config.auth.mode === "token" && this.config.auth.token) {
      options.token = this.config.auth.token;
    } else if (this.config.auth.mode === "password" && this.config.auth.password) {
      options.password = this.config.auth.password;
    }

    this.client = new OpenClaw(options);
    await this.client.connect();
    return this.client;
  }

  /**
   * Disconnect from the gateway
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  /**
   * Get the connected client (throws if not connected)
   */
  getClient(): OpenClaw {
    if (!this.client) {
      throw new Error("OpenClaw client not connected. Call connect() first.");
    }
    return this.client;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.client !== null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/executor/engines/openclaw/connection.ts
git commit -m "feat(core): add openclaw SDK connection manager"
```

---

### Task 8: Create event-mapper.ts

**Files:**
- Create: `packages/core/src/executor/engines/openclaw/event-mapper.ts`

- [ ] **Step 1: Write event mapper (OpenClawEvent → SSEMessage)**

```typescript
/**
 * OpenClaw Event Mapper
 *
 * Maps @openclaw/sdk normalized events to viben SSEMessage format.
 */

import type { OpenClawEvent } from "@openclaw/sdk";
import type { SSEMessage } from "../../ops/types";

/**
 * Map an OpenClaw SDK event to a viben SSEMessage.
 * Returns null for events that should be skipped.
 */
export function mapOpenClawEvent(event: OpenClawEvent): SSEMessage | null {
  const data = event.data as Record<string, unknown> | undefined;

  switch (event.type) {
    case "assistant.delta": {
      const delta = (data?.delta as string) ?? (data?.text as string) ?? "";
      if (!delta) return null;
      return { type: "text", content: delta };
    }

    case "assistant.message": {
      const content = (data?.text as string) ?? (data?.content as string) ?? "";
      if (!content) return null;
      return { type: "text", content };
    }

    case "tool.call.started": {
      const id = (data?.toolCallId as string) ?? (data?.id as string) ?? event.id;
      const name = (data?.name as string) ?? "unknown";
      const input = data?.args ?? data?.input ?? {};
      return { type: "tool_use", id, name, input };
    }

    case "tool.call.completed": {
      const toolUseId = (data?.toolCallId as string) ?? (data?.id as string) ?? "";
      const output = (data?.output as string) ?? (data?.result as string) ?? JSON.stringify(data ?? {});
      const isError = (data?.isError as boolean) ?? false;
      return { type: "tool_result", tool_use_id: toolUseId, output, is_error: isError };
    }

    case "tool.call.failed": {
      const toolUseId = (data?.toolCallId as string) ?? (data?.id as string) ?? "";
      const errorMsg = (data?.error as string) ?? (data?.message as string) ?? "Tool call failed";
      return { type: "tool_result", tool_use_id: toolUseId, output: errorMsg, is_error: true };
    }

    case "run.completed": {
      const usage = data?.usage as Record<string, unknown> | undefined;
      const cost = (usage?.costUsd as number) ?? undefined;
      return { type: "result", subtype: "success", cost };
    }

    case "run.failed": {
      const message = (data?.error as string) ?? (data?.message as string) ?? "Run failed";
      return { type: "error", message };
    }

    case "run.cancelled":
    case "run.timed_out": {
      return { type: "result", subtype: "error" };
    }

    case "session.created": {
      const sessionKey = event.sessionKey ?? (data?.key as string) ?? "";
      if (!sessionKey) return null;
      return { type: "sdk_session", sdk_session_id: sessionKey };
    }

    case "approval.requested":
    case "question.requested": {
      // Map to question format — structure depends on gateway implementation
      const id = (data?.id as string) ?? event.id;
      const questions = (data?.questions as Array<unknown>) ?? [];
      return {
        type: "question",
        id,
        questions: questions.map((q) => {
          const qr = q as Record<string, unknown>;
          return {
            question: (qr.question as string) ?? "",
            header: (qr.header as string) ?? "",
            options: ((qr.options as Array<unknown>) ?? []).map((o) => {
              const or = o as Record<string, unknown>;
              return { label: (or.label as string) ?? "", description: or.description as string | undefined };
            }),
            multiSelect: (qr.multiSelect as boolean) ?? false,
          };
        }),
      };
    }

    // Events we skip (thinking, tool deltas, git events, etc.)
    case "thinking.delta":
    case "tool.call.delta":
    case "run.created":
    case "run.queued":
    case "run.started":
    case "approval.resolved":
    case "question.answered":
    case "artifact.created":
    case "artifact.updated":
    case "session.updated":
    case "session.compacted":
    case "task.updated":
    case "git.branch":
    case "git.diff":
    case "git.pr":
    case "raw":
      return null;

    default:
      return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/executor/engines/openclaw/event-mapper.ts
git commit -m "feat(core): add openclaw event to SSE mapper"
```

---

### Task 9: Create chat-proxy.ts

**Files:**
- Create: `packages/core/src/executor/engines/openclaw/chat-proxy.ts`

- [ ] **Step 1: Write streaming chat proxy**

```typescript
/**
 * OpenClaw Chat Proxy
 *
 * Provides streaming chat via OpenClaw SDK, converting events to SSEMessage.
 */

import type { OpenClaw, OpenClawEvent, Run } from "@openclaw/sdk";
import type { SSEMessage, ChatOptions } from "../../ops/types";
import { mapOpenClawEvent } from "./event-mapper";

export class OpenClawChatProxy {
  private client: OpenClaw;
  private currentRun: Run | null = null;
  private currentSessionKey: string | null = null;

  constructor(client: OpenClaw) {
    this.client = client;
  }

  /**
   * Stream a chat interaction, yielding SSEMessage events
   */
  async *stream(options: ChatOptions): AsyncGenerator<SSEMessage> {
    const { prompt, sessionId: sessionKey } = options;

    // Create or resolve session
    let session;
    if (sessionKey) {
      session = await this.client.sessions.get(sessionKey);
    } else {
      session = await this.client.sessions.create({
        key: `viben-${Date.now()}`,
      });
    }

    this.currentSessionKey = session.key;

    // Yield session info
    yield { type: "sdk_session", sdk_session_id: session.key };

    // Send message and get run
    const run = await session.send({ message: prompt });
    this.currentRun = run;

    // Stream events
    for await (const event of run.events()) {
      const sseMessage = mapOpenClawEvent(event as OpenClawEvent);
      if (sseMessage) {
        yield sseMessage;
      }

      // Stop on terminal events
      if (
        event.type === "run.completed" ||
        event.type === "run.failed" ||
        event.type === "run.cancelled" ||
        event.type === "run.timed_out"
      ) {
        break;
      }
    }

    this.currentRun = null;
  }

  /**
   * Abort the current run
   */
  async abort(): Promise<void> {
    if (this.currentRun) {
      await this.currentRun.cancel();
      this.currentRun = null;
    }
  }

  /**
   * Get the current session key
   */
  getSessionKey(): string | null {
    return this.currentSessionKey;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/executor/engines/openclaw/chat-proxy.ts
git commit -m "feat(core): add openclaw streaming chat proxy"
```

---

### Task 10: Create index.ts (OpenClawExecutor)

**Files:**
- Create: `packages/core/src/executor/engines/openclaw/index.ts`

- [ ] **Step 1: Write the main executor class**

```typescript
/**
 * OpenClaw Executor
 *
 * Executor implementation for OpenClaw AI assistant gateway.
 * Uses WebSocket (via @openclaw/sdk) instead of CLI subprocess.
 */

import type { AvailabilityInfo } from "../../../types";
import type {
  ExecutorCapability,
  SpawnOptions,
  ChatOptions,
  ExecutionResult,
  RunCommandOptions,
  SSEMessage,
} from "../../ops/types";
import { registerExecutor } from "../../ops/registry";
import { BaseExecutor } from "../base";
import type { OpenClawExecutorConfig } from "./types";
import { loadGatewayConfig } from "./config";
import { OpenClawProcessManager } from "./process-manager";
import { OpenClawConnectionManager } from "./connection";
import { OpenClawChatProxy } from "./chat-proxy";

export type { OpenClawExecutorConfig } from "./types";

class OpenClawExecutor extends BaseExecutor {
  readonly type = "OPENCLAW" as const;
  protected override config: OpenClawExecutorConfig;
  private processManager: OpenClawProcessManager | null = null;
  private connectionManager: OpenClawConnectionManager | null = null;

  constructor(config: OpenClawExecutorConfig = {}) {
    super(config);
    this.config = config;
  }

  // === Capability Detection ===

  getAvailabilityInfo(): AvailabilityInfo {
    const execPath = this.getExecutablePath();
    const configExists = this.checkAuthFile(
      this.getHomePath(".openclaw", "openclaw.json")
    );

    if (configExists) {
      return {
        status: "LOGIN_DETECTED",
        lastAuthTimestamp: Date.now(),
        path: execPath ?? undefined,
      };
    }

    if (execPath) {
      return {
        status: "INSTALLATION_FOUND",
        path: execPath,
      };
    }

    return { status: "NOT_FOUND" };
  }

  capabilities(): ExecutorCapability[] {
    return ["SPAWN", "CHAT", "CHAT_STREAMING", "SESSION_RESUME"];
  }

  // === Configuration ===

  defaultMcpConfigPath(): string | null {
    return this.getHomePath(".openclaw", "openclaw.json");
  }

  getConfigDirName(): string {
    return ".openclaw";
  }

  getCliName(): string {
    return "openclaw";
  }

  // === Command Building ===

  buildRunCommand(_options: RunCommandOptions): string[] {
    // OpenClaw uses WebSocket, not CLI commands
    return [];
  }

  buildResumeCommand(_sessionId: string): string[] {
    return [];
  }

  getNonInteractiveEnv(): Record<string, string> {
    return {};
  }

  // === Feature Detection ===

  supportsSessionIdOnCreate(): boolean {
    return true;
  }

  supportsCLIAgents(): boolean {
    return false;
  }

  // === Private Helpers ===

  private getGatewayConfig() {
    return loadGatewayConfig({
      host: this.config.gateway?.host,
      port: this.config.gateway?.port,
      token: this.config.gateway?.token,
      password: this.config.gateway?.password,
      cliPath: this.config.cliPath,
      autoStart: this.config.autoStart,
    });
  }

  private async ensureConnected(): Promise<OpenClawConnectionManager> {
    const gwConfig = this.getGatewayConfig();

    // Ensure gateway process is running
    if (!this.processManager) {
      this.processManager = new OpenClawProcessManager(gwConfig);
    }
    await this.processManager.ensureRunning();

    // Connect via SDK
    if (!this.connectionManager) {
      this.connectionManager = new OpenClawConnectionManager(gwConfig);
    }
    await this.connectionManager.connect();
    return this.connectionManager;
  }

  // === Execution Operations ===

  async spawn(options: SpawnOptions): Promise<ExecutionResult> {
    const { prompt, sessionId } = options;

    try {
      const connMgr = await this.ensureConnected();
      const client = connMgr.getClient();

      // Create session
      const session = await client.sessions.create({
        key: sessionId ?? `viben-task-${Date.now()}`,
      });

      // Send prompt and wait for completion
      const run = await session.send(prompt);
      const result = await run.wait();

      return {
        success: result.status === "completed",
        sessionId: session.key,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: "SDK_ERROR",
      };
    }
  }

  async chat(options: ChatOptions): Promise<ExecutionResult> {
    const { prompt, sessionId, resume } = options;

    try {
      const connMgr = await this.ensureConnected();
      const client = connMgr.getClient();

      const sessionKey = resume ?? sessionId ?? `viben-chat-${Date.now()}`;
      let session;
      if (resume) {
        session = await client.sessions.get(sessionKey);
      } else {
        session = await client.sessions.create({ key: sessionKey });
      }

      const run = await session.send(prompt);
      const result = await run.wait();

      return {
        success: result.status === "completed",
        sessionId: session.key,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: "SDK_ERROR",
      };
    }
  }

  async *chatStreaming(options: ChatOptions): AsyncGenerator<SSEMessage> {
    try {
      const connMgr = await this.ensureConnected();
      const client = connMgr.getClient();
      const proxy = new OpenClawChatProxy(client);

      yield* proxy.stream(options);
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async resume(
    sessionId: string,
    options?: Partial<SpawnOptions>
  ): Promise<ExecutionResult> {
    return this.chat({
      prompt: options?.prompt ?? "",
      resume: sessionId,
    });
  }
}

// Register executor
registerExecutor("OPENCLAW", (config) => new OpenClawExecutor(config));

export { OpenClawExecutor };
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/executor/engines/openclaw/index.ts
git commit -m "feat(core): add OpenClawExecutor implementation"
```

---

### Task 11: Register in engines barrel

**Files:**
- Modify: `packages/core/src/executor/engines/index.ts`

- [ ] **Step 1: Add openclaw import and re-export**

Add after `import "./qwen";`:

```typescript
import "./openclaw";
```

Add at the end of the re-exports:

```typescript
export { OpenClawExecutor } from "./openclaw";
export type { OpenClawExecutorConfig } from "./openclaw";
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck`
Expected: No type errors related to openclaw

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/executor/engines/index.ts
git commit -m "feat(core): register openclaw executor in engines barrel"
```

---

### Task 12: Add @openclaw/sdk dependency

**Files:**
- Modify: `packages/core/package.json`

- [ ] **Step 1: Add dependency**

Since `@openclaw/sdk` is private and local, add it as a workspace link or file reference:

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core
# If the SDK is published to a registry:
# pnpm add @openclaw/sdk
# If local:
pnpm add @openclaw/sdk@link:/Users/lxy/Documents/GitHub/others/openclaw/packages/sdk
```

- [ ] **Step 2: Verify install works**

Run: `pnpm install`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): add @openclaw/sdk dependency"
```

---

### Task 13: Add OPENCLAW to gateway WebSocket route

**Files:**
- Modify: `packages/core/src/gateway/routes/agent-ws.ts`

- [ ] **Step 1: Add executor_type handling for OPENCLAW**

In the `agent-ws.ts` file, find where `executor_type` is checked in the `AgentConfigPayload` interface and add OPENCLAW handling. The route should use `OpenClawChatProxy` instead of `SdkChatProxy` when executor type is OPENCLAW.

Add import at top:

```typescript
import { OpenClawExecutor } from "../../executor/engines/openclaw";
import { OpenClawChatProxy } from "../../executor/engines/openclaw/chat-proxy";
import { OpenClawConnectionManager } from "../../executor/engines/openclaw/connection";
import { OpenClawProcessManager } from "../../executor/engines/openclaw/process-manager";
import { loadGatewayConfig } from "../../executor/engines/openclaw/config";
```

In the message handler for `type: "start"`, add a branch for OPENCLAW executor:

```typescript
if (agentConfig?.executor_type === "OPENCLAW") {
  const gwConfig = loadGatewayConfig();
  const processManager = new OpenClawProcessManager(gwConfig);
  await processManager.ensureRunning();
  const connManager = new OpenClawConnectionManager(gwConfig);
  const client = await connManager.connect();
  const proxy = new OpenClawChatProxy(client);

  // Stream events to WebSocket client
  for await (const msg of proxy.stream({ prompt: prompt!, sessionId: query.session_id })) {
    sendJson(ws, msg);
  }
  sendJson(ws, { type: "done" });
  await connManager.disconnect();
  return;
}
```

- [ ] **Step 2: Verify gateway compiles**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/gateway/routes/agent-ws.ts
git commit -m "feat(core): add OPENCLAW executor support in gateway WebSocket route"
```

---

### Task 14: Add OPENCLAW to gateway REST executors route

**Files:**
- Modify: `packages/core/src/gateway/routes/executors.ts`

- [ ] **Step 1: Add OPENCLAW to EXECUTOR_METADATA**

Find the `EXECUTOR_METADATA` constant and add:

```typescript
OPENCLAW: {
  name: "OpenClaw",
  description: "Personal AI assistant gateway with multi-agent routing",
  icon: "openclaw",
  capabilities: ["SPAWN", "CHAT", "CHAT_STREAMING", "SESSION_RESUME"],
},
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/gateway/routes/executors.ts
git commit -m "feat(core): add OPENCLAW metadata to executors REST API"
```

---

### Task 15: Verify full build

**Files:** (none — verification only)

- [ ] **Step 1: Run typecheck**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck`
Expected: All packages pass type checking

- [ ] **Step 2: Run build**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm build`
Expected: Build succeeds without errors

- [ ] **Step 3: Run tests (if applicable)**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core && pnpm test -- --grep openclaw`
Expected: Tests pass (or no tests yet)

---

### Task 16: Add OPENCLAW to desktop app executor list (optional, if needed now)

**Files:**
- This depends on how the desktop app renders executor options. Check `apps/desktop/src/` for executor selector components.

- [ ] **Step 1: Find executor selector in desktop app**

Search for where executor types are listed in the desktop UI and add "OPENCLAW" / "OpenClaw" entry.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/...
git commit -m "feat(desktop): add OpenClaw to executor selector UI"
```
