# CLI `--json` Output Standardization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standardized `--json` flag to all data/query and action/result CLI commands using a shared envelope format.

**Architecture:** Centralized output helpers (`src/cli/output.ts`) providing `isJsonMode()`, `jsonSuccess()`, `jsonError()`, and `muteForJson()`. Each command checks for `--json` early, mutes logger noise, and calls terminal output functions that print JSON and `process.exit()`. TDD approach — test helpers first, then integrate per-command.

**Tech Stack:** TypeScript, Vitest, pino (muting)

**Spec:** `specs/2026-04-02-cli-json-output-design.md`

---

### Task 1: Core Output Module — Types, Helpers, Error Codes

**Files:**
- Create: `src/cli/output.ts`
- Create: `src/cli/__tests__/output.test.ts`

- [ ] **Step 1: Write failing tests for `isJsonMode`**

```typescript
// src/cli/__tests__/output.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('isJsonMode', () => {
  it('returns true when args contain --json', async () => {
    const { isJsonMode } = await import('../output.js')
    expect(isJsonMode(['list', '--json'])).toBe(true)
  })

  it('returns false when args do not contain --json', async () => {
    const { isJsonMode } = await import('../output.js')
    expect(isJsonMode(['list'])).toBe(false)
  })

  it('returns false for empty args', async () => {
    const { isJsonMode } = await import('../output.js')
    expect(isJsonMode([])).toBe(false)
  })

  it('returns true when --json is the only arg', async () => {
    const { isJsonMode } = await import('../output.js')
    expect(isJsonMode(['--json'])).toBe(true)
  })

  it('does not match partial flags like --json-pretty', async () => {
    const { isJsonMode } = await import('../output.js')
    expect(isJsonMode(['--json-pretty'])).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/__tests__/output.test.ts`
Expected: FAIL — module `../output.js` not found

- [ ] **Step 3: Implement `isJsonMode`, types, and `ErrorCodes`**

```typescript
// src/cli/output.ts

// --- Types ---

export interface JsonSuccess<T = unknown> {
  success: true
  data: T
}

export interface JsonError {
  success: false
  error: {
    code: string
    message: string
  }
}

export type JsonOutput<T = unknown> = JsonSuccess<T> | JsonError

// --- Error Codes ---

export const ErrorCodes = {
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
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

// --- Functions ---

export function isJsonMode(args: string[]): boolean {
  return args.includes('--json')
}
```

- [ ] **Step 4: Run tests to verify `isJsonMode` passes**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/__tests__/output.test.ts`
Expected: all `isJsonMode` tests PASS

- [ ] **Step 5: Write failing tests for `jsonSuccess` and `jsonError`**

Add to `src/cli/__tests__/output.test.ts`:

```typescript
describe('jsonSuccess', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs valid JSON with success: true and data', async () => {
    const { jsonSuccess } = await import('../output.js')
    try { jsonSuccess({ foo: 'bar' }) } catch {}
    expect(logSpy).toHaveBeenCalledOnce()
    const output = logSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(output)
    expect(parsed).toEqual({ success: true, data: { foo: 'bar' } })
  })

  it('calls process.exit(0)', async () => {
    const { jsonSuccess } = await import('../output.js')
    try { jsonSuccess({}) } catch {}
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('outputs single-line JSON (no newlines in output)', async () => {
    const { jsonSuccess } = await import('../output.js')
    try { jsonSuccess({ nested: { a: 1, b: [2, 3] } }) } catch {}
    const output = logSpy.mock.calls[0][0] as string
    expect(output).not.toContain('\n')
    JSON.parse(output) // should not throw
  })
})

