# viben login/logout/whoami Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement CLI authentication commands for Viben using API tokens from apps/web.

**Architecture:** Token-based auth flow: CLI prompts user for token from web UI, validates via `/api/users/me` with Bearer auth, stores in `~/.viben/token`.

**Tech Stack:** TypeScript, Commander.js, Node.js fetch, open (browser launcher)

**Spec:** `docs/superpowers/specs/2026-03-29-viben-login-design.md`

---

## File Structure

```
packages/core/src/
├── config/
│   └── paths.ts              # MODIFY: add getTokenPath()
├── auth/
│   ├── index.ts              # CREATE: auth module exports
│   ├── token.ts              # CREATE: token read/write/validate
│   └── api.ts                # CREATE: API client for auth
└── cli/commands/
    ├── login.ts              # CREATE: login/logout/whoami commands
    └── index.ts              # MODIFY: register login command

apps/web/lib/auth/
└── middleware.ts             # MODIFY: add Bearer token support
```

---

## Chunk 1: Backend - Bearer Token Support

### Task 1: Extend requireAuth() to support Bearer Token

**Files:**
- Modify: `apps/web/lib/auth/middleware.ts:30-44`

- [ ] **Step 1: Write test for Bearer token auth**

Create test file:

```typescript
// apps/web/lib/auth/__tests__/middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../api-key', () => ({
  validateApiKey: vi.fn(),
}));

vi.mock('../jwe', () => ({
  decryptSession: vi.fn(),
}));

import { requireAuth, AuthError } from '../middleware';
import { validateApiKey } from '../api-key';
import { decryptSession } from '../jwe';

function createMockRequest(options: {
  authorization?: string;
  sessionCookie?: string;
}): Request {
  const headers = new Headers();
  if (options.authorization) {
    headers.set('authorization', options.authorization);
  }

  const request = {
    headers,
    cookies: {
      get: (name: string) => {
        if (name === 'session' && options.sessionCookie) {
          return { value: options.sessionCookie };
        }
        return undefined;
      },
    },
  } as unknown as Request;

  return request;
}

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should authenticate with valid Bearer token', async () => {
    const mockUser = {
      id: 'user_123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
    };
    vi.mocked(validateApiKey).mockResolvedValue(mockUser as any);

    const request = createMockRequest({
      authorization: 'Bearer bmcp_12345678_abcdefghijklmnopqrstuvwx',
    });

    const session = await requireAuth(request as any);

    expect(session.userId).toBe('user_123');
    expect(session.username).toBe('testuser');
    expect(session.email).toBe('test@example.com');
    expect(validateApiKey).toHaveBeenCalledWith('bmcp_12345678_abcdefghijklmnopqrstuvwx');
  });

  it('should throw AuthError for invalid Bearer token', async () => {
    vi.mocked(validateApiKey).mockResolvedValue(null);

    const request = createMockRequest({
      authorization: 'Bearer invalid_token',
    });

    await expect(requireAuth(request as any)).rejects.toThrow(AuthError);
    await expect(requireAuth(request as any)).rejects.toThrow('Invalid API key');
  });

  it('should fall back to cookie session when no Bearer token', async () => {
    const mockSession = {
      userId: 'user_456',
      username: 'cookieuser',
      email: 'cookie@example.com',
      role: 'user',
      expiresAt: Date.now() + 3600000,
    };
    vi.mocked(decryptSession).mockResolvedValue(mockSession);

    const request = createMockRequest({
      sessionCookie: 'encrypted_session_token',
    });

    const session = await requireAuth(request as any);

    expect(session.userId).toBe('user_456');
    expect(decryptSession).toHaveBeenCalledWith('encrypted_session_token');
    expect(validateApiKey).not.toHaveBeenCalled();
  });

  it('should throw Unauthorized when no auth provided', async () => {
    const request = createMockRequest({});

    await expect(requireAuth(request as any)).rejects.toThrow(AuthError);
    await expect(requireAuth(request as any)).rejects.toThrow('Unauthorized');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test lib/auth/__tests__/middleware.test.ts`
