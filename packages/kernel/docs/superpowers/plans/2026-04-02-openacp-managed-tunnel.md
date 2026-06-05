# Viben Managed Tunnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unauthenticated Cloudflare quick tunnels with Viben-provisioned named tunnels via a Cloudflare Worker, giving users stable `*.tunnel.viben.ai` URLs with no rate limits.

**Architecture:** A Cloudflare Worker handles tunnel lifecycle (create/ping/delete) via the Cloudflare REST API, persisting metadata in Workers KV. The Viben CLI calls the Worker to obtain a named tunnel token, then runs `cloudflared --token` locally. Tunnel credentials are persisted in plugin storage so restarts reuse the same URL. If the Worker is unreachable, fall back to the existing quick-tunnel Cloudflare provider.

**Tech Stack:** Cloudflare Workers (Hono, Workers KV, Cron Triggers), TypeScript, cloudflared binary, Vitest (core tests)

---

## File Map

### Phase 1 — Cloudflare Worker (`viben-tunnel-worker/`)

| File | Purpose |
|------|---------|
| `package.json` | Project deps: hono, wrangler |
| `tsconfig.json` | TS config for Workers runtime |
| `wrangler.toml` | KV bindings, cron trigger, secrets |
| `src/types.ts` | Shared interfaces (Env, TunnelRecord, API responses) |
| `src/lib/cloudflare-api.ts` | CF REST API: createTunnel, getToken, createDns, deleteDns, deleteTunnel |
| `src/lib/rate-limit.ts` | IP rate limiter using KV |
| `src/lib/subdomain.ts` | Random 8-char hex subdomain generator |
| `src/routes/create.ts` | POST /tunnel/create |
| `src/routes/ping.ts` | POST /tunnel/:id/ping |
| `src/routes/destroy.ts` | DELETE /tunnel/:id |
| `src/cron.ts` | Cron handler — cleanup expired tunnels |
| `src/index.ts` | Hono app wiring |

### Phase 2 — Viben Core (`Viben/`)

| File | Change |
|------|--------|
| `src/plugins/tunnel/providers/viben.ts` | **NEW** — VibenTunnelProvider |
| `src/plugins/tunnel/tunnel-registry.ts` | Add `storage` param, add `viben` case, update fallback default |
| `src/plugins/tunnel/tunnel-service.ts` | Forward `storage` param |
| `src/plugins/tunnel/index.ts` | Add storage permissions, pass storage, update install/configure options, change default provider |
| `src/plugins/tunnel/__tests__/viben-provider.test.ts` | **NEW** — provider unit tests |

---

## Phase 1: Cloudflare Worker

### Task 1: Project Scaffolding

