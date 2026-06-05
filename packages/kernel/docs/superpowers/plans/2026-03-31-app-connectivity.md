# App Connectivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable app clients (desktop/web) to discover and connect to running Viben instances via localhost auto-discovery or remote links. Implement `viben remote` CLI command for generating access tokens with QR codes and connection links.

**Architecture:** CLI command reads instance registry, generates JWT via API, auto-starts tunnel if needed, and outputs 3 link formats + ASCII QR code. A discovery utility reads `~/.viben/instances.json` to find running instances by checking `api.port` files and health endpoints.

**Tech Stack:** qrcode-terminal (ASCII QR), existing instance-registry, existing tunnel plugin, existing API auth system

**Spec:** [docs/superpowers/specs/2026-03-31-app-connectivity-design.md](../specs/2026-03-31-app-connectivity-design.md)
**Depends on:** [Plan 1: API Server Core](./2026-03-31-api-server-core.md), [Plan 2: Auth System](./2026-03-31-auth-system.md)

---

## File Structure

```
src/
  cli/
    commands/
      remote.ts           — CREATE: `viben remote` CLI command
  core/
    instance-discovery.ts — CREATE: Discover running instances from registry
```

---

## Task 1: Install QR Code Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install qrcode-terminal**

```bash
pnpm add qrcode-terminal
pnpm add -D @types/qrcode-terminal
```

If `@types/qrcode-terminal` doesn't exist, the implementing agent should check the package exports. If the package has no types, create a minimal declaration file at `src/types/qrcode-terminal.d.ts`:

```typescript
declare module 'qrcode-terminal' {
  export function generate(text: string, opts?: { small?: boolean }, callback?: (qrcode: string) => void): void;
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add qrcode-terminal for remote access QR code generation"
```

---

## Task 2: Create Instance Discovery Utility

**Files:**
- Create: `src/core/instance-discovery.ts`
- Test: `src/core/__tests__/instance-discovery.test.ts`

- [ ] **Step 1: Write failing tests for instance discovery**

```typescript
// src/core/__tests__/instance-discovery.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverRunningInstances, type DiscoveredInstance } from '../instance-discovery.js';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';

describe('instance-discovery', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'discovery-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when no instances registered', async () => {
    const registryPath = join(tmpDir, 'instances.json');
    await writeFile(registryPath, JSON.stringify({ version: 1, instances: {} }));

    const instances = await discoverRunningInstances(registryPath);
    expect(instances).toHaveLength(0);
  });

  it('discovers a running instance with api.port file', async () => {
    // Create a temporary HTTP server to simulate health endpoint
    const server = http.createServer((req, res) => {
      if (req.url === '/api/v1/system/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port;

    try {
      // Create instance directory with api.port file
      const instanceRoot = join(tmpDir, 'instance1');
      await mkdir(instanceRoot, { recursive: true });
      await writeFile(join(instanceRoot, 'api.port'), String(port));
      await writeFile(
        join(instanceRoot, 'config.json'),
        JSON.stringify({ instanceName: 'Test Instance' }),
      );

      // Create registry pointing to instance
      const registryPath = join(tmpDir, 'instances.json');
      await writeFile(
        registryPath,
        JSON.stringify({
          version: 1,
          instances: { test: { id: 'test', root: instanceRoot } },
        }),
      );

      const instances = await discoverRunningInstances(registryPath);
      expect(instances).toHaveLength(1);
      expect(instances[0].id).toBe('test');
      expect(instances[0].name).toBe('Test Instance');
      expect(instances[0].port).toBe(port);
      expect(instances[0].running).toBe(true);
    } finally {
      server.close();
    }
  });

  it('skips instances without api.port file', async () => {
    const instanceRoot = join(tmpDir, 'stopped-instance');
    await mkdir(instanceRoot, { recursive: true });
    // No api.port file — instance not running

    const registryPath = join(tmpDir, 'instances.json');
    await writeFile(
      registryPath,
      JSON.stringify({
        version: 1,
        instances: { stopped: { id: 'stopped', root: instanceRoot } },
      }),
    );

    const instances = await discoverRunningInstances(registryPath);
    expect(instances).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/core/__tests__/instance-discovery.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement instance discovery**

```typescript
// src/core/instance-discovery.ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface DiscoveredInstance {
  id: string;
  root: string;
  name: string;
  port: number;
  running: boolean;
}

interface RegistryFile {
  version: number;
  instances: Record<string, { id: string; root: string }>;
}

