import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DEFAULT_SANDBOX_TIMEOUT_MS,
  DEFAULT_SANDBOX_VCPUS,
} from "@/lib/sandbox/config";
import { POST } from "./route";

interface TestSessionRecord {
  id: string;
  userId: string;
  lifecycleVersion: number;
  sandboxState: { type: "vercel" };
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  vercelTeamId: string | null;
  globalSkillRefs: Array<{ source: string; skillName: string }>;
}

interface TestVercelAuthInfo {
  token: string;
  expiresAt: number;
  externalId: string;
}

interface KickCall {
  sessionId: string;
  reason: string;
}

interface ConnectConfig {
  state: {
    type: "vercel";
    sandboxName?: string;
    source?: {
      repo?: string;
      branch?: string;
      newBranch?: string;
    };
  };
  options?: {
    githubToken?: string;
    gitUser?: {
      email?: string;
    };
    persistent?: boolean;
    resume?: boolean;
    createIfMissing?: boolean;
    timeout?: number;
    vcpus?: number;
  };
}

const state = vi.hoisted(() => ({
  kickCalls: [] as KickCall[],
  updateCalls: [] as Array<{
    sessionId: string;
    patch: Record<string, unknown>;
  }>,
  connectConfigs: [] as ConnectConfig[],
  writeFileCalls: [] as Array<{ path: string; content: string }>,
  execCalls: [] as Array<{ command: string; cwd: string; timeoutMs: number }>,
  dotenvSyncCalls: [] as Array<Record<string, unknown>>,
  sessionRecord: undefined as TestSessionRecord | undefined,
  currentVercelAuthInfo: null as TestVercelAuthInfo | null,
  currentDotenvContent: "",
  currentDotenvError: null as Error | null,
}));

vi.mock("server-only", () => ({}));

vi.mock("botid/server", () => ({
  checkBotId: async () => ({ isBot: false }),
}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => ({
    user: {
      id: "user-1",
      username: "nico",
      name: "Nico",
      email: "nico@example.com",
    },
  }),
}));

vi.mock("@/lib/github/users", () => ({
  getGitHubUserProfile: async () => ({
    externalUserId: "12345",
    username: "nico-gh",
  }),
}));

vi.mock("@/lib/github/urls", () => ({
  parseGitHubHttpsUrl: (repoUrl: string) => {
    let parsed: URL;
    try {
      parsed = new URL(repoUrl);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
      return null;
    }
    const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+?)(\.git)?$/);
    if (!match?.[1] || !match[2]) {
      return null;
    }
    return { owner: match[1], repo: match[2] };
  },
}));

vi.mock("@/lib/github/access", () => ({
  verifyRepoAccess: async () => ({
    ok: true,
    installationId: 999,
    repositoryId: 123,
    defaultBranch: "main",
  }),
  getRepoAccessErrorMessage: () => "Access denied",
}));

vi.mock("@/lib/github/app", () => ({
  mintInstallationToken: async () => ({
    token: "installation-token-mock",
    expiresAt: null,
    installationId: 999,
    repositoryIds: [123],
    permissions: { contents: "read" },
  }),
  revokeInstallationToken: async () => {},
}));

vi.mock("@/lib/vercel/token", () => ({
  getUserVercelAuthInfo: async () => state.currentVercelAuthInfo,
  getUserVercelToken: async () => state.currentVercelAuthInfo?.token ?? null,
}));

vi.mock("@/lib/vercel/projects", () => ({
  buildDevelopmentDotenvFromVercelProject: async (
    input: Record<string, unknown>,
  ) => {
    state.dotenvSyncCalls.push(input);
    if (state.currentDotenvError) {
      throw state.currentDotenvError;
    }
    return state.currentDotenvContent;
  },
}));

vi.mock("@/lib/db/sessions", () => ({
  getChatsBySessionId: async () => [],
  getSessionById: async () => state.sessionRecord,
  updateSession: async (sessionId: string, patch: Record<string, unknown>) => {
    state.updateCalls.push({ sessionId, patch });
    return {
      ...state.sessionRecord,
      ...patch,
    };
  },
}));

