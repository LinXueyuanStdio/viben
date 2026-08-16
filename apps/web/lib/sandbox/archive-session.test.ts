import { beforeEach, describe, expect, test, vi } from "vitest";
import { archiveSession } from "./archive-session";

vi.mock("server-only", () => ({}));

interface TestSessionRecord {
  id: string;
  userId: string;
  status: "running" | "archived";
  repoOwner: string | null;
  repoName: string | null;
  branch: string | null;
  cloneUrl: string | null;
  prNumber: number | null;
  prStatus: "open" | "merged" | "closed" | null;
  sandboxState: {
    type: "vercel";
    sandboxName?: string;
    expiresAt?: number;
  } | null;
  snapshotUrl: string | null;
  lifecycleState: "active" | "archived" | null;
  lifecycleError: string | null;
  sandboxExpiresAt: Date | null;
  hibernateAfter: Date | null;
}

interface MockSandboxExecResult {
  success: boolean;
  stdout: string;
}

interface MockSandbox {
  workingDirectory: string;
  exec: (
    command: string,
    cwd: string,
    timeoutMs: number,
  ) => Promise<MockSandboxExecResult>;
  stop: () => Promise<void>;
  snapshot?: () => Promise<{ snapshotId: string }>;
}

type MockPullRequestStatusResult =
  | {
      success: true;
      status: "open" | "merged" | "closed";
    }
  | {
      success: false;
      error: string;
    };

type MockFindPullRequestResult =
  | {
      found: true;
      prNumber: number;
      prStatus: "open" | "merged" | "closed";
    }
  | {
      found: false;
      error?: string;
    };

const state = vi.hoisted(() => {
  const s = {
    sessionRecord: null as TestSessionRecord | null,
    sandboxQueue: [] as MockSandbox[],
    spies: {
      getSessionById: vi.fn(async (_sessionId: string) => {
        if (!s.sessionRecord) {
          return null;
        }

        return {
          ...s.sessionRecord,
          sandboxState: s.sessionRecord.sandboxState
            ? { ...s.sessionRecord.sandboxState }
            : null,
        };
      }),
      updateSession: vi.fn(
        async (_sessionId: string, patch: Record<string, unknown>) => {
          if (!s.sessionRecord) {
            return null;
          }

          s.sessionRecord = {
            ...s.sessionRecord,
            ...(patch as Partial<TestSessionRecord>),
          };

          return {
            ...s.sessionRecord,
            sandboxState: s.sessionRecord.sandboxState
              ? { ...s.sessionRecord.sandboxState }
              : null,
          };
        },
      ),
      connectSandbox: vi.fn(async () => {
        const sandbox = s.sandboxQueue.shift();
        if (!sandbox) {
          throw new Error("sandbox connection failed");
        }

        return sandbox;
      }),
      getGitHubRepoOAuthToken: vi.fn(async () => "repo-token"),
      getPullRequestStatus: vi.fn(
        async (): Promise<MockPullRequestStatusResult> => ({
          success: false,
          error: "Failed to get PR status",
        }),
      ),
      findPullRequest: vi.fn(
        async (): Promise<MockFindPullRequestResult> => ({
          found: false,
        }),
      ),
    },
  };

  return s;
});

vi.mock("@/lib/db/sessions", () => ({
  getSessionById: state.spies.getSessionById,
  updateSession: state.spies.updateSession,
}));

vi.mock("@viben/sandbox", () => ({
  connectSandbox: state.spies.connectSandbox,
}));

vi.mock("@/lib/github/token", () => ({
  getGitHubRepoOAuthToken: state.spies.getGitHubRepoOAuthToken,
}));

vi.mock("@/lib/github/pulls", () => ({
  getPullRequestStatus: state.spies.getPullRequestStatus,
  findPullRequest: state.spies.findPullRequest,
}));

function makeSessionRecord(
  overrides: Partial<TestSessionRecord> = {},
): TestSessionRecord {
  return {
    id: "session-1",
    userId: "user-1",
    status: "running",
    repoOwner: "acme",
    repoName: "widgets",
    branch: "feature/session-1",
    cloneUrl: "https://github.com/acme/widgets.git",
    prNumber: 42,
    prStatus: "open",
    sandboxState: {
      type: "vercel",
      sandboxName: "session_session-1",
      expiresAt: Date.now() + 60_000,
    },
    snapshotUrl: null,
    lifecycleState: "active",
    lifecycleError: null,
    sandboxExpiresAt: new Date("2025-01-01T00:00:00.000Z"),
    hibernateAfter: new Date("2025-01-01T00:10:00.000Z"),
    ...overrides,
  };
}