export async function discoverRunningInstances(
  registryPath: string,
): Promise<DiscoveredInstance[]> {
  let registry: RegistryFile;
  try {
    const data = await readFile(registryPath, 'utf-8');
    registry = JSON.parse(data);
  } catch {
    return [];
  }

  const discovered: DiscoveredInstance[] = [];

  for (const entry of Object.values(registry.instances)) {
    try {
      // Check if api.port file exists (indicates running instance)
      const portStr = await readFile(join(entry.root, 'api.port'), 'utf-8');
      const port = parseInt(portStr.trim(), 10);
      if (isNaN(port)) continue;

      // Health check
      const isHealthy = await checkHealth(port);
      if (!isHealthy) continue;

      // Read instance name from config
      let name = entry.id;
      try {
        const configData = await readFile(join(entry.root, 'config.json'), 'utf-8');
        const config = JSON.parse(configData);
        if (config.instanceName) {
          name = config.instanceName;
        }
      } catch {
        // Config might not exist or be unreadable
      }

      discovered.push({
        id: entry.id,
        root: entry.root,
        name,
        port,
        running: true,
      });
    } catch {
      // api.port doesn't exist or can't be read — instance not running
      continue;
    }
  }

  return discovered;
}

async function checkHealth(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/system/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return response.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/core/__tests__/instance-discovery.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/instance-discovery.ts src/core/__tests__/instance-discovery.test.ts
git commit -m "feat(connectivity): add instance discovery utility for running instances"
```

---

## Task 3: Implement `viben remote` CLI Command

**Files:**
- Create: `src/cli/commands/remote.ts`

- [ ] **Step 1: Examine existing CLI command pattern**

Read an existing command (e.g., `src/cli/commands/status.ts` or `src/cli/commands/tunnel.ts`) to understand:
- Export pattern (named export, command definition structure)
- How CLI flags are parsed
- How instance context is resolved
- How output is formatted

- [ ] **Step 2: Implement remote command**

```typescript
// src/cli/commands/remote.ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import qrcode from 'qrcode-terminal';

// The implementing agent must match the exact CLI command definition pattern
// used in this project. Below is a reference implementation — adjust to match
// the project's command registration API.

export async function remoteCommand(opts: {
  role?: string;
  expire?: string;
  scopes?: string;
  name?: string;
  noTunnel?: boolean;
  noQr?: boolean;
  instance?: string;
  instanceRoot: string;
}): Promise<void> {
  const role = opts.role ?? 'admin';
  const expire = opts.expire ?? '24h';
  const instanceRoot = opts.instanceRoot;

  // 1. Check API server is running
  let port: number;
  try {
    const portStr = await readFile(join(instanceRoot, 'api.port'), 'utf-8');
    port = parseInt(portStr.trim(), 10);
  } catch {
    console.error('API server not running. Start with: viben start');
    process.exit(1);
  }

  // Verify health
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/system/health`);
    if (!res.ok) throw new Error('Health check failed');
  } catch {
    console.error('API server not responding on port', port);
    process.exit(1);
  }

  // 2. Read secret token
  let secret: string;
  try {
    secret = (await readFile(join(instanceRoot, 'api-secret'), 'utf-8')).trim();
  } catch {
    console.error('Cannot read API secret. Is the instance set up?');
    process.exit(1);
  }

  // 3. Generate name
  const now = new Date();
  const tokenName =
    opts.name ??
    `remote-${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

  // 4. Generate JWT via API
  const tokenRes = await fetch(`http://127.0.0.1:${port}/api/v1/auth/tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role,
      name: tokenName,
      expire,
      ...(opts.scopes ? { scopes: opts.scopes.split(',').map((s) => s.trim()) } : {}),
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json();
    console.error('Failed to generate token:', err);
    process.exit(1);
  }

  const tokenData = (await tokenRes.json()) as {
    accessToken: string;
    tokenId: string;
    expiresAt: string;
    refreshDeadline: string;
  };

  // 5. Tunnel handling
  let tunnelUrl: string | null = null;
  if (!opts.noTunnel) {
    tunnelUrl = await getTunnelUrl(port, secret);
  }

  // 6. Generate links
  const localLink = `http://localhost:${port}?token=${tokenData.accessToken}`;
  const tunnelLink = tunnelUrl ? `${tunnelUrl}?token=${tokenData.accessToken}` : null;
  const tunnelHost = tunnelUrl ? new URL(tunnelUrl).host : null;
  const appLink = tunnelHost
    ? `viben://connect?host=${tunnelHost}&token=${tokenData.accessToken}`
    : `viben://connect?host=localhost&port=${port}&token=${tokenData.accessToken}`;

  // 7. Output
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Viben Remote Access                                       ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Token:   ${tokenName.padEnd(49)}║`);
  console.log(`║  Role:    ${role.padEnd(49)}║`);
  console.log(`║  Expires: ${new Date(tokenData.expiresAt).toLocaleString().padEnd(49)}║`);
  console.log(`║  Refresh: until ${new Date(tokenData.refreshDeadline).toLocaleString().padEnd(43)}║`);
  console.log('║                                                              ║');
  console.log('║  Local:                                                      ║');
  console.log(`║  ${localLink}`);
  console.log('║                                                              ║');

  if (tunnelLink) {
    console.log('║  Tunnel:                                                     ║');
    console.log(`║  ${tunnelLink}`);
    console.log('║                                                              ║');
  }

  console.log('║  App:                                                        ║');
  console.log(`║  ${appLink}`);
  console.log('║                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // 8. QR code
  if (!opts.noQr) {
    const qrLink = tunnelLink ?? localLink;
    console.log('');
    console.log('Scan QR code to connect:');
    qrcode.generate(qrLink, { small: true });
  }

  console.log('');
}

async function getTunnelUrl(port: number, secret: string): Promise<string | null> {
  try {
    // Check if tunnel is already running via API
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/system/health`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return null;

    const health = (await res.json()) as { tunnel?: { url?: string } };
    if (health.tunnel?.url) {
      return health.tunnel.url;
    }

    // Tunnel not running — try to start it
    // The implementing agent should check if there's a tunnel start API endpoint
    // or if the tunnel plugin needs to be accessed differently
    const tunnelRes = await fetch(`http://127.0.0.1:${port}/api/v1/tunnel/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    });

    if (tunnelRes.ok) {
      const tunnelData = (await tunnelRes.json()) as { url?: string };
      return tunnelData.url ?? null;
    }

    return null;
  } catch {
    return null;
  }
}
```

Note: The implementing agent must:
- Match the exact CLI command registration pattern (check `src/cli.ts` or an existing command)
- Verify how flags are parsed (yargs, commander, custom?)
- Verify the tunnel API endpoint exists and its exact response format
- Check the health endpoint response shape for tunnel URL

- [ ] **Step 3: Register the remote command in CLI**

Check `src/cli.ts` to understand how commands are registered. Add `remote` command with flags:
- `--role <role>` (default: admin)
- `--expire <duration>` (default: 24h)
- `--scopes <scopes>` (comma-separated)
- `--name <label>`
- `--no-tunnel`
- `--no-qr`
- `--instance <id>`

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/remote.ts src/cli.ts
git commit -m "feat(connectivity): add viben remote CLI command with token and QR generation"
```

---

## Task 4: Manual End-to-End Test

This task is a manual verification that the full flow works.

- [ ] **Step 1: Start Viben with API server**

```bash
pnpm start
```

- [ ] **Step 2: Run viben remote**

```bash
pnpm start -- remote
```

Expected output:
- Token info (name, role, expiry, refresh deadline)
- Local link with JWT
- Tunnel link (if tunnel configured) or skip
- App link with viben:// scheme
- QR code (ASCII art)

- [ ] **Step 3: Test local link**

```bash
# Copy the local link and test it
curl "http://localhost:<port>/api/v1/auth/me" -H "Authorization: Bearer <jwt-from-link>"
```

Expected: Returns `{ type: "jwt", role: "admin", ... }`

- [ ] **Step 4: Test token refresh**

```bash
curl -X POST "http://localhost:<port>/api/v1/auth/refresh" -H "Authorization: Bearer <jwt>"
```

Expected: Returns new access token with same tokenId.

- [ ] **Step 5: Test token revocation**

```bash
# List tokens
curl "http://localhost:<port>/api/v1/auth/tokens" -H "Authorization: Bearer <secret>"

# Revoke the token
curl -X DELETE "http://localhost:<port>/api/v1/auth/tokens/<tokenId>" -H "Authorization: Bearer <secret>"

# Verify old JWT no longer works
curl "http://localhost:<port>/api/v1/auth/me" -H "Authorization: Bearer <old-jwt>"
```

Expected: 401 "Token revoked"

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(connectivity): address issues found during manual testing"
```