**Files:**
- Create: `viben-tunnel-worker/package.json`
- Create: `viben-tunnel-worker/tsconfig.json`
- Create: `viben-tunnel-worker/wrangler.toml`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir -p /Users/lucas/code/viben-workspace/viben-tunnel-worker
cd /Users/lucas/code/viben-workspace/viben-tunnel-worker
```

```json
// package.json
{
  "name": "viben-tunnel-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "cf-typegen": "wrangler types"
  },
  "dependencies": {
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241106.0",
    "typescript": "^5.5.0",
    "wrangler": "^3.80.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create wrangler.toml**

```toml
# wrangler.toml
name = "viben-tunnel-worker"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[[kv_namespaces]]
binding = "TUNNELS"
id = "REPLACE_WITH_KV_ID"
preview_id = "REPLACE_WITH_KV_PREVIEW_ID"

[triggers]
crons = ["*/10 * * * *"]

# Secrets (set via: wrangler secret put <NAME>)
# CF_API_TOKEN
# CF_ACCOUNT_ID
# CF_ZONE_ID
# CF_DOMAIN          (e.g. "tunnel.viben.ai")
# VIBEN_API_KEY
```

- [ ] **Step 4: Install dependencies**

```bash
cd /Users/lucas/code/viben-workspace/viben-tunnel-worker
npm install
```

- [ ] **Step 5: Create KV namespace**

```bash
wrangler kv:namespace create TUNNELS
wrangler kv:namespace create TUNNELS --preview
```

Copy the `id` and `preview_id` values into `wrangler.toml`.

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold viben-tunnel-worker project"
```

---

### Task 2: Shared Types

**Files:**
- Create: `viben-tunnel-worker/src/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// src/types.ts

export interface Env {
  TUNNELS: KVNamespace
  CF_API_TOKEN: string
  CF_ACCOUNT_ID: string
  CF_ZONE_ID: string
  CF_DOMAIN: string        // e.g. "tunnel.viben.ai"
  VIBEN_API_KEY: string
}

// Stored in KV under key "tunnel:<tunnelId>"
export interface TunnelRecord {
  tunnelId: string
  dnsRecordId: string      // CF DNS record ID (needed for deletion)
  subdomain: string        // e.g. "abc123" (without domain suffix)
  createdAt: number        // unix seconds
  lastPing: number         // unix seconds
}

// Response from POST /tunnel/create
export interface CreateTunnelResponse {
  tunnelId: string
  publicUrl: string        // https://<subdomain>.<CF_DOMAIN>
  token: string            // cloudflared tunnel token
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared types for tunnel worker"
```

---

### Task 3: Cloudflare API Client

**Files:**
- Create: `viben-tunnel-worker/src/lib/cloudflare-api.ts`

- [ ] **Step 1: Create cloudflare-api.ts**

```typescript
// src/lib/cloudflare-api.ts

const CF_BASE = 'https://api.cloudflare.com/client/v4'

async function cfFetch<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${CF_BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const body = await res.json() as { success: boolean; result: T; errors: { message: string }[] }
  if (!body.success) {
    throw new Error(`CF API error on ${path}: ${body.errors.map(e => e.message).join(', ')}`)
  }
  return body.result
}

export async function createTunnel(
  token: string,
  accountId: string,
  name: string,
): Promise<{ id: string }> {
  return cfFetch<{ id: string }>(token, `/accounts/${accountId}/cfd_tunnel`, {
    method: 'POST',
    body: JSON.stringify({ name, config_src: 'cloudflare' }),
  })
}

export async function getTunnelToken(
  token: string,
  accountId: string,
  tunnelId: string,
): Promise<string> {
  return cfFetch<string>(token, `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`)
}

export async function createDnsRecord(
  token: string,
  zoneId: string,
  subdomain: string,    // e.g. "abc123.tunnel"  (relative to zone root)
  tunnelId: string,
): Promise<{ id: string }> {
  return cfFetch<{ id: string }>(token, `/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'CNAME',
      name: subdomain,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true,
      ttl: 1,
    }),
  })
}

export async function deleteDnsRecord(
  token: string,
  zoneId: string,
  dnsRecordId: string,
): Promise<void> {
  await cfFetch<unknown>(token, `/zones/${zoneId}/dns_records/${dnsRecordId}`, {
    method: 'DELETE',
  })
}

export async function deleteTunnel(
  token: string,
  accountId: string,
  tunnelId: string,
): Promise<void> {
  await cfFetch<unknown>(token, `/accounts/${accountId}/cfd_tunnel/${tunnelId}`, {
    method: 'DELETE',
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cloudflare-api.ts
git commit -m "feat: add Cloudflare REST API client"
```

---

### Task 4: Rate Limiter + Subdomain Generator

**Files:**
- Create: `viben-tunnel-worker/src/lib/rate-limit.ts`
- Create: `viben-tunnel-worker/src/lib/subdomain.ts`

- [ ] **Step 1: Create rate-limit.ts**

```typescript
// src/lib/rate-limit.ts

const MAX_CREATES_PER_HOUR = 5
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

export async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
  const key = `ratelimit:${ip}`
  const raw = await kv.get(key)
  const count = raw ? parseInt(raw, 10) : 0

  if (count >= MAX_CREATES_PER_HOUR) return false

  // Increment — TTL resets window from first request in window
  await kv.put(key, String(count + 1), { expirationTtl: WINDOW_MS / 1000 })
  return true
}
```

- [ ] **Step 2: Create subdomain.ts**

```typescript
// src/lib/subdomain.ts

import type { KVNamespace } from '@cloudflare/workers-types'

function randomHex(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length)
}

// Returns an 8-char hex subdomain not already in KV
export async function generateSubdomain(kv: KVNamespace): Promise<string> {
  for (let i = 0; i < 3; i++) {
    const sub = randomHex(8)
    const existing = await kv.get(`subdomain:${sub}`)
    if (!existing) return sub
  }
  throw new Error('Failed to generate unique subdomain after 3 attempts')
}

// Reserve a subdomain in KV to prevent collision during creation
export async function reserveSubdomain(kv: KVNamespace, sub: string, tunnelId: string): Promise<void> {
  await kv.put(`subdomain:${sub}`, tunnelId, { expirationTtl: 90 * 24 * 60 * 60 }) // 90d safety TTL
}

export async function releaseSubdomain(kv: KVNamespace, sub: string): Promise<void> {
  await kv.delete(`subdomain:${sub}`)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/subdomain.ts
git commit -m "feat: add rate limiter and subdomain generator"
```

---

### Task 5: POST /tunnel/create Route

**Files:**
- Create: `viben-tunnel-worker/src/routes/create.ts`

- [ ] **Step 1: Create create.ts**

```typescript
// src/routes/create.ts

import type { Context } from 'hono'
import type { Env, CreateTunnelResponse, TunnelRecord } from '../types.js'
import { createTunnel, getTunnelToken, createDnsRecord } from '../lib/cloudflare-api.js'
import { checkRateLimit } from '../lib/rate-limit.js'
import { generateSubdomain, reserveSubdomain } from '../lib/subdomain.js'

export async function handleCreate(c: Context<{ Bindings: Env }>): Promise<Response> {
  const env = c.env
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'

  // Rate limit
  const allowed = await checkRateLimit(env.TUNNELS, ip)
  if (!allowed) {
    return c.json({ error: 'Rate limit exceeded. Max 5 tunnels per hour.' }, 429)
  }

  // Generate unique subdomain
  const subdomain = await generateSubdomain(env.TUNNELS)
  const tunnelName = `viben-${subdomain}`
  // DNS name relative to zone root: "abc123.tunnel" for tunnel.viben.ai
  const dnsName = `${subdomain}.tunnel`

  let tunnelId = ''
  let dnsRecordId = ''

  try {
    // 1. Create named tunnel
    const tunnel = await createTunnel(env.CF_API_TOKEN, env.CF_ACCOUNT_ID, tunnelName)
    tunnelId = tunnel.id

    // 2. Create DNS CNAME record
    const dns = await createDnsRecord(env.CF_API_TOKEN, env.CF_ZONE_ID, dnsName, tunnelId)
    dnsRecordId = dns.id

    // 3. Get tunnel token
    const token = await getTunnelToken(env.CF_API_TOKEN, env.CF_ACCOUNT_ID, tunnelId)

    // 4. Reserve subdomain + persist to KV
    await reserveSubdomain(env.TUNNELS, subdomain, tunnelId)

    const now = Math.floor(Date.now() / 1000)
    const record: TunnelRecord = {
      tunnelId,
      dnsRecordId,
      subdomain,
      createdAt: now,
      lastPing: now,
    }
    await env.TUNNELS.put(`tunnel:${tunnelId}`, JSON.stringify(record))

    const publicUrl = `https://${subdomain}.${env.CF_DOMAIN}`
    const response: CreateTunnelResponse = { tunnelId, publicUrl, token }
    return c.json(response, 201)
  } catch (err) {
    // Partial cleanup on failure — best-effort, order matters: DNS before tunnel
    if (dnsRecordId) {
      try { await import('../lib/cloudflare-api.js').then(m => m.deleteDnsRecord(env.CF_API_TOKEN, env.CF_ZONE_ID, dnsRecordId)) } catch { /* ignore */ }
    }
    if (tunnelId) {
      try { await import('../lib/cloudflare-api.js').then(m => m.deleteTunnel(env.CF_API_TOKEN, env.CF_ACCOUNT_ID, tunnelId)) } catch { /* ignore */ }
    }
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: `Failed to create tunnel: ${message}` }, 500)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/create.ts
git commit -m "feat: add POST /tunnel/create route"
```

---

### Task 6: Ping + Destroy Routes

**Files:**
- Create: `viben-tunnel-worker/src/routes/ping.ts`
- Create: `viben-tunnel-worker/src/routes/destroy.ts`

- [ ] **Step 1: Create ping.ts**

```typescript
// src/routes/ping.ts

import type { Context } from 'hono'
import type { Env, TunnelRecord } from '../types.js'

export async function handlePing(c: Context<{ Bindings: Env }>): Promise<Response> {
  const tunnelId = c.req.param('id')
  const key = `tunnel:${tunnelId}`

  const raw = await c.env.TUNNELS.get(key)
  if (!raw) return c.json({ error: 'Tunnel not found' }, 404)

  const record = JSON.parse(raw) as TunnelRecord
  record.lastPing = Math.floor(Date.now() / 1000)
  await c.env.TUNNELS.put(key, JSON.stringify(record))

  return c.json({ ok: true })
}
```

- [ ] **Step 2: Create destroy.ts**

```typescript
// src/routes/destroy.ts

import type { Context } from 'hono'
import type { Env, TunnelRecord } from '../types.js'
import { deleteDnsRecord, deleteTunnel } from '../lib/cloudflare-api.js'
import { releaseSubdomain } from '../lib/subdomain.js'

export async function handleDestroy(c: Context<{ Bindings: Env }>): Promise<Response> {
  const tunnelId = c.req.param('id')
  const key = `tunnel:${tunnelId}`

  const raw = await c.env.TUNNELS.get(key)
  if (!raw) return c.json({ error: 'Tunnel not found' }, 404)

  const record = JSON.parse(raw) as TunnelRecord

  // Delete DNS record, tunnel, and KV entry
  // Each step is best-effort — continue even if one fails
  const errors: string[] = []

  try {
    await deleteDnsRecord(c.env.CF_API_TOKEN, c.env.CF_ZONE_ID, record.dnsRecordId)
  } catch (e) {
    errors.push(`DNS: ${(e as Error).message}`)
  }

  try {
    await deleteTunnel(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID, tunnelId)
  } catch (e) {
    errors.push(`Tunnel: ${(e as Error).message}`)
  }

  await releaseSubdomain(c.env.TUNNELS, record.subdomain)
  await c.env.TUNNELS.delete(key)

  if (errors.length > 0) {
    return c.json({ ok: true, warnings: errors }, 200)
  }
  return c.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/ping.ts src/routes/destroy.ts
git commit -m "feat: add ping and destroy routes"
```

---

### Task 7: Cron Cleanup Handler

**Files:**
- Create: `viben-tunnel-worker/src/cron.ts`

- [ ] **Step 1: Create cron.ts**

```typescript
// src/cron.ts

import type { Env, TunnelRecord } from './types.js'
import { deleteDnsRecord, deleteTunnel } from './lib/cloudflare-api.js'
import { releaseSubdomain } from './lib/subdomain.js'

const TTL_SECONDS = 24 * 60 * 60 // 24 hours

export async function handleCron(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const list = await env.TUNNELS.list({ prefix: 'tunnel:' })

  await Promise.allSettled(
    list.keys.map(async ({ name }) => {
      const raw = await env.TUNNELS.get(name)
      if (!raw) return

      const record = JSON.parse(raw) as TunnelRecord
      if (now - record.lastPing < TTL_SECONDS) return

      // Expired — delete everything
      try { await deleteDnsRecord(env.CF_API_TOKEN, env.CF_ZONE_ID, record.dnsRecordId) } catch { /* best-effort */ }
      try { await deleteTunnel(env.CF_API_TOKEN, env.CF_ACCOUNT_ID, record.tunnelId) } catch { /* best-effort */ }
      await releaseSubdomain(env.TUNNELS, record.subdomain)
      await env.TUNNELS.delete(name)
    })
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cron.ts
git commit -m "feat: add cron cleanup handler"
```

---

### Task 8: Wire App + Auth Middleware

**Files:**
- Create: `viben-tunnel-worker/src/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
// src/index.ts

import { Hono } from 'hono'
import type { Env } from './types.js'
import { handleCreate } from './routes/create.js'
import { handlePing } from './routes/ping.js'
import { handleDestroy } from './routes/destroy.js'
import { handleCron } from './cron.js'

const app = new Hono<{ Bindings: Env }>()

// Auth middleware for all non-health routes
app.use('/tunnel/*', async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth || auth !== `Bearer ${c.env.VIBEN_API_KEY}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return next()
})

app.get('/health', c => c.json({ ok: true }))
app.post('/tunnel/create', handleCreate)
app.post('/tunnel/:id/ping', handlePing)
app.delete('/tunnel/:id', handleDestroy)

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleCron(env))
  },
}
```

- [ ] **Step 2: Set secrets**

```bash
wrangler secret put CF_API_TOKEN
wrangler secret put CF_ACCOUNT_ID
wrangler secret put CF_ZONE_ID
wrangler secret put CF_DOMAIN       # value: tunnel.viben.ai
wrangler secret put VIBEN_API_KEY
```

- [ ] **Step 3: Test locally**

```bash
wrangler dev
# In another terminal:
curl -X GET http://localhost:8787/health
# Expected: {"ok":true}

curl -X POST http://localhost:8787/tunnel/create \
  -H "Authorization: Bearer <your-test-key>"
# Expected: {"tunnelId":"...","publicUrl":"https://....tunnel.viben.ai","token":"eyJ..."}
```

- [ ] **Step 4: Deploy**

```bash
wrangler deploy
```

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire Hono app with auth middleware and scheduled cron"
```

---

## Phase 2: Viben Core

### Task 9: VibenTunnelProvider

**Files:**
- Create: `Viben/src/plugins/tunnel/providers/viben.ts`
- Create: `Viben/src/plugins/tunnel/__tests__/viben-provider.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/plugins/tunnel/__tests__/viben-provider.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VibenTunnelProvider } from '../providers/viben.js'
import type { PluginStorage } from '../../../core/plugin/types.js'

// Mock cloudflared spawn — never actually spawn a process in tests
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn(() => true) }
})
vi.mock('../providers/install-cloudflared.js', () => ({
  ensureCloudflared: vi.fn().mockResolvedValue('/mock/cloudflared'),
}))

import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'

function makeStorage(initial: Record<string, unknown> = {}): PluginStorage {
  const store = { ...initial }
  return {
    get: vi.fn(async (key: string) => store[key] as any),
    set: vi.fn(async (key: string, value: unknown) => { store[key] = value }),
    delete: vi.fn(async (key: string) => { delete store[key] }),
    list: vi.fn(async () => Object.keys(store)),
    getDataDir: vi.fn(() => '/tmp/test-storage'),
    _store: store,
  } as any
}

function makeProcess(exitCode: number | null = null, exitAfterMs = 20_000): EventEmitter & { kill: ReturnType<typeof vi.fn> } {
  const proc = new EventEmitter() as any
  proc.kill = vi.fn()
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  if (exitAfterMs < 20_000) {
    setTimeout(() => proc.emit('exit', exitCode), exitAfterMs)
  }
  return proc
}

describe('VibenTunnelProvider', () => {
  let storage: ReturnType<typeof makeStorage>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    storage = makeStorage()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('creates a new tunnel when no saved state', async () => {
    const proc = makeProcess()
    vi.mocked(spawn).mockReturnValue(proc as any)

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tunnelId: 'cf-123',
        token: 'tok-abc',
        publicUrl: 'https://abc.tunnel.viben.ai',
      }),
    })

    const provider = new VibenTunnelProvider({}, '/mock/bin', storage)
    const startPromise = provider.start(3100)

    // Advance past startup timeout (15s)
    await vi.advanceTimersByTimeAsync(15_001)
    const url = await startPromise

    expect(url).toBe('https://abc.tunnel.viben.ai')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/tunnel/create'),
      expect.objectContaining({ method: 'POST' }),
    )
    // State persisted
    expect(storage.set).toHaveBeenCalledWith('viben-tunnels', {
      '3100': { tunnelId: 'cf-123', token: 'tok-abc', publicUrl: 'https://abc.tunnel.viben.ai' },
    })
  })

  it('reuses saved tunnel when worker ping returns 200', async () => {
    const saved = { '3100': { tunnelId: 'cf-old', token: 'tok-old', publicUrl: 'https://old.tunnel.viben.ai' } }
    storage = makeStorage({ 'viben-tunnels': saved })

    const proc = makeProcess()
    vi.mocked(spawn).mockReturnValue(proc as any)

    // Ping returns OK; no create call
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const provider = new VibenTunnelProvider({}, '/mock/bin', storage)
    const startPromise = provider.start(3100)
    await vi.advanceTimersByTimeAsync(15_001)
    const url = await startPromise

    expect(url).toBe('https://old.tunnel.viben.ai')
    // Only one fetch call (ping), no create
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/tunnel/cf-old/ping'),
      expect.anything(),
    )
  })

  it('creates new tunnel when saved state ping fails', async () => {
    const saved = { '3100': { tunnelId: 'cf-old', token: 'tok-old', publicUrl: 'https://old.tunnel.viben.ai' } }
    storage = makeStorage({ 'viben-tunnels': saved })

    const proc = makeProcess()
    vi.mocked(spawn).mockReturnValue(proc as any)

    fetchMock
      .mockResolvedValueOnce({ ok: false })  // ping fails
      .mockResolvedValueOnce({               // create succeeds
        ok: true,
        json: async () => ({ tunnelId: 'cf-new', token: 'tok-new', publicUrl: 'https://new.tunnel.viben.ai' }),
      })

    const provider = new VibenTunnelProvider({}, '/mock/bin', storage)
    const startPromise = provider.start(3100)
    await vi.advanceTimersByTimeAsync(15_001)
    const url = await startPromise

    expect(url).toBe('https://new.tunnel.viben.ai')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws when cloudflared exits before 15s startup window', async () => {
    const proc = makeProcess(1, 100)  // exits after 100ms
    vi.mocked(spawn).mockReturnValue(proc as any)

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tunnelId: 'cf-x', token: 'tok-x', publicUrl: 'https://x.tunnel.viben.ai' }),
    })

    const provider = new VibenTunnelProvider({}, '/mock/bin', storage)
    const startPromise = provider.start(3100)
    await vi.advanceTimersByTimeAsync(200)

    await expect(startPromise).rejects.toThrow('exited with code 1')
  })

  it('does not delete state on crash, fires onExit callback', async () => {
    const proc = makeProcess()
    vi.mocked(spawn).mockReturnValue(proc as any)

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tunnelId: 'cf-123', token: 'tok-abc', publicUrl: 'https://abc.tunnel.viben.ai' }),
    })

    const onExit = vi.fn()
    const provider = new VibenTunnelProvider({}, '/mock/bin', storage)
    provider.onExit(onExit)

    const startPromise = provider.start(3100)
    await vi.advanceTimersByTimeAsync(15_001)
    await startPromise

    // Simulate post-establishment crash
    proc.emit('exit', 1)

    expect(onExit).toHaveBeenCalledWith(1)
    // Storage NOT cleared (so retry can reuse token)
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('deletes state and calls worker DELETE on explicit stop', async () => {
    const proc = makeProcess()
    vi.mocked(spawn).mockReturnValue(proc as any)

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tunnelId: 'cf-123', token: 'tok', publicUrl: 'https://abc.tunnel.viben.ai' }) })
      .mockResolvedValue({ ok: true, json: async () => ({}) })  // DELETE + heartbeats

    const provider = new VibenTunnelProvider({}, '/mock/bin', storage)
    const startPromise = provider.start(3100)
    await vi.advanceTimersByTimeAsync(15_001)
    await startPromise

    await provider.stop()

    const deleteCalls = fetchMock.mock.calls.filter(([url, init]) =>
      String(url).includes('/tunnel/cf-123') && (init as RequestInit)?.method === 'DELETE'
    )
    expect(deleteCalls.length).toBe(1)
    expect(storage.set).toHaveBeenLastCalledWith('viben-tunnels', {})
  })

  it('falls back to cloudflare quick tunnel when worker is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed'))

    const provider = new VibenTunnelProvider({}, '/mock/bin', storage)
    await expect(provider.start(3100)).rejects.toThrow('fetch failed')
    // The TunnelRegistry handles the retry/fallback at a higher level
  })
})
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test src/plugins/tunnel/__tests__/viben-provider.test.ts
# Expected: FAIL — VibenTunnelProvider not found
```

- [ ] **Step 3: Implement VibenTunnelProvider**

```typescript
// src/plugins/tunnel/providers/viben.ts