describe('jsonError', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs valid JSON with success: false and error object', async () => {
    const { jsonError, ErrorCodes } = await import('../output.js')
    try { jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'Not running') } catch {}
    const output = logSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(output)
    expect(parsed).toEqual({
      success: false,
      error: { code: 'DAEMON_NOT_RUNNING', message: 'Not running' },
    })
  })

  it('calls process.exit(1)', async () => {
    const { jsonError, ErrorCodes } = await import('../output.js')
    try { jsonError(ErrorCodes.UNKNOWN_ERROR, 'oops') } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('outputs single-line JSON', async () => {
    const { jsonError, ErrorCodes } = await import('../output.js')
    try { jsonError(ErrorCodes.API_ERROR, 'msg') } catch {}
    const output = logSpy.mock.calls[0][0] as string
    expect(output).not.toContain('\n')
    JSON.parse(output)
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/__tests__/output.test.ts`
Expected: FAIL — `jsonSuccess` and `jsonError` not exported

- [ ] **Step 7: Implement `jsonSuccess`, `jsonError`, and `muteForJson`**

Add to `src/cli/output.ts`:

```typescript
export function jsonSuccess(data: unknown): never {
  console.log(JSON.stringify({ success: true, data }))
  process.exit(0)
}

export function jsonError(code: string, message: string): never {
  console.log(JSON.stringify({ success: false, error: { code, message } }))
  process.exit(1)
}

export async function muteForJson(): Promise<void> {
  try {
    const { muteLogger } = await import('../core/utils/log.js')
    muteLogger()
  } catch {
    // pino not initialized — nothing to mute, that's fine
  }
}
```

- [ ] **Step 8: Run all tests to verify they pass**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/__tests__/output.test.ts`
Expected: All tests PASS

- [ ] **Step 9: Write test for ErrorCodes uniqueness**

Add to `src/cli/__tests__/output.test.ts`:

```typescript
describe('ErrorCodes', () => {
  it('all values are unique strings', async () => {
    const { ErrorCodes } = await import('../output.js')
    const values = Object.values(ErrorCodes)
    expect(new Set(values).size).toBe(values.length)
    for (const v of values) {
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 10: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/__tests__/output.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/cli/output.ts src/cli/__tests__/output.test.ts
git commit -m "feat(cli): add standardized JSON output helpers (output.ts)

Add isJsonMode(), jsonSuccess(), jsonError(), muteForJson(), and ErrorCodes.
These provide a consistent --json envelope for all CLI commands."
```

---

### Task 2: Test Helpers for Integration Tests

**Files:**
- Create: `src/cli/commands/__tests__/helpers/json-test-utils.ts`
- Create: `src/cli/commands/__tests__/helpers/json-test-utils.test.ts`

- [ ] **Step 1: Write the test utilities**

```typescript
// src/cli/commands/__tests__/helpers/json-test-utils.ts
import { vi } from 'vitest'

export interface CapturedOutput {
  stdout: string
  exitCode: number | null
}

/**
 * Capture console.log output and process.exit code from a function that
 * uses jsonSuccess/jsonError (which call process.exit).
 */
/**
 * IMPORTANT: When using this in test files that also use vi.mock() at top level,
 * add vi.resetModules() in beforeEach to avoid mock leaking between tests.
 * The dynamic imports inside commands will re-resolve against the mocks.
 */
export async function captureJsonOutput(fn: () => Promise<void>): Promise<CapturedOutput> {
  let stdout = ''
  let exitCode: number | null = null

  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout += args.map(String).join(' ')
  })
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
    exitCode = code ?? 0
    throw new Error(`process.exit(${code})`)
  }) as any)

  try {
    await fn()
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith('process.exit'))) {
      throw err
    }
  } finally {
    logSpy.mockRestore()
    exitSpy.mockRestore()
  }

  return { stdout, exitCode }
}

/**
 * Parse and validate a successful JSON output.
 */
export function expectValidJsonSuccess(stdout: string, dataShape?: Record<string, unknown>): Record<string, unknown> {
  const parsed = JSON.parse(stdout)
  if (parsed.success !== true) {
    throw new Error(`Expected success: true, got: ${JSON.stringify(parsed)}`)
  }
  if (!('data' in parsed)) {
    throw new Error('Missing "data" field in success response')
  }
  if (dataShape) {
    for (const [key, value] of Object.entries(dataShape)) {
      if (!(key in parsed.data)) {
        throw new Error(`Missing key "${key}" in data`)
      }
    }
  }
  return parsed.data
}

/**
 * Parse and validate an error JSON output.
 */
export function expectValidJsonError(stdout: string, expectedCode?: string): { code: string; message: string } {
  const parsed = JSON.parse(stdout)
  if (parsed.success !== false) {
    throw new Error(`Expected success: false, got: ${JSON.stringify(parsed)}`)
  }
  if (!parsed.error || typeof parsed.error.code !== 'string' || typeof parsed.error.message !== 'string') {
    throw new Error(`Invalid error shape: ${JSON.stringify(parsed.error)}`)
  }
  if (expectedCode && parsed.error.code !== expectedCode) {
    throw new Error(`Expected error code "${expectedCode}", got "${parsed.error.code}"`)
  }
  return parsed.error
}
```

- [ ] **Step 2: Write tests for the test utilities themselves**

```typescript
// src/cli/commands/__tests__/helpers/json-test-utils.test.ts
import { describe, it, expect } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './json-test-utils.js'

describe('captureJsonOutput', () => {
  it('captures stdout and exit code from jsonSuccess', async () => {
    const { jsonSuccess } = await import('../../../output.js')
    const result = await captureJsonOutput(async () => {
      jsonSuccess({ test: true })
    })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.success).toBe(true)
    expect(parsed.data.test).toBe(true)
  })

  it('captures stdout and exit code from jsonError', async () => {
    const { jsonError, ErrorCodes } = await import('../../../output.js')
    const result = await captureJsonOutput(async () => {
      jsonError(ErrorCodes.UNKNOWN_ERROR, 'test error')
    })
    expect(result.exitCode).toBe(1)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.success).toBe(false)
    expect(parsed.error.code).toBe('UNKNOWN_ERROR')
  })

  it('rethrows non-exit errors', async () => {
    await expect(captureJsonOutput(async () => {
      throw new Error('real error')
    })).rejects.toThrow('real error')
  })
})

describe('expectValidJsonSuccess', () => {
  it('returns data for valid success output', () => {
    const data = expectValidJsonSuccess('{"success":true,"data":{"x":1}}')
    expect(data).toEqual({ x: 1 })
  })

  it('throws for error output', () => {
    expect(() => expectValidJsonSuccess('{"success":false,"error":{"code":"X","message":"m"}}')).toThrow()
  })
})

describe('expectValidJsonError', () => {
  it('returns error for valid error output', () => {
    const err = expectValidJsonError('{"success":false,"error":{"code":"FOO","message":"bar"}}', 'FOO')
    expect(err).toEqual({ code: 'FOO', message: 'bar' })
  })

  it('throws when code does not match', () => {
    expect(() => expectValidJsonError('{"success":false,"error":{"code":"FOO","message":"bar"}}', 'BAR')).toThrow()
  })
})
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/helpers/json-test-utils.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/__tests__/helpers/
git commit -m "test(cli): add JSON output test utilities

captureJsonOutput, expectValidJsonSuccess, expectValidJsonError
for testing --json flag integration across CLI commands."
```

---

### Task 3: Migrate `version` Command (simplest — validates the pattern)

**Files:**
- Modify: `src/cli/commands/version.ts`
- Create: `src/cli/commands/__tests__/version-json.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/cli/commands/__tests__/version-json.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess } from './helpers/json-test-utils.js'

describe('version --json', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs JSON with version string', async () => {
    const { cmdVersion } = await import('../version.js')
    const result = await captureJsonOutput(async () => {
      await cmdVersion(['--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('version')
    expect(typeof data.version).toBe('string')
    expect((data.version as string).length).toBeGreaterThan(0)
  })

  it('outputs plain text without --json', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { cmdVersion } = await import('../version.js')
    await cmdVersion([])
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('viben v'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/version-json.test.ts`
Expected: FAIL — `cmdVersion` does not accept args

- [ ] **Step 3: Update `cmdVersion` to accept args and support `--json`**

Replace the content of `src/cli/commands/version.ts`:

```typescript
import { isJsonMode, jsonSuccess } from '../output.js'

export async function cmdVersion(args: string[] = []): Promise<void> {
  const { getCurrentVersion } = await import('../version.js')
  const version = getCurrentVersion()

  if (isJsonMode(args)) {
    jsonSuccess({ version })
  }

  console.log(`viben v${version}`)
}
```

- [ ] **Step 4: Update the call site in `src/cli.ts`**

In `src/cli.ts` lines 88-89, update the noInstanceCommands map:

```typescript
// Before (line 88-89):
'--version': () => cmdVersion(),
'-v': () => cmdVersion(),

// After:
'--version': () => cmdVersion(args),
'-v': () => cmdVersion(args),
```

Here `args` is the variable from line 74: `const [command, ...args] = remaining`. When user runs `viben --version --json`, `args` will be `['--json']`.

- [ ] **Step 5: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/version-json.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/version.ts src/cli/commands/__tests__/version-json.test.ts src/cli.ts
git commit -m "feat(cli): add --json support to version command"
```

---

### Task 4: Migrate Existing `agents list --json` and `setup --json`

**Files:**
- Modify: `src/cli/commands/agents.ts`
- Modify: `src/cli/commands/setup.ts`
- Modify: `src/cli/commands/__tests__/agents-json.test.ts`
- Modify: `src/cli/commands/__tests__/setup.test.ts`

- [ ] **Step 1: Update `agents-json.test.ts` to expect new envelope format**

```typescript
// src/cli/commands/__tests__/agents-json.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess } from './helpers/json-test-utils.js'

vi.mock('../../../core/agents/agent-catalog.js', () => {
  class MockAgentCatalog {
    load = vi.fn()
    refreshRegistryIfStale = vi.fn().mockResolvedValue(undefined)
    getAvailable = vi.fn().mockReturnValue([
      {
        key: 'claude-code',
        name: 'Claude Code',
        version: '1.0.0',
        distribution: 'npm',
        description: 'AI coding agent',
        installed: true,
        available: true,
        missingDeps: [],
      },
      {
        key: 'gemini',
        name: 'Gemini CLI',
        version: '0.5.0',
        distribution: 'npm',
        description: 'Google Gemini agent',
        installed: false,
        available: true,
        missingDeps: [],
      },
    ])
  }
  return { AgentCatalog: MockAgentCatalog }
})

describe('agents list --json', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs envelope with agents array', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['list', '--json'], undefined)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('agents')
    expect(Array.isArray(data.agents)).toBe(true)
    expect((data.agents as unknown[]).length).toBe(2)
  })

  it('includes all required fields in each agent entry', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['list', '--json'], undefined)
    })
    const data = expectValidJsonSuccess(result.stdout)
    const agent = (data.agents as Record<string, unknown>[])[0]
    const fields = ['key', 'name', 'version', 'distribution', 'description', 'installed', 'available', 'missingDeps']
    for (const field of fields) {
      expect(agent).toHaveProperty(field)
    }
  })
})
```

- [ ] **Step 2: Update `agentsList` in `agents.ts` to use helpers**

In `src/cli/commands/agents.ts`, update the `agentsList` function:

```typescript
// Add import at top:
import { isJsonMode, jsonSuccess, muteForJson } from '../output.js'

