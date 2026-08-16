import { beforeEach, describe, expect, test, vi } from "vitest";
import { performAutoCreatePr } from "./auto-pr-direct";
import type { AutoCreatePrResult } from "./auto-pr-direct";

vi.mock("server-only", () => ({}));

type ExecResult = {
  success: boolean;
  stdout: string;
  stderr?: string;
};

const state = vi.hoisted(() => {
  const s = {
    execResults: new Map<string, ExecResult>(),
    userTokenResult: "ghu_user" as string | null,
    cachedBranchesResult: {
      branches: ["main", "feature-branch"],
      defaultBranch: "main",
    } as { branches: string[]; defaultBranch: string } | null,
    findPullRequestResult: { found: false } as {
      found: boolean;
      prNumber?: number;
      prStatus?: "open" | "closed" | "merged";
      prUrl?: string;
      error?: string;
    },
    openPullRequestResult: {
      success: true,
      prNumber: 42,
      prUrl: "https://github.com/acme/repo/pull/42",
    } as {
      success: boolean;
      prUrl?: string;
      prNumber?: number;
      error?: string;
    },
    prContentResult: {
      success: true,
      title: "feat: improve auto pr",
      body: "## Summary\n\nAdds auto PR support.",
      diffStats: " file.ts | 1 +",
      commitLog: "abc123 feat: improve auto pr",
      baseRef: "origin/main",
      mergeBase: "abc123",
    } as
      | {
          success: true;
          title: string;
          body: string;
          diffStats: string;
          commitLog: string;
          baseRef: string;
          mergeBase: string | null;
        }
      | { success: false; error: string },

    execSpy: vi.fn(async (command: string): Promise<ExecResult> => {
      for (const [prefix, result] of s.execResults) {
        if (command.startsWith(prefix) || command.includes(prefix)) {
          return result;
        }
      }

      return { success: true, stdout: "", stderr: "" };
    }),
    updateSessionSpy: vi.fn(async () => {}),
    fetchGitHubBranchesSpy: vi.fn(async () => s.cachedBranchesResult),
    findPullRequestSpy: vi.fn(async () => s.findPullRequestResult),
    openPullRequestSpy: vi.fn(async () => s.openPullRequestResult),
    generatePullRequestContentFromSandboxSpy: vi.fn(
      async () => s.prContentResult,
    ),
    getGitHubRepoOAuthTokenSpy: vi.fn(
      async (_userId?: string) => s.userTokenResult,
    ),
    withTemporaryGitHubAuthSpy: vi.fn(
      async (
        _sandbox: unknown,
        _token: string | undefined,
        operation: () => Promise<unknown>,
      ) => operation(),
    ),
    mintInstallationTokenSpy: vi.fn(async () => ({
      token: "ghs_read",
      expiresAt: null,
      installationId: 999,
      repositoryIds: [123],
      permissions: { contents: "read" },
    })),
    revokeInstallationTokenSpy: vi.fn(async () => {}),
    verifyRepoAccessSpy: vi.fn(async () => ({
      ok: true,
      installationId: 999,
      repositoryId: 123,
      defaultBranch: "main",
    })),
  };

  return s;
});

vi.mock("@viben/sandbox", () => ({
  withTemporaryGitHubAuth: state.withTemporaryGitHubAuthSpy,
}));

vi.mock("@/lib/git/helpers", () => ({
  looksLikeCommitHash: (value: string) => /^[0-9a-f]{7,40}$/i.test(value),
}));

vi.mock("@/lib/db/sessions", () => ({
  getChatsBySessionId: async () => [],
  getSessionById: async () => null,
  updateSession: state.updateSessionSpy,
}));

vi.mock("@/lib/github/repos", () => ({
  fetchGitHubBranches: state.fetchGitHubBranchesSpy,
}));

vi.mock("@/lib/github/token", () => ({
  getGitHubRepoOAuthToken: state.getGitHubRepoOAuthTokenSpy,
}));

vi.mock("@/lib/github/access", () => ({
  verifyRepoAccess: state.verifyRepoAccessSpy,
  getRepoAccessErrorMessage: () => "Access denied",
}));

