# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 15 remaining security vulnerabilities across agent sandbox, installation, plugin system, and tunnel subsystem.

**Architecture:** Hybrid approach — core modules (`PathGuard`, `EnvFilter`) enforce hard security boundaries that cannot be bypassed. Security plugin and config provide flexible policies (`.vibenignore`, allowed paths, env whitelist). All changes are additive or surgical replacements; existing logic flow is preserved.

**Tech Stack:** Node.js, TypeScript, Vitest, Zod, `ignore` npm package (gitignore-style pattern matching)

**Spec:** `docs/superpowers/specs/2026-04-03-security-hardening-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/core/security/path-guard.ts` | Workspace boundary validation + `.vibenignore` pattern matching |
| `src/core/security/env-filter.ts` | Environment variable whitelist filtering |
| `src/core/security/sanitize-html.ts` | Lightweight HTML sanitizer for markdown output |
| `src/core/security/__tests__/path-guard.test.ts` | PathGuard unit tests |
| `src/core/security/__tests__/env-filter.test.ts` | EnvFilter unit tests |
| `src/core/security/__tests__/sanitize-html.test.ts` | HTML sanitizer tests |
| `src/core/agents/__tests__/agent-installer-security.test.ts` | Installer security tests |
| `src/plugins/tunnel/__tests__/tunnel-security.test.ts` | Tunnel security tests |

### Modified Files

| File | Change |
|------|--------|
| `package.json` | Add `ignore` dependency |
| `src/core/config/config.ts` | Add `workspace.security` schema + fix `resolveWorkspace()` |
| `src/core/agents/agent-instance.ts` | Wire PathGuard into readTextFile/writeTextFile/attachments, wire EnvFilter into spawn |
| `src/core/sessions/terminal-manager.ts` | Wire EnvFilter into createTerminal |
| `src/core/sessions/session-bridge.ts` | Remove description-based auto-approve |
| `src/core/agents/agent-installer.ts` | Add checksum, size limit, validate-before-extract, uninstall path validation |
| `src/core/agents/agent-catalog.ts` | File permissions 0o600 |
| `src/core/agents/agent-store.ts` | File permissions 0o600 |
| `src/core/utils/install-binary.ts` | Size limit + tar validation |
| `src/core/plugin/plugin-installer.ts` | Add `--ignore-scripts` |
| `src/core/setup/wizard.ts` | Add `--ignore-scripts` |
| `src/plugins/tunnel/index.ts` | Auth default on |
| `src/plugins/tunnel/templates/file-viewer.ts` | Replace CDN DOMPurify with inline sanitizer |
| `src/plugins/tunnel/providers/ngrok.ts` | Credentials via env vars |
| `src/plugins/tunnel/providers/bore.ts` | Credentials via env vars |
| `src/plugins/tunnel/providers/viben.ts` | Credentials via env vars |
| `src/plugins/tunnel/viewer-routes.ts` | Strip absolute paths from API responses |
| `src/plugins/api-server/routes/sessions.ts` | Require `sessions:dangerous` scope for bypass toggle |
| `src/core/sessions/__tests__/session-bridge-autoapprove.test.ts` | Update tests for removed auto-approve |
| `src/core/plugin/__tests__/plugin-installer.test.ts` | Add `--ignore-scripts` test |
| `src/plugins/api-server/__tests__/routes-sessions.test.ts` | Update dangerous endpoint scope tests |

---

## Task 1: Add `ignore` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `ignore` package**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm add ignore
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm list ignore
```

Expected: `ignore` listed in dependencies

- [ ] **Step 3: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add package.json pnpm-lock.yaml && git commit -m "chore: add ignore package for .vibenignore support"
```

---

## Task 2: PathGuard module

**Files:**
- Test: `src/core/security/__tests__/path-guard.test.ts`
- Create: `src/core/security/path-guard.ts`

- [ ] **Step 1: Write PathGuard tests**

```typescript
// src/core/security/__tests__/path-guard.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PathGuard } from "../path-guard.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("PathGuard", () => {
  let tmpDir: string;
  let guard: PathGuard;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pathguard-"));
    // Create test files
    fs.writeFileSync(path.join(tmpDir, "allowed.txt"), "ok");
    fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=123");
    fs.writeFileSync(path.join(tmpDir, "db.key"), "private-key");
    fs.writeFileSync(path.join(tmpDir, "credentials.json"), "{}");
    fs.mkdirSync(path.join(tmpDir, "subdir"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "subdir", "nested.txt"), "nested");
    guard = new PathGuard({ cwd: tmpDir, allowedPaths: [], ignorePatterns: [] });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- Boundary enforcement ---

  it("allows read of file within cwd", () => {
    const result = guard.validatePath(path.join(tmpDir, "allowed.txt"), "read");
    expect(result.allowed).toBe(true);
  });

  it("allows read of file in nested directory within cwd", () => {
    const result = guard.validatePath(path.join(tmpDir, "subdir", "nested.txt"), "read");
    expect(result.allowed).toBe(true);
  });

  it("rejects read of file outside cwd", () => {
    const result = guard.validatePath("/etc/passwd", "read");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("outside");
  });

  it("rejects read of home directory sensitive file", () => {
    const result = guard.validatePath(path.join(os.homedir(), ".ssh", "id_rsa"), "read");
    expect(result.allowed).toBe(false);
  });

  it("rejects path traversal via ../", () => {
    const result = guard.validatePath(path.join(tmpDir, "..", "..", "etc", "passwd"), "read");
    expect(result.allowed).toBe(false);
  });

  it("rejects write outside cwd", () => {
    const result = guard.validatePath("/tmp/evil.txt", "write");
    expect(result.allowed).toBe(false);
  });

  it("allows read from allowedPaths", () => {
    const extraDir = fs.mkdtempSync(path.join(os.tmpdir(), "allowed-"));
    fs.writeFileSync(path.join(extraDir, "config.txt"), "config");
    const guardWithAllowed = new PathGuard({
      cwd: tmpDir,
      allowedPaths: [extraDir],
      ignorePatterns: [],
    });
    const result = guardWithAllowed.validatePath(path.join(extraDir, "config.txt"), "read");
    expect(result.allowed).toBe(true);
    fs.rmSync(extraDir, { recursive: true, force: true });
  });

  it("rejects symlink pointing outside cwd", () => {
    const outsideFile = path.join(os.tmpdir(), "outside-target-" + Date.now() + ".txt");
    fs.writeFileSync(outsideFile, "secret");
    const symlinkPath = path.join(tmpDir, "evil-link");
    fs.symlinkSync(outsideFile, symlinkPath);
    const result = guard.validatePath(symlinkPath, "read");
    expect(result.allowed).toBe(false);
    fs.unlinkSync(outsideFile);
  });

  // --- Default deny patterns ---

  it("rejects .env files by default", () => {
    const result = guard.validatePath(path.join(tmpDir, ".env"), "read");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("ignore");
  });

  it("rejects .env.local files by default", () => {
    fs.writeFileSync(path.join(tmpDir, ".env.local"), "x");
    const result = guard.validatePath(path.join(tmpDir, ".env.local"), "read");
    expect(result.allowed).toBe(false);
  });

  it("rejects *.key files by default", () => {
    const result = guard.validatePath(path.join(tmpDir, "db.key"), "read");
    expect(result.allowed).toBe(false);
  });

  it("rejects credentials files by default", () => {
    const result = guard.validatePath(path.join(tmpDir, "credentials.json"), "read");
    expect(result.allowed).toBe(false);
  });

  // --- .vibenignore ---

  it("respects custom .vibenignore patterns", () => {
    const guardCustom = new PathGuard({
      cwd: tmpDir,
      allowedPaths: [],
      ignorePatterns: ["*.txt"],
    });
    const result = guardCustom.validatePath(path.join(tmpDir, "allowed.txt"), "read");
    expect(result.allowed).toBe(false);
  });

  // --- .vibenignore file itself ---

  it("rejects write to .vibenignore", () => {
    const result = guard.validatePath(path.join(tmpDir, ".vibenignore"), "write");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain(".vibenignore");
  });

  it("allows read of .vibenignore", () => {
    fs.writeFileSync(path.join(tmpDir, ".vibenignore"), "*.log");
    const result = guard.validatePath(path.join(tmpDir, ".vibenignore"), "read");
    expect(result.allowed).toBe(true);
  });

  // --- Edge cases ---

  it("handles cwd path itself", () => {
    const result = guard.validatePath(tmpDir, "read");
    expect(result.allowed).toBe(true);
  });

  it("rejects path that is prefix but not subdirectory", () => {
    // e.g. cwd = /tmp/foo, target = /tmp/foobar/secret
    const siblingDir = tmpDir + "bar";
    fs.mkdirSync(siblingDir, { recursive: true });
    fs.writeFileSync(path.join(siblingDir, "secret"), "s");
    const result = guard.validatePath(path.join(siblingDir, "secret"), "read");
    expect(result.allowed).toBe(false);
    fs.rmSync(siblingDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/security/__tests__/path-guard.test.ts
```