// In agentsList function, replace the json block:
async function agentsList(instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  const catalog = await createCatalog(instanceRoot)
  catalog.load()
  await catalog.refreshRegistryIfStale()

  const items = catalog.getAvailable()

  if (json) {
    jsonSuccess({
      agents: items.map((item) => ({
        key: item.key,
        name: item.name,
        version: item.version,
        distribution: item.distribution,
        description: item.description ?? '',
        installed: item.installed,
        available: item.available ?? true,
        missingDeps: item.missingDeps ?? [],
      })),
    })
  }

  // ... rest of human-readable output unchanged ...
```

- [ ] **Step 3: Update `setup.test.ts` for new envelope format**

Update the JSON test in `src/cli/commands/__tests__/setup.test.ts`:

```typescript
  it('outputs JSON result when --json flag is passed', async () => {
    const { captureJsonOutput, expectValidJsonSuccess } = await import('./helpers/json-test-utils.js')
    const { cmdSetup } = await import('../setup.js')
    const result = await captureJsonOutput(async () => {
      await cmdSetup(
        ['--workspace', '/tmp/ws', '--agent', 'claude-code', '--json'],
        tmpDir,
      )
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('configPath')
    expect((data.configPath as string)).toContain('config.json')
  })
```

- [ ] **Step 4: Update `setup.ts` to use helpers**

Replace JSON handling in `src/cli/commands/setup.ts`:

```typescript
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

export async function cmdSetup(args: string[], instanceRoot: string): Promise<void> {
  const workspace = parseFlag(args, '--workspace')
  const agentRaw = parseFlag(args, '--agent')
  const json = isJsonMode(args)
  if (json) await muteForJson()

  if (!workspace) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, '--workspace is required')
    console.error('  Error: --workspace <path> is required')
    process.exit(1)
  }

  if (!agentRaw) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, '--agent is required')
    console.error('  Error: --agent <name> is required')
    process.exit(1)
  }

  const rawRunMode = parseFlag(args, '--run-mode') ?? 'daemon'
  if (rawRunMode !== 'daemon' && rawRunMode !== 'foreground') {
    if (json) jsonError(ErrorCodes.SETUP_FAILED, "--run-mode must be 'daemon' or 'foreground'")
    console.error(`  Error: --run-mode must be 'daemon' or 'foreground'`)
    process.exit(1)
  }

  // ... unchanged config writing logic ...

  if (json) {
    jsonSuccess({ configPath })
  }

  console.log(`\n  \x1b[32m✓ Setup complete.\x1b[0m Config written to ${configPath}\n`)
}
```

- [ ] **Step 5: Run all affected tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/agents-json.test.ts src/cli/commands/__tests__/setup.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/agents.ts src/cli/commands/setup.ts src/cli/commands/__tests__/agents-json.test.ts src/cli/commands/__tests__/setup.test.ts
git commit -m "refactor(cli): migrate agents list and setup to standardized --json envelope

Breaking change: agents list --json now returns { success, data: { agents } }
instead of raw array. setup --json error format changes to { code, message }."
```

---

### Task 5: Add `--json` to `status` Command

**Files:**
- Modify: `src/cli/commands/status.ts`
- Create: `src/cli/commands/__tests__/status-json.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/cli/commands/__tests__/status-json.test.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

describe('status --json', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-status-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('outputs JSON with instance info when daemon is not running', async () => {
    // Write minimal config so readInstanceInfo has something to read
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ instanceName: 'test' }))

    const { cmdStatus } = await import('../status.js')
    const result = await captureJsonOutput(async () => {
      await cmdStatus(['--json'], tmpDir)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('status')
    expect(data.status).toBe('offline')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/status-json.test.ts`
Expected: FAIL

- [ ] **Step 3: Add `--json` support to `status.ts`**

Add at the top of `cmdStatus`:

```typescript
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

export async function cmdStatus(args: string[] = [], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  if (args.includes('--all')) {
    await showAllInstances(json)
    return
  }

  const idIdx = args.indexOf('--id')
  if (idIdx !== -1 && args[idIdx + 1]) {
    await showInstanceById(args[idIdx + 1]!, json)
    return
  }

  const root = instanceRoot ?? getGlobalRoot()
  await showSingleInstance(root, json)
}
```

Then update each internal function to accept a `json` parameter and output JSON:

For `showSingleInstance`:
```typescript
async function showSingleInstance(root: string, json = false): Promise<void> {
  const info = readInstanceInfo(root)

  if (json) {
    jsonSuccess({
      id: path.basename(root),
      name: info.name,
      status: info.pid ? 'online' : 'offline',
      pid: info.pid,
      dir: root,
      mode: info.runMode,
      channels: info.channels,
      apiPort: info.apiPort,
      tunnelPort: info.tunnelPort,
    })
  }

  // ... existing human output ...
}
```

For `showAllInstances`:
```typescript
async function showAllInstances(json = false): Promise<void> {
  const registryPath = path.join(getGlobalRoot(), 'instances.json')
  const registry = new InstanceRegistry(registryPath)
  await registry.load()
  const instances = registry.list()

  if (json) {
    jsonSuccess({
      instances: instances.map(entry => {
        const info = readInstanceInfo(entry.root)
        return {
          id: entry.id,
          name: info.name,
          status: info.pid ? 'online' : 'offline',
          pid: info.pid,
          dir: entry.root,
          mode: info.runMode,
          channels: info.channels,
          apiPort: info.apiPort,
          tunnelPort: info.tunnelPort,
        }
      }),
    })
  }

  // ... existing human output ...
}
```

For `showInstanceById`:
```typescript
async function showInstanceById(id: string, json = false): Promise<void> {
  const registryPath = path.join(getGlobalRoot(), 'instances.json')
  const registry = new InstanceRegistry(registryPath)
  await registry.load()
  const entry = registry.get(id)
  if (!entry) {
    if (json) jsonError(ErrorCodes.INSTANCE_NOT_FOUND, `Workspace "${id}" not found.`)
    console.error(`Workspace "${id}" not found.`)
    process.exit(1)
  }
  await showSingleInstance(entry.root, json)
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/status-json.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/status.ts src/cli/commands/__tests__/status-json.test.ts
git commit -m "feat(cli): add --json support to status command"
```

---

### Task 6: Add `--json` to `plugins` / `plugin list`, `plugin search`, `plugin enable/disable`

**Files:**
- Modify: `src/cli/commands/plugins.ts`
- Modify: `src/cli/commands/plugin-search.ts`
- Create: `src/cli/commands/__tests__/plugins-json.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/cli/commands/__tests__/plugins-json.test.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

describe('plugins --json', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-plugins-test-'))
    // Create a minimal plugins.json
    fs.writeFileSync(path.join(tmpDir, 'plugins.json'), JSON.stringify({
      installed: {
        'telegram': { version: '1.0.0', enabled: true, source: 'builtin', description: 'Telegram adapter' },
      },
    }))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('outputs JSON with plugins array', async () => {
    const { cmdPlugins } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugins(['--json'], tmpDir)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('plugins')
    expect(Array.isArray(data.plugins)).toBe(true)
  })
})

describe('plugin enable/disable --json', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-plugin-toggle-'))
    fs.writeFileSync(path.join(tmpDir, 'plugins.json'), JSON.stringify({
      installed: {
        'telegram': { version: '1.0.0', enabled: true, source: 'builtin', description: 'Telegram adapter' },
      },
    }))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('outputs JSON when disabling a plugin', async () => {
    const { cmdPlugin } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugin(['disable', 'telegram', '--json'], tmpDir)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toEqual({ plugin: 'telegram', enabled: false })
  })

  it('outputs JSON error for unknown plugin', async () => {
    const { cmdPlugin } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugin(['enable', 'nonexistent', '--json'], tmpDir)
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'PLUGIN_NOT_FOUND')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/plugins-json.test.ts`
Expected: FAIL

