import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SkillMetadata } from "@viben/agent";

vi.mock("server-only", () => ({}));

interface TestSandboxState {
  type: string;
  sandboxId?: string;
  snapshotId?: string;
  files?: Record<string, unknown>;
}

interface TestSessionRecord {
  id: string;
  userId: string;
  sandboxState: TestSandboxState | null;
}

const state = vi.hoisted(() => {
  const s = {
    cacheReadCalls: [] as Array<{
      sessionId: string;
      sandboxState: TestSandboxState | null;
    }>,
    cacheWriteCalls: [] as Array<{
      sessionId: string;
      sandboxState: TestSandboxState | null;
      skills: SkillMetadata[];
    }>,
    connectCalls: [] as TestSandboxState[],
    discoverCalls: [] as Array<{ skillDirs: string[] }>,
    updateCalls: [] as Array<Record<string, unknown>>,
    sessionRecord: null as TestSessionRecord | null,
    cachedSkills: null as SkillMetadata[] | null,
    discoveredSkills: [] as SkillMetadata[],
    isAuthenticated: true,
  };
  return s;
});

vi.mock("@/app/api/sessions/_lib/session-context", () => ({
  requireAuthenticatedUser: async () =>
    state.isAuthenticated
      ? {
          ok: true as const,
          userId: "user-1",
        }
      : {
          ok: false as const,
          response: Response.json(
            { error: "Not authenticated" },
            { status: 401 },
          ),
        },
  requireOwnedSession: async ({
    userId,
    sessionId,
  }: {
    userId: string;
    sessionId: string;
  }) => {
    if (!state.sessionRecord || state.sessionRecord.id !== sessionId) {
      return {
        ok: false as const,
        response: Response.json(
          { error: "Session not found" },
          { status: 404 },
        ),
      };
    }

    if (state.sessionRecord.userId !== userId) {
      return {
        ok: false as const,
        response: Response.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    return {
      ok: true as const,
      sessionRecord: state.sessionRecord,
    };
  },
}));

vi.mock("@/lib/db/sessions", () => ({
  updateSession: async (
    _sessionId: string,
    patch: Record<string, unknown>,
  ) => {
    state.updateCalls.push(patch);
    return {
      ...state.sessionRecord,
      ...patch,
    };
  },
}));

vi.mock("@/lib/skills-cache", () => ({
  getCachedSkills: async (
    sessionId: string,
    sandboxState: TestSandboxState | null,
  ) => {
    state.cacheReadCalls.push({ sessionId, sandboxState });
    return state.cachedSkills;
  },
  setCachedSkills: async (
    sessionId: string,
    sandboxState: TestSandboxState | null,
    skills: SkillMetadata[],
  ) => {
    state.cacheWriteCalls.push({ sessionId, sandboxState, skills });
  },
}));

vi.mock("@/lib/sandbox/lifecycle", () => ({
  buildHibernatedLifecycleUpdate: () => ({ lifecycleState: "hibernated" }),
}));

vi.mock("@/lib/sandbox/utils", () => ({
  clearSandboxState: () => null,
  clearUnavailableSandboxState: () => null,
  hasRuntimeSandboxState: (state: TestSandboxState | null) => {
    if (!state) {
      return false;
    }

    return (
      (typeof state.sandboxId === "string" && state.sandboxId.length > 0) ||
      state.files !== undefined
    );
  },
  isSandboxUnavailableError: () => false,
}));

vi.mock("@viben/sandbox", () => ({
  connectSandbox: async (sandboxState: TestSandboxState) => {
    state.connectCalls.push(sandboxState);
    return {
      workingDirectory: "/workspace",
      exec: async (command: string) => ({
        success: command === 'printf %s "$HOME"',
        exitCode: 0,
        stdout: command === 'printf %s "$HOME"' ? "/root" : "",
        stderr: "",
        truncated: false,
      }),
    };
  },
}));

vi.mock("@viben/agent", () => ({
  discoverSkills: async (_sandbox: unknown, skillDirs: string[]) => {
    state.discoverCalls.push({ skillDirs });
    return state.discoveredSkills;
  },
}));

import * as route from "./route";

describe("/api/sessions/[sessionId]/skills", () => {
  beforeEach(() => {
    state.cacheReadCalls.length = 0;
    state.cacheWriteCalls.length = 0;
    state.connectCalls.length = 0;
    state.discoverCalls.length = 0;
    state.updateCalls.length = 0;
    state.isAuthenticated = true;
    state.sessionRecord = {
      id: "session-1",
      userId: "user-1",
      sandboxState: {
        type: "vercel",
        sandboxId: "sbx-123",
      },
    };
    state.cachedSkills = null;
    state.discoveredSkills = [];
  });

  test("returns cached suggestions without connecting to the sandbox", async () => {
    state.sessionRecord!.sandboxState = {
      type: "vercel",
      snapshotId: "snap-123",
    };
    state.cachedSkills = [
      {
        name: "ship",
        description: "Deploy the current project",
        path: "/workspace/.agents/skills/ship",
        filename: "SKILL.md",
        options: {},
      },
      {
        name: "internal",
        description: "Hidden skill",
        path: "/workspace/.agents/skills/internal",
        filename: "SKILL.md",
        options: {
          userInvocable: false,
        },
      },
    ];

    const { GET } = route;
    const response = await GET(
      new Request("http://localhost/api/sessions/session-1/skills"),
      {
        params: Promise.resolve({ sessionId: "session-1" }),
      },
    );

    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({
      skills: [
        {
          name: "ship",
          description: "Deploy the current project",
        },
      ],
    });
    expect(state.cacheReadCalls).toEqual([
      {
        sessionId: "session-1",
        sandboxState: {
          type: "vercel",
          snapshotId: "snap-123",
        },
      },
    ]);
    expect(state.connectCalls).toHaveLength(0);
    expect(state.discoverCalls).toHaveLength(0);
    expect(state.cacheWriteCalls).toHaveLength(0);
  });

  test("refresh bypasses the cache and repopulates it from discovery", async () => {
    state.cachedSkills = [
      {
        name: "stale",
        description: "Old cached skill",
        path: "/workspace/.agents/skills/stale",
        filename: "SKILL.md",
        options: {},
      },
    ];
    state.discoveredSkills = [
      {
        name: "fresh",
        description: "Freshly discovered skill",
        path: "/workspace/.agents/skills/fresh",
        filename: "SKILL.md",
        options: {},
      },
    ];

    const { GET } = route;
    const response = await GET(
      new Request("http://localhost/api/sessions/session-1/skills?refresh=1"),
      {
        params: Promise.resolve({ sessionId: "session-1" }),
      },
    );

    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({
      skills: [
        {
          name: "fresh",
          description: "Freshly discovered skill",
        },
      ],
    });
    expect(state.cacheReadCalls).toHaveLength(0);
    expect(state.connectCalls).toEqual([
      {
        type: "vercel",
        sandboxId: "sbx-123",
      },
    ]);
    expect(state.discoverCalls).toEqual([
      {
        skillDirs: [
          "/workspace/.claude/skills",
          "/workspace/.agents/skills",
          "/root/.agents/skills",
        ],
      },
    ]);
    expect(state.cacheWriteCalls).toEqual([
      {
        sessionId: "session-1",
        sandboxState: {
          type: "vercel",
          sandboxId: "sbx-123",
        },
        skills: state.discoveredSkills,
      },
    ]);
  });
});