Expected: FAIL — `PathGuard` module does not exist

- [ ] **Step 3: Implement PathGuard**

```typescript
// src/core/security/path-guard.ts
import fs from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

const DEFAULT_DENY_PATTERNS = [
  ".env*",
  "*.key",
  "*.pem",
  ".ssh/",
  ".aws/",
  ".viben/",
  "**/credentials*",
  "**/secrets*",
  "**/*.secret",
];

export interface PathGuardOptions {
  cwd: string;
  allowedPaths: string[];
  ignorePatterns: string[];
}

export class PathGuard {
  private readonly cwd: string;
  private readonly allowedPaths: string[];
  private readonly ig: Ignore;

  constructor(options: PathGuardOptions) {
    this.cwd = path.resolve(options.cwd);
    this.allowedPaths = options.allowedPaths.map((p) => path.resolve(p));
    this.ig = ignore();
    this.ig.add(DEFAULT_DENY_PATTERNS);
    if (options.ignorePatterns.length > 0) {
      this.ig.add(options.ignorePatterns);
    }
  }

  validatePath(
    targetPath: string,
    operation: "read" | "write",
  ): { allowed: boolean; reason: string } {
    // Resolve to absolute
    const resolved = path.resolve(targetPath);

    // Resolve symlinks if target exists
    let realPath: string;
    try {
      realPath = fs.realpathSync(resolved);
    } catch {
      // File doesn't exist yet (write op) — use resolved path
      realPath = resolved;
    }

    // Block writes to .vibenignore
    if (operation === "write" && path.basename(realPath) === ".vibenignore") {
      return { allowed: false, reason: "Cannot write to .vibenignore" };
    }

    // Check boundary: must be within cwd or allowedPaths
    const isWithinCwd =
      realPath === this.cwd || realPath.startsWith(this.cwd + path.sep);
    const isWithinAllowed = this.allowedPaths.some(
      (ap) => realPath === ap || realPath.startsWith(ap + path.sep),
    );

    if (!isWithinCwd && !isWithinAllowed) {
      return {
        allowed: false,
        reason: `Path is outside workspace boundary: ${realPath}`,
      };
    }

    // Check .vibenignore patterns (relative to cwd)
    if (isWithinCwd) {
      const relativePath = path.relative(this.cwd, realPath);
      if (relativePath && this.ig.ignores(relativePath)) {
        return {
          allowed: false,
          reason: `Path matches ignore pattern: ${relativePath}`,
        };
      }
    }

    return { allowed: true, reason: "" };
  }

  /** Load .vibenignore from workspace root and merge into patterns */
  static loadIgnoreFile(cwd: string): string[] {
    const ignorePath = path.join(cwd, ".vibenignore");
    try {
      const content = fs.readFileSync(ignorePath, "utf-8");
      return content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/security/__tests__/path-guard.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/security/path-guard.ts src/core/security/__tests__/path-guard.test.ts && git commit -m "feat: add PathGuard module for workspace boundary enforcement"
```

---

## Task 3: EnvFilter module

**Files:**
- Test: `src/core/security/__tests__/env-filter.test.ts`
- Create: `src/core/security/env-filter.ts`

- [ ] **Step 1: Write EnvFilter tests**