- [ ] **Step 3: Add `--json` to `cmdPlugins` in `plugins.ts`**

```typescript
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

export async function cmdPlugins(args: string[] = [], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  if (!json && wantsHelp(args)) {
    // ... existing help ...
    return
  }

  const os = await import('node:os')
  const path = await import('node:path')
  const { PluginRegistry } = await import('../../core/plugin/plugin-registry.js')

  const root = instanceRoot ?? path.join(os.homedir(), '.viben')
  const registryPath = path.join(root, 'plugins.json')
  const registry = new PluginRegistry(registryPath)
  await registry.load()

  const plugins = registry.list()

  if (json) {
    const pluginList: Record<string, unknown>[] = []
    for (const [name, entry] of plugins) {
      pluginList.push({
        name,
        version: entry.version,
        enabled: entry.enabled !== false,
        source: entry.source ?? 'unknown',
        description: entry.description ?? '',
      })
    }
    jsonSuccess({ plugins: pluginList })
  }

  // ... existing human output ...
}
```

- [ ] **Step 4: Add `--json` to `setPluginEnabled` in `plugins.ts`**

```typescript
async function setPluginEnabled(name: string, enabled: boolean, instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  // ... existing registry load logic ...

  const entry = registry.get(name)
  if (!entry) {
    if (json) jsonError(ErrorCodes.PLUGIN_NOT_FOUND, `Plugin "${name}" not found.`)
    console.error(`Plugin "${name}" not found. Run "viben plugin list" to see installed plugins.`)
    process.exit(1)
  }

  registry.setEnabled(name, enabled)
  await registry.save()

  if (json) jsonSuccess({ plugin: name, enabled })

  console.log(`Plugin ${name} ${enabled ? 'enabled' : 'disabled'}. Restart to apply.`)
}
```

Update `cmdPlugin` switch to pass json flag:
```typescript
case 'enable': {
  const name = args[1]
  if (!name) {
    if (isJsonMode(args)) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Plugin name is required')
    console.error('Error: missing plugin name. Usage: viben plugin enable <name>')
    process.exit(1)
  }
  await setPluginEnabled(name, true, instanceRoot, isJsonMode(args))
  return
}

case 'disable': {
  const name = args[1]
  if (!name) {
    if (isJsonMode(args)) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Plugin name is required')
    console.error('Error: missing plugin name. Usage: viben plugin disable <name>')
    process.exit(1)
  }
  await setPluginEnabled(name, false, instanceRoot, isJsonMode(args))
  return
}
```

- [ ] **Step 5: Add `--json` to `plugin-search.ts`**

```typescript
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

export async function cmdPluginSearch(args: string[]): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const query = args.filter(a => a !== '--json').join(' ').trim()
  if (!query) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Search query is required')
    console.error('Usage: viben plugin search <query>')
    process.exit(1)
  }

  const client = new RegistryClient()

  try {
    const results = await client.search(query)

    if (json) {
      jsonSuccess({
        results: results.map(p => ({
          name: p.name,
          displayName: p.displayName ?? p.name,
          version: p.version,
          description: p.description,
          npm: p.npm,
          category: p.category,
          verified: p.verified ?? false,
          featured: p.featured ?? false,
        })),
      })
    }

    // ... existing human output ...
  } catch (err) {
    if (json) jsonError(ErrorCodes.API_ERROR, `Failed to search registry: ${err}`)
    console.error(`Failed to search registry: ${err}`)
    process.exit(1)
  }
}
```

- [ ] **Step 6: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/plugins-json.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/plugins.ts src/cli/commands/plugin-search.ts src/cli/commands/__tests__/plugins-json.test.ts
git commit -m "feat(cli): add --json support to plugins, plugin search, plugin enable/disable"
```

---

### Task 7: Add `--json` to `start`, `stop`, `restart`

**Files:**
- Modify: `src/cli/commands/start.ts`
- Modify: `src/cli/commands/stop.ts`
- Modify: `src/cli/commands/restart.ts`
- Create: `src/cli/commands/__tests__/daemon-json.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/cli/commands/__tests__/daemon-json.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

// Mock daemon module
vi.mock('../../daemon.js', () => ({
  startDaemon: vi.fn().mockReturnValue({ pid: 12345 }),
  stopDaemon: vi.fn().mockResolvedValue({ stopped: true, pid: 12345 }),
  getPidPath: vi.fn().mockReturnValue('/tmp/test.pid'),
  markRunning: vi.fn(),
}))

// Mock config
vi.mock('../../../core/config/config.js', () => ({
  ConfigManager: class {
    exists = vi.fn().mockResolvedValue(true)
    load = vi.fn().mockResolvedValue(undefined)
    get = vi.fn().mockReturnValue({ logging: { logDir: '/tmp/logs' }, runMode: 'daemon' })
  },
}))

// Mock version check
vi.mock('../../version.js', () => ({
  checkAndPromptUpdate: vi.fn().mockResolvedValue(undefined),
  getCurrentVersion: vi.fn().mockReturnValue('2026.401.1'),
}))

// Mock instance hint
vi.mock('../../instance-hint.js', () => ({
  printInstanceHint: vi.fn(),
}))

