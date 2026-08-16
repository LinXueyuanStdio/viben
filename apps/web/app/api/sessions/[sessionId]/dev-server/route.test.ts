import { beforeEach, describe, expect, test, vi } from "vitest";

type MockPathEntry = {
  type: "file" | "directory";
  mtimeMs: number;
  size: number;
};

const state = vi.hoisted(() => {
  const DEV_SERVER_PID_FILE =
    "/vercel/sandbox/apps/web/.viben-agent-dev-server-3000.pid";
  const DEV_SERVER_STATE_FILE =
    "/vercel/sandbox/.viben-agent-dev-server-state.json";
  const RUNNING_PID = "4242";

  const currentSessionRecord = {
    userId: "user-1",
    sandboxState: {
      type: "vercel" as const,
      sandboxId: "sandbox-1",
      expiresAt: Date.now() + 60_000,
    },
  };

  const s = {
    currentFindOutput: "./package.json\n./apps/web/package.json\n",
    fileContents: new Map<string, string>(),
    existingPaths: new Set<string>(),
    pathEntries: new Map<string, MockPathEntry>(),
    runningPids: new Set<string>(),
    lastLaunchCommand: null as string | null,
    lastLaunchCwd: null as string | null,
    currentMtimeMs: 1_000,
  };

  function successResult(stdout = "") {
    return {
      success: true,
      exitCode: 0,
      stdout,
      stderr: "",
      truncated: false,
    };
  }

  function failureResult(stderr: string) {
    return {
      success: false,
      exitCode: 1,
      stdout: "",
      stderr,
      truncated: false,
    };
  }

  function nextMtime(): number {
    s.currentMtimeMs += 100;
    return s.currentMtimeMs;
  }

  function setMockFile(filePath: string, content: string, mtimeMs = nextMtime()) {
    s.fileContents.set(filePath, content);
    s.existingPaths.add(filePath);
    s.pathEntries.set(filePath, {
      type: "file",
      mtimeMs,
      size: content.length,
    });
  }

  function setMockDirectory(dirPath: string, mtimeMs = nextMtime()) {
    s.existingPaths.add(dirPath);
    s.pathEntries.set(dirPath, {
      type: "directory",
      mtimeMs,
      size: 0,
    });
  }

  function removeMockPath(targetPath: string) {
    s.existingPaths.delete(targetPath);
    s.fileContents.delete(targetPath);
    s.pathEntries.delete(targetPath);
  }

  function seedDefaultWorkspace() {
    s.currentFindOutput = "./package.json\n./apps/web/package.json\n";

    setMockDirectory("/vercel/sandbox");
    setMockDirectory("/vercel/sandbox/apps");
    setMockDirectory("/vercel/sandbox/apps/web");

    setMockFile(
      "/vercel/sandbox/package.json",
      JSON.stringify({
        packageManager: "bun@1.2.14",
        scripts: {
          dev: "turbo dev",
        },
      }),
    );
    setMockFile(
      "/vercel/sandbox/apps/web/package.json",
      JSON.stringify({
        scripts: {
          dev: "next dev",
        },
        dependencies: {
          next: "15.0.0",
        },
      }),
    );
    setMockFile("/vercel/sandbox/bun.lock", "");
  }

  const requireAuthenticatedUserMock = vi.fn(async () => ({
    ok: true as const,
    userId: "user-1",
  }));
  const requireOwnedSessionWithSandboxGuardMock = vi.fn(async () => ({
    ok: true as const,
    sessionRecord: currentSessionRecord,
  }));
  const execMock = vi.fn(async (command: string) => {
    if (command.includes("find .")) {
      return successResult(s.currentFindOutput);
    }

    if (command.startsWith("kill -0 ")) {
      const pid = command.slice("kill -0 ".length).trim();
      return s.runningPids.has(pid)
        ? successResult()
        : failureResult(`No such process: ${pid}`);
    }

    if (command.startsWith("kill ")) {
      const pid = command.match(/^kill ([0-9]+)/)?.[1];
      if (pid) {
        s.runningPids.delete(pid);
      }
      return successResult();
    }

    if (command.startsWith("rm -f ")) {
      const filePath = command.match(/^rm -f '(.+)'$/)?.[1];
      if (filePath) {
        removeMockPath(filePath);
      }
      return successResult();
    }

    throw new Error(`Unexpected exec command: ${command}`);
  });
  const readFileMock = vi.fn(async (filePath: string) => {
    const content = s.fileContents.get(filePath);
    if (content === undefined) {
      throw new Error(`Missing file: ${filePath}`);
    }
    return content;
  });
  const writeFileMock = vi.fn(async (filePath: string, content: string) => {
    setMockFile(filePath, content);
  });
  const statMock = vi.fn(async (filePath: string) => {
    const entry = s.pathEntries.get(filePath);
    if (!entry) {
      throw new Error(`ENOENT: ${filePath}`);
    }

    return {
      isDirectory: () => entry.type === "directory",
      isFile: () => entry.type === "file",
      size: entry.size,
      mtimeMs: entry.mtimeMs,
    };
  });
  const accessMock = vi.fn(async (filePath: string) => {
    if (!s.existingPaths.has(filePath)) {
      throw new Error(`ENOENT: ${filePath}`);
    }
  });
  const execDetachedMock = vi.fn(async (command: string, cwd: string) => {
    s.lastLaunchCommand = command;
    s.lastLaunchCwd = cwd;

    const pidFilePath = command.match(
      /> '([^']+\.viben-agent-dev-server-[0-9]+\.pid)'/,
    )?.[1];
    if (pidFilePath) {
      setMockFile(pidFilePath, `${RUNNING_PID}\n`);
      s.runningPids.add(RUNNING_PID);
    }

    return { commandId: "cmd-1" };
  });
  const domainMock = vi.fn((port: number) => `https://sb-${port}.vercel.run`);
  const connectSandboxMock = vi.fn(async () => ({
    workingDirectory: "/vercel/sandbox",
    exec: execMock,
    readFile: readFileMock,
    writeFile: writeFileMock,
    stat: statMock,
    access: accessMock,
    execDetached: execDetachedMock,
    domain: domainMock,
  }));

  return Object.assign(s, {
    DEV_SERVER_PID_FILE,
    DEV_SERVER_STATE_FILE,
    RUNNING_PID,
    currentSessionRecord,
    seedDefaultWorkspace,
    setMockFile,
    setMockDirectory,
    requireAuthenticatedUserMock,
    requireOwnedSessionWithSandboxGuardMock,
    execMock,
    readFileMock,
    writeFileMock,
    statMock,
    accessMock,
    execDetachedMock,
    domainMock,
    connectSandboxMock,
  });
});