```typescript
// src/core/security/__tests__/env-filter.test.ts
import { describe, it, expect } from "vitest";
import { filterEnv, DEFAULT_ENV_WHITELIST } from "../env-filter.js";

describe("filterEnv", () => {
  const mockProcessEnv: Record<string, string> = {
    PATH: "/usr/bin",
    HOME: "/home/user",
    SHELL: "/bin/bash",
    LANG: "en_US.UTF-8",
    LC_ALL: "en_US.UTF-8",
    LC_CTYPE: "UTF-8",
    TERM: "xterm-256color",
    USER: "testuser",
    LOGNAME: "testuser",
    TMPDIR: "/tmp",
    XDG_DATA_HOME: "/home/user/.local/share",
    XDG_CONFIG_HOME: "/home/user/.config",
    NODE_ENV: "development",
    EDITOR: "vim",
    // Secrets that MUST NOT leak
    AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
    DATABASE_URL: "postgres://user:pass@host/db",
    OPENAI_API_KEY: "sk-1234567890",
    TELEGRAM_BOT_TOKEN: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    GITHUB_TOKEN: "ghp_xxxxxxxxxxxxxxxxxxxx",
    STRIPE_SECRET_KEY: "sk_test_xxxx",
  };

  it("passes only whitelisted vars with default whitelist", () => {
    const result = filterEnv(mockProcessEnv);
    expect(result.PATH).toBe("/usr/bin");
    expect(result.HOME).toBe("/home/user");
    expect(result.SHELL).toBe("/bin/bash");
    expect(result.LANG).toBe("en_US.UTF-8");
    expect(result.TERM).toBe("xterm-256color");
    expect(result.USER).toBe("testuser");
    expect(result.NODE_ENV).toBe("development");
  });

  it("blocks secret vars", () => {
    const result = filterEnv(mockProcessEnv);
    expect(result.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(result.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(result.DATABASE_URL).toBeUndefined();
    expect(result.OPENAI_API_KEY).toBeUndefined();
    expect(result.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(result.GITHUB_TOKEN).toBeUndefined();
    expect(result.STRIPE_SECRET_KEY).toBeUndefined();
  });

  it("supports glob patterns (LC_* matches LC_ALL, LC_CTYPE)", () => {
    const result = filterEnv(mockProcessEnv);
    expect(result.LC_ALL).toBe("en_US.UTF-8");
    expect(result.LC_CTYPE).toBe("UTF-8");
  });

  it("supports glob patterns (XDG_* matches XDG_DATA_HOME, XDG_CONFIG_HOME)", () => {
    const result = filterEnv(mockProcessEnv);
    expect(result.XDG_DATA_HOME).toBe("/home/user/.local/share");
    expect(result.XDG_CONFIG_HOME).toBe("/home/user/.config");
  });

  it("merges agent env on top of filtered process env", () => {
    const result = filterEnv(mockProcessEnv, { MY_AGENT_VAR: "hello", PATH: "/custom/bin" });
    expect(result.MY_AGENT_VAR).toBe("hello");
    expect(result.PATH).toBe("/custom/bin"); // agent overrides
  });

  it("uses custom whitelist when provided", () => {
    const result = filterEnv(mockProcessEnv, undefined, ["PATH", "AWS_ACCESS_KEY_ID"]);
    expect(result.PATH).toBe("/usr/bin");
    expect(result.AWS_ACCESS_KEY_ID).toBe("AKIAIOSFODNN7EXAMPLE");
    expect(result.HOME).toBeUndefined(); // not in custom whitelist
  });

  it("returns empty object when process env is empty", () => {
    const result = filterEnv({});
    expect(Object.keys(result).length).toBe(0);
  });

  it("default whitelist is exported and non-empty", () => {
    expect(DEFAULT_ENV_WHITELIST.length).toBeGreaterThan(0);
    expect(DEFAULT_ENV_WHITELIST).toContain("PATH");
    expect(DEFAULT_ENV_WHITELIST).toContain("HOME");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/security/__tests__/env-filter.test.ts
```

Expected: FAIL — `filterEnv` module does not exist

- [ ] **Step 3: Implement EnvFilter**

```typescript
// src/core/security/env-filter.ts

export const DEFAULT_ENV_WHITELIST = [
  "PATH",
  "HOME",
  "SHELL",
  "LANG",
  "LC_*",
  "TERM",
  "USER",
  "LOGNAME",
  "TMPDIR",
  "XDG_*",
  "NODE_ENV",
  "EDITOR",
];

function matchesPattern(key: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return key.startsWith(pattern.slice(0, -1));
  }
  return key === pattern;
}

export function filterEnv(
  processEnv: Record<string, string | undefined>,
  agentEnv?: Record<string, string>,
  whitelist?: string[],
): Record<string, string> {
  const patterns = whitelist ?? DEFAULT_ENV_WHITELIST;
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(processEnv)) {
    if (value === undefined) continue;
    if (patterns.some((p) => matchesPattern(key, p))) {
      result[key] = value;
    }
  }

  // Merge agent-defined env on top
  if (agentEnv) {
    Object.assign(result, agentEnv);
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/security/__tests__/env-filter.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/security/env-filter.ts src/core/security/__tests__/env-filter.test.ts && git commit -m "feat: add EnvFilter module to prevent environment variable leakage"
```

---

## Task 4: Config schema update

**Files:**
- Modify: `src/core/config/config.ts:112-116`

- [ ] **Step 1: Add workspace.security to config schema**

In `src/core/config/config.ts`, replace the `workspace` schema (lines 112-116):

```typescript
// BEFORE:
  workspace: z
    .object({
      baseDir: z.string().default("~/viben-workspace"),
    })
    .default({}),

// AFTER:
  workspace: z
    .object({
      baseDir: z.string().default("~/viben-workspace"),
      security: z
        .object({
          allowedPaths: z.array(z.string()).default([]),
          envWhitelist: z.array(z.string()).default([]),
        })
        .default({}),
    })
    .default({}),
```

- [ ] **Step 2: Fix resolveWorkspace() to reject unsafe paths**

In `src/core/config/config.ts`, replace `resolveWorkspace()` (lines 316-332):

```typescript
// BEFORE:
  resolveWorkspace(input?: string): string {
    if (!input) {
      const resolved = expandHome(this.config.workspace.baseDir);
      fs.mkdirSync(resolved, { recursive: true });
      return resolved;
    }
    if (input.startsWith("/") || input.startsWith("~")) {
      const resolved = expandHome(input);
      fs.mkdirSync(resolved, { recursive: true });
      return resolved;
    }
    // Named workspace → lowercase, under baseDir
    const name = input.toLowerCase();
    const resolved = path.join(expandHome(this.config.workspace.baseDir), name);
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }

// AFTER:
  resolveWorkspace(input?: string): string {
    if (!input) {
      const resolved = expandHome(this.config.workspace.baseDir);
      fs.mkdirSync(resolved, { recursive: true });
      return resolved;
    }
    // Named workspace only — no absolute paths, no traversal
    const name = input.replace(/[^a-zA-Z0-9_-]/g, "");
    if (name !== input) {
      throw new Error(
        `Invalid workspace name: "${input}". Only alphanumeric characters, hyphens, and underscores are allowed.`,
      );
    }
    const resolved = path.join(
      expandHome(this.config.workspace.baseDir),
      name.toLowerCase(),
    );
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }
```

- [ ] **Step 3: Build to check for type errors**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm build
```

Expected: SUCCESS

- [ ] **Step 4: Run existing tests to verify no regressions**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/config/
```

