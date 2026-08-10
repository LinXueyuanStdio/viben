import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { VercelProjectSelection } from "@/lib/vercel/types";

const mocks = vi.hoisted(() => ({
  currentSession: {
    user: {
      id: "user-1",
      username: "nico",
      name: "Nico",
    },
  } as {
    authProvider?: "vercel" | "github";
    user: {
      id: string;
      username: string;
      name: string;
      email?: string;
    };
  } | null,
  existingSessionCount: 0,
  savedLink: null as VercelProjectSelection | null,
  currentVercelToken: "vercel-token" as string | null,
  matchingProjects: [] as VercelProjectSelection[],
  matchingProjectsError: null as Error | null,
  createCalls: [] as Array<Record<string, unknown>>,
  upsertCalls: [] as Array<Record<string, unknown>>,
  provisioningKickCalls: [] as string[],
}));

const originalNodeEnv = process.env.NODE_ENV;

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => mocks.currentSession,
}));

vi.mock("@/lib/db/user-preferences", () => ({
  getUserPreferences: async () => ({
    defaultModelId: "anthropic/claude-haiku-4.5",
    defaultSubagentModelId: null,
    defaultSandboxType: "vercel",
    defaultDiffMode: "unified",
    autoCommitPush: false,
    autoCreatePr: false,
    alertsEnabled: true,
    alertSoundEnabled: true,
    publicUsageEnabled: false,
    globalSkillRefs: [{ source: "vercel/ai", skillName: "ai-sdk" }],
    modelVariants: [],
    enabledModelIds: [],
  }),
}));

vi.mock("@/lib/db/vercel-project-links", () => ({
  getVercelProjectLinkByRepo: async () => mocks.savedLink,
  upsertVercelProjectLink: async (input: Record<string, unknown>) => {
    mocks.upsertCalls.push(input);
  },
}));

vi.mock("@/lib/vercel/token", () => ({
  getUserVercelToken: async () => mocks.currentVercelToken,
}));

vi.mock("@/lib/vercel/projects", () => ({
  isVercelInvalidTokenError: (error: unknown) =>
    mocks.matchingProjectsError !== null && error === mocks.matchingProjectsError,
  listMatchingVercelProjects: async () => {
    if (mocks.matchingProjectsError) {
      throw mocks.matchingProjectsError;
    }
    return mocks.matchingProjects;
  },
}));