describe('stop --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful stop', async () => {
    const { cmdStop } = await import('../stop.js')
    const result = await captureJsonOutput(async () => {
      await cmdStop(['--json'], '/tmp/test-instance')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('stopped', true)
    expect(data).toHaveProperty('pid', 12345)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/daemon-json.test.ts`
Expected: FAIL

- [ ] **Step 3: Add `--json` to `stop.ts`**

```typescript
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

export async function cmdStop(args: string[] = [], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const root = instanceRoot ?? path.join(os.homedir(), '.viben')
  if (!json && wantsHelp(args)) {
    // ... existing help ...
    return
  }
  const { stopDaemon, getPidPath } = await import('../daemon.js')
  const result = await stopDaemon(getPidPath(root), root)
  if (result.stopped) {
    if (json) jsonSuccess({ stopped: true, pid: result.pid })
    console.log(`Viben daemon stopped (was PID ${result.pid})`)
  } else {
    if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, result.error)
    console.error(result.error)
    process.exit(1)
  }
}
```

- [ ] **Step 4: Add `--json` to `start.ts`**

Same pattern — after `startDaemon` returns:

```typescript
if (json) jsonSuccess({ pid: result.pid, instanceId: path.basename(root), dir: root })
```

Error case:
```typescript
if ('error' in result) {
  if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, result.error)
  console.error(result.error)
  process.exit(1)
}
```

No config:
```typescript
if (json) jsonError(ErrorCodes.CONFIG_NOT_FOUND, 'No config found. Run "viben" first to set up.')
```

- [ ] **Step 5: Add `--json` to `restart.ts`**

When `--json` is passed, force daemon mode (per spec):

```typescript
const json = isJsonMode(args)
if (json) muteForJson()

// When --json, always use daemon mode
const useForeground = json ? false : (forceForeground || (!forceDaemon && config.runMode !== 'daemon'))
```

- [ ] **Step 6: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/daemon-json.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/start.ts src/cli/commands/stop.ts src/cli/commands/restart.ts src/cli/commands/__tests__/daemon-json.test.ts
git commit -m "feat(cli): add --json support to start, stop, restart commands"
```

---

### Task 8: Add `--json` to `doctor`

**Files:**
- Modify: `src/cli/commands/doctor.ts`
- Create: `src/cli/commands/__tests__/doctor-json.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/cli/commands/__tests__/doctor-json.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess } from './helpers/json-test-utils.js'

vi.mock('../../../core/doctor/index.js', () => ({
  DoctorEngine: class {
    runAll = vi.fn().mockResolvedValue({
      categories: [
        { name: 'Config', results: [{ status: 'pass', message: 'Config valid' }] },
        { name: 'Agents', results: [{ status: 'warn', message: 'No agents installed' }] },
      ],
      pendingFixes: [],
      summary: { passed: 1, warnings: 1, failed: 0, fixed: 0 },
    })
  },
}))

describe('doctor --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON report with categories and summary', async () => {
    const { cmdDoctor } = await import('../doctor.js')
    const result = await captureJsonOutput(async () => {
      await cmdDoctor(['--json'], '/tmp/test')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('categories')
    expect(data).toHaveProperty('summary')
    expect((data.summary as Record<string, number>).passed).toBe(1)
    expect((data.summary as Record<string, number>).warnings).toBe(1)
  })
})
```

- [ ] **Step 2: Run test, verify fails**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/doctor-json.test.ts`

- [ ] **Step 3: Add `--json` to `doctor.ts`**

Key: `--json` implies `--dry-run` (no interactive fix prompts):

```typescript
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

export async function cmdDoctor(args: string[], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  // ... existing help and flag parsing ...

  // --json implies --dry-run
  const dryRun = args.includes('--dry-run') || json
  const engine = new DoctorEngine({ dryRun, dataDir: instanceRoot })
  const report = await engine.runAll()

  if (json) {
    const reportData = {
      categories: report.categories.map(c => ({
        name: c.name,
        results: c.results.map(r => ({ status: r.status, message: r.message })),
      })),
      summary: {
        passed: report.summary.passed,
        warnings: report.summary.warnings,
        failed: report.summary.failed,
      },
    }
    // Always use jsonSuccess — caller checks summary.failed to determine health.
    // Exit code 0 to stay consistent with the envelope contract.
    jsonSuccess(reportData)
  }

  // ... existing human output ...
}

- [ ] **Step 4: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/doctor-json.test.ts`
Expected: PASS

- [ ] **Step 5: Add `--json` to known flags list**

In doctor.ts, update the known flags:
```typescript
const knownFlags = ["--dry-run", "--json"]
```

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/doctor.ts src/cli/commands/__tests__/doctor-json.test.ts
git commit -m "feat(cli): add --json support to doctor command (implies --dry-run)"
```

---

### Task 9: Add `--json` to `agents install`, `agents uninstall`, `agents info`

**Files:**
- Modify: `src/cli/commands/agents.ts`
- Create: `src/cli/commands/__tests__/agents-subcommands-json.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/cli/commands/__tests__/agents-subcommands-json.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

vi.mock('../../../core/agents/agent-catalog.js', () => {
  class MockAgentCatalog {
    load = vi.fn()
    refreshRegistryIfStale = vi.fn().mockResolvedValue(undefined)
    getAvailable = vi.fn().mockReturnValue([])
    getInstalledAgent = vi.fn().mockImplementation((key: string) => {
      if (key === 'claude-code') {
        return {
          key: 'claude-code',
          name: 'Claude Code',
          version: '1.0.0',
          distribution: 'npm',
          command: 'npx',
          args: ['@anthropic-ai/claude-code'],
          installedAt: '2026-01-01T00:00:00Z',
          registryId: 'claude-code',
        }
      }
      return undefined
    })
    findRegistryAgent = vi.fn().mockReturnValue(undefined)
    install = vi.fn().mockResolvedValue({ ok: true, agentKey: 'gemini' })
    uninstall = vi.fn().mockResolvedValue({ ok: true })
    getInstalledEntries = vi.fn().mockReturnValue({ 'claude-code': {} })
  }
  return { AgentCatalog: MockAgentCatalog }
})

vi.mock('../../../core/agents/agent-dependencies.js', () => ({
  getAgentCapabilities: vi.fn().mockReturnValue({ integration: null }),
  getAgentSetup: vi.fn().mockReturnValue(undefined),
}))

describe('agents info --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON for installed agent', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['info', 'claude-code', '--json'], undefined)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('key', 'claude-code')
    expect(data).toHaveProperty('name', 'Claude Code')
    expect(data).toHaveProperty('installed', true)
  })

  it('outputs JSON error for unknown agent', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['info', 'nonexistent', '--json'], undefined)
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'AGENT_NOT_FOUND')
  })
})

describe('agents uninstall --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful uninstall', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['uninstall', 'claude-code', '--json'], undefined)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('key', 'claude-code')
    expect(data).toHaveProperty('uninstalled', true)
  })
})
```

- [ ] **Step 2: Run tests, verify fail**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/agents-subcommands-json.test.ts`

- [ ] **Step 3: Add `--json` to `agentsInfo`**

In `src/cli/commands/agents.ts`, update `agentsInfo`:

```typescript
async function agentsInfo(nameOrId: string | undefined, help = false, instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  if (!json && (help || !nameOrId)) {
    // ... existing help ...
    return
  }

  if (!nameOrId) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Agent name is required')
    return
  }

  const catalog = await createCatalog(instanceRoot)
  catalog.load()
  const { getAgentSetup } = await import('../../core/agents/agent-dependencies.js')

  const installed = catalog.getInstalledAgent(nameOrId)
  if (installed) {
    if (json) {
      jsonSuccess({
        key: installed.registryId ?? nameOrId,
        name: installed.name,
        version: installed.version,
        distribution: installed.distribution,
        description: installed.description ?? '',
        installed: true,
        command: installed.command,
        binaryPath: installed.binaryPath ?? null,
        registryId: installed.registryId ?? null,
      })
    }
    // ... existing human output ...
    return
  }

  const regAgent = catalog.findRegistryAgent(nameOrId)
  if (regAgent) {
    if (json) {
      jsonSuccess({
        key: regAgent.id,
        name: regAgent.name,
        version: regAgent.version,
        description: regAgent.description ?? '',
        installed: false,
      })
    }
    // ... existing human output ...
    return
  }

  if (json) jsonError(ErrorCodes.AGENT_NOT_FOUND, `"${nameOrId}" not found.`)

  // ... existing human error output ...
}
```

- [ ] **Step 4: Add `--json` to `agentsInstall` and `agentsUninstall`**

For `agentsInstall` — suppress progress callbacks when json, output result:

```typescript
async function agentsInstall(nameOrId: string | undefined, force: boolean, help = false, instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  if (!json && (help || !nameOrId)) { /* existing help */ return }
  if (!nameOrId) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Agent name is required')
    return
  }

  const catalog = await createCatalog(instanceRoot)
  catalog.load()
  await catalog.refreshRegistryIfStale()

  // Suppress progress callbacks in JSON mode
  const progress: import('../../core/types.js').InstallProgress = json ? {
    onStart() {},
    onStep() {},
    onDownloadProgress() {},
    onSuccess() {},
    onError() {},
  } : {
    // ... existing progress handlers ...
  }

  const result = await catalog.install(nameOrId, progress, force)
  if (!result.ok) {
    if (json) jsonError(ErrorCodes.INSTALL_FAILED, result.error ?? 'Installation failed')
    // ... existing error handling ...
    process.exit(1)
  }

  if (json) jsonSuccess({ key: result.agentKey, version: result.version ?? 'unknown', installed: true })

  // ... existing post-install output ...
}
```

For `agentsUninstall`:

```typescript
async function agentsUninstall(name: string | undefined, help = false, instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  if (!json && (help || !name)) { /* existing help */ return }
  if (!name) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Agent name is required')
    return
  }

  const catalog = await createCatalog(instanceRoot)
  catalog.load()

  const result = await catalog.uninstall(name)
  if (result.ok) {
    // ... existing integration uninstall ...
    if (json) jsonSuccess({ key: name, uninstalled: true })
    // ... existing human output ...
  } else {
    if (json) jsonError(ErrorCodes.UNINSTALL_FAILED, result.error ?? 'Uninstall failed')
    // ... existing error output ...
  }
}
```

- [ ] **Step 5: Update `cmdAgents` switch to pass json flag**

```typescript
switch (subcommand) {
  case 'install':
    return agentsInstall(args[1], args.includes('--force'), wantsHelp(args), instanceRoot, isJsonMode(args))
  case 'uninstall':
    return agentsUninstall(args[1], wantsHelp(args), instanceRoot, isJsonMode(args))
  case 'info':
    return agentsInfo(args[1], wantsHelp(args), instanceRoot, isJsonMode(args))
  // ... rest unchanged ...
}
```

- [ ] **Step 6: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/agents-subcommands-json.test.ts src/cli/commands/__tests__/agents-json.test.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/agents.ts src/cli/commands/__tests__/agents-subcommands-json.test.ts
git commit -m "feat(cli): add --json support to agents install, uninstall, info"
```

