# UUID-Centric Instance Identity — Design Spec

**Date:** 2026-04-10
**Status:** Draft
**Scope:** Core CLI — instance identity stored in config.json, propagated through all creation paths

## Problem

Instances currently do not know their own UUID. The UUID lives only in `~/.viben/instances.json`,
keyed by ID. Any code that needs the UUID for a given instance root must look it up from the registry:

- `resolveInstanceId` reads `instances.json`, falls back to sanitized directory name
- `cmdSetup` registers a UUID in `instances.json` but never writes it to `config.json`
- `initInstanceFiles` has no `id` parameter — UUID is invisible to the instance files
- The interactive wizard generates a UUID at line 456 but writes config at line 439 (before UUID
  generation) — so `id` is never included in the config written by the wizard

This creates two concrete bugs:

1. The App setup wizard cannot get the UUID from `viben setup --json` output (it returns only
   `{ configPath }`, not `{ id, name, directory }`), forcing a fragile `instances list + path
   comparison` fallback that breaks on tilde paths and produces a hardcoded `'main'` fallback.

2. When the App needs to identify an existing workspace from a directory path, it has no reliable
   method — path comparison is used, which is wrong for identity.

## Solution

Store `id` in `config.json` so every instance carries its own UUID. All instance creation paths
write the UUID into config.json. The CLI surfaces the UUID in `cmdSetup` JSON output.
`resolveInstanceId` reads from config.json first instead of the registry.

### Core Principle

> An instance's UUID is written once at creation time into its own `config.json`.
> The registry (`instances.json`) is an index for discovery, not the source of truth for identity.

---

## Design

### 1. `InitInstanceOptions` — add `id` field

**File:** `src/core/instance/instance-init.ts`

```typescript
export interface InitInstanceOptions {
  id?: string            // UUID for this instance, written to config.json
  agents?: string[]
  instanceName?: string
  mergeExisting?: boolean
  runMode?: 'daemon' | 'foreground'
}
```

`writeConfig` behavior:
- If `opts.id` is provided → write `id` to config object
- If `mergeExisting` is true and existing config already has `id` → preserve existing value
  (never overwrite an established UUID)

```typescript
// In writeConfig():
const id = opts.id ?? (existing['id'] as string | undefined)
if (id) config['id'] = id
```

### 2. `ConfigSchema` — add `id` field

**File:** `src/core/config/config.ts`

```typescript
export const ConfigSchema = z.object({
  id: z.string().optional(),       // ← add: instance UUID, optional for backward compat
  instanceName: z.string().optional(),
  // ... rest unchanged
})
```

### 3. Config migration — `add-instance-id`

**File:** `src/core/config/config-migrations.ts`

`MigrationContext` already has `configDir` (the directory containing `config.json`, which equals
`instanceRoot`). `ConfigManager.load()` already passes `{ configDir: path.dirname(this.configPath) }`
to `applyMigrations`. The migration reads `instances.json` with plain `fs` (synchronous, ESM-compatible):

```typescript
{
  name: 'add-instance-id',
  apply(raw, ctx) {
    if (raw.id) return false           // already has id, skip
    if (!ctx?.configDir) return false  // no context, can't look up

    // ctx.configDir === instanceRoot (config.json lives at instanceRoot/config.json)
    const instanceRoot = ctx.configDir

    try {
      const registryPath = path.join(os.homedir(), '.viben', 'instances.json')
      const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
      const instances = data?.instances ?? {}
      const entry = Object.values(instances).find(
        (e: any) => e.root === instanceRoot
      ) as { id: string } | undefined
      if (entry?.id) {
        raw.id = entry.id
        log.info({ instanceRoot }, 'Migrated: added id to config from registry')
        return true
      }
    } catch { /* best-effort — registry may not exist on fresh installs */ }

    return false
  }
}
```

Add `import fs from 'node:fs'`, `import path from 'node:path'`, `import os from 'node:os'`
at the top of the migration file (already available in config.ts, but migrations file needs them).

### 4. `cmdSetup` — pass UUID into `initInstanceFiles`, return in JSON

**File:** `src/cli/commands/setup.ts`

