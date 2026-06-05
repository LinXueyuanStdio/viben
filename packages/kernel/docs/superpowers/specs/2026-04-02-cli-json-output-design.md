# CLI `--json` Output Standardization

## Overview

Add standardized `--json` flag support across all CLI commands that return structured data or action results. When `--json` is passed, the command outputs a single line of JSON to stdout and exits with an appropriate exit code. This enables automation, scripting, and app integration.

## JSON Envelope

All commands use a consistent envelope:

**Success (exit 0):**
```json
{ "success": true, "data": { ... } }
```

**Error (exit non-zero):**
```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable description" } }
```

Rules:
- Output is always a single line of valid JSON on stdout
- Exit code 0 for success, non-zero for errors
- No ANSI escape codes, progress bars, spinners, or other text in stdout when `--json` is active

## Core Module: `src/cli/output.ts`

### Types

```typescript
interface JsonSuccess<T = unknown> {
  success: true;
  data: T;
}

interface JsonError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type JsonOutput<T = unknown> = JsonSuccess<T> | JsonError;
```

### Functions

```typescript
function isJsonMode(args: string[]): boolean;
function jsonSuccess(data: unknown): never;   // JSON to stdout + process.exit(0)
function jsonError(code: string, message: string): never;  // JSON to stdout + process.exit(1)
function muteForJson(): void;  // Mute pino logger to suppress stderr noise
```

`jsonSuccess` and `jsonError` are terminal — they call `process.exit()` and never return. This naturally prevents any subsequent `console.log` noise.

### Error Codes

```typescript
const ErrorCodes = {
  DAEMON_NOT_RUNNING: 'DAEMON_NOT_RUNNING',
  INSTANCE_NOT_FOUND: 'INSTANCE_NOT_FOUND',
  PLUGIN_NOT_FOUND: 'PLUGIN_NOT_FOUND',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  SETUP_FAILED: 'SETUP_FAILED',
  API_ERROR: 'API_ERROR',
  TUNNEL_ERROR: 'TUNNEL_ERROR',
  INSTALL_FAILED: 'INSTALL_FAILED',
  UNINSTALL_FAILED: 'UNINSTALL_FAILED',
  MISSING_ARGUMENT: 'MISSING_ARGUMENT',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;
```

New codes may be added as needed during implementation.

## Noise Handling

| Source | Stream | Solution |
|--------|--------|----------|
| Pino logger | stderr | Call `muteForJson()` at command start to suppress |
| `console.log` in commands | stdout | `jsonSuccess`/`jsonError` call `process.exit()`, so subsequent logs never execute |
| Progress bars (`process.stdout.write`) | stdout | Guard with `if (!json)` or place after `jsonSuccess` call |
| Spinners (ora) | stdout | Not used in CLI commands currently; guard if added |

### Command Pattern

```typescript
export async function cmdExample(args: string[], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args);
  if (json) muteForJson();

  try {
    // ... command logic ...

    if (json) jsonSuccess(data);  // exits, nothing below runs

    // Human-readable output
    console.log('...');
  } catch (err) {
    if (json) jsonError(ErrorCodes.SOME_ERROR, err.message);  // exits
    console.error('...');
    process.exit(1);
  }
}
```

## Commands In Scope

### Group A — Data/Query Commands

| Command | `data` shape |
|---------|-------------|
| `agents list` | `{ agents: [{ key, name, version, distribution, description, installed, available, missingDeps }] }` |
| `agents info <key>` | `{ key, name, version, distribution, description, installed, binaryPath?, command?, registryId? }` |
| `plugins` / `plugin list` | `{ plugins: [{ name, version, enabled, source, description }] }` |
| `plugin search <q>` | `{ results: [{ name, version, description }] }` |
| `status` | `{ instances: [{ id, name, status, pid, dir, mode, channels, apiPort, tunnelPort }] }` |
| `status --id <id>` | `{ id, name, status, pid, dir, mode, channels, apiPort, tunnelPort }` |
| `config set <k> <v>` | `{ path, value, needsRestart }` |
| `doctor --json` | `{ categories: [{ name, results: [{ status, message }] }], summary: { passed, warnings, failed } }` |
| `tunnel list` | `{ tunnels: [{ port, label?, publicUrl?, status }] }` |
| `api *` (20+ subcommands) | Normalized wrap of API response |
| `version` | `{ version: "2026.401.1" }` |

Notes:
- `config` (no args) opens interactive editor — not JSON-compatible. Only `config set` supports `--json`.
- `doctor --json` implies `--dry-run` (no interactive fix prompts). Reports checks only. Always exits 0 with `success: true` — caller checks `summary.failed` to determine health.