vi.mock("@/lib/sandbox/lifecycle-kick", () => ({
  kickSandboxLifecycleWorkflow: (input: KickCall) => {
    state.kickCalls.push(input);
  },
}));

vi.mock("@/lib/skills/global-skill-installer", () => ({
  installGlobalSkills: async (params: {
    sandbox: {
      workingDirectory: string;
      exec: (
        command: string,
        cwd: string,
        timeoutMs: number,
      ) => Promise<unknown>;
    };
    globalSkillRefs: Array<{ source: string; skillName: string }>;
  }) => {
    const homeResult = await params.sandbox.exec(
      'printf %s "$HOME"',
      params.sandbox.workingDirectory,
      5000,
    );
    const home =
      typeof homeResult === "object" &&
      homeResult !== null &&
      "stdout" in homeResult &&
      typeof homeResult.stdout === "string"
        ? homeResult.stdout
        : "/root";

    for (const ref of params.globalSkillRefs) {
      await params.sandbox.exec(
        `HOME='${home}' npx skills add '${ref.source}' --skill '${ref.skillName}' --agent amp -g -y --copy`,
        params.sandbox.workingDirectory,
        120000,
      );
    }
  },
}));

vi.mock("@viben/sandbox", () => ({
  connectSandbox: async (config: ConnectConfig) => {
    state.connectConfigs.push(config);

    return {
      currentBranch: "main",
      workingDirectory: "/vercel/sandbox",
      getState: () => ({
        type: "vercel" as const,
        sandboxName: config.state.sandboxName ?? "session_session-1",
        expiresAt: Date.now() + 120_000,
      }),
      exec: async (command: string, cwd: string, timeoutMs: number) => {
        state.execCalls.push({ command, cwd, timeoutMs });
        if (command === 'printf %s "$HOME"') {
          return {
            success: true,
            exitCode: 0,
            stdout: "/root",
            stderr: "",
            truncated: false,
          };
        }

        return {
          success: true,
          exitCode: 0,
          stdout: "",
          stderr: "",
          truncated: false,
        };
      },
      writeFile: async (path: string, content: string) => {
        state.writeFileCalls.push({ path, content });
      },
      stop: async () => {},
    };
  },
}));

