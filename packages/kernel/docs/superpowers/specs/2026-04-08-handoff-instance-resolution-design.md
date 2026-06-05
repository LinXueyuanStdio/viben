# Handoff Instance Resolution Design

**Date**: 2026-04-08
**Status**: Draft

## Problem

When multiple Viben instances run on the same machine (e.g., global `~/.viben/` + local project `~/workspace/.viben/`), the handoff flow always targets the global instance. The CLI `adopt` command calls `readApiPort()` with no arguments, which defaults to `~/.viben/api.port` — it has no awareness of local instances.

Note: other CLI commands (`api.ts`, `config.ts`, `tunnel.ts`, `remote.ts`) already pass `instanceRoot` to `readApiPort()` correctly. `adopt.ts` is the outlier.

Users commonly work in workspaces with nested project directories. An agent running in `~/workspace/project-A/src/core/` should handoff to the instance at `~/workspace/.viben/` if one is running, not to the unrelated global instance.

## Design

### Instance Resolution Algorithm

Enhance the existing `resolveInstanceRoot()` in `instance-context.ts` to walk up the directory tree from the agent's working directory, looking for a running `.viben/` instance. Currently it only checks the exact CWD — it needs to climb like `findPackageRoot()` in `agent-instance.ts`.

```
resolveRunningInstance(cwd):
  dir = cwd
  while dir != path.dirname(dir):     // stop at filesystem root
    candidate = path.join(dir, '.viben')
    if candidate exists:
      port = read candidate/api.port
      if port exists AND health check passes:
        return candidate          // found running instance
      else:
        continue walking up       // instance exists but not running, skip
    dir = path.dirname(dir)

  // fallback: global instance
  global = ~/.viben
  if global has api.port AND health check passes:
    return global

  // nothing running
  return null
```

**Key behaviors:**
- Nearest running instance wins (like `.git` discovery)
- Dead instances (exist but not running) are skipped — continue walking up
- Fallback to global `~/.viben/` if no local instance found
- Health check: read `api.port` file + HTTP GET to `/api/v1/system/health` (reuse `checkHealth()` from `instance-discovery.ts`)

### Changes Required

#### 1. New async function: `resolveRunningInstance()`

**Location**: `src/core/instance/instance-context.ts` (alongside existing `resolveInstanceRoot()`)

```typescript
export async function resolveRunningInstance(cwd: string): Promise<string | null>
```

- New function — does NOT modify or replace the existing sync `resolveInstanceRoot()`, which is used by multiple CLI commands for non-network resolution
- Walks up directory tree using the same pattern as `findPackageRoot()` in `agent-instance.ts`
- At each `.viben/` candidate: reads `api.port`, calls `checkHealth()` from `instance-discovery.ts`
- Returns instance root path, or `null` if nothing running

#### 2. Modify CLI `adopt.ts`

Replace the current port resolution:

```typescript
// Before
const port = readApiPort()

// After
const instanceRoot = await resolveRunningInstance(cwd ?? process.cwd())
if (!instanceRoot) {
  console.error('No running Viben instance found')
  process.exit(1)
}
const port = readApiPort(undefined, instanceRoot)
```

- `cwd` comes from the `--cwd` flag (already parsed in adopt.ts but unused for instance resolution)
- If `--cwd` not provided, falls back to `process.cwd()`

#### 3. No changes to shell scripts

The handoff scripts (`viben-handoff.sh`, `viben-inject-session.sh`) and slash commands remain unchanged. They already pass `--cwd` to `viben adopt`. This means:
- Users who already integrated don't need to re-run `viben integrate`
- Backward compatible — old installs work without changes

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Nested instances: `~/workspace/.viben/` + `~/workspace/project/.viben/` | Nearest running instance wins |
| Instance dir exists but daemon is dead | Skip, continue walking up |
| No local instance, global is running | Fallback to global |
| No instance running anywhere | Error: "No running Viben instance found" |
| `--cwd` not provided | Use `process.cwd()` |
| Agent in deeply nested dir (`~/workspace/project/src/core/utils/`) | Walks up all levels until finding `.viben/` |

### What Does NOT Change

- Existing sync `resolveInstanceRoot()` — untouched, no breaking change
- Shell hook scripts (no re-integration needed)
- Daemon-side adopt logic (`core.adoptSession()`)
- API endpoints
- Session storage format
- Instance registry format

## Testing

1. **Unit tests for `resolveRunningInstance()`**:
   - Walk up finds nearest running instance
   - Skips dead instances (`.viben/` exists, no running daemon), finds next running one
   - Falls back to global when no local instance found
   - Returns null when nothing is running
   - Nested instances: nearest running wins over parent

2. **Integration test**:
   - Two instances running (local + global), adopt from nested CWD routes to local