vi.mock("@/app/api/sessions/_lib/session-context", () => ({
  requireAuthenticatedUser: state.requireAuthenticatedUserMock,
  requireOwnedSessionWithSandboxGuard:
    state.requireOwnedSessionWithSandboxGuardMock,
}));

vi.mock("@viben/sandbox", () => ({
  connectSandbox: state.connectSandboxMock,
}));

import * as route from "./route";

function createRouteContext(sessionId = "session-1") {
  return {
    params: Promise.resolve({ sessionId }),
  };
}

describe("/api/sessions/[sessionId]/dev-server", () => {
  beforeEach(() => {
    state.currentMtimeMs = 1_000;
    state.fileContents = new Map();
    state.existingPaths = new Set<string>();
    state.pathEntries = new Map<string, MockPathEntry>();
    state.seedDefaultWorkspace();
    state.runningPids = new Set<string>();
    state.lastLaunchCommand = null;
    state.lastLaunchCwd = null;
    state.currentSessionRecord.sandboxState.expiresAt = Date.now() + 60_000;
    state.requireAuthenticatedUserMock.mockClear();
    state.requireOwnedSessionWithSandboxGuardMock.mockClear();
    state.connectSandboxMock.mockClear();
    state.execMock.mockClear();
    state.readFileMock.mockClear();
    state.writeFileMock.mockClear();
    state.statMock.mockClear();
    state.accessMock.mockClear();
    state.execDetachedMock.mockClear();
    state.domainMock.mockClear();
  });

  test("prefers a direct app dev script over a root workspace orchestrator and returns its preview URL", async () => {
    const { POST } = route;

    const response = await POST(
      new Request("http://localhost/api/sessions/session-1/dev-server", {
        method: "POST",
      }),
      createRouteContext(),
    );
    const body = (await response.json()) as {
      packagePath: string;
      port: number;
      url: string;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      packagePath: "apps/web",
      port: 3000,
      url: "https://sb-3000.vercel.run",
    });
    expect(state.connectSandboxMock).toHaveBeenCalledWith(
      state.currentSessionRecord.sandboxState,
      { ports: [3000, 5173, 4321, 8000] },
    );
    expect(state.execDetachedMock).toHaveBeenCalledTimes(1);
    expect(state.lastLaunchCwd).toBe("/vercel/sandbox/apps/web");
    expect(state.lastLaunchCommand).not.toBeNull();
    expect(state.existingPaths.has(state.DEV_SERVER_PID_FILE)).toBe(true);
    expect(state.existingPaths.has(state.DEV_SERVER_STATE_FILE)).toBe(true);
    expect(state.fileContents.get(state.DEV_SERVER_STATE_FILE)).toBe(
      JSON.stringify({ packageDir: "apps/web", port: 3000 }),
    );
    expect(state.runningPids.has(state.RUNNING_PID)).toBe(true);

    if (!state.lastLaunchCommand) {
      throw new Error("Expected execDetached to receive a launch command");
    }

    expect(state.lastLaunchCommand).toContain(state.DEV_SERVER_PID_FILE);
    expect(state.lastLaunchCommand).toContain("bun install");
    expect(state.lastLaunchCommand).toContain("bun run dev");
    expect(state.lastLaunchCommand).toContain("--hostname 0.0.0.0 --port 3000");
  });

  test("returns the existing preview URL without relaunching when the dev server is already running", async () => {
    const { POST } = route;

    state.setMockFile(state.DEV_SERVER_PID_FILE, `${state.RUNNING_PID}\n`);
    state.setMockFile(
      state.DEV_SERVER_STATE_FILE,
      JSON.stringify({ packageDir: "apps/web", port: 3000 }),
    );
    state.runningPids.add(state.RUNNING_PID);

    const response = await POST(
      new Request("http://localhost/api/sessions/session-1/dev-server", {
        method: "POST",
      }),
      createRouteContext(),
    );
    const body = (await response.json()) as {
      packagePath: string;
      port: number;
      url: string;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      packagePath: "apps/web",
      port: 3000,
      url: "https://sb-3000.vercel.run",
    });
    expect(state.execDetachedMock).toHaveBeenCalledTimes(0);
  });

  test("keeps using the launched app when package discovery later prefers another app", async () => {
    const { POST } = route;

    const firstResponse = await POST(
      new Request("http://localhost/api/sessions/session-1/dev-server", {
        method: "POST",
      }),
      createRouteContext(),
    );
    expect(firstResponse.status).toBe(200);

    state.setMockDirectory("/vercel/sandbox/apps/admin");
    state.setMockFile(
      "/vercel/sandbox/apps/admin/package.json",
      JSON.stringify({
        scripts: {
          dev: "next dev",
        },
        dependencies: {
          next: "15.0.0",
        },
      }),
    );
    state.currentFindOutput =
      "./apps/admin/package.json\n./apps/web/package.json\n./package.json\n";

    const response = await POST(
      new Request("http://localhost/api/sessions/session-1/dev-server", {
        method: "POST",
      }),
      createRouteContext(),
    );
    const body = (await response.json()) as {
      packagePath: string;
      port: number;
      url: string;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      packagePath: "apps/web",
      port: 3000,
      url: "https://sb-3000.vercel.run",
    });
    expect(state.execDetachedMock).toHaveBeenCalledTimes(1);
  });

  test("stops the running dev server even when package discovery later prefers another app", async () => {
    const { DELETE, POST } = route;

    const launchResponse = await POST(
      new Request("http://localhost/api/sessions/session-1/dev-server", {
        method: "POST",
      }),
      createRouteContext(),
    );
    expect(launchResponse.status).toBe(200);

    state.setMockDirectory("/vercel/sandbox/apps/admin");
    state.setMockFile(
      "/vercel/sandbox/apps/admin/package.json",
      JSON.stringify({
        scripts: {
          dev: "next dev",
        },
        dependencies: {
          next: "15.0.0",
        },
      }),
    );
    state.currentFindOutput =
      "./apps/admin/package.json\n./apps/web/package.json\n./package.json\n";

    const response = await DELETE(
      new Request("http://localhost/api/sessions/session-1/dev-server", {
        method: "DELETE",
      }),
      createRouteContext(),
    );
    const body = (await response.json()) as {
      stopped: boolean;
      packagePath: string;
      port: number;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      stopped: true,
      packagePath: "apps/web",
      port: 3000,
    });
    expect(state.runningPids.has(state.RUNNING_PID)).toBe(false);
    expect(state.existingPaths.has(state.DEV_SERVER_PID_FILE)).toBe(false);
    expect(state.existingPaths.has(state.DEV_SERVER_STATE_FILE)).toBe(false);
  });

  test("reinstalls dependencies when a package manifest changed after node_modules was created", async () => {
    const { POST } = route;

    state.setMockDirectory("/vercel/sandbox/node_modules", 5_000);
    state.setMockFile(
      "/vercel/sandbox/apps/web/package.json",
      JSON.stringify({
        scripts: {
          dev: "next dev",
        },
        dependencies: {
          next: "15.0.0",
          react: "19.0.0",
        },
      }),
      6_000,
    );

    const response = await POST(
      new Request("http://localhost/api/sessions/session-1/dev-server", {
        method: "POST",
      }),
      createRouteContext(),
    );

    expect(response.status).toBe(200);
    expect(state.lastLaunchCommand).not.toBeNull();

    if (!state.lastLaunchCommand) {
      throw new Error("Expected execDetached to receive a launch command");
    }

    expect(state.lastLaunchCommand).toContain("bun install");
  });

  test("skips dependency install when node_modules is newer than manifests and lockfiles", async () => {
    const { POST } = route;

    state.setMockDirectory("/vercel/sandbox/node_modules", 10_000);

    const response = await POST(
      new Request("http://localhost/api/sessions/session-1/dev-server", {
        method: "POST",
      }),
      createRouteContext(),
    );

    expect(response.status).toBe(200);
    expect(state.lastLaunchCommand).not.toBeNull();

    if (!state.lastLaunchCommand) {
      throw new Error("Expected execDetached to receive a launch command");
    }

    expect(state.lastLaunchCommand).not.toContain("bun install");
  });

  test("returns 404 when no supported dev script is found", async () => {
    const { POST } = route;

    state.fileContents = new Map();
    state.existingPaths = new Set<string>();
    state.pathEntries = new Map<string, MockPathEntry>();
    state.setMockDirectory("/vercel/sandbox");
    state.setMockFile(
      "/vercel/sandbox/package.json",
      JSON.stringify({
        scripts: {
          test: "bun test",
        },
      }),
    );
    state.currentFindOutput = "./package.json\n";

    const response = await POST(
      new Request("http://localhost/api/sessions/session-1/dev-server", {
        method: "POST",
      }),
      createRouteContext(),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe(
      "No supported dev script found in package.json files",
    );
    expect(state.execDetachedMock).toHaveBeenCalledTimes(0);
  });
});