### Group B — Action/Result Commands

| Command | `data` shape |
|---------|-------------|
| `start` | `{ pid, instanceId, dir }` |
| `stop` | `{ stopped: true, pid }` |
| `restart` | `{ pid, instanceId, dir }` |
| `install <plugin>` | `{ plugin, version, installed: true }` |
| `uninstall <plugin>` | `{ plugin, uninstalled: true }` |
| `agents install <key>` | `{ key, version, installed: true }` |
| `agents uninstall <key>` | `{ key, uninstalled: true }` |
| `setup` | `{ configPath }` |
| `adopt` | `{ sessionId, threadId, agent, status }` |
| `remote` | `{ code, name, role, expiresAt, urls: { local, tunnel?, app? } }` |
| `tunnel add` | `{ port, publicUrl }` |
| `tunnel stop` | `{ port, stopped: true }` |
| `tunnel stop-all` | `{ stopped: true }` |
| `plugin enable/disable` | `{ plugin, enabled: boolean }` |

Notes:
- `restart --foreground` starts a blocking server — incompatible with `--json`. When `--json` is passed, `restart` always uses daemon mode regardless of config.
- `plugin configure` and `plugin create` are interactive — not JSON-compatible.

### Out of Scope

`logs`, `attach`, `onboard`, `reset`, `dev`, `help`, `default`, `config` (interactive editor), `plugin configure`, `plugin create`, `agents run` — these are interactive, streaming, or blocking commands where JSON output is not applicable.

## Help Text

Commands that support `--json` must document it in their `--help` output. Add a line like:

```
  --json    Output result as JSON
```

## Migration: Existing `--json` Commands

Two commands already support `--json` with non-standard formats. Both will be migrated to the new envelope format.

**`agents list --json`** (breaking change):
- Before: `[{ key, name, ... }]` (raw array)
- After: `{ "success": true, "data": { "agents": [{ key, name, ... }] } }`

**`setup --json`** (breaking change):
- Before: `{ success: false, error: "string" }` / `{ success: true, configPath }`
- After: `{ "success": false, "error": { "code": "SETUP_FAILED", "message": "..." } }` / `{ "success": true, "data": { "configPath": "..." } }`

## Testing Strategy

### Layer 1: Unit Tests — `output.ts` helpers

File: `src/cli/commands/__tests__/output.test.ts`

- `isJsonMode()` returns correct boolean for various arg combinations
- `jsonSuccess()` outputs valid single-line JSON with `{ success: true, data }` and exits 0
- `jsonError()` outputs valid single-line JSON with `{ success: false, error: { code, message } }` and exits non-zero
- `muteForJson()` calls `muteLogger()`
- All `ErrorCodes` values are unique strings

### Layer 2: Integration Tests — per-command JSON output

File: `src/cli/commands/__tests__/json-output.test.ts`

For each command with `--json` support:

1. **Success case**: mock dependencies, call with `--json`, verify:
   - Output is valid JSON (parseable by `JSON.parse`)
   - `success === true`
   - `data` matches expected shape
   - Exit code 0
2. **Error case**: trigger error condition, verify:
   - Output is valid JSON (not ANSI text or stack trace)
   - `success === false`
   - `error.code` is a known error code string
   - `error.message` is a non-empty string
   - Exit code non-zero
3. **No noise**: stdout contains exactly one line of JSON, no progress bars, ANSI codes, or extraneous text

### Layer 3: Contract Tests — JSON schema stability

File: `src/cli/commands/__tests__/json-contract.test.ts`

Snapshot-style tests that verify the shape of `data` for each command does not change unexpectedly. These protect consumers from silent breaking changes.

```typescript
it('agents list --json contract', () => {
  const output = JSON.parse(stdout);
  expect(output).toHaveProperty('success', true);
  expect(output).toHaveProperty('data.agents');
  expect(output.data.agents[0]).toMatchObject({
    key: expect.any(String),
    name: expect.any(String),
    installed: expect.any(Boolean),
  });
});
```

### Test Helpers

Shared utilities in `src/cli/commands/__tests__/helpers/json-test-utils.ts`:

```typescript
function captureJsonOutput(fn: () => Promise<void>): { stdout: string; exitCode: number };
function expectValidJsonSuccess(stdout: string, dataShape?: object): void;
function expectValidJsonError(stdout: string, expectedCode?: string): void;
```

### Estimated Test Count

- ~15-20 tests for output helpers (Layer 1)
- ~2-3 tests per command × ~20 commands = ~40-60 tests (Layer 2)
- ~1 test per command × ~20 commands = ~20 tests (Layer 3)
- Total: ~75-100 test cases