---

### Task 10: Add `--json` to `tunnel` Commands

**Files:**
- Modify: `src/cli/commands/tunnel.ts`
- Create: `src/cli/commands/__tests__/tunnel-json.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/cli/commands/__tests__/tunnel-json.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

vi.mock('../../api-client.js', () => ({
  readApiPort: vi.fn().mockReturnValue(3000),
  apiCall: vi.fn().mockImplementation((_port: number, urlPath: string) => {
    if (urlPath === '/api/tunnel/list') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { port: 8080, label: 'web', publicUrl: 'https://example.trycloudflare.com', status: 'active' },
        ]),
      })
    }
    if (urlPath === '/api/tunnel') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ port: 8080, publicUrl: 'https://example.trycloudflare.com' }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }),
}))

describe('tunnel list --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON with tunnels array', async () => {
    const { cmdTunnel } = await import('../tunnel.js')
    const result = await captureJsonOutput(async () => {
      await cmdTunnel(['list', '--json'], '/tmp/test')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('tunnels')
    expect(Array.isArray(data.tunnels)).toBe(true)
  })
})

describe('tunnel add --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON with port and publicUrl', async () => {
    const { cmdTunnel } = await import('../tunnel.js')
    const result = await captureJsonOutput(async () => {
      await cmdTunnel(['add', '8080', '--json'], '/tmp/test')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('port')
    expect(data).toHaveProperty('publicUrl')
  })
})
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Add `--json` to `tunnel.ts`**

Add json mode handling to each subcommand in `cmdTunnel`. Pattern:

```typescript
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

export async function cmdTunnel(args: string[], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const subCmd = args[0]
  const port = readApiPort(undefined, instanceRoot)
  if (port === null) {
    if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'Viben is not running.')
    console.error('Viben is not running. Start with `viben start`')
    process.exit(1)
  }

  const call = (urlPath: string, options?: RequestInit) => apiCall(port, urlPath, options, instanceRoot)

  try {
    if (subCmd === 'add') {
      // ... existing parsing ...
      const res = await call('/api/tunnel', { /* ... */ })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.TUNNEL_ERROR, String(data.error))
        console.error(`Error: ${data.error}`)
        process.exit(1)
      }
      if (json) jsonSuccess({ port: data.port, publicUrl: data.publicUrl })
      console.log(`Tunnel active: port ${data.port} → ${data.publicUrl}`)

    } else if (subCmd === 'list') {
      const res = await call('/api/tunnel/list')
      const data = await res.json() as Array<Record<string, unknown>>
      if (json) {
        jsonSuccess({
          tunnels: data.map(t => ({
            port: t.port,
            label: t.label ?? null,
            publicUrl: t.publicUrl ?? null,
            status: t.status ?? 'unknown',
          })),
        })
      }
      // ... existing human output ...

    } else if (subCmd === 'stop') {
      // ... existing parsing ...
      if (json) jsonSuccess({ port: parseInt(tunnelPort, 10), stopped: true })
      // ...

    } else if (subCmd === 'stop-all') {
      // ...
      if (json) jsonSuccess({ stopped: true })
      // ...
    }
  } catch (err) {
    if (json) jsonError(ErrorCodes.TUNNEL_ERROR, (err as Error).message)
    console.error(`Failed to connect to daemon: ${(err as Error).message}`)
    process.exit(1)
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/tunnel-json.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/tunnel.ts src/cli/commands/__tests__/tunnel-json.test.ts
git commit -m "feat(cli): add --json support to tunnel add, list, stop, stop-all"
```

---

### Task 11: Add `--json` to `config set`, `adopt`, `remote`

**Files:**
- Modify: `src/cli/commands/config.ts`
- Modify: `src/cli/commands/adopt.ts`
- Modify: `src/cli/commands/remote.ts`
- Create: `src/cli/commands/__tests__/config-json.test.ts`
- Create: `src/cli/commands/__tests__/adopt-json.test.ts`
- Create: `src/cli/commands/__tests__/remote-json.test.ts`

- [ ] **Step 1: Write failing tests for `config set --json`**

```typescript
// src/cli/commands/__tests__/config-json.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

vi.mock('../../api-client.js', () => ({
  readApiPort: vi.fn().mockReturnValue(null), // Server not running
}))

vi.mock('../../../core/config/config.js', () => ({
  ConfigManager: class {
    exists = vi.fn().mockResolvedValue(true)
    load = vi.fn().mockResolvedValue(undefined)
    save = vi.fn().mockResolvedValue(undefined)
  },
  ConfigSchema: { shape: { defaultAgent: {}, telegram: {}, security: {} } },
}))

describe('config set --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful config set', async () => {
    const { cmdConfig } = await import('../config.js')
    const result = await captureJsonOutput(async () => {
      await cmdConfig(['set', 'defaultAgent', 'claude', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('path', 'defaultAgent')
    expect(data).toHaveProperty('value', 'claude')
  })

  it('outputs JSON error for unknown config key', async () => {
    const { cmdConfig } = await import('../config.js')
    const result = await captureJsonOutput(async () => {
      await cmdConfig(['set', 'nonexistent', 'value', '--json'])
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'CONFIG_INVALID')
  })
})
```

- [ ] **Step 2: Write failing test for `adopt --json`**

```typescript
// src/cli/commands/__tests__/adopt-json.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

vi.mock('../../api-client.js', () => ({
  readApiPort: vi.fn().mockReturnValue(3000),
  apiCall: vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ ok: true, sessionId: 'sess-1', threadId: 'thread-1', status: 'new' }),
  }),
}))