vi.mock("@/lib/github/app", () => ({
  mintInstallationToken: state.mintInstallationTokenSpy,
  revokeInstallationToken: state.revokeInstallationTokenSpy,
}));

vi.mock("@/lib/github/pulls", () => ({
  findPullRequest: state.findPullRequestSpy,
  openPullRequest: state.openPullRequestSpy,
}));

vi.mock("@/lib/github/pr-content", () => ({
  generatePullRequestContentFromSandbox:
    state.generatePullRequestContentFromSandboxSpy,
}));

const sandbox = {
  workingDirectory: "/vercel/sandbox",
  exec: state.execSpy,
};

function defaultExecResults(): Map<string, ExecResult> {
  return new Map<string, ExecResult>([
    [
      "git symbolic-ref --short HEAD",
      { success: true, stdout: "feature-branch" },
    ],
    ["git fetch origin", { success: true, stdout: "" }],
    ["git rev-parse HEAD", { success: true, stdout: "abc123" }],
    [
      "git ls-remote --heads origin",
      {
        success: true,
        stdout: "abc123\trefs/heads/feature-branch",
      },
    ],
    [
      "git symbolic-ref refs/remotes/origin/HEAD",
      { success: true, stdout: "refs/remotes/origin/main" },
    ],
  ]);
}

function makeParams() {
  return {
    sandbox: sandbox as never,
    userId: "user-1",
    sessionId: "session-1",
    sessionTitle: "Auto PR session",
    repoOwner: "acme",
    repoName: "repo",
  };
}

beforeEach(() => {
  state.execSpy.mockClear();
  state.updateSessionSpy.mockClear();
  state.fetchGitHubBranchesSpy.mockClear();
  state.findPullRequestSpy.mockClear();
  state.openPullRequestSpy.mockClear();
  state.generatePullRequestContentFromSandboxSpy.mockClear();
  state.getGitHubRepoOAuthTokenSpy.mockClear();
  state.withTemporaryGitHubAuthSpy.mockClear();
  state.mintInstallationTokenSpy.mockClear();
  state.revokeInstallationTokenSpy.mockClear();
  state.verifyRepoAccessSpy.mockClear();

  state.execResults = defaultExecResults();
  state.userTokenResult = "ghu_user";
  state.cachedBranchesResult = {
    branches: ["main", "feature-branch"],
    defaultBranch: "main",
  };
  state.findPullRequestResult = { found: false };
  state.openPullRequestResult = {
    success: true,
    prNumber: 42,
    prUrl: "https://github.com/acme/repo/pull/42",
  };
  state.prContentResult = {
    success: true,
    title: "feat: improve auto pr",
    body: "## Summary\n\nAdds auto PR support.",
    diffStats: " file.ts | 1 +",
    commitLog: "abc123 feat: improve auto pr",
    baseRef: "origin/main",
    mergeBase: "abc123",
  };
});