function createMockSandbox(overrides: Partial<MockSandbox> = {}): MockSandbox {
  return {
    workingDirectory: "/workspace",
    exec: async () => ({ success: true, stdout: "feature/session-1\n" }),
    stop: async () => {},
    ...overrides,
  };
}

beforeEach(() => {
  state.sessionRecord = makeSessionRecord();
  state.sandboxQueue = [];
  Object.values(state.spies).forEach((spy) => spy.mockClear());

  state.spies.getGitHubRepoOAuthToken.mockImplementation(async () => "repo-token");
  state.spies.getPullRequestStatus.mockImplementation(async () => ({
    success: false,
    error: "Failed to get PR status",
  }));
  state.spies.findPullRequest.mockImplementation(async () => ({
    found: false,
  }));
});

describe("archiveSession", () => {
  test("clears runtime sandbox state when archive finalization fails without a snapshot", async () => {
    let backgroundTask: Promise<void> | null = null;

    const result = await archiveSession("session-1", {
      logPrefix: "[Test]",
      scheduleBackgroundWork: (callback) => {
        backgroundTask = callback();
      },
    });

    expect(result.archiveTriggered).toBe(true);
    if (!backgroundTask) {
      throw new Error("Expected archive finalization task to be scheduled");
    }
    await backgroundTask;

    const updateCalls = state.spies.updateSession.mock.calls as Array<
      [string, Record<string, unknown>]
    >;

    expect(updateCalls).toHaveLength(2);
    const recoveryPatch = updateCalls[1]?.[1];

    expect(recoveryPatch).toMatchObject({
      lifecycleState: "archived",
      sandboxExpiresAt: null,
      hibernateAfter: null,
      lifecycleError: "Archive finalization failed: sandbox connection failed",
      sandboxState: {
        type: "vercel",
        sandboxName: "session_session-1",
      },
    });

    expect(state.sessionRecord?.sandboxState).toEqual({
      type: "vercel",
      sandboxName: "session_session-1",
    });
  });

  test("preserves runtime sandbox state when archive finalization fails but snapshot already exists", async () => {
    state.sessionRecord = makeSessionRecord({ snapshotUrl: "snapshot-existing" });

    let backgroundTask: Promise<void> | null = null;

    const result = await archiveSession("session-1", {
      logPrefix: "[Test]",
      scheduleBackgroundWork: (callback) => {
        backgroundTask = callback();
      },
    });

    expect(result.archiveTriggered).toBe(true);
    if (!backgroundTask) {
      throw new Error("Expected archive finalization task to be scheduled");
    }
    await backgroundTask;

    const updateCalls = state.spies.updateSession.mock.calls as Array<
      [string, Record<string, unknown>]
    >;

    expect(updateCalls).toHaveLength(2);
    const recoveryPatch = updateCalls[1]?.[1];

    expect(recoveryPatch?.lifecycleError).toBe(
      "Archive finalization failed: sandbox connection failed",
    );
    expect(recoveryPatch?.sandboxState).toBeUndefined();
    expect(state.sessionRecord?.sandboxState).toEqual(
      expect.objectContaining({
        type: "vercel",
        sandboxName: "session_session-1",
      }),
    );
  });

  test("refreshes merged PR status before archiving", async () => {
    state.sandboxQueue = [createMockSandbox(), createMockSandbox()];
    state.spies.getPullRequestStatus.mockImplementation(async () => ({
      success: true,
      status: "merged",
    }));

    let backgroundTask: Promise<void> | null = null;

    const result = await archiveSession("session-1", {
      logPrefix: "[Test]",
      scheduleBackgroundWork: (callback) => {
        backgroundTask = callback();
      },
    });

    expect(result.archiveTriggered).toBe(true);
    if (!backgroundTask) {
      throw new Error("Expected archive finalization task to be scheduled");
    }
    await backgroundTask;

    const updateCalls = state.spies.updateSession.mock.calls as Array<
      [string, Record<string, unknown>]
    >;

    expect(updateCalls[0]?.[1]).toMatchObject({
      status: "archived",
      prStatus: "merged",
    });
    expect(state.spies.findPullRequest).not.toHaveBeenCalled();
    expect(state.sessionRecord?.prStatus).toBe("merged");
  });
});
