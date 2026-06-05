# Security Hardening Design

**Date:** 2026-04-03
**Issues:** #69, #70, #74, #75
**Approach:** Hybrid — Core boundaries + Middleware policies

## Overview

Viben has multiple critical security vulnerabilities across agent filesystem access, process execution, agent installation, plugin system, and tunnel subsystem. This design addresses all 15 remaining vulnerabilities in a single branch using a hybrid approach: core enforces hard boundaries (cannot be bypassed), security plugin handles configurable policies.

### Current State (Vulnerabilities)

| Area | Critical | High | Medium |
|------|----------|------|--------|
| Agent filesystem/process (#69) | 2 | 3 | 1 |
| Agent installation (#70) | 2 | 2 | 2 |
| Plugin system (#74) | 1 | 0 | 0 |
| Tunnel system (#75) | 1 | 3 | 0 |
| **Total** | **5** | **8** | **3** |

Already fixed (not in scope): shell injection (#74), plugin crash handling (#74), execSync blocking (#74), timing attack (#75), process leak (#75).

## Section 1: Workspace Sandbox (Core)

### PathGuard Module

**File:** `src/core/security/path-guard.ts`

PathGuard validates all file operations against workspace boundaries. It receives `cwd` (immutable from session), `allowedPaths` (from config), and `.vibenignore` patterns.

**Interface:**

```typescript
interface PathGuardOptions {
  cwd: string;
  allowedPaths: string[];
  ignorePatterns: string[];  // from .vibenignore + defaults
}

class PathGuard {
  constructor(options: PathGuardOptions);
  validatePath(targetPath: string, operation: 'read' | 'write'): { allowed: boolean; reason: string };
}
```

**Validation logic:**

1. Normalize path via `path.resolve()`, resolve symlinks via `fs.realpathSync()`
2. Check path starts with `cwd` or any entry in `allowedPaths` — if not → reject
3. Check path against `.vibenignore` patterns — if match → reject
4. Return `{ allowed: true }`

### `.vibenignore`

Located at `{cwd}/.vibenignore`. Syntax identical to `.gitignore` (use `ignore` npm package).

**Built-in default patterns** (always applied, even without file):

```
.env*
*.key
*.pem
.ssh/
.aws/
.viben/
**/credentials*
**/secrets*
**/*.secret
```

User patterns in `.vibenignore` are merged on top of defaults. Agent **cannot** write to `.vibenignore` itself (hardcoded in PathGuard).

### Core Enforcement Points

- `agent-instance.ts:566-579` → `readTextFile()`: call `pathGuard.validatePath(path, 'read')` before `readTextFileWithRange()`
- `agent-instance.ts:581-594` → `writeTextFile()`: call `pathGuard.validatePath(path, 'write')` before `fs.writeFile`
- `agent-instance.ts:699-703` → attachment file reading: call `pathGuard.validatePath(path, 'read')` before `fs.promises.readFile()`
- `terminal-manager.ts:40-123` → `createTerminal()`: validate `cwd` param is within allowed boundaries
- `read-text-file.ts:7-17` → `readTextFileWithRange()`: add PathGuard check (this is the underlying utility used by readTextFile)
- On reject → return error to agent (no crash, agent sees "file restricted" message)

### API/SSE Path Redaction

Agent output streamed via SSE or returned via API should not leak absolute file paths outside workspace:

- `viewer-routes.ts:40-63` → `/api/file/:id` and `/api/diff/:id`: replace absolute `filePath` with workspace-relative path (strip `cwd` prefix)
- `workspace.ts:14-19` → `/workspace` endpoint: already requires `sessions:read` scope, acceptable to expose workspace directory to authenticated clients
- SSE `agent:event` payloads: no additional filtering needed (tool outputs may reference paths, but the sandbox prevents actual access)

### Config

```typescript
workspace: {
  security: {
    allowedPaths: string[]   // default: [] — cwd only
    envWhitelist: string[]   // default: see Section 2
  }
}
```

## Section 2: Environment Variable Filtering (Core)

### EnvFilter Module

**File:** `src/core/security/env-filter.ts`

```typescript
function filterEnv(
  processEnv: Record<string, string>,
  agentEnv?: Record<string, string>,
  whitelist?: string[]
): Record<string, string>;
```

**Logic:**

1. Start with empty object
2. Copy only whitelisted keys from `process.env` (supports glob patterns like `LC_*`)
3. Merge `agentEnv` on top (agent-defined vars from agent config)
4. Return filtered env

**Default whitelist:**

```typescript
const DEFAULT_ENV_WHITELIST = [
  "PATH", "HOME", "SHELL", "LANG", "LC_*", "TERM", "USER", "LOGNAME",
  "TMPDIR", "XDG_*", "NODE_ENV", "EDITOR"
];
```

Admin extends via `workspace.security.envWhitelist` in config.

### Enforcement Points

- `agent-instance.ts:197` — replace `{ ...process.env, ...agentDef.env }` with `filterEnv(process.env, agentDef.env)`
- `terminal-manager.ts:78` — replace `{ ...process.env, ...env }` with `filterEnv(process.env, env)`
- Tunnel provider spawn calls (ngrok.ts, bore.ts, cloudflare.ts, tailscale.ts) — these inherit parent env implicitly via `spawn()` without explicit `env` option. Add `env: filterEnv(process.env, providerEnv)` to each spawn call.

### Backward Compatibility

Default whitelist covers all vars needed for normal agent operation. If an agent needs a specific var, admin adds it to config.

## Section 3: Auto-Approve Fix + Permission Hardening (Core)

### Fix Auto-Approve Bypass

**Remove** the description-based auto-approve in `session-bridge.ts:365-396`.

Current `PermissionRequest` type (`core/types.ts:44-48`) only has `id`, `description`, `options` — no `toolId` field. Two options:

**Option chosen:** Instead of adding `toolId` to the ACP protocol type, simplify by removing auto-approve entirely. The bypass was originally added for convenience but creates a security hole. Permission requests should always go through the normal approval flow (user approval or bypass mode for headless API).

```typescript
// BEFORE (vulnerable):
if (request.description.toLowerCase().includes("viben")) { ... }

// AFTER (secure):
// Remove the entire description-based auto-approve block.
// Auto-approve is only available via explicit bypass mode (which requires sessions:dangerous scope).
```

This is the safest approach — no string matching, no toolId dependency, no way for agents to self-approve.

### Headless API Bypass Protection

- `POST /sessions/:id/dangerous` → require new scope `sessions:dangerous` (separate from `sessions:write`)
- Log warning when bypass is enabled

### Workspace Path Sanitization

Fix `resolveWorkspace()` in `config.ts`:

```typescript
resolveWorkspace(input?: string): string {
  if (!input) return expandAndCreate(this.config.workspace.baseDir);
  // Named workspace only — no absolute paths, no traversal
  const name = input.replace(/[^a-zA-Z0-9_-]/g, '');
  if (name !== input) throw new Error(`Invalid workspace name: "${input}"`);
  return expandAndCreate(path.join(this.config.workspace.baseDir, name));
}
```

Reject absolute paths, `~` paths, and `..` traversal. Only allow simple named workspaces.

## Section 4: Agent Installation Security (Core)

### Checksum Verification

Registry adds `sha256` field per binary target. New download flow:

1. Download with size limit
2. Verify SHA-256 hash
3. Validate tar contents (list before extract)
4. Extract

```typescript
const buffer = await downloadWithSizeLimit(archiveUrl, MAX_DOWNLOAD_SIZE);
if (expectedHash) {
  const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (actualHash !== expectedHash) {
    throw new Error(`Integrity check failed: expected ${expectedHash}, got ${actualHash}`);
  }
}
```

If registry has no hash → log warning, allow install (backward compat) but display warning to user.

### Download Size Limit

- `MAX_DOWNLOAD_SIZE = 500 * 1024 * 1024` (500MB)
- `readResponseWithProgress()` aborts when `received > MAX_DOWNLOAD_SIZE`

### Validate-Before-Extract (Fix TOCTOU)

Use `tar -tf` to list archive contents before extraction:

- Reject entries containing `..`
- Reject absolute paths
- Reject symlinks pointing outside destDir
- Only proceed with `tar -xzf` if all entries pass

### Uninstall Path Validation

```typescript
const agentsDir = path.resolve(expandHome("~/.viben/agents"));
const realPath = path.resolve(agent.binaryPath);
if (!realPath.startsWith(agentsDir + path.sep)) {
  throw new Error(`Refusing to delete path outside agents directory: ${realPath}`);
}
```

### File Permissions

- `agents.json` and registry cache → write with `mode: 0o600`
- `mkdirSync` for agents dir → `mode: 0o700`

### Shared with `install-binary.ts` (Tunnel Binaries)

Same patterns apply: size limit, tar content validation before extract, checksum when available.

## Section 5: Plugin System Hardening

### npm `--ignore-scripts`

Add flag to all npm install calls:

- `plugin-installer.ts:67` → add `--ignore-scripts`
- `wizard.ts:304` → add `--ignore-scripts` to setup wizard npm install
- `wizard.ts:357` → add `--ignore-scripts` to setup wizard npm install

```typescript
await execAsync(`npm install ${packageName} --prefix "${dir}" --save --ignore-scripts`, {
  timeout: 60000,
});
```

Prevents all postinstall/preinstall RCE across all npm install paths.

### Plugin Scope Restriction (Configurable)

```typescript
// Config
plugins: {
  trustedScopes: string[]  // default: ["@viben"]
}
```

- If `trustedScopes` is non-empty → only allow packages from those scopes
- If empty → allow any (backward compat)
- Warn user when installing packages outside trusted scope

### Plugin Permission Audit Logging

Log each plugin access to `ctx.core` (configManager, sessionManager, adapters). Security plugin can subscribe to `plugin:coreAccess` events for monitoring.

## Section 6: Tunnel Security

### Auth Default On

- Tunnel viewer routes → `auth: true` by default
- On first tunnel start → auto-generate random token: `crypto.randomBytes(32).toString('hex')`
- Token stored in tunnel config, displayed to user at tunnel creation
- User must explicit set `auth.enabled: false` for public access

### XSS Sanitization

Fix `file-viewer.ts:158-164`. Current code already loads DOMPurify from CDN (`cdn.jsdelivr.net/npm/dompurify@3.2.4`) but has two issues:
1. Falls back to **unsanitized** `innerHTML` if DOMPurify fails to load
2. External CDN dependency can be compromised or unavailable

**Fix:**
- Remove CDN dependency for DOMPurify
- Implement inline `sanitizeHtml()` function directly in the template string (this is a server-rendered template, not a separate JS file)
- The sanitizer strips `<script>` tags, `on*` event attributes, `javascript:` URIs
- Allows safe tags: `p`, `h1`-`h6`, `ul`, `ol`, `li`, `a`, `code`, `pre`, `blockquote`, `em`, `strong`, `img`
- Fallback when `marked` is unavailable already escapes HTML correctly (line 162-163) — no change needed there

### Credentials via Environment Variables

Replace CLI arguments with env vars:

| Provider | Before | After |
|----------|--------|-------|
| ngrok | `--authtoken TOKEN` | `env: { NGROK_AUTHTOKEN: token }` |
| bore | `--secret SECRET` | `env: { BORE_SECRET: secret }` |
| viben | `--token TOKEN` | `env: { CLOUDFLARE_TUNNEL_TOKEN: token }` |

Process args no longer contain secrets → `ps aux` safe.

## Section 7: Testing Strategy

### New Test Files

| File | Covers |
|------|--------|
| `src/core/security/__tests__/path-guard.test.ts` | PathGuard: cwd boundary, allowedPaths, `.vibenignore`, symlink escape, `..` traversal, default deny patterns |
| `src/core/security/__tests__/env-filter.test.ts` | EnvFilter: whitelist, glob patterns, agent env merge, secrets not leaked |
| `src/core/agents/__tests__/agent-installer-security.test.ts` | Checksum verify, size limit abort, tar content validation, uninstall path validation |
| `src/plugins/tunnel/__tests__/tunnel-security.test.ts` | Auth default on, XSS sanitization, credentials in env not args |

### Updated Test Files

| File | Updates |
|------|---------|
| `src/core/sessions/__tests__/session-bridge-autoapprove.test.ts` | Verify description-based bypass no longer works, only toolId whitelist |
| `src/core/plugin/__tests__/plugin-installer.test.ts` | Verify `--ignore-scripts` flag present, trusted scope rejection |

### Key Test Scenarios

**PathGuard:**
- Allow read file within cwd
- Reject read file outside cwd (`/etc/passwd`, `~/.ssh/id_rsa`)
- Reject path traversal (`cwd + "/../../../etc/passwd"`)
- Reject symlink pointing outside cwd
- Reject `.vibenignore` matched files (`.env`, `*.key`)
- Allow file in `allowedPaths` config
- Default deny patterns apply even without `.vibenignore` file
- Agent cannot write to `.vibenignore` itself

**EnvFilter:**
- Only whitelisted vars passed through
- Glob patterns work (`LC_*` matches `LC_ALL`)
- `AWS_SECRET_ACCESS_KEY` not leaked
- Agent-defined vars merged correctly

**Auto-approve:**
- Description containing "viben" NO LONGER auto-approves
- Auto-approve block is fully removed (no string matching, no toolId)
- Only bypass mode (requiring `sessions:dangerous` scope) can skip permissions

**Installer:**
- Mismatched SHA-256 rejects install
- Download > 500MB aborted
- Tar with `../` entries rejected BEFORE extraction
- Uninstall path outside `~/.viben/agents/` rejected

**Plugin:**
- `npm install` includes `--ignore-scripts` (plugin-installer.ts AND wizard.ts)
- Untrusted scope warns/rejects per config

**API path redaction:**
- `/api/file/:id` returns workspace-relative path, not absolute
- `/api/diff/:id` returns workspace-relative path, not absolute

**Tunnel:**
- Auth enabled by default (viewer routes require token)
- Markdown XSS payloads sanitized
- Credentials passed via env vars, not CLI args