Expected: ALL PASS (existing config tests still pass)

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/config/config.ts && git commit -m "feat: add workspace.security config schema and fix resolveWorkspace path traversal"
```

---

## Task 5: Wire PathGuard + EnvFilter into core

**Files:**
- Modify: `src/core/agents/agent-instance.ts:191-199, 566-594, 695-714`
- Modify: `src/core/sessions/terminal-manager.ts:76-80`

- [ ] **Step 1: Add PathGuard + EnvFilter imports and construction in agent-instance.ts**

At the top of `agent-instance.ts`, add imports:

```typescript
import { PathGuard } from "../security/path-guard.js";
import { filterEnv } from "../security/env-filter.js";
```

Add a `pathGuard` property to the `AgentInstance` class. Construct it in `spawnSubprocess()` (around line 185) where `workingDirectory` is available:

```typescript
// Add property to AgentInstance class:
private pathGuard!: PathGuard;

// In spawnSubprocess(), after line 186 (const resolved = resolveAgentBinary(...)):
const ignorePatterns = PathGuard.loadIgnoreFile(workingDirectory);
this.pathGuard = new PathGuard({
  cwd: workingDirectory,
  allowedPaths: configManager?.config.workspace.security?.allowedPaths ?? [],
  ignorePatterns,
});
```

The `configManager` reference needs to be passed into `AgentInstance` — either via constructor options or by reading from the config at spawn time. Check how the existing code accesses config and follow the same pattern.

- [ ] **Step 2: Wire PathGuard into readTextFile (line 566-579)**

```typescript
// BEFORE:
      async readTextFile(params) {
        const p = params as unknown as SdkReadTextFileParams;
        if (self.middlewareChain) {
          const result = await self.middlewareChain.execute('fs:beforeRead', { sessionId: self.sessionId, path: p.path, line: p.line, limit: p.limit }, async (r) => r);
          if (!result) return { content: "" };
          p.path = result.path;
        }
        const content = await readTextFileWithRange(p.path, {
          line: p.line ?? undefined,
          limit: p.limit ?? undefined,
        });
        return { content };
      },

// AFTER:
      async readTextFile(params) {
        const p = params as unknown as SdkReadTextFileParams;
        // Security: validate path against workspace boundary
        const pathCheck = self.pathGuard.validatePath(p.path, "read");
        if (!pathCheck.allowed) {
          return { content: `[Access denied] ${pathCheck.reason}` };
        }
        if (self.middlewareChain) {
          const result = await self.middlewareChain.execute('fs:beforeRead', { sessionId: self.sessionId, path: p.path, line: p.line, limit: p.limit }, async (r) => r);
          if (!result) return { content: "" };
          p.path = result.path;
        }
        const content = await readTextFileWithRange(p.path, {
          line: p.line ?? undefined,
          limit: p.limit ?? undefined,
        });
        return { content };
      },
```

- [ ] **Step 3: Wire PathGuard into writeTextFile (line 581-594)**

```typescript
// BEFORE:
      async writeTextFile(params) {
        let writePath = params.path;
        let writeContent = params.content;
        if (self.middlewareChain) {
          const result = await self.middlewareChain.execute('fs:beforeWrite', { sessionId: self.sessionId, path: writePath, content: writeContent }, async (r) => r);
          if (!result) return {};
          writePath = result.path;
          writeContent = result.content;
        }
        await fs.promises.mkdir(path.dirname(writePath), { recursive: true });
        await fs.promises.writeFile(writePath, writeContent, "utf-8");
        return {};
      },

// AFTER:
      async writeTextFile(params) {
        let writePath = params.path;
        let writeContent = params.content;
        // Security: validate path against workspace boundary
        const pathCheck = self.pathGuard.validatePath(writePath, "write");
        if (!pathCheck.allowed) {
          throw new Error(`[Access denied] ${pathCheck.reason}`);
        }
        if (self.middlewareChain) {
          const result = await self.middlewareChain.execute('fs:beforeWrite', { sessionId: self.sessionId, path: writePath, content: writeContent }, async (r) => r);
          if (!result) return {};
          writePath = result.path;
          writeContent = result.content;
        }
        await fs.promises.mkdir(path.dirname(writePath), { recursive: true });
        await fs.promises.writeFile(writePath, writeContent, "utf-8");
        return {};
      },
```

- [ ] **Step 4: Wire PathGuard into attachment reading (line 695-714)**

```typescript
// BEFORE (line 699):
        const data = await fs.promises.readFile(att.filePath);

// AFTER:
        const attCheck = this.pathGuard.validatePath(att.filePath, "read");
        if (!attCheck.allowed) {
          (contentBlocks[0] as { text: string }).text += `\n\n[Attachment access denied: ${attCheck.reason}]`;
          continue;
        }
        const data = await fs.promises.readFile(att.filePath);
```

Apply the same pattern for the audio attachment block (line 702).

- [ ] **Step 5: Wire EnvFilter into agent spawn (line 197)**

```typescript
// BEFORE:
        env: { ...process.env, ...agentDef.env },

// AFTER:
        env: filterEnv(process.env as Record<string, string>, agentDef.env, securityConfig?.envWhitelist),
```

- [ ] **Step 6: Wire EnvFilter into terminal-manager.ts (line 78)**

Add import at top of `terminal-manager.ts`:

```typescript
import { filterEnv } from "../security/env-filter.js";
```

```typescript
// BEFORE (line 78):
      env: { ...process.env, ...env },

// AFTER:
      env: filterEnv(process.env as Record<string, string>, env),
```

- [ ] **Step 7: Build and run tests**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm build && pnpm vitest run src/core/
```

Expected: Build succeeds, existing tests pass

- [ ] **Step 8: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/agents/agent-instance.ts src/core/sessions/terminal-manager.ts && git commit -m "feat: wire PathGuard and EnvFilter into agent file operations and process spawning"
```

---

## Task 6: Fix auto-approve bypass

**Files:**
- Modify: `src/core/sessions/session-bridge.ts:365-376`
- Modify: `src/core/sessions/__tests__/session-bridge-autoapprove.test.ts`

- [ ] **Step 1: Update auto-approve tests**

In `session-bridge-autoapprove.test.ts`, find and update tests that assert the "viben" description auto-approve behavior. Change them to assert the OPPOSITE — that descriptions containing "viben" are NOT auto-approved:

Find existing tests that assert "viben" description auto-approve works. Invert them:

```typescript
it("does NOT auto-approve based on description containing viben", async () => {
  // Set up a session bridge WITHOUT bypass mode
  // Send a permission request with "viben" in description
  // Assert: the request is forwarded to the adapter (not auto-resolved)
  // The exact test structure depends on existing test patterns in this file —
  // follow the same mock setup as other tests, but verify that
  // onPermissionRequest callback is invoked (meaning auto-approve did NOT handle it)
});
```

The existing test file already has the mock infrastructure. The key assertion: when bypass mode is OFF and description contains "viben", the permission request MUST reach the adapter's `onPermissionRequest` handler. Read the existing tests first, follow their patterns, and change the expected behavior from "auto-approved" to "forwarded to adapter".

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/sessions/__tests__/session-bridge-autoapprove.test.ts
```

