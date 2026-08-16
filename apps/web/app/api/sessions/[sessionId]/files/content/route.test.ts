import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

type AuthResult =
  | {
      ok: true;
      userId: string;
    }
  | {
      ok: false;
      response: Response;
    };

type TestSandboxState = {
  type: string;
  sandboxId?: string;
};

type OwnedSessionResult =
  | {
      ok: true;
      sessionRecord: {
        id: string;
        userId: string;
        sandboxState: TestSandboxState | null;
      };
    }
  | {
      ok: false;
      response: Response;
    };

type TestStats = {
  isDirectory(): boolean;
  isFile(): boolean;
  size: number;
};

const state = vi.hoisted(() => {
  const s = {
    connectCalls: [] as TestSandboxState[],
    statCalls: [] as string[],
    readFileCalls: [] as Array<{ path: string; encoding: "utf-8" }>,
    updateCalls: [] as Array<{
      sessionId: string;
      patch: Record<string, unknown>;
    }>,
    authResult: { ok: true, userId: "user-1" } as AuthResult,
    ownedSessionResult: {
      ok: true,
      sessionRecord: {
        id: "session-1",
        userId: "user-1",
        sandboxState: {
          type: "vercel",
          sandboxId: "sbx-1",
        },
      },
    } as OwnedSessionResult,
    connectSandboxError: null as Error | null,
    statImplementation: (async () => ({
      isDirectory: () => false,
      isFile: () => true,
      size: 42,
    })) as (path: string) => Promise<TestStats>,
    readFileImplementation: (async () => "export const answer = 42;\n") as (
      path: string,
      encoding: "utf-8",
    ) => Promise<string>,
  };
  return s;
});

vi.mock("@/app/api/sessions/_lib/session-context", () => ({
  requireAuthenticatedUser: async () => state.authResult,
  requireOwnedSessionWithSandboxGuard: async () => state.ownedSessionResult,
}));

vi.mock("@viben/sandbox", () => ({
  connectSandbox: async (sandboxState: TestSandboxState) => {
    if (state.connectSandboxError) {
      throw state.connectSandboxError;
    }

    state.connectCalls.push(sandboxState);
    return {
      workingDirectory: "/workspace",
      stat: async (path: string) => {
        state.statCalls.push(path);
        return state.statImplementation(path);
      },
      readFile: async (path: string, encoding: "utf-8") => {
        state.readFileCalls.push({ path, encoding });
        return state.readFileImplementation(path, encoding);
      },
    };
  },
}));

vi.mock("@/lib/db/sessions", () => ({
  updateSession: async (sessionId: string, patch: Record<string, unknown>) => {
    state.updateCalls.push({ sessionId, patch });
  },
}));

vi.mock("@/lib/sandbox/lifecycle", () => ({
  buildHibernatedLifecycleUpdate: () => ({ lifecycleState: "hibernated" }),
}));

vi.mock("@/lib/sandbox/utils", () => ({
  clearSandboxState: () => null,
  clearUnavailableSandboxState: () => null,
  hasRuntimeSandboxState: (state: TestSandboxState | null) =>
    Boolean(state?.sandboxId),
  isSandboxUnavailableError: (message: string) =>
    message.toLowerCase().includes("sandbox unavailable"),
}));

import * as route from "./route";

function createContext(sessionId = "session-1") {
  return {
    params: Promise.resolve({ sessionId }),
  };
}

describe("/api/sessions/[sessionId]/files/content", () => {
  beforeEach(() => {
    state.connectCalls.length = 0;
    state.statCalls.length = 0;
    state.readFileCalls.length = 0;
    state.updateCalls.length = 0;
    state.connectSandboxError = null;
    state.authResult = { ok: true, userId: "user-1" };
    state.ownedSessionResult = {
      ok: true,
      sessionRecord: {
        id: "session-1",
        userId: "user-1",
        sandboxState: {
          type: "vercel",
          sandboxId: "sbx-1",
        },
      },
    };
    state.statImplementation = async () => ({
      isDirectory: () => false,
      isFile: () => true,
      size: 42,
    });
    state.readFileImplementation = async () => "export const answer = 42;\n";
  });

  test("returns auth failures from the session guard", async () => {
    state.authResult = {
      ok: false,
      response: Response.json({ error: "Not authenticated" }, { status: 401 }),
    };
    const { GET } = route;

    const response = await GET(
      new Request(
        "http://localhost/api/sessions/session-1/files/content?path=apps/web/lib/test.ts",
      ),
      createContext(),
    );

    expect(response.status).toBe(401);
    expect(state.connectCalls).toHaveLength(0);
  });

  test("rejects invalid or traversing paths before connecting to the sandbox", async () => {
    const { GET } = route;

    const response = await GET(
      new Request(
        "http://localhost/api/sessions/session-1/files/content?path=../secrets.txt",
      ),
      createContext(),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid file path");
    expect(state.connectCalls).toHaveLength(0);
    expect(state.statCalls).toHaveLength(0);
  });

  test("returns a normalized file preview for valid workspace files", async () => {
    const { GET } = route;

    const response = await GET(
      new Request(
        "http://localhost/api/sessions/session-1/files/content?path=apps%5Cweb%5Clib%5Ctest%20file.ts",
      ),
      createContext(),
    );
    const body = (await response.json()) as {
      path: string;
      content: string;
      size: number;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      path: "apps/web/lib/test file.ts",
      content: "export const answer = 42;\n",
      size: 42,
    });
    expect(state.connectCalls).toEqual([
      {
        type: "vercel",
        sandboxId: "sbx-1",
      },
    ]);
    expect(state.statCalls).toEqual(["/workspace/apps/web/lib/test file.ts"]);
    expect(state.readFileCalls).toEqual([
      {
        path: "/workspace/apps/web/lib/test file.ts",
        encoding: "utf-8",
      },
    ]);
  });

  test("rejects directories instead of trying to read them", async () => {
    state.statImplementation = async () => ({
      isDirectory: () => true,
      isFile: () => false,
      size: 0,
    });
    const { GET } = route;

    const response = await GET(
      new Request(
        "http://localhost/api/sessions/session-1/files/content?path=apps/web/components",
      ),
      createContext(),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Directories cannot be previewed");
    expect(state.readFileCalls).toHaveLength(0);
  });

  test("returns not found when the file is missing", async () => {
    state.statImplementation = async () => {
      throw new Error(
        "ENOENT: no such file or directory, stat '/workspace/missing.ts'",
      );
    };
    const { GET } = route;

    const response = await GET(
      new Request(
        "http://localhost/api/sessions/session-1/files/content?path=apps/web/lib/missing.ts",
      ),
      createContext(),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("File not found");
    expect(state.readFileCalls).toHaveLength(0);
  });

  test("marks the session hibernated when the sandbox is unavailable", async () => {
    state.connectSandboxError = new Error("sandbox unavailable: connection closed");
    const { GET } = route;

    const response = await GET(
      new Request(
        "http://localhost/api/sessions/session-1/files/content?path=apps/web/lib/test.ts",
      ),
      createContext(),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe("Sandbox is unavailable. Please resume sandbox.");
    expect(state.updateCalls).toEqual([
      {
        sessionId: "session-1",
        patch: {
          sandboxState: null,
          lifecycleState: "hibernated",
        },
      },
    ]);
  });
});