vi.mock("@/lib/db/sessions", () => ({
  countSessionsByUserId: async () => mocks.existingSessionCount,
  createSessionWithInitialChat: async (input: {
    session: Record<string, unknown>;
    initialChat: Record<string, unknown>;
  }) => {
    mocks.createCalls.push(input.session);
    return {
      session: {
        ...input.session,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      chat: {
        id: String(input.initialChat.id),
        sessionId: String(input.session.id),
        title: String(input.initialChat.title),
        modelId: String(input.initialChat.modelId),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  },
  getArchivedSessionCountByUserId: async () => 0,
  getSessionsWithUnreadByUserId: async () => [],
}));

vi.mock("@/lib/sandbox/provisioning-kick", () => ({
  kickSandboxProvisioningWorkflow: async (sessionId: string) => {
    mocks.provisioningKickCalls.push(sessionId);
    return { status: "started", runId: `provision-${sessionId}` };
  },
}));

const routeModulePromise = import("./route");

function createJsonRequest(
  body: unknown,
  url = "http://localhost/api/sessions",
): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/sessions POST vercel project linking", () => {
  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  });

  beforeEach(() => {
    mocks.currentSession = {
      user: {
        id: "user-1",
        username: "nico",
        name: "Nico",
      },
    };
    mocks.existingSessionCount = 0;
    mocks.savedLink = null;
    mocks.currentVercelToken = "vercel-token";
    mocks.matchingProjects = [];
    mocks.matchingProjectsError = null;
    mocks.createCalls.length = 0;
    mocks.upsertCalls.length = 0;
    mocks.provisioningKickCalls.length = 0;
  });

  test("blocks additional sessions for managed template trial users", async () => {
    const { POST } = await routeModulePromise;

    mocks.currentSession = {
      authProvider: "vercel",
      user: {
        id: "user-1",
        username: "nico",
        name: "Nico",
        email: "person@example.com",
      },
    };
    mocks.existingSessionCount = 1;

    const response = await POST(
      createJsonRequest(
        {
          branch: "main",
          cloneUrl: "https://github.com/viben/viben-agent",
          repoOwner: "viben",
          repoName: "viben-agent",
        },
        "https://viben-web.vercel.app/api/sessions",
      ),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe(
      "This hosted demo includes 1 trial session. Deploy your own copy to unlock the full Viben Assistant template.",
    );
    expect(mocks.createCalls).toHaveLength(0);
  });

  test("blocks repo-backed sessions for trial users", async () => {
    Object.assign(process.env, { NODE_ENV: "development" });
    const { POST } = await routeModulePromise;

    mocks.currentSession = {
      authProvider: "vercel",
      user: {
        id: "user-1",
        username: "nico",
        name: "Nico",
        email: "person@example.com",
      },
    };

    const response = await POST(
      createJsonRequest({
        branch: "main",
        cloneUrl: "https://github.com/viben/viben-agent",
        repoOwner: "viben",
        repoName: "viben-agent",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe(
      "GitHub-backed sessions are disabled in the hosted demo. Deploy your own copy to unlock repository support, or start a new chat without a repository.",
    );
    expect(mocks.createCalls).toHaveLength(0);
  });

  test("explicit Vercel project is validated against live repo matches before it is persisted", async () => {
    const { POST } = await routeModulePromise;

    const vercelProject: VercelProjectSelection = {
      projectId: "project-1",
      projectName: "tampered-name",
      teamId: "team-x",
      teamSlug: "tampered-team",
    };
    mocks.matchingProjects = [
      {
        projectId: "project-1",
        projectName: "app",
        teamId: "team-1",
        teamSlug: "acme",
      },
    ];

    const response = await POST(
      createJsonRequest({
        repoOwner: "Vercel",
        repoName: "Open-Harness",
        branch: "main",
        cloneUrl: "https://github.com/Vercel/Open-Harness",
        vercelProject,
      }),
    );
    const body = (await response.json()) as {
      session: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(mocks.upsertCalls).toEqual([
      {
        userId: "user-1",
        repoOwner: "Vercel",
        repoName: "Open-Harness",
        project: mocks.matchingProjects[0],
      },
    ]);
    expect(mocks.createCalls[0]).toMatchObject({
      repoOwner: "Vercel",
      repoName: "Open-Harness",
      vercelProjectId: "project-1",
      vercelProjectName: "app",
      vercelTeamId: "team-1",
      vercelTeamSlug: "acme",
    });
    expect(body.session.vercelProjectId).toBe("project-1");
    expect(body.session.vercelProjectName).toBe("app");
    expect(mocks.provisioningKickCalls).toEqual([String(body.session.id)]);
  });

  test("rejects explicit Vercel projects that are not a live match for the repo", async () => {
    const { POST } = await routeModulePromise;

    mocks.matchingProjects = [
      {
        projectId: "project-2",
        projectName: "dashboard",
        teamId: null,
        teamSlug: null,
      },
    ];

    const response = await POST(
      createJsonRequest({
        repoOwner: "vercel",
        repoName: "viben-agent",
        branch: "main",
        cloneUrl: "https://github.com/vercel/viben-agent",
        vercelProject: {
          projectId: "project-999",
          projectName: "rogue-project",
          teamId: null,
          teamSlug: null,
        },
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      "Selected Vercel project no longer matches this repository",
    );
    expect(mocks.upsertCalls).toHaveLength(0);
    expect(mocks.createCalls).toHaveLength(0);
  });

  test("omitting vercelProject falls back to the saved repo link", async () => {
    const { POST } = await routeModulePromise;

    mocks.savedLink = {
      projectId: "project-2",
      projectName: "dashboard",
      teamId: null,
      teamSlug: null,
    };

    const response = await POST(
      createJsonRequest({
        repoOwner: "vercel",
        repoName: "viben-agent",
        branch: "main",
        cloneUrl: "https://github.com/vercel/viben-agent",
      }),
    );
    const body = (await response.json()) as {
      session: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(mocks.upsertCalls).toHaveLength(0);
    expect(mocks.createCalls[0]).toMatchObject({
      vercelProjectId: "project-2",
      vercelProjectName: "dashboard",
      vercelTeamId: null,
      vercelTeamSlug: null,
    });
    expect(body.session.vercelProjectName).toBe("dashboard");
  });

  test("explicit null suppresses Vercel linking for that session", async () => {
    const { POST } = await routeModulePromise;

    mocks.savedLink = {
      projectId: "project-2",
      projectName: "dashboard",
      teamId: null,
      teamSlug: null,
    };

    const response = await POST(
      createJsonRequest({
        repoOwner: "vercel",
        repoName: "viben-agent",
        branch: "main",
        cloneUrl: "https://github.com/vercel/viben-agent",
        vercelProject: null,
      }),
    );
    const body = (await response.json()) as {
      session: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(mocks.upsertCalls).toHaveLength(0);
    expect(mocks.createCalls[0]).toMatchObject({
      vercelProjectId: null,
      vercelProjectName: null,
      vercelTeamId: null,
      vercelTeamSlug: null,
    });
    expect(body.session.vercelProjectId).toBeNull();
  });

  test("new sessions snapshot the user global skill refs", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      createJsonRequest({
        repoOwner: "vercel",
        repoName: "viben-agent",
        branch: "main",
        cloneUrl: "https://github.com/vercel/viben-agent",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createCalls[0]).toMatchObject({
      globalSkillRefs: [{ source: "vercel/ai", skillName: "ai-sdk" }],
    });
  });

  test("rejects invalid repository owners", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      createJsonRequest({
        repoOwner: 'vercel" && echo nope && "',
        repoName: "viben-agent",
        branch: "main",
        cloneUrl: "https://github.com/vercel/viben-agent",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid repository owner");
    expect(mocks.createCalls).toHaveLength(0);
  });

  test("persists autoCreatePr when autoCommitPush is enabled", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      createJsonRequest({
        repoOwner: "vercel",
        repoName: "viben-agent",
        branch: "feature/auto-pr",
        cloneUrl: "https://github.com/vercel/viben-agent",
        autoCommitPush: true,
        autoCreatePr: true,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createCalls[0]).toMatchObject({
      autoCommitPushOverride: true,
      autoCreatePrOverride: true,
    });
  });

  test("ignores a client agent_type and still provisions a work session", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      createJsonRequest({ agent_type: "chat", title: "Forged page chat" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createCalls[0]).toMatchObject({ agentType: "work" });
    expect(mocks.provisioningKickCalls).toHaveLength(1);
  });
});