describe('adopt --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful adopt', async () => {
    const { cmdAdopt } = await import('../adopt.js')
    const result = await captureJsonOutput(async () => {
      await cmdAdopt(['claude', 'ext-session-1', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('sessionId')
    expect(data).toHaveProperty('agent', 'claude')
  })

  it('outputs JSON error when missing arguments', async () => {
    const { cmdAdopt } = await import('../adopt.js')
    const result = await captureJsonOutput(async () => {
      await cmdAdopt(['--json'])
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'MISSING_ARGUMENT')
  })
})
```

- [ ] **Step 3: Run tests, verify fail**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/config-json.test.ts src/cli/commands/__tests__/adopt-json.test.ts`

- [ ] **Step 4: Add `--json` to `config.ts` (only `config set`)**

```typescript
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

export async function cmdConfig(args: string[] = [], instanceRoot?: string): Promise<void> {
  const subCmd = args[0]
  const json = isJsonMode(args)

  // ... existing help blocks (no change) ...

  if (subCmd === 'set') {
    if (json) await muteForJson()

    const configPath = args[1]
    const configValue = args[2]
    if (!configPath || configValue === undefined) {
      if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Usage: viben config set <path> <value>')
      console.error('Usage: viben config set <path> <value>')
      process.exit(1)
    }

    // Validate top-level key
    const { ConfigSchema } = await import('../../core/config/config.js')
    const topLevelKey = configPath.split('.')[0]
    const validConfigKeys = Object.keys(ConfigSchema.shape)
    if (!validConfigKeys.includes(topLevelKey)) {
      if (json) jsonError(ErrorCodes.CONFIG_INVALID, `Unknown config key: ${topLevelKey}`)
      // ... existing error handling ...
    }

    let value: unknown = configValue
    try { value = JSON.parse(configValue) } catch {}

    const port = readApiPort(undefined, instanceRoot)
    if (port !== null) {
      const res = await apiCall(port, '/api/config', { /* ... */ }, instanceRoot)
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        if (json) jsonError(ErrorCodes.API_ERROR, String(data.error))
        console.error(`Error: ${data.error}`)
        process.exit(1)
      }
      if (json) jsonSuccess({ path: configPath, value, needsRestart: data.needsRestart ?? false })
      // ... existing human output ...
    } else {
      // ... existing file-based update ...
      if (json) jsonSuccess({ path: configPath, value, needsRestart: false })
      // ... existing human output ...
    }
    return
  }

  // Interactive editor — no --json support
  // ... unchanged ...
}
```

- [ ] **Step 5: Add `--json` to `adopt.ts`**

```typescript
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

export async function cmdAdopt(args: string[]): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  if (!json && wantsHelp(args)) { /* existing help */ return }

  // Parse positional args — skip known flags and their values
  const skipFlags = new Set(['--json', '--cwd', '--channel', '-h', '--help'])
  const skipNext = new Set(['--cwd', '--channel'])
  const positional: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (skipNext.has(args[i]!)) { i++; continue }
    if (skipFlags.has(args[i]!)) continue
    positional.push(args[i]!)
  }
  const agent = positional[0]
  const sessionId = positional[1]

  if (!agent || !sessionId) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Usage: viben adopt <agent> <session_id>')
    console.log('Usage: viben adopt <agent> <session_id> [--cwd <path>] [--channel <name>]')
    process.exit(1)
  }

  // ... existing cwd/channel parsing ...

  const port = readApiPort()
  if (!port) {
    if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'Viben is not running.')
    console.log('Viben is not running. Start it with: viben start')
    process.exit(1)
  }

  try {
    const { apiCall } = await import('../api-client.js')
    const res = await apiCall(port, '/api/sessions/adopt', { /* ... */ })
    const data = await res.json() as Record<string, unknown>

    if (data.ok) {
      if (json) jsonSuccess({
        sessionId: data.sessionId,
        threadId: data.threadId,
        agent,
        status: data.status ?? 'new',
      })
      // ... existing human output ...
    } else {
      if (json) jsonError(ErrorCodes.API_ERROR, String(data.message || data.error))
      console.log(`Error: ${data.message || data.error}`)
      process.exit(1)
    }
  } catch (err) {
    if (json) jsonError(ErrorCodes.API_ERROR, err instanceof Error ? err.message : String(err))
    console.log(`Failed to connect to Viben: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}
```

- [ ] **Step 6: Add `--json` to `remote.ts`**

```typescript
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

export async function cmdRemote(args: string[], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  // ... existing flag parsing ...

  // ... existing error checks (add json error handling to each) ...
  // Example:
  if (port === null) {
    if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'Viben is not running.')
    console.error('Viben is not running. Start with `viben start`')
    process.exit(1)
  }

  // ... after generating code and URLs ...

  if (json) {
    jsonSuccess({
      code,
      name: tokenName,
      role,
      expiresAt,
      urls: {
        local: localUrl,
        tunnel: tunnelLink ?? undefined,
        app: appLink ?? undefined,
      },
    })
  }

  // ... existing human output (box, QR code, etc.) ...
}
```

- [ ] **Step 7: Run all tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/config-json.test.ts src/cli/commands/__tests__/adopt-json.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/cli/commands/config.ts src/cli/commands/adopt.ts src/cli/commands/remote.ts src/cli/commands/__tests__/config-json.test.ts src/cli/commands/__tests__/adopt-json.test.ts
git commit -m "feat(cli): add --json support to config set, adopt, remote"
```

---

### Task 12: Add `--json` to `plugin install`, `plugin uninstall`

**Files:**
- Modify: `src/cli/commands/plugins.ts`
- Create: `src/cli/commands/__tests__/plugin-install-json.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/cli/commands/__tests__/plugin-install-json.test.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

vi.mock('../../../core/plugin/registry-client.js', () => ({
  RegistryClient: class { getRegistry = vi.fn().mockResolvedValue({ plugins: [] }) },
}))

vi.mock('../../../plugins/core-plugins.js', () => ({
  corePlugins: [
    { name: 'test-plugin', version: '1.0.0', description: 'Test', install: vi.fn() },
  ],
}))

describe('plugin install --json', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-plugin-install-'))
    fs.writeFileSync(path.join(tmpDir, 'plugins.json'), JSON.stringify({ installed: {} }))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('outputs JSON on successful builtin plugin install', async () => {
    const { cmdPlugin } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugin(['install', 'test-plugin', '--json'], tmpDir)
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('plugin', 'test-plugin')
    expect(data).toHaveProperty('installed', true)
  })

  it('outputs JSON error when missing package name', async () => {
    const { cmdPlugin } = await import('../plugins.js')
    const result = await captureJsonOutput(async () => {
      await cmdPlugin(['install', '--json'], tmpDir)
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'MISSING_ARGUMENT')
  })
})
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Add `--json` to `installPlugin` and `uninstallPlugin` in `plugins.ts`**

For `installPlugin`:
```typescript
async function installPlugin(input: string, instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  // ... existing logic ...

  if (builtinPlugin) {
    // ... existing install ...
    if (json) jsonSuccess({ plugin: builtinPlugin.name, version: builtinPlugin.version, installed: true })
    console.log(`✓ ${builtinPlugin.name} installed! Restart to activate.`)
    return
  }

  // ... npm install ...
  // On success:
  if (json) jsonSuccess({ plugin: plugin?.name ?? pkgName, version: installedPkg.version, installed: true })

  // On npm failure:
  if (json) jsonError(ErrorCodes.INSTALL_FAILED, `Failed to install ${installSpec}`)
}
```

Update `cmdPlugin` switch to pass json:
```typescript
case 'add':
case 'install': {
  const pkg = args[1]
  if (!pkg) {
    if (isJsonMode(args)) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Package name is required')
    console.error('Error: missing package name.')
    process.exit(1)
  }
  await installPlugin(pkg, instanceRoot, isJsonMode(args))
  return
}

case 'remove':
case 'uninstall': {
  const pkg = args[1]
  if (!pkg) {
    if (isJsonMode(args)) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Package name is required')
    console.error('Error: missing package name.')
    process.exit(1)
  }
  const purge = args.includes('--purge')
  await uninstallPlugin(pkg, purge, instanceRoot, isJsonMode(args))
  return
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/plugin-install-json.test.ts`
Expected: PASS

- [ ] **Step 5: Add `--json` to legacy `install.ts` and `uninstall.ts`**

These are the legacy `viben install <pkg>` / `viben uninstall <pkg>` commands (distinct from `plugin install`). They use `execSync` with `stdio: 'inherit'`, which writes npm output to stdout/stderr.

In `src/cli/commands/install.ts`:

```typescript
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

export async function cmdInstall(args: string[], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const root = instanceRoot ?? path.join(os.homedir(), '.viben')
  const pluginsDir = path.join(root, 'plugins')
  if (!json && wantsHelp(args)) { /* existing help */ return }
  const pkg = args.filter(a => a !== '--json')[0]
  if (!pkg) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Package name is required')
    console.error('Usage: viben install <package>')
    process.exit(1)
  }
  fs.mkdirSync(pluginsDir, { recursive: true })
  const pkgPath = path.join(pluginsDir, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'viben-plugins', private: true, dependencies: {} }, null, 2))
  }
  if (!json) console.log(`Installing ${pkg}...`)
  try {
    execSync(`npm install ${pkg} --prefix "${pluginsDir}"`, { stdio: json ? 'pipe' : 'inherit' })
  } catch (err) {
    if (json) jsonError(ErrorCodes.INSTALL_FAILED, `Failed to install ${pkg}`)
    process.exit(1)
  }
  if (json) jsonSuccess({ plugin: pkg, installed: true })
  console.log(`Plugin ${pkg} installed successfully.`)
}
```

Same pattern for `uninstall.ts` — use `stdio: json ? 'pipe' : 'inherit'` to suppress npm output in json mode.

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/plugins.ts src/cli/commands/install.ts src/cli/commands/uninstall.ts src/cli/commands/__tests__/plugin-install-json.test.ts
git commit -m "feat(cli): add --json support to plugin install/uninstall and legacy install/uninstall"
```