Expected: FAIL — current code still auto-approves

- [ ] **Step 3: Remove description-based auto-approve**

In `session-bridge.ts`, remove lines 365-376 (the "viben" description check):

```typescript
// BEFORE (lines 365-376):
  private checkAutoApprove(request: PermissionRequest): string | null {
    // Auto-approve viben CLI commands
    if (request.description.toLowerCase().includes("viben")) {
      const allowOption = request.options.find((o) => o.isAllow);
      if (allowOption) {
        log.info(
          { sessionId: this.session.id, requestId: request.id },
          "Auto-approving viben command",
        );
        return allowOption.id;
      }
    }

    // Bypass mode: auto-approve all permissions ...

// AFTER:
  private checkAutoApprove(request: PermissionRequest): string | null {
    // Bypass mode: auto-approve all permissions ...
```

Keep the bypass mode block (lines 378-393) intact — it requires explicit `sessions:dangerous` scope.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/sessions/__tests__/session-bridge-autoapprove.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/sessions/session-bridge.ts src/core/sessions/__tests__/session-bridge-autoapprove.test.ts && git commit -m "fix: remove description-based auto-approve bypass in session-bridge"
```

---

## Task 7: Dangerous endpoint scope hardening

**Files:**
- Modify: `src/plugins/api-server/routes/sessions.ts:280-303`
- Modify: `src/plugins/api-server/__tests__/routes-sessions.test.ts`

- [ ] **Step 1: Update dangerous endpoint test**

In `routes-sessions.test.ts`, find the test at line 281 (`PATCH /api/v1/sessions/:sessionId/dangerous`) and add a test that verifies the endpoint requires `sessions:dangerous` scope:

```typescript
it("rejects requests without sessions:dangerous scope", async () => {
  // Send request with a token that only has sessions:write scope
  const response = await app.inject({
    method: "PATCH",
    url: "/api/v1/sessions/sess-1/dangerous",
    payload: { enabled: true },
    headers: {
      authorization: "Bearer write-only-token", // token with sessions:write but not sessions:dangerous
    },
  });
  expect(response.statusCode).toBe(403);
});
```

- [ ] **Step 2: Change scope requirement**

In `sessions.ts`, change line 283:

```typescript
// BEFORE:
    { preHandler: requireScopes('sessions:write') },

// AFTER:
    { preHandler: requireScopes('sessions:dangerous') },
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/plugins/api-server/__tests__/routes-sessions.test.ts
```

Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/plugins/api-server/routes/sessions.ts src/plugins/api-server/__tests__/routes-sessions.test.ts && git commit -m "fix: require sessions:dangerous scope for bypass permissions endpoint"
```

---

## Task 8: Agent installer security

**Files:**
- Test: `src/core/agents/__tests__/agent-installer-security.test.ts`
- Modify: `src/core/agents/agent-installer.ts`
- Modify: `src/core/agents/agent-catalog.ts`
- Modify: `src/core/agents/agent-store.ts`

- [ ] **Step 1: Write installer security tests**

```typescript
// src/core/agents/__tests__/agent-installer-security.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Agent Installer Security", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "installer-sec-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("download size limit", () => {
    it("rejects downloads exceeding MAX_DOWNLOAD_SIZE", async () => {
      // This test validates that readResponseWithProgress aborts
      // when accumulated size exceeds limit.
      // We test the function directly with a mock response.
      const { readResponseWithProgress, MAX_DOWNLOAD_SIZE } = await import("../agent-installer.js");
      const largeChunk = new Uint8Array(MAX_DOWNLOAD_SIZE + 1);
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: largeChunk })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };
      const mockResponse = {
        body: { getReader: () => mockReader },
      } as unknown as Response;

      await expect(
        readResponseWithProgress(mockResponse, 0),
      ).rejects.toThrow(/size limit/i);
    });
  });

  describe("tar content validation", () => {
    it("rejects archive entries containing ../", async () => {
      const { validateTarContents } = await import("../agent-installer.js");
      // Create a tar listing with path traversal
      const entries = ["bin/agent", "../../../etc/passwd"];
      expect(() => validateTarContents(entries, tmpDir)).toThrow(/unsafe/i);
    });

    it("rejects absolute path entries", async () => {
      const { validateTarContents } = await import("../agent-installer.js");
      const entries = ["/etc/passwd"];
      expect(() => validateTarContents(entries, tmpDir)).toThrow(/unsafe/i);
    });

    it("allows normal entries", async () => {
      const { validateTarContents } = await import("../agent-installer.js");
      const entries = ["bin/agent", "lib/libfoo.so", "README.md"];
      expect(() => validateTarContents(entries, tmpDir)).not.toThrow();
    });
  });

  describe("checksum verification", () => {
    it("rejects buffer with mismatched SHA-256", async () => {
      const { verifyChecksum } = await import("../agent-installer.js");
      const buffer = Buffer.from("hello world");
      expect(() =>
        verifyChecksum(buffer, "0000000000000000000000000000000000000000000000000000000000000000"),
      ).toThrow(/integrity/i);
    });

    it("accepts buffer with matching SHA-256", async () => {
      const crypto = await import("node:crypto");
      const { verifyChecksum } = await import("../agent-installer.js");
      const buffer = Buffer.from("hello world");
      const hash = crypto.createHash("sha256").update(buffer).digest("hex");
      expect(() => verifyChecksum(buffer, hash)).not.toThrow();
    });
  });

  describe("uninstall path validation", () => {
    it("rejects binaryPath outside agents directory", async () => {
      const { validateUninstallPath } = await import("../agent-installer.js");
      expect(() =>
        validateUninstallPath("/etc/important", tmpDir),
      ).toThrow(/outside/i);
    });

    it("allows binaryPath within agents directory", async () => {
      const { validateUninstallPath } = await import("../agent-installer.js");
      const agentPath = path.join(tmpDir, "my-agent");
      fs.mkdirSync(agentPath, { recursive: true });
      expect(() => validateUninstallPath(agentPath, tmpDir)).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/agents/__tests__/agent-installer-security.test.ts
```

