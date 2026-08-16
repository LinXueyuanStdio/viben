import { beforeEach, describe, expect, test, vi } from "vitest";

const state = vi.hoisted(() => {
  const CODE_EDITOR_PID_FILE = "/tmp/viben-agent-code-server.pid";
  const CODE_EDITOR_LOCK_DIR = "/tmp/viben-agent-code-server.lock";
  const RUNNING_CODE_SERVER_PID = "9001";

  const currentSessionRecord = {
    userId: "user-1",
    sandboxState: {
      type: "vercel" as const,
      sandboxId: "sandbox-1",
      expiresAt: Date.now() + 60_000,
    },
  };

  const s = {
    fileContents: new Map<string, string>(),
    directories: new Set<string>(),
    runningPids: new Set<string>(),
    processListOutput: "",
    portProbeStatusCode: null as string | null,
    // Controls what healthz content probe returns — null = not code-server, "alive" = code-server
    healthzBody: null as string | null,
    lastLaunchCommand: null as string | null,
    lastLaunchCwd: null as string | null,
    currentAuthSession: null as {
      authProvider?: "vercel" | "github";
      user: {
        id: string;
        email?: string;
      };
    } | null,
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

  function removeProcessFromList(pid: string) {
    s.processListOutput = s.processListOutput
      .split("\n")
      .filter((line) => !line.trimStart().startsWith(`${pid} `))
      .join("\n");
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
    if (command === "'/usr/bin/code-server' --version") {
      return successResult("v4.99.0");
    }

    if (command === "'/usr/local/bin/code-server' --version") {
      return failureResult("Cannot find module '/usr/local'");
    }

    if (command === "'code-server' --version") {
      return successResult("v4.99.0");
    }

    if (command === "pgrep -f code-server") {
      // Return PIDs of running code-server processes from the simulated process list
      const pids = s.processListOutput
        .split("\n")
        .filter((line) => line.includes("code-server"))
        .map((line) => line.trim().match(/^\s*([1-9][0-9]*)/)?.[1])
        .filter(
          (pid): pid is string => pid !== undefined && s.runningPids.has(pid),
        );
      return pids.length > 0
        ? successResult(pids.join("\n"))
        : failureResult("no match");
    }

    if (command === "ps -eo pid=,args=") {
      return successResult(s.processListOutput);
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
        removeProcessFromList(pid);
      }
      return successResult();
    }

    if (command.startsWith("rm -f ")) {
      const filePath = command.match(/^rm -f '(.+)'$/)?.[1];
      if (filePath) {
        s.fileContents.delete(filePath);
      }
      return successResult();
    }

    if (command === `mkdir '${CODE_EDITOR_LOCK_DIR}'`) {
      if (s.directories.has(CODE_EDITOR_LOCK_DIR)) {
        return failureResult("File exists");
      }
      s.directories.add(CODE_EDITOR_LOCK_DIR);
      return successResult();
    }

    if (command === `rmdir '${CODE_EDITOR_LOCK_DIR}'`) {
      s.directories.delete(CODE_EDITOR_LOCK_DIR);
      return successResult();
    }

    if (command.includes("curl -s -o /dev/null")) {
      return s.portProbeStatusCode === null
        ? failureResult("connection refused")
        : successResult(s.portProbeStatusCode);
    }

    // probeCodeServerPort: curl to read healthz body (no -o /dev/null)
    if (command.includes("curl -s --max-time 2 http://127.0.0.1:8000/healthz")) {
      if (s.healthzBody !== null) {
        return successResult(s.healthzBody);
      }
      return failureResult("connection refused");
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
  const execDetachedMock = vi.fn(async (command: string, cwd: string) => {
    s.lastLaunchCommand = command;
    s.lastLaunchCwd = cwd;

    s.fileContents.set(CODE_EDITOR_PID_FILE, `${RUNNING_CODE_SERVER_PID}\n`);
    s.runningPids.add(RUNNING_CODE_SERVER_PID);
    s.processListOutput = ` ${RUNNING_CODE_SERVER_PID} code-server --port 8000 --auth none --bind-addr 0.0.0.0:8000 /vercel/sandbox\n`;

    return { commandId: "cmd-1" };
  });
  const domainMock = vi.fn((port: number) => `https://sb-${port}.vercel.run`);
  const connectSandboxMock = vi.fn(async () => ({
    workingDirectory: "/vercel/sandbox",
    exec: execMock,
    readFile: readFileMock,
    execDetached: execDetachedMock,
    domain: domainMock,
  }));

  return Object.assign(s, {
    CODE_EDITOR_PID_FILE,
    CODE_EDITOR_LOCK_DIR,
    RUNNING_CODE_SERVER_PID,
    currentSessionRecord,
    requireAuthenticatedUserMock,
    requireOwnedSessionWithSandboxGuardMock,
    execMock,
    readFileMock,
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

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.currentAuthSession,
}));

import * as route from "./route";

function createRouteContext(sessionId = "session-1") {
  return {
    params: Promise.resolve({ sessionId }),
  };
}

describe("/api/sessions/[sessionId]/code-editor", () => {
  beforeEach(() => {
    state.fileContents = new Map<string, string>();
    state.directories = new Set<string>();
    state.runningPids = new Set<string>();
    state.processListOutput = "";
    state.portProbeStatusCode = null;
    state.healthzBody = null;
    state.lastLaunchCommand = null;
    state.lastLaunchCwd = null;
    state.currentAuthSession = null;
    state.currentSessionRecord.sandboxState.expiresAt = Date.now() + 60_000;
    state.requireAuthenticatedUserMock.mockClear();
    state.requireOwnedSessionWithSandboxGuardMock.mockClear();
    state.connectSandboxMock.mockClear();
    state.execMock.mockClear();
    state.readFileMock.mockClear();
    state.execDetachedMock.mockClear();
    state.domainMock.mockClear();
  });

  test("GET ignores unrelated processes that happen to use the editor port", async () => {
    const { GET } = route;

    state.processListOutput = " 4321 python -m http.server 8000\n";
    state.runningPids.add("4321");
    state.portProbeStatusCode = "200";

    const response = await GET(
      new Request("http://localhost/api/sessions/session-1/code-editor"),
      createRouteContext(),
    );
    const body = (await response.json()) as {
      running: boolean;
      url: string | null;
      port: number;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      running: false,
      url: null,
      port: 8000,
    });
  });

  test("POST returns a conflict instead of opening an unrelated app on the editor port", async () => {
    const { POST } = route;

    // Simulate a non-code-server process on port 8000
    state.processListOutput = " 4321 python -m http.server 8000\n";
    state.runningPids.add("4321");
    state.portProbeStatusCode = "200";
    state.healthzBody = null; // Not code-server healthz

    const response = await POST(
      new Request("http://localhost/api/sessions/session-1/code-editor", {
        method: "POST",
      }),
      createRouteContext(),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: "Port 8000 is already in use by another process",
    });
    expect(state.execDetachedMock).toHaveBeenCalledTimes(0);
  });

  test("POST reuses an existing code-server process found via process list when the pid file is missing", async () => {
    const { POST } = route;

    state.processListOutput =
      " 9001 code-server --port 8000 --auth none --bind-addr 0.0.0.0:8000 /vercel/sandbox\n";
    state.runningPids.add(state.RUNNING_CODE_SERVER_PID);

    const response = await POST(
      new Request("http://localhost/api/sessions/session-1/code-editor", {
        method: "POST",
      }),
      createRouteContext(),
    );
    const body = (await response.json()) as { url: string; port: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      url: "https://sb-8000.vercel.run",
      port: 8000,
    });
    expect(state.execDetachedMock).toHaveBeenCalledTimes(0);
  });

  test("POST returns 403 for managed-template trial users", async () => {
    state.currentAuthSession = {
      authProvider: "vercel",
      user: {
        id: "user-1",
        email: "person@example.com",
      },
    };
    const { POST } = route;
    const expectedError =
      "The code editor is disabled in the hosted demo. Deploy your own copy to unlock the full Viben Assistant template.";

    const response = await POST(
      new Request(
        "https://viben-web.vercel.app/api/sessions/session-1/code-editor",
        {
          method: "POST",
        },
      ),
      createRouteContext(),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe(expectedError);
    expect(state.connectSandboxMock).toHaveBeenCalledTimes(0);
    expect(state.execDetachedMock).toHaveBeenCalledTimes(0);
  });

  test("DELETE does not claim success when only another app is using the editor port", async () => {
    const { DELETE } = route;

    state.processListOutput = " 4321 python -m http.server 8000\n";
    state.runningPids.add("4321");
    state.portProbeStatusCode = "200";

    const response = await DELETE(
      new Request("http://localhost/api/sessions/session-1/code-editor", {
        method: "DELETE",
      }),
      createRouteContext(),
    );
    const body = (await response.json()) as { stopped: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ stopped: false });
    expect(state.runningPids.has("4321")).toBe(true);
  });

  test("POST launches code-server when the port is free", async () => {
    const { POST } = route;

    const response = await POST(
      new Request("http://localhost/api/sessions/session-1/code-editor", {
        method: "POST",
      }),
      createRouteContext(),
    );
    const body = (await response.json()) as { url: string; port: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      url: "https://sb-8000.vercel.run",
      port: 8000,
    });
    expect(state.execDetachedMock).toHaveBeenCalledTimes(1);
    expect(state.lastLaunchCwd).toBe("/vercel/sandbox");
    expect(state.lastLaunchCommand).toContain("code-server");
    expect(state.lastLaunchCommand).toContain("--port 8000");
    expect(state.fileContents.get(state.CODE_EDITOR_PID_FILE)).toBe(
      `${state.RUNNING_CODE_SERVER_PID}\n`,
    );
  });

  test("POST recovers from stale lock when code-server is already running", async () => {
    const { POST } = route;

    // Simulate a stale lock left by a previous failed launch
    state.directories.add(state.CODE_EDITOR_LOCK_DIR);

    // Simulate code-server running (as the user's investigation showed)
    state.fileContents.set(
      state.CODE_EDITOR_PID_FILE,
      `${state.RUNNING_CODE_SERVER_PID}\n`,
    );
    state.runningPids.add(state.RUNNING_CODE_SERVER_PID);
    state.processListOutput =
      ` ${state.RUNNING_CODE_SERVER_PID} code-server --port 8000 --auth none --bind-addr 0.0.0.0:8000 /vercel/sandbox\n`;

    const response = await POST(
      new Request("http://localhost/api/sessions/session-1/code-editor", {
        method: "POST",
      }),
      createRouteContext(),
    );
    const body = (await response.json()) as { url: string; port: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      url: "https://sb-8000.vercel.run",
      port: 8000,
    });
    // Lock was not cleaned up — code-server is running so we just return success
    expect(state.directories.has(state.CODE_EDITOR_LOCK_DIR)).toBe(true);
    // Should not have launched a new instance
    expect(state.execDetachedMock).toHaveBeenCalledTimes(0);
  });

  test("POST recovers from stale lock and launches when port is free", async () => {
    const { POST } = route;

    // Simulate a stale lock with no code-server running
    state.directories.add(state.CODE_EDITOR_LOCK_DIR);

    const response = await POST(
      new Request("http://localhost/api/sessions/session-1/code-editor", {
        method: "POST",
      }),
      createRouteContext(),
    );
    const body = (await response.json()) as { url: string; port: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      url: "https://sb-8000.vercel.run",
      port: 8000,
    });
    // Stale lock was cleaned and a new code-server was launched
    expect(state.directories.has(state.CODE_EDITOR_LOCK_DIR)).toBe(false);
    expect(state.execDetachedMock).toHaveBeenCalledTimes(1);
  });
});