Expected: FAIL (requireAuth doesn't support Bearer token yet)

- [ ] **Step 3: Implement Bearer token support in requireAuth**

```typescript
// apps/web/lib/auth/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession } from './jwe';
import { validateApiKey } from './api-key';
import type { Session } from './types';

export async function authMiddleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await decryptSession(token);

  if (!session) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  // Add session to request headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.userId);
  requestHeaders.set('x-user-role', session.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// Helper to get session in API routes
export async function requireAuth(request: NextRequest): Promise<Session> {
  // 1. Check Bearer Token (API Key) first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = await validateApiKey(token);
    if (user) {
      return {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role as Session['role'],
        expiresAt: 0, // API Key session doesn't expire
      };
    }
    // Bearer token provided but invalid - don't fall through
    throw new AuthError('Invalid API key', 401);
  }

  // 2. Check Cookie Session
  const cookieToken = request.cookies.get('session')?.value;

  if (!cookieToken) {
    throw new AuthError('Unauthorized', 401);
  }

  const session = await decryptSession(cookieToken);

  if (!session) {
    throw new AuthError('Session expired', 401);
  }

  return session;
}

// Helper to get optional session (doesn't throw)
export async function getOptionalSession(
  request: NextRequest
): Promise<Session | null> {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  return decryptSession(token);
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test lib/auth/__tests__/middleware.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth/middleware.ts apps/web/lib/auth/__tests__/middleware.test.ts
git commit -m "feat(auth): add Bearer token support to requireAuth"
```

---

## Chunk 2: CLI - Token Management Module

### Task 2: Add getTokenPath() to paths.ts

**Files:**
- Modify: `packages/core/src/config/paths.ts`

- [ ] **Step 1: Add getTokenPath function**

Add at the end of `packages/core/src/config/paths.ts`:

```typescript
/**
 * Get the path to the auth token file
 */
export function getTokenPath(): string {
  return join(getStateDir(), "token");
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/config/paths.ts
git commit -m "feat(config): add getTokenPath for auth token storage"
```

### Task 3: Create auth/token.ts - Token storage utilities

**Files:**
- Create: `packages/core/src/auth/token.ts`
- Create: `packages/core/src/auth/token.test.ts`

- [ ] **Step 1: Write tests for token module**

```typescript
// packages/core/src/auth/token.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, rmSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

// Set test state dir before importing
const testStateDir = join(tmpdir(), `viben-test-${Date.now()}`);
process.env.VIBEN_STATE_DIR = testStateDir;

import {
  readToken,
  writeToken,
  deleteToken,
  validateTokenFormat,
  TOKEN_REGEX,
} from "./token";

describe("token", () => {
  beforeEach(() => {
    mkdirSync(testStateDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testStateDir)) {
      rmSync(testStateDir, { recursive: true, force: true });
    }
  });

  describe("validateTokenFormat", () => {
    it("should accept valid token format", () => {
      expect(validateTokenFormat("bmcp_12345678_abcdefghijklmnopqrstuvwx")).toBe(true);
      expect(validateTokenFormat("bmcp_ABCD1234_ABCDEFGHIJKLMNOPQRSTUVWX")).toBe(true);
    });

    it("should reject invalid token formats", () => {
      expect(validateTokenFormat("invalid")).toBe(false);
      expect(validateTokenFormat("bmcp_short_short")).toBe(false);
      expect(validateTokenFormat("bmcp_12345678")).toBe(false);
      expect(validateTokenFormat("")).toBe(false);
    });
  });

  describe("writeToken", () => {
    it("should write token to file", async () => {
      const token = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      await writeToken(token);

      const tokenPath = join(testStateDir, "token");
      expect(existsSync(tokenPath)).toBe(true);
      expect(readFileSync(tokenPath, "utf-8")).toBe(token);
    });

    it("should create directory if not exists", async () => {
      rmSync(testStateDir, { recursive: true, force: true });

      const token = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      await writeToken(token);

      expect(existsSync(testStateDir)).toBe(true);
    });

    it("should set file permissions to 0600", async () => {
      const token = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      await writeToken(token);

      const tokenPath = join(testStateDir, "token");
      const stats = statSync(tokenPath);
      // 0600 in octal = 384 in decimal, mask with 0o777 to get permission bits
      expect(stats.mode & 0o777).toBe(0o600);
    });
  });

  describe("readToken", () => {
    it("should read token from file", async () => {
      const token = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      await writeToken(token);

      const result = await readToken();
      expect(result).toBe(token);
    });

    it("should return null if file not exists", async () => {
      const result = await readToken();
      expect(result).toBeNull();
    });

    it("should prefer VIBEN_TOKEN env var", async () => {
      const fileToken = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      const envToken = "bmcp_envtoken_ABCDEFGHIJKLMNOPQRSTUVWX";

      await writeToken(fileToken);
      process.env.VIBEN_TOKEN = envToken;

      const result = await readToken();
      expect(result).toBe(envToken);

      delete process.env.VIBEN_TOKEN;
    });
  });

  describe("deleteToken", () => {
    it("should delete token file", async () => {
      const token = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      await writeToken(token);

      const tokenPath = join(testStateDir, "token");
      expect(existsSync(tokenPath)).toBe(true);

      await deleteToken();
      expect(existsSync(tokenPath)).toBe(false);
    });

    it("should not throw if file not exists", async () => {
      await expect(deleteToken()).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test src/auth/token.test.ts`
Expected: FAIL (module doesn't exist)

- [ ] **Step 3: Implement token.ts**

```typescript
// packages/core/src/auth/token.ts
/**
 * Token storage and validation utilities
 */
import { existsSync } from "node:fs";
import { readFile, writeFile, unlink, mkdir, chmod } from "node:fs/promises";
import { dirname } from "node:path";
import { getTokenPath, getStateDir } from "../config/paths";

/**
 * Token format: bmcp_XXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYY
 * - Prefix: bmcp_
 * - First part: 8 alphanumeric chars
 * - Second part: 24 alphanumeric chars
 */
export const TOKEN_REGEX = /^bmcp_[a-zA-Z0-9]{8}_[a-zA-Z0-9]{24}$/;

/**
 * Validate token format
 */
export function validateTokenFormat(token: string): boolean {
  return TOKEN_REGEX.test(token);
}

/**
 * Read token from environment or file
 * Priority: VIBEN_TOKEN env > ~/.viben/token file
 */
export async function readToken(): Promise<string | null> {
  // Check environment variable first
  const envToken = process.env.VIBEN_TOKEN;
  if (envToken) {
    return envToken;
  }

  // Check file
  const tokenPath = getTokenPath();
  if (!existsSync(tokenPath)) {
    return null;
  }

  try {
    const content = await readFile(tokenPath, "utf-8");
    return content.trim();
  } catch {
    return null;
  }
}

/**
 * Write token to file
 * Creates ~/.viben directory if needed
 * Sets file permission to 0600
 */
export async function writeToken(token: string): Promise<void> {
  const tokenPath = getTokenPath();
  const stateDir = getStateDir();

  // Create directory if needed
  if (!existsSync(stateDir)) {
    await mkdir(stateDir, { recursive: true, mode: 0o700 });
  }

  // Write token
  await writeFile(tokenPath, token, { encoding: "utf-8", mode: 0o600 });

  // Ensure permissions (in case file existed)
  await chmod(tokenPath, 0o600);
}

/**
 * Delete token file
 */
export async function deleteToken(): Promise<void> {
  const tokenPath = getTokenPath();
  if (existsSync(tokenPath)) {
    await unlink(tokenPath);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test src/auth/token.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/auth/token.ts packages/core/src/auth/token.test.ts
git commit -m "feat(auth): add token storage utilities"
```

### Task 4: Create auth/api.ts - API client for auth

**Files:**
- Create: `packages/core/src/auth/api.ts`
- Create: `packages/core/src/auth/api.test.ts`

- [ ] **Step 1: Write tests for API client**

```typescript
// packages/core/src/auth/api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { verifyToken, AuthApiError, VIBEN_WEB_URL } from "./api";

describe("auth/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyToken", () => {
    it("should return user info for valid token", async () => {
      const mockUser = {
        id: "user_123",
        username: "testuser",
        email: "test@example.com",
        avatarUrl: "https://example.com/avatar.png",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      const result = await verifyToken("bmcp_12345678_abcdefghijklmnopqrstuvwx");

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        `${VIBEN_WEB_URL}/api/users/me`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer bmcp_12345678_abcdefghijklmnopqrstuvwx",
          }),
        })
      );
    });

    it("should throw AuthApiError for invalid token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Invalid API key" }),
      });

      await expect(
        verifyToken("bmcp_invalid_abcdefghijklmnopqrstuvwx")
      ).rejects.toThrow(AuthApiError);
    });

    it("should throw AuthApiError for network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        verifyToken("bmcp_12345678_abcdefghijklmnopqrstuvwx")
      ).rejects.toThrow(AuthApiError);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test src/auth/api.test.ts`
Expected: FAIL (module doesn't exist)

- [ ] **Step 3: Implement api.ts**

```typescript
// packages/core/src/auth/api.ts
/**
 * API client for authentication
 */

export const VIBEN_WEB_URL = "https://viben-web.vercel.app";

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public code: "INVALID_TOKEN" | "NETWORK_ERROR" | "SERVER_ERROR"
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

/**
 * Verify token with the server and get user info
 */
export async function verifyToken(token: string): Promise<UserInfo> {
  try {
    const response = await fetch(`${VIBEN_WEB_URL}/api/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthApiError(
          "Invalid or expired token. Generate a new one at https://viben-web.vercel.app/settings/tokens",
          "INVALID_TOKEN"
        );
      }
      throw new AuthApiError(
        `Server error: ${response.status}`,
        "SERVER_ERROR"
      );
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error;
    }
    throw new AuthApiError(
      "Could not connect to server. Check your internet connection.",
      "NETWORK_ERROR"
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test src/auth/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/auth/api.ts packages/core/src/auth/api.test.ts
git commit -m "feat(auth): add API client for token verification"
```

### Task 5: Create auth/index.ts - Module exports

**Files:**
- Create: `packages/core/src/auth/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
// packages/core/src/auth/index.ts
/**
 * Authentication module
 */
export {
  readToken,
  writeToken,
  deleteToken,
  validateTokenFormat,
  TOKEN_REGEX,
} from "./token";

export {
  verifyToken,
  AuthApiError,
  VIBEN_WEB_URL,
  type UserInfo,
} from "./api";
```

- [ ] **Step 2: Verify build passes**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/auth/index.ts
git commit -m "feat(auth): add auth module exports"
```

---

## Chunk 3: CLI - Login Commands

### Task 6: Create login.ts - CLI commands

**Files:**
- Create: `packages/core/src/cli/commands/login.ts`

- [ ] **Step 1: Install open package**

Run: `cd packages/core && pnpm add open`

- [ ] **Step 2: Create login.ts**

```typescript
// packages/core/src/cli/commands/login.ts
/**
 * viben login/logout/whoami - Authentication commands
 */
import { createInterface } from "node:readline";
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  handleCommandError,
  outputError,
} from "../lib";
import {
  readToken,
  writeToken,
  deleteToken,
  validateTokenFormat,
  verifyToken,
  AuthApiError,
  VIBEN_WEB_URL,
} from "../../auth";

const TOKEN_URL = `${VIBEN_WEB_URL}/settings/tokens`;

/**
 * Prompt user for input (hidden for tokens)
 */
async function promptInput(prompt: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for yes/no confirmation
 */
async function promptConfirm(prompt: string): Promise<boolean> {
  const answer = await promptInput(`${prompt} (y/N) `);
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

/**
 * Try to open URL in browser
 */
async function openBrowser(url: string): Promise<boolean> {
  try {
    const open = (await import("open")).default;
    await open(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get output context from program options
 */
function getOutputContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

/**
 * Register login/logout/whoami commands
 */
export function registerLoginCommand(program: Command): void {
  // viben login
  program
    .command("login")
    .description("Log in to Viben with an API token")
    .option("--token <token>", "API token (non-interactive)")
    .option("--no-browser", "Don't open browser automatically")
    .option("-f, --force", "Overwrite existing token without confirmation")
    .action(async (options: { token?: string; browser?: boolean; force?: boolean }) => {
      const ctx = getOutputContext(program);

      try {
        // Check for existing token
        const existingToken = await readToken();
        if (existingToken && !options.force && !options.token) {
          // Verify existing token to show username
          try {
            const user = await verifyToken(existingToken);
            console.log(`You are already logged in as ${chalk.cyan(user.username)}.`);
            const overwrite = await promptConfirm("Overwrite existing token?");
            if (!overwrite) {
              return;
            }
          } catch {
            // Token is invalid, proceed with login
          }
        }

        let token = options.token;

        if (!token) {
          // Interactive mode
          if (options.browser !== false) {
            const opened = await openBrowser(TOKEN_URL);
            if (opened) {
              console.log(`Opening ${chalk.cyan(TOKEN_URL)} in your browser...`);
            } else {
              console.log(`Could not open browser. Please visit:`);
              console.log(`  ${chalk.cyan(TOKEN_URL)}`);
            }
            console.log();
          } else {
            console.log(`Get your token from: ${chalk.cyan(TOKEN_URL)}`);
            console.log();
          }

          token = await promptInput("? Enter your token: ");
        }

        if (!token) {
          outputError(ctx, "NO_TOKEN", "No token provided");
          process.exit(1);
        }

        // Validate format
        if (!validateTokenFormat(token)) {
          outputError(
            ctx,
            "INVALID_FORMAT",
            'Invalid token format. Token should start with "bmcp_"'
          );
          process.exit(1);
        }

        // Verify with server
        console.log("Validating token...");
        let user;
        try {
          user = await verifyToken(token);
        } catch (error) {
          if (error instanceof AuthApiError) {
            outputError(ctx, error.code, error.message);
          } else {
            outputError(ctx, "UNKNOWN", String(error));
          }
          process.exit(1);
        }

        // Save token
        await writeToken(token);

        output(
          ctx,
          successResponse({
            username: user.username,
            email: user.email,
            id: user.id,
          }),
          () => {
            console.log(
              chalk.green("✓") +
                ` Logged in as ${chalk.cyan(user.username)} (${user.email})`
            );
            console.log(`  Token saved to ~/.viben/token`);
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // viben logout
  program
    .command("logout")
    .description("Log out and remove saved token")
    .action(async () => {
      const ctx = getOutputContext(program);

      try {
        const existingToken = await readToken();

        if (!existingToken) {
          output(ctx, successResponse({ wasLoggedIn: false }), () => {
            console.log("Not logged in.");
          });
          return;
        }

        await deleteToken();

        output(ctx, successResponse({ wasLoggedIn: true }), () => {
          console.log(chalk.green("✓") + " Logged out successfully.");
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // viben whoami
  program
    .command("whoami")
    .description("Show current logged-in user")
    .action(async () => {
      const ctx = getOutputContext(program);

      try {
        const token = await readToken();

        if (!token) {
          if (ctx.json) {
            output(ctx, successResponse({ loggedIn: false }), () => {});
          } else {
            console.error('Not logged in. Run "viben login" first.');
            process.exit(1);
          }
          return;
        }

        // Verify token and get user info
        let user;
        try {
          user = await verifyToken(token);
        } catch (error) {
          if (error instanceof AuthApiError) {
            if (ctx.json) {
              output(
                ctx,
                successResponse({ loggedIn: false, error: error.message }),
                () => {}
              );
            } else {
              console.error(error.message);
              process.exit(1);
            }
            return;
          }
          throw error;
        }

        output(
          ctx,
          successResponse({
            loggedIn: true,
            username: user.username,
            email: user.email,
            id: user.id,
          }),
          () => {
            console.log(`${user.username} (${user.email})`);
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
```

- [ ] **Step 3: Verify build passes**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/cli/commands/login.ts packages/core/package.json pnpm-lock.yaml
git commit -m "feat(cli): add login/logout/whoami commands"
```

### Task 7: Register login command in index.ts

**Files:**
- Modify: `packages/core/src/cli/commands/index.ts`

- [ ] **Step 1: Add import and registration**

Add import at top:
```typescript
import { registerLoginCommand } from "./login";
```

Add in `registerCommands` function:
```typescript
registerLoginCommand(program);
```

- [ ] **Step 2: Verify build passes**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/cli/commands/index.ts
git commit -m "feat(cli): register login command"
```

---

## Chunk 4: Integration Testing

### Task 8: Manual integration test

- [ ] **Step 1: Build packages**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 2: Test login --help**

Run: `pnpm viben login --help`
Expected: Shows login command options

- [ ] **Step 3: Test whoami (not logged in)**

Run: `pnpm viben whoami`
Expected: "Not logged in. Run \"viben login\" first." with exit code 1

- [ ] **Step 4: Test logout (not logged in)**

Run: `pnpm viben logout`
Expected: "Not logged in." with exit code 0

- [ ] **Step 5: Final commit with all changes verified**

```bash
git add -A
git commit -m "feat: implement viben login/logout/whoami commands

- Add Bearer token support to apps/web requireAuth()
- Add token storage utilities (read/write/delete)
- Add API client for token verification
- Add CLI commands: login, logout, whoami

Closes: viben login design spec"
```

---

## Summary

| Chunk | Tasks | Description |
|-------|-------|-------------|
| 1 | Task 1 | Backend: Bearer token support in requireAuth() |
| 2 | Tasks 2-5 | CLI: Token management module |
| 3 | Tasks 6-7 | CLI: Login commands |
| 4 | Task 8 | Integration testing |

**Total estimated time:** 45-60 minutes