Expected: FAIL — exported functions don't exist yet

- [ ] **Step 3: Implement security functions in agent-installer.ts**

Add these exported functions and constants to `agent-installer.ts`:

```typescript
import crypto from "node:crypto";

export const MAX_DOWNLOAD_SIZE = 500 * 1024 * 1024; // 500MB

export function verifyChecksum(buffer: Buffer, expectedHash: string): void {
  const actualHash = crypto.createHash("sha256").update(buffer).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(
      `Integrity check failed: expected ${expectedHash}, got ${actualHash}`,
    );
  }
}

export function validateTarContents(
  entries: string[],
  destDir: string,
): void {
  for (const entry of entries) {
    if (entry.includes("..")) {
      throw new Error(`Archive contains unsafe path traversal: ${entry}`);
    }
    if (entry.startsWith("/")) {
      throw new Error(`Archive contains unsafe absolute path: ${entry}`);
    }
  }
}

export function validateUninstallPath(
  binaryPath: string,
  agentsDir: string,
): void {
  const realPath = path.resolve(binaryPath);
  const realAgentsDir = path.resolve(agentsDir);
  if (
    !realPath.startsWith(realAgentsDir + path.sep) &&
    realPath !== realAgentsDir
  ) {
    throw new Error(
      `Refusing to delete path outside agents directory: ${realPath}`,
    );
  }
}
```

- [ ] **Step 4: Add size limit to readResponseWithProgress**

```typescript
// BEFORE (line 226-234):
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;

// AFTER:
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (received > MAX_DOWNLOAD_SIZE) {
      throw new Error(
        `Download exceeds size limit of ${MAX_DOWNLOAD_SIZE} bytes`,
      );
    }
```

Export `readResponseWithProgress` so it can be tested.

- [ ] **Step 5: Add validate-before-extract to extractTarGz**

```typescript
// BEFORE (line 262-272):
async function extractTarGz(buffer: Buffer, destDir: string): Promise<void> {
  const { execFileSync } = await import("node:child_process");
  const tmpFile = path.join(destDir, "_archive.tar.gz");
  fs.writeFileSync(tmpFile, buffer);
  try {
    execFileSync("tar", ["xzf", tmpFile, "-C", destDir], { stdio: "pipe" });
  } finally {
    fs.unlinkSync(tmpFile);
  }
  validateExtractedPaths(destDir);
}

// AFTER:
async function extractTarGz(buffer: Buffer, destDir: string): Promise<void> {
  const { execFileSync } = await import("node:child_process");
  const tmpFile = path.join(destDir, "_archive.tar.gz");
  fs.writeFileSync(tmpFile, buffer);
  try {
    // Validate contents BEFORE extraction
    const listing = execFileSync("tar", ["tf", tmpFile], {
      stdio: "pipe",
    }).toString().trim().split("\n").filter(Boolean);
    validateTarContents(listing, destDir);
    // Safe to extract
    execFileSync("tar", ["xzf", tmpFile, "-C", destDir], { stdio: "pipe" });
  } finally {
    fs.unlinkSync(tmpFile);
  }
  validateExtractedPaths(destDir);
}
```

- [ ] **Step 6: Add checksum verification to downloadAndExtract**

```typescript
// In downloadAndExtract, after buffer is received:
  const buffer = await readResponseWithProgress(response, contentLength, progress);

  // Verify checksum if provided
  if (expectedHash) {
    verifyChecksum(buffer, expectedHash);
  }
```

Add `expectedHash?: string` parameter to `downloadAndExtract`.

- [ ] **Step 7: Add path validation to uninstallAgent**

```typescript
// BEFORE (line 293-294):
  if (agent.binaryPath && fs.existsSync(agent.binaryPath)) {
    fs.rmSync(agent.binaryPath, { recursive: true, force: true });

// AFTER:
  if (agent.binaryPath && fs.existsSync(agent.binaryPath)) {
    validateUninstallPath(agent.binaryPath, agentsDir ?? DEFAULT_AGENTS_DIR);
    fs.rmSync(agent.binaryPath, { recursive: true, force: true });
```

- [ ] **Step 8: Fix file permissions in agent-catalog.ts and agent-store.ts**

In `agent-catalog.ts` line 63:
```typescript
// BEFORE:
    fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2));

// AFTER:
    fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), { mode: 0o600 });
```

In `agent-store.ts` line 88:
```typescript
// BEFORE:
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2));

// AFTER:
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), { mode: 0o600 });
```

- [ ] **Step 9: Run tests**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/agents/__tests__/agent-installer-security.test.ts
```

Expected: ALL PASS

- [ ] **Step 10: Run all existing agent tests for regression**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/agents/
```

Expected: ALL PASS

