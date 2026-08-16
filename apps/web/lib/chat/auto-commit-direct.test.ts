import { beforeEach, describe, expect, test, vi } from "vitest";
import { performAutoCommit } from "./auto-commit-direct";

type VerifyResult =
  | {
      ok: true;
      installationId: number;
      repositoryId: number;
      defaultBranch: string;
    }
  | { ok: false; reason: string };

// ── spy state ──────────────────────────────────────────────────────

const state = vi.hoisted(() => ({
  hasChanges: true,
  stageFails: false,
  stagedDiff: "diff --git a/file.ts...",
  changedFiles: [
    {
      path: "file.ts",
      status: "modified" as const,
      content: "export const x = 1;",
      encoding: "utf-8" as const,
    },
  ],
  verifyResult: {
    ok: true,
    installationId: 999,
    repositoryId: 123,
    defaultBranch: "main",
  } as VerifyResult,
  coAuthorResult: {
    name: "octocat",
    email: "12345+octocat@users.noreply.github.com",
  } as { name: string; email: string } | null,
  apiCommitResult: {
    ok: true,
    commitSha: "abc123def456",
  } as { ok: true; commitSha: string } | { ok: false; error: string },
  generateTextResult: { text: "feat: implement new feature" },
  syncPreservingChangesCalls: 0,
}));

// ── module mocks ───────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("ai", () => ({
  generateText: async () => state.generateTextResult,
}));

vi.mock("@viben/agent", () => ({
  gateway: () => "mock-model",
}));

vi.mock("@viben/sandbox", () => ({
  connectSandbox: async () => ({}),
  hasUncommittedChanges: async () => state.hasChanges,
  stageAll: async () => {
    if (state.stageFails) throw new Error("staging failed");
  },
  getStagedDiff: async () => state.stagedDiff,
  getChangedFiles: async () =>
    state.changedFiles.map(({ path, status }) => ({ path, status })),
  detectBinaryFiles: async () => new Set<string>(),
  getFileModes: async () => new Map([["file.ts", "100644"]]),
  getHeadSha: async () => "base-sha",
  getCurrentBranch: async () => "feature-branch",
  syncToRemote: async () => {},
  syncToRemotePreservingChanges: async () => {
    state.syncPreservingChangesCalls += 1;
  },
  withTemporaryGitHubAuth: async (
    _sandbox: unknown,
    _token: string | undefined,
    operation: () => Promise<unknown>,
  ) => operation(),
}));

vi.mock("@/lib/db/sessions", () => ({
  getChatsBySessionId: async () => [],
  getSessionById: async () => null,
  updateSession: async () => {},
}));

vi.mock("@/lib/github/access", () => ({
  verifyRepoAccess: async () => state.verifyResult,
  getRepoAccessErrorMessage: () => "Access denied",
}));

vi.mock("@/lib/github/commit", () => ({
  createCommit: async () => state.apiCommitResult,
  buildCoAuthor: async () => state.coAuthorResult,
  buildCommitMessageWithCoAuthor: (
    message: string,
    coAuthor?: { name: string; email: string },
  ) =>
    coAuthor
      ? `${message}\n\nCo-Authored-By: ${coAuthor.name} <${coAuthor.email}>`
      : message,
}));

vi.mock("@/lib/github/app", () => ({
  withScopedInstallationOctokit: async ({
    operation,
  }: {
    operation: (octokit: Record<string, never>) => Promise<unknown>;
  }) => operation({}),
  mintInstallationToken: async () => ({
    token: "read-token",
    expiresAt: null,
    installationId: 999,
    repositoryIds: [123],
    permissions: { contents: "read" },
  }),
  revokeInstallationToken: async () => {},
}));

// ── helpers ────────────────────────────────────────────────────────

function makeParams() {
  return {
    sandbox: {
      workingDirectory: "/sandbox",
      readFile: async () => state.changedFiles[0]?.content ?? "",
      readFileBuffer: async () => Buffer.from(state.changedFiles[0]?.content ?? ""),
      exec: async () => ({ success: true, stdout: "" }),
    } as never,
    userId: "user-1",
    sessionId: "session-1",
    sessionTitle: "Fix bug",
    repoOwner: "acme",
    repoName: "repo",
  };
}

// ── tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  state.hasChanges = true;
  state.stageFails = false;
  state.stagedDiff = "diff --git a/file.ts...";
  state.changedFiles = [
    {
      path: "file.ts",
      status: "modified",
      content: "export const x = 1;",
      encoding: "utf-8",
    },
  ];
  state.verifyResult = {
    ok: true,
    installationId: 999,
    repositoryId: 123,
    defaultBranch: "main",
  };
  state.coAuthorResult = {
    name: "octocat",
    email: "12345+octocat@users.noreply.github.com",
  };
  state.apiCommitResult = { ok: true, commitSha: "abc123def456" };
  state.generateTextResult = { text: "feat: implement new feature" };
  state.syncPreservingChangesCalls = 0;
});

describe("performAutoCommit", () => {
  test("returns early with no commit when no changes", async () => {
    state.hasChanges = false;

    const result = await performAutoCommit(makeParams());

    expect(result).toEqual({ committed: false, pushed: false });
  });

  test("returns error when staging fails", async () => {
    state.stageFails = true;

    const result = await performAutoCommit(makeParams());

    expect(result).toEqual({
      committed: false,
      pushed: false,
      error: "Failed to stage changes",
    });
  });

  test("returns error when repo access verification fails", async () => {
    state.verifyResult = { ok: false, reason: "no_installation" };

    const result = await performAutoCommit(makeParams());

    expect(result.committed).toBe(false);
    expect(result.error).toContain("no_installation");
  });

  test("returns error when api commit fails", async () => {
    state.apiCommitResult = { ok: false, error: "Concurrent push detected" };

    const result = await performAutoCommit(makeParams());

    expect(result.committed).toBe(false);
    expect(result.error).toBe("Concurrent push detected");
  });

  test("full success path returns all fields", async () => {
    const result = await performAutoCommit(makeParams());

    expect(result.committed).toBe(true);
    expect(result.pushed).toBe(true);
    expect(result.commitMessage).toBeDefined();
    expect(result.commitSha).toBe("abc123def456");
    expect(result.error).toBeUndefined();
    expect(state.syncPreservingChangesCalls).toBe(1);
  });

  test("uses fallback commit message when diff is empty", async () => {
    state.stagedDiff = "";

    const result = await performAutoCommit(makeParams());

    expect(result.committed).toBe(true);
    expect(result.commitMessage).toBe("chore: update repository changes");
  });

  test("truncates generated commit message to 72 chars", async () => {
    state.generateTextResult = { text: "A".repeat(100) };

    const result = await performAutoCommit(makeParams());

    expect(result.committed).toBe(true);
    expect(result.commitMessage!.length).toBeLessThanOrEqual(72);
  });

  test("returns early when no changed files after staging", async () => {
    state.changedFiles = [];

    const result = await performAutoCommit(makeParams());

    expect(result).toEqual({ committed: false, pushed: false });
  });
});
