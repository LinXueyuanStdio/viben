# Contributing

Contributions are welcome. This page covers how to set up a development environment, project conventions, testing expectations, and the PR process.

---

## Dev Setup

**Requirements:** Node.js >= 20, pnpm >= 10.

```bash
# 1. Fork https://github.com/LinXueyuanStdio/viben and clone your fork
git clone https://github.com/<your-username>/Viben.git
cd Viben

# 2. Install dependencies
pnpm install

# 3. Compile TypeScript
pnpm build

# 4. Run the CLI locally
pnpm start

# 5. Watch mode (recompiles on save)
pnpm dev

# 6. Run the test suite
pnpm test
```

The compiled output lands in `dist/`. The entry point is `dist/cli.js`.

For publishing-related work, `pnpm build:publish` bundles via tsup into `dist-publish/` — this is what gets shipped to npm as `@viben/kernel`.

---

## Project Conventions

### ESM-only

The package uses `"type": "module"`. All `import` statements must use `.js` extensions, even when importing `.ts` source files:

```typescript
// Correct
import { ChannelAdapter } from './channel.js'

// Wrong — will fail at runtime
import { ChannelAdapter } from './channel'
```

### TypeScript

- `strict: true` is enforced.
- Target: ES2022.
- Module resolution: NodeNext.
- All new files must be `.ts`. No plain `.js` in `src/`.

### File and Module Layout

- Source lives in `src/`. Tests live in `src/**/__tests__/` or next to the file they test.
- Core abstractions belong in `src/core/`. Plugin implementations (including adapters) belong in `src/plugins/<name>/`.
- Public API exports flow through `src/index.ts` → `src/core/index.ts`.

---

## Testing Guidelines

The test framework is [Vitest](https://vitest.dev/). Run with `pnpm test` (single run) or `pnpm test:watch` (interactive watch mode).

### Test Flows, Not Internals

Tests should validate behavior against specifications, not implementation details. Focus on observable outcomes: what events are emitted, what methods are called, what state changes result.

```typescript
// Good — tests the outcome of a complete flow
it('sends a message to the adapter after the agent responds', async () => {
  const adapter = mockAdapter()
  await core.handleIncomingMessage({ ... })
  await vi.waitFor(() => expect(adapter.sendMessage).toHaveBeenCalledWith(...))
})

// Avoid — tests a private implementation detail
it('calls _processQueue internally', () => { ... })
```

### Mock at Boundaries

Mock `AgentInstance`, `ChannelAdapter`, and `SessionStore` — not internal classes. Use `vi.fn()` for mocks. For event-driven mocks, use `TypedEmitter` from `viben`:

```typescript
import { TypedEmitter } from '@viben/kernel'
import type { AgentEvent } from '@viben/kernel'

function mockAgentInstance() {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>()
  return Object.assign(emitter, {
    sessionId: 'agent-sess-1',
    prompt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  }) as any
}
```

### Async Assertions

For fire-and-forget operations, use `vi.waitFor()` rather than arbitrary sleeps:

```typescript
await vi.waitFor(() => {
  expect(adapter.sendMessage).toHaveBeenCalledTimes(3)
})
```

Use `await Promise.resolve()` for microtask timing when you just need to flush the microtask queue.

### Timer-Based Tests

Use `vi.useFakeTimers()` for anything involving timeouts (e.g. permission gate expiry, session TTL):

```typescript
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('times out the permission request after 60 seconds', async () => {
  // ...setup...
  await vi.advanceTimersByTimeAsync(60_000)
  expect(result).toBe('timed_out')
})
```

### What to Cover

Good contributions include tests for:

- **All state machine transitions** — both valid paths and invalid ones. Verify events emitted on each.
- **Error recovery** — after an error, the system must remain usable.
- **Concurrency** — serial processing guarantees, queue ordering, race conditions.
- **Boundary values** — at exactly the limit (e.g. `maxConcurrentSessions`).
- **Cleanup** — timers, listeners, and files are removed in `afterEach`.
- **Idempotency** — double `connect()`, double `resolve()`, double `stop()` must be safe.

### Cleanup

Always clean up in `afterEach`:

```typescript
afterEach(async () => {
  await core.stop()
  vi.clearAllMocks()
})
```

---

## PR Process

1. **Branch from `develop`**, not `main`:
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feat/my-feature
   ```

2. **Write tests** before or alongside your implementation. PRs without tests for new behavior will be asked to add them.

3. **Build and test** before pushing:
   ```bash
   pnpm build && pnpm test
   ```

4. **Open a PR against `develop`**. In your PR description:
   - Explain what the change does and why.
   - List any breaking changes.
   - Note any backward compatibility considerations (see the `CLAUDE.md` backward-compat section for the full policy).

5. **Backward compatibility**: if you change config fields, storage formats, CLI commands, or plugin APIs, you must handle old data gracefully. New config fields need `.default()` or `.optional()` in the Zod schema. See the project `CLAUDE.md` for the full policy.

---

## Publishing a Plugin to the Registry

Built a plugin? Share it with the community by adding it to the [Viben Plugin Registry](https://github.com/Viben/plugin-registry).

### Step 1: Publish to npm

```bash
cd my-plugin
npm run build
npm publish --access=public
```

### Step 2: Create a registry entry

Fork [Viben/plugin-registry](https://github.com/Viben/plugin-registry) and create a JSON file in `plugins/`:

**Filename:** your npm package name with `@` removed and `/` replaced by `--`.
- `@yourname/viben-translator` → `yourname--viben-translator.json`
- `viben-plugin-tts` → `viben-plugin-tts.json`

**Content:**

```json
{
  "name": "my-plugin",
  "displayName": "My Awesome Plugin",
  "description": "What your plugin does in one line",
  "npm": "@yourname/viben-my-plugin",
  "repository": "https://github.com/yourname/viben-my-plugin",
  "author": {
    "name": "yourname",
    "github": "yourname"
  },
  "version": "1.0.0",
  "minCliVersion": "2026.0326.0",
  "category": "utility",
  "tags": ["keyword1", "keyword2"],
  "icon": "🔧",
  "license": "MIT",
  "verified": false,
  "featured": false,
  "createdAt": "2026-03-27T00:00:00Z"
}
```

**Categories:** `adapter`, `utility`, `integration`, `ai`, `security`, `media`

### Step 3: Submit a Pull Request

Submit your PR to the registry repo. CI will automatically:
1. Validate your JSON format
2. Verify your npm package exists
3. Auto-merge if everything passes

### After submission

- Your plugin appears in `viben plugin search` within minutes
- A daily CI job keeps the version synced with npm — no need to update manually
- Maintainers may review your plugin and mark it as **verified** (✓)

### Requirements

- Plugin **must be published on npm** before submitting
- Plugin **must export a valid `VibenPlugin` interface**
- Plugin **must have a README** with installation instructions
- Plugin **must specify a license**

---

## Code Style

- Follow the patterns of the file you are editing — consistency within a file takes priority.
- Prefer explicit types over `any`. Use `unknown` when the type is genuinely unknown.
- Use `createChildLogger({ module: 'my-module' })` for structured logging instead of `console.log`.
- Keep files focused. If a file grows beyond ~300 lines, consider splitting it.
- No default exports from core modules — use named exports so tree-shaking and refactoring tools work reliably.