- [ ] **Step 11: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/agents/ && git commit -m "feat: add checksum verification, size limits, path validation to agent installer"
```

---

## Task 9: Plugin system hardening

**Files:**
- Modify: `src/core/plugin/plugin-installer.ts:67`
- Modify: `src/core/setup/wizard.ts:304, 357`
- Modify: `src/core/plugin/__tests__/plugin-installer.test.ts`

- [ ] **Step 1: Add --ignore-scripts test**

In `plugin-installer.test.ts`, add test:

```typescript
it("includes --ignore-scripts flag in npm install command", async () => {
  // Read the source file directly to verify the flag is present
  const fs = await import("node:fs");
  const source = fs.readFileSync(
    new URL("../plugin-installer.ts", import.meta.url).pathname.replace("__tests__/", ""),
    "utf-8",
  );
  // Every npm install call must include --ignore-scripts
  const npmInstallMatches = source.match(/npm install[^"`)]+/g) ?? [];
  expect(npmInstallMatches.length).toBeGreaterThan(0);
  for (const match of npmInstallMatches) {
    expect(match).toContain("--ignore-scripts");
  }
});
```

- [ ] **Step 2: Add --ignore-scripts to plugin-installer.ts**

```typescript
// BEFORE (line 67):
  await execAsync(`npm install ${packageName} --prefix "${dir}" --save`, {

// AFTER:
  await execAsync(`npm install ${packageName} --prefix "${dir}" --save --ignore-scripts`, {
```

- [ ] **Step 3: Add --ignore-scripts to wizard.ts**

Line 304:
```typescript
// BEFORE:
            execFileSync('npm', ['install', npmPackage, '--prefix', pluginsDir, '--save'], {

// AFTER:
            execFileSync('npm', ['install', npmPackage, '--prefix', pluginsDir, '--save', '--ignore-scripts'], {
```

Line 357:
```typescript
// BEFORE:
          execFileSync('npm', ['install', npmPackage, '--prefix', pluginsDir, '--save'], {

// AFTER:
          execFileSync('npm', ['install', npmPackage, '--prefix', pluginsDir, '--save', '--ignore-scripts'], {
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/plugin/__tests__/plugin-installer.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/plugin/plugin-installer.ts src/core/setup/wizard.ts src/core/plugin/__tests__/plugin-installer.test.ts && git commit -m "fix: add --ignore-scripts to all npm install calls to prevent lifecycle RCE"
```

---

## Task 10: install-binary.ts security

**Files:**
- Modify: `src/core/utils/install-binary.ts`

- [ ] **Step 1: Add size limit and tar validation**

Import the shared functions:

```typescript
import { MAX_DOWNLOAD_SIZE, validateTarContents } from "../agents/agent-installer.js";
```

Add size limit to `downloadFile()`:

```typescript
// In the download function, track total bytes and abort if too large
let totalBytes = 0;
// ... in the data handler:
totalBytes += chunk.length;
if (totalBytes > MAX_DOWNLOAD_SIZE) {
  request.destroy();
  reject(new Error(`Download exceeds size limit of ${MAX_DOWNLOAD_SIZE} bytes`));
}
```

Add tar validation before extraction (line 111):

```typescript
// BEFORE:
    execSync(`tar -xzf "${downloadDest}" -C "${resolvedBinDir}"`, { stdio: 'pipe' })

// AFTER:
    // Validate tar contents before extraction
    const listing = execSync(`tar -tf "${downloadDest}"`, { stdio: 'pipe' })
      .toString().trim().split("\n").filter(Boolean);
    validateTarContents(listing, resolvedBinDir);
    execSync(`tar -xzf "${downloadDest}" -C "${resolvedBinDir}"`, { stdio: 'pipe' })
```

- [ ] **Step 2: Build and test**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm build
```

Expected: SUCCESS

- [ ] **Step 3: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/utils/install-binary.ts && git commit -m "fix: add download size limit and tar validation to install-binary"
```

---

## Task 11: HTML sanitizer for tunnel XSS fix

**Files:**
- Test: `src/core/security/__tests__/sanitize-html.test.ts`
- Create: `src/core/security/sanitize-html.ts`

- [ ] **Step 1: Write sanitizer tests**

```typescript
// src/core/security/__tests__/sanitize-html.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../sanitize-html.js";

describe("sanitizeHtml", () => {
  it("strips <script> tags and content", () => {
    const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>Hello</p>");
    expect(result).toContain("<p>World</p>");
  });

  it("removes onerror attributes", () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onerror");
  });

  it("removes onclick attributes", () => {
    const input = '<button onclick="alert(1)">Click</button>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onclick");
  });

  it("removes onload attributes", () => {
    const input = '<body onload="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onload");
  });

  it("removes javascript: URIs from href", () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("removes javascript: URIs from src", () => {
    const input = '<img src="javascript:alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("preserves safe HTML", () => {
    const input = '<h1>Title</h1><p>Text with <strong>bold</strong> and <em>italic</em></p><pre><code>code</code></pre>';
    const result = sanitizeHtml(input);
    expect(result).toContain("<h1>Title</h1>");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
    expect(result).toContain("<pre><code>code</code></pre>");
  });

  it("preserves safe links", () => {
    const input = '<a href="https://example.com">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('href="https://example.com"');
  });

  it("handles nested script injection", () => {
    const input = '<scr<script>ipt>alert(1)</scr</script>ipt>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("alert");
  });

  it("handles case-insensitive script tags", () => {
    const input = '<SCRIPT>alert(1)</SCRIPT>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("alert");
  });

  it("strips data: URIs from src", () => {
    const input = '<img src="data:text/html,<script>alert(1)</script>">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("data:");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/security/__tests__/sanitize-html.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement sanitizer**

```typescript
// src/core/security/sanitize-html.ts

/**
 * Lightweight HTML sanitizer for server-rendered markdown output.
 * Strips dangerous content while preserving safe formatting tags.
 */
export function sanitizeHtml(html: string): string {
  let result = html;

  // Strip <script> tags and content (case-insensitive, handles nesting)
  // Apply multiple times to handle nested attempts
  for (let i = 0; i < 3; i++) {
    result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  }
  // Remove any remaining script tags (self-closing or unclosed)
  result = result.replace(/<\/?script\b[^>]*>/gi, "");

  // Remove all on* event handler attributes
  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");

  // Remove javascript: and data: URIs from href and src attributes
  result = result.replace(
    /(href|src)\s*=\s*(?:"(?:javascript|data):[^"]*"|'(?:javascript|data):[^']*')/gi,
    '$1=""',
  );

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/core/security/__tests__/sanitize-html.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/core/security/sanitize-html.ts src/core/security/__tests__/sanitize-html.test.ts && git commit -m "feat: add lightweight HTML sanitizer for tunnel viewer XSS prevention"
```

---

## Task 12: Tunnel security fixes

**Files:**
- Modify: `src/plugins/tunnel/index.ts:199`
- Modify: `src/plugins/tunnel/templates/file-viewer.ts`
- Modify: `src/plugins/tunnel/providers/ngrok.ts`
- Modify: `src/plugins/tunnel/providers/bore.ts`
- Modify: `src/plugins/tunnel/providers/viben.ts`
- Modify: `src/plugins/tunnel/viewer-routes.ts:46, 58`
- Test: `src/plugins/tunnel/__tests__/tunnel-security.test.ts`

- [ ] **Step 1: Write tunnel security tests**

```typescript
// src/plugins/tunnel/__tests__/tunnel-security.test.ts
import { describe, it, expect } from "vitest";

describe("Tunnel Security", () => {
  describe("viewer auth default", () => {
    it("viewer routes are registered with auth: true by default", async () => {
      // Verify that the tunnel plugin registers viewer routes with auth enabled
      // Read the source and check the registerPlugin call
      const fs = await import("node:fs");
      const source = fs.readFileSync(
        new URL("../index.ts", import.meta.url).pathname.replace("__tests__/", ""),
        "utf-8",
      );
      // The registerPlugin call should NOT have { auth: false }
      expect(source).not.toMatch(/registerPlugin\s*\([^)]*auth:\s*false/);
    });
  });

  describe("credential environment variables", () => {
    it("ngrok provider passes authtoken via env, not CLI args", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync(
        new URL("../providers/ngrok.ts", import.meta.url).pathname.replace("__tests__/", ""),
        "utf-8",
      );
      // Should NOT push --authtoken to args
      expect(source).not.toContain("'--authtoken'");
      // Should use env var
      expect(source).toContain("NGROK_AUTHTOKEN");
    });

    it("bore provider passes secret via env, not CLI args", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync(
        new URL("../providers/bore.ts", import.meta.url).pathname.replace("__tests__/", ""),
        "utf-8",
      );
      expect(source).not.toContain("'--secret'");
      expect(source).toContain("BORE_SECRET");
    });

    it("viben provider passes token via env, not CLI args", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync(
        new URL("../providers/viben.ts", import.meta.url).pathname.replace("__tests__/", ""),
        "utf-8",
      );
      expect(source).not.toContain("'--token'");
      expect(source).toContain("TUNNEL_TOKEN");
    });
  });

  describe("viewer path redaction", () => {
    it("file API returns relative path, not absolute", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync(
        new URL("../viewer-routes.ts", import.meta.url).pathname.replace("__tests__/", ""),
        "utf-8",
      );
      // Should NOT directly expose entry.filePath
      // Should use path.relative or similar
      expect(source).not.toMatch(/filePath:\s*entry\.filePath\b/);
    });
  });

  describe("XSS sanitization", () => {
    it("file-viewer does not use unsanitized innerHTML for markdown", async () => {
      const fs = await import("node:fs");
      const source = fs.readFileSync(
        new URL("../templates/file-viewer.ts", import.meta.url).pathname.replace("__tests__/", ""),
        "utf-8",
      );
      // Should not have raw innerHTML = marked.parse(content) without sanitization
      expect(source).not.toMatch(/innerHTML\s*=\s*(?:marked\.parse|rawHtml)\s*[;)]/);
      // Should contain sanitizeHtml call
      expect(source).toContain("sanitizeHtml");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/plugins/tunnel/__tests__/tunnel-security.test.ts
```

Expected: FAIL

- [ ] **Step 3: Fix tunnel auth default**

In `src/plugins/tunnel/index.ts` line 199:

```typescript
// BEFORE:
        apiServer.registerPlugin('/', viewerRoutes, { auth: false })

// AFTER:
        apiServer.registerPlugin('/', viewerRoutes)  // auth defaults to true
```

- [ ] **Step 4: Fix ngrok credentials**

In `src/plugins/tunnel/providers/ngrok.ts`:

```typescript
// BEFORE (lines 25-26):
    if (this.options.authtoken) {
      args.push('--authtoken', String(this.options.authtoken))
    }
    // ... in spawn call, add env:
    this.child = spawn(binaryPath, args, { ... })

// AFTER:
    // authtoken passed via environment variable (not CLI args, which are visible in ps)
    const env: Record<string, string> = {};
    if (this.options.authtoken) {
      env.NGROK_AUTHTOKEN = String(this.options.authtoken);
    }
    // ... in spawn call:
    this.child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, ...env } })
```

- [ ] **Step 5: Fix bore credentials**

In `src/plugins/tunnel/providers/bore.ts`:

```typescript
// BEFORE (lines 29-31):
    if (this.options.secret) {
      args.push('--secret', String(this.options.secret))
    }

// AFTER:
    const env: Record<string, string> = {};
    if (this.options.secret) {
      env.BORE_SECRET = String(this.options.secret);
    }
```

Then find the `spawn()` call in bore.ts and add `env`:

```typescript
    this.child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, ...env } })
```

- [ ] **Step 6: Fix viben tunnel credentials**

In `src/plugins/tunnel/providers/viben.ts` line 145:

```typescript
// BEFORE:
    const args = ['tunnel', 'run', '--token', token, '--url', `http://localhost:${port}`]

// AFTER:
    const args = ['tunnel', 'run', '--url', `http://localhost:${port}`]
    const env = { TUNNEL_TOKEN: token };
```

Then find the `spawn()` call in `spawnCloudflared()` and add `env`:

```typescript
    this.child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, ...env } })
```

- [ ] **Step 7: Fix XSS in file-viewer.ts**

In `src/plugins/tunnel/templates/file-viewer.ts`, replace the DOMPurify CDN approach:

Remove the DOMPurify `<script>` CDN tag (around line 77).

Replace the markdown rendering (lines 158-164):

```typescript
// BEFORE:
if (typeof marked !== 'undefined') {
  const rawHtml = marked.parse(content)
  previewEl.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml
} else {
  const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  previewEl.innerHTML = escaped.replace(/\n/g, '<br>')
};

// AFTER:
if (typeof marked !== 'undefined') {
  const rawHtml = marked.parse(content)
  previewEl.innerHTML = sanitizeHtml(rawHtml)
} else {
  const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  previewEl.innerHTML = escaped.replace(/\\n/g, '<br>')
};
```

Add the `sanitizeHtml` function inline in the template's `<script>` block (since it's a template string, not a module import):

```typescript
// Add inside the <script> block of the template:
function sanitizeHtml(html) {
  let result = html;
  for (let i = 0; i < 3; i++) {
    result = result.replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, '');
  }
  result = result.replace(/<\\/?script\\b[^>]*>/gi, '');
  result = result.replace(/\\s+on\\w+\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]*)/gi, '');
  result = result.replace(/(href|src)\\s*=\\s*(?:"(?:javascript|data):[^"]*"|'(?:javascript|data):[^']*')/gi, '$1=""');
  return result;
}
```

- [ ] **Step 8: Fix path redaction in viewer-routes.ts**

```typescript
// BEFORE (line 46):
        filePath: entry.filePath,

// AFTER:
        filePath: entry.filePath ? path.basename(entry.filePath) : null,
```

Add `import path from "node:path"` at the top if not already present. Apply same for diff endpoint (line 58).

- [ ] **Step 9: Run tests**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/plugins/tunnel/__tests__/tunnel-security.test.ts
```

Expected: ALL PASS

- [ ] **Step 10: Run all tunnel tests for regression**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm vitest run src/plugins/tunnel/
```

Expected: ALL PASS

- [ ] **Step 11: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git add src/plugins/tunnel/ && git commit -m "fix: tunnel auth default on, XSS sanitization, credential env vars, path redaction"
```

---

## Task 13: Final build + full test suite

**Files:** None (verification only)

- [ ] **Step 1: Full build**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm build
```

Expected: SUCCESS — no type errors

- [ ] **Step 2: Full test suite**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test
```

Expected: ALL PASS — no regressions

- [ ] **Step 3: Review all security changes**

```bash
cd /Users/lucas/code/viben-workspace/Viben && git log --oneline security-hardening..HEAD
```

Verify all commits are present and coherent.

- [ ] **Step 4: Final commit (if any fixups needed)**

If any test fixes were needed, commit them here.