import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createChildLogger } from '../../../core/utils/log.js'
import { commandExists } from '../../../core/agents/agent-dependencies.js'
import type { TunnelProvider } from '../provider.js'
import type { PluginStorage } from '../../../core/plugin/types.js'

const log = createChildLogger({ module: 'viben-tunnel' })

export const DEFAULT_WORKER_URL = 'https://tunnel-worker.viben.ai'
export const DEFAULT_API_KEY = 'VIBEN_SHARED_KEY_V1' // rotatable via release

const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000  // 10 min
const STARTUP_TIMEOUT_MS = 15_000
const SIGKILL_TIMEOUT_MS = 5_000
const STORAGE_KEY = 'viben-tunnels'

interface TunnelState {
  tunnelId: string
  token: string
  publicUrl: string
}

type TunnelStateMap = Record<string, TunnelState>

export class VibenTunnelProvider implements TunnelProvider {
  private child: ChildProcess | null = null
  private publicUrl = ''
  private tunnelId = ''
  private localPort = 0
  private heartbeat: NodeJS.Timeout | null = null
  private exitCallback: ((code: number | null) => void) | null = null

  private readonly storage: PluginStorage
  private readonly workerUrl: string
  private readonly apiKey: string
  private readonly binDir: string

  constructor(options: Record<string, unknown>, binDir: string, storage: PluginStorage) {
    this.storage = storage
    this.binDir = binDir
    this.workerUrl = (options.workerUrl as string | undefined) ?? DEFAULT_WORKER_URL
    this.apiKey = (options.apiKey as string | undefined) ?? DEFAULT_API_KEY
  }