describe("/api/sandbox lifecycle kicks", () => {
  beforeEach(() => {
    state.kickCalls.length = 0;
    state.updateCalls.length = 0;
    state.connectConfigs.length = 0;
    state.writeFileCalls.length = 0;
    state.execCalls.length = 0;
    state.dotenvSyncCalls.length = 0;
    state.currentVercelAuthInfo = {
      token: "vercel-token",
      expiresAt: 1_700_000_000,
      externalId: "user_ext_1",
    };
    state.currentDotenvContent = 'API_KEY="secret"\n';
    state.currentDotenvError = null;
    state.sessionRecord = {
      id: "session-1",
      userId: "user-1",
      lifecycleVersion: 3,
      sandboxState: { type: "vercel" },
      vercelProjectId: "project-1",
      vercelProjectName: "viben-web",
      vercelTeamId: "team-1",
      globalSkillRefs: [],
    };
  });

  test("uses session_<sessionId> as the persistent sandbox name", async () => {
    state.currentDotenvContent = "";
    state.sessionRecord!.vercelProjectId = null;
    state.sessionRecord!.vercelProjectName = null;
    state.sessionRecord!.vercelTeamId = null;

    const request = new Request("http://localhost/api/sandbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        sandboxType: "vercel",
      }),
    });

    const response = await POST(request);

    expect(response.ok).toBe(true);
    expect(state.kickCalls).toEqual([
      {
        sessionId: "session-1",
        reason: "sandbox-created",
      },
    ]);
    expect(state.connectConfigs[0]).toMatchObject({
      state: {
        type: "vercel",
        sandboxName: "session_session-1",
      },
      options: {
        timeout: DEFAULT_SANDBOX_TIMEOUT_MS,
        vcpus: DEFAULT_SANDBOX_VCPUS,
        persistent: true,
        resume: true,
        createIfMissing: true,
      },
    });
    expect(state.dotenvSyncCalls).toHaveLength(0);
  });

  test("repo sandboxes use a setup-only installation token instead of embedding it", async () => {
    state.sessionRecord!.vercelProjectId = null;
    state.sessionRecord!.vercelProjectName = null;
    state.sessionRecord!.vercelTeamId = null;

    const response = await POST(
      new Request("http://localhost/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-1",
          repoUrl: "https://github.com/acme/private-repo",
          branch: "main",
          sandboxType: "vercel",
        }),
      }),
    );

    expect(response.ok).toBe(true);
    expect(state.connectConfigs[0]).toMatchObject({
      state: {
        type: "vercel",
        sandboxName: "session_session-1",
        source: {
          repo: "https://github.com/acme/private-repo",
          branch: "main",
        },
      },
      options: {
        githubToken: "installation-token-mock",
      },
    });
    expect(state.connectConfigs[0]?.state.source).not.toHaveProperty("token");
  });

  test("rejects repo URLs that only contain github.com in the path", async () => {
    const response = await POST(
      new Request("http://localhost/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-1",
          repoUrl: "https://attacker.example/github.com/acme/private-repo",
          branch: "main",
          sandboxType: "vercel",
        }),
      }),
    );

    const payload = (await response.json()) as { error: string };
    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid GitHub repository URL");
    expect(state.connectConfigs).toHaveLength(0);
  });

  test("new vercel sandbox does not sync linked Development env vars while code is commented out", async () => {
    const request = new Request("http://localhost/api/sandbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        sandboxType: "vercel",
      }),
    });

    const response = await POST(request);

    expect(response.ok).toBe(true);
    expect(state.kickCalls).toEqual([
      {
        sessionId: "session-1",
        reason: "sandbox-created",
      },
    ]);
    expect(state.updateCalls.length).toBeGreaterThan(0);
    expect(state.connectConfigs[0]?.options?.gitUser?.email).toBe(
      "12345+nico-gh@users.noreply.github.com",
    );
    expect(state.dotenvSyncCalls).toHaveLength(0);
    expect(state.writeFileCalls).toEqual([]);

    const payload = (await response.json()) as {
      timeout: number;
      mode: string;
    };
    expect(payload.timeout).toBe(DEFAULT_SANDBOX_TIMEOUT_MS);
    expect(payload.mode).toBe("vercel");
  });

  test("commented-out env sync does not run during sandbox creation", async () => {
    state.currentDotenvError = new Error("boom");

    const response = await POST(
      new Request("http://localhost/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-1",
          sandboxType: "vercel",
        }),
      }),
    );

    expect(response.ok).toBe(true);
    expect(state.kickCalls).toEqual([
      {
        sessionId: "session-1",
        reason: "sandbox-created",
      },
    ]);
    expect(state.dotenvSyncCalls).toHaveLength(0);
    expect(state.writeFileCalls).toEqual([]);
  });

  test("new sandboxes install global skills", async () => {
    state.sessionRecord!.globalSkillRefs = [
      { source: "vercel/ai", skillName: "ai-sdk" },
    ];

    const response = await POST(
      new Request("http://localhost/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-1",
          sandboxType: "vercel",
        }),
      }),
    );

    expect(response.ok).toBe(true);
    expect(state.execCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'printf %s "$HOME"' }),
        expect.objectContaining({
          command:
            "HOME='/root' npx skills add 'vercel/ai' --skill 'ai-sdk' --agent amp -g -y --copy",
        }),
      ]),
    );
  });

  test("rejects unsupported sandbox types", async () => {
    const request = new Request("http://localhost/api/sandbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        sandboxType: "invalid",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid sandbox type");
    expect(state.connectConfigs).toHaveLength(0);
    expect(state.kickCalls).toHaveLength(0);
  });
});