---

### Task 13: Add `--json` to `api` Command (20+ subcommands)

**Files:**
- Modify: `src/cli/commands/api.ts`
- Create: `src/cli/commands/__tests__/api-json.test.ts`

- [ ] **Step 1: Write failing tests for key `api` subcommands**

```typescript
// src/cli/commands/__tests__/api-json.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

vi.mock('../../api-client.js', () => ({
  readApiPort: vi.fn().mockReturnValue(3000),
  removeStalePortFile: vi.fn(),
  apiCall: vi.fn().mockImplementation((_port: number, urlPath: string) => {
    if (urlPath === '/api/sessions') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          sessions: [{ id: 'sess-1', agent: 'claude', status: 'active', name: 'Test' }],
        }),
      })
    }
    if (urlPath === '/api/agents') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          agents: [{ name: 'claude', command: 'npx', args: [] }],
          default: 'claude',
        }),
      })
    }
    if (urlPath.startsWith('/api/v1/system/health') || urlPath === '/health') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', uptime: 3600, version: '2026.401.1' }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }),
}))

describe('api status --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('wraps API response in success envelope', async () => {
    const { cmdApi } = await import('../api.js')
    const result = await captureJsonOutput(async () => {
      await cmdApi(['status', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('sessions')
  })
})

describe('api agents --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('wraps agents response in success envelope', async () => {
    const { cmdApi } = await import('../api.js')
    const result = await captureJsonOutput(async () => {
      await cmdApi(['agents', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('agents')
  })
})

describe('api health --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('wraps health response in success envelope', async () => {
    const { cmdApi } = await import('../api.js')
    const result = await captureJsonOutput(async () => {
      await cmdApi(['health', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('status', 'ok')
  })
})
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Add `--json` to `cmdApi`**

The `api` command already fetches JSON from the HTTP API. In `--json` mode, wrap the raw API response in the standard envelope:

At the top of `cmdApi`, after the port check:
```typescript
const json = isJsonMode(args)
if (json) muteForJson()

const port = readApiPort(undefined, instanceRoot)
if (port === null) {
  if (json) jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'Viben is not running.')
  console.error('Viben is not running. Start with `viben start`')
  process.exit(1)
}
```

For each subcommand, add JSON handling after the API call. Pattern:
```typescript
} else if (subCmd === 'status') {
  const res = await call('/api/sessions')
  const data = await res.json() as { sessions: Array<...> }
  if (json) jsonSuccess(data)  // Wrap raw API response
  // ... existing human output ...

} else if (subCmd === 'agents') {
  const res = await call('/api/agents')
  const data = await res.json() as { agents: Array<...>; default: string }
  if (json) jsonSuccess(data)
  // ... existing human output ...
```

For error responses from the API:
```typescript
if (!res.ok) {
  const errData = await res.json() as Record<string, unknown>
  if (json) jsonError(ErrorCodes.API_ERROR, String(errData.error ?? 'API request failed'))
  console.error(`Error: ${errData.error}`)
  process.exit(1)
}
```

Apply this pattern to all ~20 subcommands in the file. Each subcommand's pattern is:
1. Make the API call
2. Parse response
3. If json mode, call `jsonSuccess(data)` with the raw API data (normalized passthrough)
4. On error, call `jsonError(ErrorCodes.API_ERROR, message)`

The catch block at the bottom:
```typescript
} catch (err) {
  if (json) jsonError(ErrorCodes.API_ERROR, (err as Error).message)
  console.error(`Error: ${(err as Error).message}`)
  process.exit(1)
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test -- src/cli/commands/__tests__/api-json.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/api.ts src/cli/commands/__tests__/api-json.test.ts
git commit -m "feat(cli): add --json support to api command (all subcommands)"
```

---

### Task 14: Update Help Text for All Modified Commands

**Files:**
- Modify: All command files that were modified in Tasks 3-13

- [ ] **Step 1: Add `--json` to help text of each command**

For every command that now supports `--json`, add this line to its `--help` output in the Options section:

```
  --json          Output result as JSON
```

Commands to update:
- `agents.ts` — main help, install help, uninstall help, info help
- `plugins.ts` — `cmdPlugins` help, `cmdPlugin` help
- `plugin-search.ts` — no formal help block, but add if applicable
- `status.ts` — no formal help block currently, add basic help with `--json`
- `config.ts` — `config set` help
- `start.ts` — help
- `stop.ts` — help
- `restart.ts` — help
- `doctor.ts` — help
- `tunnel.ts` — help (in the default else block)
- `adopt.ts` — help
- `remote.ts` — no formal help currently
- `api.ts` — main help, individual subcommand helps

- [ ] **Step 2: Verify help output by running a few commands manually**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build && node dist/cli.js agents --help`
Verify `--json` appears in the options section.

- [ ] **Step 3: Commit**

```bash
git add src/cli/commands/
git commit -m "docs(cli): add --json flag to help text for all supported commands"
```

---

### Task 15: Run Full Test Suite and Fix Any Failures

- [ ] **Step 1: Build the project**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm build`
Expected: No TypeScript errors

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/lucas/code/viben-workspace/Viben && pnpm test`
Expected: All tests pass. Fix any failures introduced by the changes.

- [ ] **Step 3: Verify existing tests still pass**

Pay special attention to:
- `src/cli/commands/__tests__/agents-json.test.ts` — migrated format
- `src/cli/commands/__tests__/setup.test.ts` — migrated format
- Any test that spies on `console.log` or `process.exit`

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(cli): fix test failures from --json integration"
```

---

### Task 16: Export types from `src/cli/output.ts` in package index

**Files:**
- Modify: `src/cli/output.ts` — ensure types are exported
- Verify: Types are usable by consumers

- [ ] **Step 1: Verify exports**

The types `JsonSuccess`, `JsonError`, `JsonOutput`, and `ErrorCodes` should already be exported from `output.ts`. Verify they are importable:

```typescript
import { JsonOutput, ErrorCodes } from '@viben/kernel/cli/output.js'
```

If they need to be in the public API (`src/index.ts`), add the export there. Otherwise, they are internal-only which is fine for CLI usage.

- [ ] **Step 2: Commit if any changes**

```bash
git add src/cli/output.ts
git commit -m "chore(cli): ensure JSON output types are properly exported"
```