describe("performAutoCreatePr", () => {
  test("skips when the current branch is detached", async () => {
    state.execResults.set("git symbolic-ref --short HEAD", {
      success: false,
      stdout: "",
    });

    const result = await performAutoCreatePr(makeParams());

    expect(result).toEqual({
      created: false,
      syncedExisting: false,
      skipped: true,
      skipReason: "Current branch is detached",
    } satisfies AutoCreatePrResult);
    expect(state.openPullRequestSpy).not.toHaveBeenCalled();
  });

  test("skips when the current branch matches the default branch", async () => {
    state.execResults.set("git symbolic-ref --short HEAD", {
      success: true,
      stdout: "main",
    });

    const result = await performAutoCreatePr(makeParams());

    expect(result).toEqual({
      created: false,
      syncedExisting: false,
      skipped: true,
      skipReason: "Current branch matches the default branch",
    } satisfies AutoCreatePrResult);
    expect(state.openPullRequestSpy).not.toHaveBeenCalled();
  });

  test("skips when the repository owner is not a safe GitHub path segment", async () => {
    const result = await performAutoCreatePr({
      ...makeParams(),
      repoOwner: 'acme" && echo nope && "',
    });

    expect(result).toEqual({
      created: false,
      syncedExisting: false,
      skipped: true,
      skipReason:
        "Repository owner or name is not supported for auto PR creation",
    } satisfies AutoCreatePrResult);
    expect(state.execSpy).toHaveBeenCalledTimes(1);
  });

  test("skips when the current branch is not available on origin", async () => {
    state.execResults.set("git ls-remote --heads origin", {
      success: true,
      stdout: "",
    });

    const result = await performAutoCreatePr(makeParams());

    expect(result).toEqual({
      created: false,
      syncedExisting: false,
      skipped: true,
      skipReason: "Current branch is not available on origin",
    } satisfies AutoCreatePrResult);
    expect(state.generatePullRequestContentFromSandboxSpy).not.toHaveBeenCalled();
  });

  test("skips when the current branch is not fully pushed to origin", async () => {
    state.execResults.set("git ls-remote --heads origin", {
      success: true,
      stdout: "def456\trefs/heads/feature-branch",
    });

    const result = await performAutoCreatePr(makeParams());

    expect(result).toEqual({
      created: false,
      syncedExisting: false,
      skipped: true,
      skipReason: "Current branch is not fully pushed to origin",
    } satisfies AutoCreatePrResult);
    expect(state.findPullRequestSpy).not.toHaveBeenCalled();
    expect(state.openPullRequestSpy).not.toHaveBeenCalled();
  });

  test("syncs an existing open pull request instead of creating a new one", async () => {
    state.findPullRequestResult = {
      found: true,
      prNumber: 7,
      prStatus: "open",
      prUrl: "https://github.com/acme/repo/pull/7",
    };

    const result = await performAutoCreatePr(makeParams());

    expect(result).toEqual({
      created: false,
      syncedExisting: true,
      skipped: false,
      prNumber: 7,
      prUrl: "https://github.com/acme/repo/pull/7",
    } satisfies AutoCreatePrResult);
    expect(state.updateSessionSpy).toHaveBeenCalledWith("session-1", {
      prNumber: 7,
      prStatus: "open",
    });
    expect(state.openPullRequestSpy).not.toHaveBeenCalled();
  });

  test("creates a new pull request and persists PR metadata", async () => {
    const result = await performAutoCreatePr(makeParams());

    expect(result).toEqual({
      created: true,
      syncedExisting: false,
      skipped: false,
      prNumber: 42,
      prUrl: "https://github.com/acme/repo/pull/42",
    } satisfies AutoCreatePrResult);
    expect(state.getGitHubRepoOAuthTokenSpy).toHaveBeenCalledWith("user-1");
    expect(state.verifyRepoAccessSpy).toHaveBeenCalledWith({
      userId: "user-1",
      owner: "acme",
      repo: "repo",
    });
    expect(state.mintInstallationTokenSpy).toHaveBeenCalledWith({
      installationId: 999,
      repositoryIds: [123],
      permissions: { contents: "read" },
    });
    expect(state.withTemporaryGitHubAuthSpy).toHaveBeenCalledWith(
      sandbox,
      "ghs_read",
      expect.any(Function),
    );
    expect(state.revokeInstallationTokenSpy).toHaveBeenCalledWith("ghs_read");
    expect(state.generatePullRequestContentFromSandboxSpy).toHaveBeenCalledTimes(1);
    expect(state.openPullRequestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        repoUrl: "https://github.com/acme/repo",
        branchName: "feature-branch",
        baseBranch: "main",
        token: "ghu_user",
      }),
    );
    expect(state.updateSessionSpy).toHaveBeenCalledWith("session-1", {
      prNumber: 42,
      prStatus: "open",
    });
  });

  test("returns an error when PR content generation fails unexpectedly", async () => {
    state.prContentResult = {
      success: false,
      error: "Failed to resolve the repository default branch",
    };

    const result = await performAutoCreatePr(makeParams());

    expect(result).toEqual({
      created: false,
      syncedExisting: false,
      skipped: false,
      error: "Failed to resolve the repository default branch",
    } satisfies AutoCreatePrResult);
    expect(state.openPullRequestSpy).not.toHaveBeenCalled();
  });
});