  onExit(callback: (code: number | null) => void): void {
    this.exitCallback = callback
  }

  async start(localPort: number): Promise<string> {
    this.localPort = localPort

    const binaryPath = await this.resolveBinary()
    const all = await this.loadState()
    const saved = all[String(localPort)]

    let { token, publicUrl, tunnelId } = await this.resolveCredentials(saved, all, localPort)

    this.tunnelId = tunnelId
    this.publicUrl = publicUrl

    await this.spawnCloudflared(binaryPath, token, localPort)
    this.startHeartbeat()

    return publicUrl
  }

  async stop(force = false): Promise<void> {
    this.stopHeartbeat()

    const child = this.child
    const tunnelId = this.tunnelId
    const localPort = this.localPort

    this.child = null
    this.exitCallback = null

    if (child) {
      child.kill(force ? 'SIGKILL' : 'SIGTERM')

      if (!force) {
        const exited = await Promise.race([
          new Promise<boolean>(resolve => child.on('exit', () => resolve(true))),
          new Promise<boolean>(resolve => setTimeout(() => resolve(false), SIGKILL_TIMEOUT_MS)),
        ])
        if (!exited) child.kill('SIGKILL')
      }
    }

    if (tunnelId) {
      // Fire-and-forget DELETE to worker
      this.deleteFromWorker(tunnelId).catch(err => {
        log.warn({ err: (err as Error).message }, 'Failed to delete tunnel from worker')
      })

      // Clear state for this port
      const all = await this.loadState()
      delete all[String(localPort)]
      await this.storage.set(STORAGE_KEY, all)
    }

    log.info({ localPort }, 'Viben tunnel stopped')
  }