Reorder: registry check/register BEFORE `initInstanceFiles` so the UUID can be passed in:

```typescript
// Resolve or create UUID (idempotent — existing registration is preserved)
const registryPath = path.join(getGlobalRoot(), 'instances.json')
const registry = new InstanceRegistry(registryPath)
registry.load()

let id: string
const existing = registry.getByRoot(instanceRoot)
if (existing) {
  id = existing.id
} else {
  id = randomUUID()
  registry.register(id, instanceRoot)
  registry.save()
}

// Write instance files with id — config.json now carries the UUID
initInstanceFiles(instanceRoot, { agents, runMode, mergeExisting: true, id })

// Default instanceName to the workspace directory basename if not already set
const name = readConfigField(instanceRoot, 'instanceName')
           ?? path.basename(path.dirname(instanceRoot))

// Persist the default name if it wasn't set
if (!readConfigField(instanceRoot, 'instanceName')) {
  const configPath = path.join(instanceRoot, 'config.json')
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    raw.instanceName = name
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2))
  } catch { /* best-effort */ }
}

if (json) {
  jsonSuccess({ id, name, directory: path.dirname(instanceRoot), configPath: path.join(instanceRoot, 'config.json') })
} else {
  console.log(`\n  \x1b[32m✓ Setup complete.\x1b[0m Config written to ${path.join(instanceRoot, 'config.json')}\n`)
}
```

Helper (can be inline or a small private function):
```typescript
function readConfigField(instanceRoot: string, field: string): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(instanceRoot, 'config.json'), 'utf-8'))
    return typeof raw[field] === 'string' ? raw[field] : null
  } catch { return null }
}
```

### 5. `cmdInstancesCreate` — idempotent, pass UUID into `initInstanceFiles`

**File:** `src/cli/commands/instances.ts`

**Change 1: "already registered" case** — return existing entry (idempotent), and also write
`id` to config.json in case it was created before this change:

```typescript
if (existing) {
  // Ensure config.json has the id (idempotent write — mergeExisting preserves other fields)
  initInstanceFiles(instanceRoot, { mergeExisting: true, id: existing.id })
  if (!json) console.warn(`Warning: Instance already registered at ${resolvedDir} (id: ${existing.id})`)
  await outputInstance(json, { id: existing.id, root: instanceRoot })
  return
}
```

**Change 2: ".viben exists but not registered" case** — pass UUID to `initInstanceFiles`:

```typescript
const id = randomUUID()
initInstanceFiles(instanceRoot, { mergeExisting: true, id })
registry.register(id, instanceRoot)
registry.save()
await outputInstance(json, { id, root: instanceRoot })
```

**Change 3: "create new" case** — same, pass `id`:

```typescript
const id = randomUUID()
// --from case: after copyInstance, write new id (copyInstance strips id — see section 7)
if (rawFrom) {
  // ... existing copyInstance call ...
  initInstanceFiles(instanceRoot, { mergeExisting: true, id })  // write new id over copied source id
} else {
  initInstanceFiles(instanceRoot, { agents, instanceName: name, id })
}
registry.register(id, instanceRoot)
registry.save()
await outputInstance(json, { id, root: instanceRoot })
```

### 6. `resolveInstanceId` — read config.json first

**File:** `src/cli/resolve-instance-id.ts`

Add `import fs from 'node:fs'` (path is already imported):

```typescript
export function resolveInstanceId(instanceRoot: string): string {
  // 1. Read id from config.json (preferred — instance knows its own UUID)
  try {
    const configPath = path.join(instanceRoot, 'config.json')
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (raw.id && typeof raw.id === 'string') return raw.id
  } catch { /* fall through */ }

  // 2. Fall back to registry (backward compat for instances that haven't migrated yet)
  try {
    const reg = new InstanceRegistry(path.join(getGlobalRoot(), 'instances.json'))
    reg.load()
    const entry = reg.getByRoot(instanceRoot)
    if (entry?.id) return entry.id
  } catch { /* fall through */ }

  // 3. Last resort: sanitized parent dir name
  return path.basename(path.dirname(instanceRoot)).replace(/[^a-zA-Z0-9-]/g, '-') || 'default'
}
```

### 7. `copyInstance` — delete `id` from copied config

**File:** `src/core/instance/instance-copy.ts`

`copyInstance` currently deletes `instanceName` but not `id`. If a source instance has `id` in
config.json, the copy would inherit the same UUID — two instances with the same id. Fix: delete
`id` alongside other instance-specific fields:

```typescript
// Remove instance-specific fields
delete config.instanceName
delete config.id              // ← add: each instance needs its own UUID
if (config.workspace) delete config.workspace.baseDir
```

After this change, the copy has no `id`. The caller (`cmdInstancesCreate --from` case or wizard)
must write a new `id` via `initInstanceFiles({ mergeExisting: true, id: newUUID })` after copy.

### 8. Interactive wizard — include `id` in written config

**File:** `src/core/setup/wizard.ts`

Currently: UUID generated at line 456, config written at line 439 (before UUID generation).

Fix: generate UUID before writing config, include in config object:

```typescript
// Generate UUID before writing config (move registry check up)
const existingEntry = instanceRegistry.getByRoot(instanceRoot)
const instanceId = existingEntry?.id ?? randomUUID()

const config = {
  id: instanceId,          // ← include in written config
  instanceName,
  defaultAgent,
  // ... rest unchanged
}

await configManager.writeNew(config)

// Register in registry (now after config write, UUID already decided above)
if (!existingEntry) {
  instanceRegistry.register(instanceId, instanceRoot)
  await instanceRegistry.save()
}
```

---

## Files Changed

| File | Change |
|---|---|
| `src/core/instance/instance-init.ts` | Add `id` to `InitInstanceOptions`; write `id` into config.json (preserve existing) |
| `src/core/instance/instance-copy.ts` | Delete `id` from copied config (instance-specific field) |
| `src/core/config/config.ts` | Add `id: z.string().optional()` to `ConfigSchema` |
| `src/core/config/config-migrations.ts` | Add `add-instance-id` migration; add `fs`, `path`, `os` imports |
| `src/cli/resolve-instance-id.ts` | Read from config.json first, registry as fallback; add `fs` import |
| `src/cli/commands/setup.ts` | Reorder: registry before `initInstanceFiles`; pass `id`; default `instanceName`; return `{ id, name, directory, configPath }` |
| `src/cli/commands/instances.ts` | Idempotent on "already registered" (warn + return existing, write id to config); pass `id` to `initInstanceFiles` in all create paths; write new `id` after `--from` copy |
| `src/core/setup/wizard.ts` | Generate UUID before writing config; include `id` in config object |

## No Changes Required

- `InstanceRegistry` — still the discovery index, no structural change
- `createInstanceContext` — already receives `id` as parameter, no change
- `main.ts` — already reads UUID from registry when creating context; migration handles old instances

## Edge Cases

- **Existing instances without `id` in config** → migration `add-instance-id` handles on next server
  start. `cmdInstancesCreate` also writes `id` to config in the "already registered" case.
- **Copy instance (`--from`, wizard copy)** → `copyInstance` strips `id`; caller writes new UUID
  via `initInstanceFiles` after copy. Two instances will never share the same `id`.
- **Registry and config out of sync** → `resolveInstanceId` reads config.json first (most reliable).
  If config has `id` but registry doesn't, the `id` is still trusted. Registry is just for discovery.

## Testing

- `initInstanceFiles` with `id` option writes `id` to config.json
- `initInstanceFiles` with `mergeExisting: true` and existing `id` preserves the existing value
- `copyInstance` does NOT copy `id` — destination config has no `id` field after copy
- `cmdSetup --json` output includes `{ id, name, directory, configPath }` with non-null `name`
- `cmdInstancesCreate --json` on already-registered instance returns `jsonSuccess` (not error)
- `cmdInstancesCreate --from` creates destination with a new UUID (not source UUID)
- `resolveInstanceId` reads from config.json when `id` is present
- Migration `add-instance-id` writes `id` from registry into configs that lack it
- Wizard-created instances have `id` in config.json immediately after setup