  getPublicUrl(): string {
    return this.publicUrl
  }

  private async resolveCredentials(
    saved: TunnelState | undefined,
    all: TunnelStateMap,
    localPort: number,
  ): Promise<TunnelState> {
    if (saved) {
      const alive = await this.pingWorker(saved.tunnelId)
      if (alive) {
        log.info({ publicUrl: saved.publicUrl }, 'Reusing existing tunnel')
        return saved
      }
      // Saved state is stale — discard
      log.info({ tunnelId: saved.tunnelId }, 'Saved tunnel expired, creating new one')
      delete all[String(localPort)]
    }

    const fresh = await this.createTunnel()
    all[String(localPort)] = fresh
    await this.storage.set(STORAGE_KEY, all)
    return fresh
  }

  private async spawnCloudflared(binaryPath: string, token: string, port: number): Promise<void> {
    const args = ['tunnel', 'run', '--token', token, '--url', `http://localhost:${port}`]

    return new Promise<void>((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void): void => {
        if (!settled) { settled = true; fn() }
      }

      // Named tunnel token mode: process stays alive after connect.
      // If it hasn't exited within STARTUP_TIMEOUT_MS, assume established.
      const timeout = setTimeout(() => {
        settle(resolve)
      }, STARTUP_TIMEOUT_MS)

      let child: ChildProcess
      try {
        child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
      } catch (err) {
        clearTimeout(timeout)
        settle(() => reject(new Error(`Failed to start cloudflared at ${binaryPath}`)))
        return
      }

      this.child = child

      child.on('error', (err) => {
        clearTimeout(timeout)
        settle(() => reject(new Error(`cloudflared failed to start: ${err.message}`)))
      })

      child.on('exit', (code) => {
        clearTimeout(timeout)
        if (!settled) {
          settle(() => reject(new Error(`cloudflared exited with code ${code} before establishing tunnel`)))
        } else {
          // Post-establishment crash
          log.error({ code }, 'cloudflared exited unexpectedly after establishment')
          this.stopHeartbeat()
          this.child = null
          this.exitCallback?.(code)
        }
      })
    })
  }

  private async createTunnel(): Promise<TunnelState> {
    const res = await fetch(`${this.workerUrl}/tunnel/create`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Worker /tunnel/create failed: ${res.status} ${body}`)
    }
    return res.json() as Promise<TunnelState>
  }

  private async pingWorker(tunnelId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.workerUrl}/tunnel/${tunnelId}/ping`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  private async deleteFromWorker(tunnelId: string): Promise<void> {
    const res = await fetch(`${this.workerUrl}/tunnel/${tunnelId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    if (!res.ok) throw new Error(`DELETE /tunnel/${tunnelId} returned ${res.status}`)
  }

  private startHeartbeat(): void {
    this.heartbeat = setInterval(async () => {
      if (!this.tunnelId) return
      const alive = await this.pingWorker(this.tunnelId)
      if (!alive) {
        log.warn({ tunnelId: this.tunnelId }, 'Heartbeat ping failed — tunnel may have expired on worker')
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
  }

  private async loadState(): Promise<TunnelStateMap> {
    return (await this.storage.get<TunnelStateMap>(STORAGE_KEY)) ?? {}
  }

  private async resolveBinary(): Promise<string> {
    if (commandExists('cloudflared')) return 'cloudflared'

    const binPath = path.join(this.binDir, 'cloudflared')
    if (fs.existsSync(binPath)) return binPath

    log.warn('cloudflared not found, attempting auto-install...')
    const { ensureCloudflared } = await import('./install-cloudflared.js')
    return ensureCloudflared()
  }
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
pnpm test src/plugins/tunnel/__tests__/viben-provider.test.ts
# Expected: PASS (6 tests)
```

- [ ] **Step 5: Commit**

```bash
git add src/plugins/tunnel/providers/viben.ts src/plugins/tunnel/__tests__/viben-provider.test.ts
git commit -m "feat: add VibenTunnelProvider with tests"
```

---

### Task 10: TunnelRegistry + TunnelService Storage Plumbing

**Files:**
- Modify: `Viben/src/plugins/tunnel/tunnel-registry.ts`
- Modify: `Viben/src/plugins/tunnel/tunnel-service.ts`

- [ ] **Step 1: Update TunnelRegistry constructor to accept storage**

In [tunnel-registry.ts](src/plugins/tunnel/tunnel-registry.ts), update the constructor options interface and field:

```typescript
// Add import at top:
import type { PluginStorage } from '../../core/plugin/types.js'
import { VibenTunnelProvider } from './providers/viben.js'

// Update constructor opts interface:
constructor(opts: {
  maxUserTunnels?: number
  providerOptions?: Record<string, unknown>
  registryPath?: string
  binDir?: string
  storage?: PluginStorage   // ADD THIS
} = {}) {
  this.maxUserTunnels = opts.maxUserTunnels ?? 5
  this.providerOptions = opts.providerOptions ?? {}
  this.registryPath = opts.registryPath ?? path.join(os.homedir(), '.viben', 'tunnels.json')
  this.binDir = opts.binDir
  this.storage = opts.storage ?? null   // ADD THIS
}

// Add field:
private storage: PluginStorage | null
```

- [ ] **Step 2: Update createProvider() to add viben case and change fallback default**

Find the `createProvider` method in [tunnel-registry.ts](src/plugins/tunnel/tunnel-registry.ts) and replace it:

```typescript
private createProvider(name: string): TunnelProvider {
  switch (name) {
    case 'viben': {
      if (!this.storage) {
        throw new Error('VibenTunnelProvider requires storage — ensure tunnel plugin has storage:read and storage:write permissions')
      }
      return new VibenTunnelProvider(this.providerOptions, this.binDir ?? '', this.storage)
    }
    case 'cloudflare':
      return new CloudflareTunnelProvider(this.providerOptions, this.binDir)
    case 'ngrok':
      return new NgrokTunnelProvider(this.providerOptions)
    case 'bore':
      return new BoreTunnelProvider(this.providerOptions)
    case 'tailscale':
      return new TailscaleTunnelProvider(this.providerOptions)
    default:
      log.warn({ provider: name }, 'Unknown provider, falling back to viben')
      if (!this.storage) {
        log.warn('No storage available for viben fallback, using cloudflare quick tunnel')
        return new CloudflareTunnelProvider(this.providerOptions, this.binDir)
      }
      return new VibenTunnelProvider(this.providerOptions, this.binDir ?? '', this.storage)
  }
}
```

- [ ] **Step 3: Update TunnelService to accept and forward storage**

In [tunnel-service.ts](src/plugins/tunnel/tunnel-service.ts), update the constructor:

```typescript
// Add import:
import type { PluginStorage } from '../../core/plugin/types.js'

// Update constructor signature:
constructor(
  config: TunnelConfig,
  registryPath?: string,
  binDir?: string,
  storage?: PluginStorage,   // ADD
) {
  this.config = config
  this.store = new ViewerStore(config.storeTtlMinutes)
  this.registry = new TunnelRegistry({
    maxUserTunnels: config.maxUserTunnels ?? 5,
    providerOptions: config.options,
    registryPath,
    binDir,
    storage,   // ADD
  })
}
```

- [ ] **Step 4: Run existing tunnel tests to ensure nothing broke**

```bash
pnpm test src/plugins/tunnel/
# Expected: all existing tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/plugins/tunnel/tunnel-registry.ts src/plugins/tunnel/tunnel-service.ts
git commit -m "feat: thread PluginStorage through TunnelRegistry and TunnelService"
```

---

### Task 11: Update TunnelConfig Zod Schema

**Files:**
- Modify: `Viben/src/core/config/config.ts`

This task MUST run before Task 12 — the Zod schema currently rejects `"viben"` as a provider value, which would cause a config validation error at startup.

- [ ] **Step 1: Add `viben` to the provider enum and change defaults**

In [config.ts](src/core/config/config.ts), find `TunnelSchema` (around line 49) and update:

```typescript
// Before:
provider: z
  .enum(["cloudflare", "ngrok", "bore", "tailscale"])
  .default("cloudflare"),

// After:
provider: z
  .enum(["viben", "cloudflare", "ngrok", "bore", "tailscale"])
  .default("viben"),
```

Also find the hardcoded default config constant (around line 197):

```typescript
// Before:
tunnel: {
  enabled: true,
  port: 3100,
  provider: "cloudflare",
  ...
}

// After:
tunnel: {
  enabled: true,
  port: 3100,
  provider: "viben",
  ...
}
```

- [ ] **Step 2: Run config tests**

```bash
pnpm test src/core/config/
# Expected: all tests PASS
```

- [ ] **Step 3: Commit**

```bash
git add src/core/config/config.ts
git commit -m "feat: add viben to TunnelConfig provider enum, set as default"
```

---

### Task 12: Tunnel Plugin Index Updates

**Files:**
- Modify: `Viben/src/plugins/tunnel/index.ts`

- [ ] **Step 1: Add storage permissions**

In [index.ts](src/plugins/tunnel/index.ts), find the `permissions` array and add storage:

```typescript
// Before:
permissions: ['services:register', 'services:use', 'kernel:access', 'commands:register', 'events:read'],

// After:
permissions: ['services:register', 'services:use', 'kernel:access', 'commands:register', 'events:read', 'storage:read', 'storage:write'],
```

- [ ] **Step 2: Pass ctx.storage to TunnelService**

In the `setup(ctx)` method, find the `new TunnelService(...)` call and add storage:

```typescript
// Before:
const tunnelSvc = new TunnelService(
  config as unknown as TunnelConfig,
  path.join(instanceRoot, 'tunnels.json'),
  path.join(instanceRoot, 'bin'),
)

// After:
const tunnelSvc = new TunnelService(
  config as unknown as TunnelConfig,
  path.join(instanceRoot, 'tunnels.json'),
  path.join(instanceRoot, 'bin'),
  ctx.storage,
)
```

- [ ] **Step 3: Update install() — viben as default, change legacy migration default**

Find the `install()` provider select and legacy migration, replace both:

```typescript
// Provider select in install() — viben first:
const provider = await terminal.select({
  message: 'Tunnel provider:',
  options: [
    { value: 'viben', label: 'Viben Managed', hint: 'Recommended — stable URL, no account needed' },
    { value: 'cloudflare', label: 'Cloudflare quick tunnel', hint: 'Rate-limited, random URL' },
    { value: 'ngrok', label: 'ngrok', hint: 'Requires auth token' },
    { value: 'bore', label: 'bore', hint: 'Self-hostable' },
    { value: 'tailscale', label: 'Tailscale Funnel' },
  ],
})

// Legacy config migration default — change 'cloudflare' → 'viben':
provider: tunnelCfg.provider ?? 'viben',
```

- [ ] **Step 4: Update configure() — add viben option**

Find the `configure()` provider select and add viben as the first option:

```typescript
const provider = await terminal.select({
  message: 'Tunnel provider:',
  options: [
    { value: 'viben', label: 'Viben Managed', hint: 'Recommended' },
    { value: 'cloudflare', label: 'Cloudflare quick tunnel' },
    { value: 'ngrok', label: 'ngrok' },
    { value: 'bore', label: 'bore' },
    { value: 'tailscale', label: 'Tailscale' },
  ],
})
```

- [ ] **Step 5: Run full tunnel plugin tests**

```bash
pnpm test src/plugins/tunnel/
# Expected: all tests PASS
```

- [ ] **Step 6: Build to check types**

```bash
pnpm build
# Expected: no type errors
```

- [ ] **Step 7: Commit**

```bash
git add src/plugins/tunnel/index.ts
git commit -m "feat: set viben as default tunnel provider, wire storage permissions"
```

---

## Fallback: Worker Unreachable → Cloudflare Quick Tunnel

The user asked: if the Viben service is down, fall back to the Cloudflare quick tunnel automatically.

This is handled at the `TunnelRegistry` level via its existing retry logic. The `VibenTunnelProvider.start()` throws when the Worker is unreachable. The registry retries with exponential backoff up to 5 times. If all retries fail, the system tunnel is unavailable.

To add an **immediate silent fallback** (no retries, instant switch), modify `TunnelService.start()`:

**Files:**
- Modify: `Viben/src/plugins/tunnel/tunnel-service.ts`

- [ ] **Step 1: Add fallback in TunnelService.start()**

```typescript
// In TunnelService.start(), replace the try/catch block:
if (this.config.provider) {
  try {
    const entry = await this.registry.add(apiPort, {
      type: 'system',
      provider: this.config.provider,
      label: 'system',
    })
    return entry.publicUrl || `http://localhost:${apiPort}`
  } catch (err) {
    // If viben provider failed, fall back to cloudflare quick tunnel
    if (this.config.provider === 'viben') {
      log.warn({ err: (err as Error).message }, 'Viben tunnel service unreachable, falling back to Cloudflare quick tunnel')
      try {
        const fallbackEntry = await this.registry.add(apiPort, {
          type: 'system',
          provider: 'cloudflare',
          label: 'system',
        })
        this.startError = 'Viben tunnel unavailable — using Cloudflare quick tunnel'
        return fallbackEntry.publicUrl || `http://localhost:${apiPort}`
      } catch (fallbackErr) {
        this.startError = (fallbackErr as Error).message
        return `http://localhost:${apiPort}`
      }
    }
    this.startError = (err as Error).message
    return `http://localhost:${apiPort}`
  }
}
```

- [ ] **Step 2: Run tunnel tests**

```bash
pnpm test src/plugins/tunnel/
# Expected: all tests PASS
```

- [ ] **Step 3: Build**

```bash
pnpm build
# Expected: no errors
```

- [ ] **Step 4: Commit**

```bash
git add src/plugins/tunnel/tunnel-service.ts
git commit -m "feat: fall back to cloudflare quick tunnel when viben service is unreachable"
```

---

## Final Checklist

- [ ] Worker deployed to `tunnel-worker.viben.ai` with all secrets set
- [ ] `CF_DOMAIN` secret value is `tunnel.viben.ai`
- [ ] Wildcard DNS `*.tunnel.viben.ai` CNAME to `<tunnelId>.cfargotunnel.com` created by Worker (not manual)
- [ ] `VIBEN_API_KEY` baked into Viben binary matches Worker secret
- [ ] `pnpm test` passes in Viben
- [ ] `pnpm build` succeeds in Viben
- [ ] Manual smoke test: run `viben start`, verify system tunnel URL is `*.tunnel.viben.ai`
- [ ] Manual restart test: restart Viben, verify same URL is reused
- [ ] Manual worker-down test: stop worker, verify fallback to `*.trycloudflare.com` URL
