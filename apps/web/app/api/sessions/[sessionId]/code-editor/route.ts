import { connectSandbox } from "@viben/sandbox";
import {
  requireAuthenticatedUser,
  requireOwnedSessionWithSandboxGuard,
} from "@/app/api/sessions/_lib/session-context";
import {
  isManagedTemplateTrialUser,
  MANAGED_TEMPLATE_TRIAL_CODE_EDITOR_ERROR,
} from "@/lib/managed-template-trial";
import { CODE_SERVER_PORT, DEFAULT_SANDBOX_PORTS } from "@/lib/sandbox/config";
import { getServerSession } from "@/lib/session/get-server-session";
import { isSandboxActive } from "@/lib/sandbox/utils";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export type CodeEditorLaunchResponse = {
  url: string;
  port: number;
};

export type CodeEditorStatusResponse = {
  running: boolean;
  url: string | null;
  port: number;
};

export type CodeEditorStopResponse = {
  stopped: boolean;
};

const CODE_SERVER_PIDFILE = "/tmp/viben-agent-code-server.pid";
const CODE_SERVER_LOCKDIR = "/tmp/viben-agent-code-server.lock";

type ConnectedSandbox = Awaited<ReturnType<typeof connectSandbox>>;

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

async function connectCodeEditorSandbox(sessionId: string, userId: string) {
  const sessionContext = await requireOwnedSessionWithSandboxGuard({
    userId,
    sessionId,
    sandboxGuard: isSandboxActive,
    sandboxErrorMessage: "Resume the sandbox before opening the editor",
    sandboxErrorStatus: 409,
  });
  if (!sessionContext.ok) {
    return sessionContext;
  }

  const sandboxState = sessionContext.sessionRecord.sandboxState;
  if (!sandboxState) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "Resume the sandbox before opening the editor" },
        { status: 409 },
      ),
    };
  }

  const sandbox = await connectSandbox(sandboxState, {
    ports: DEFAULT_SANDBOX_PORTS,
  });

  return {
    ok: true as const,
    sandbox,
  };
}

async function getRunningCodeServerPid(
  sandbox: ConnectedSandbox,
): Promise<string | null> {
  try {
    const pid = (await sandbox.readFile(CODE_SERVER_PIDFILE, "utf-8")).trim();
    if (!/^[1-9][0-9]*$/.test(pid)) {
      console.warn("[code-editor] PID file contained invalid content, cleaning up");
      await sandbox.exec(
        `rm -f ${shellQuote(CODE_SERVER_PIDFILE)}`,
        "/tmp",
        5_000,
      );
      return null;
    }

    const checkResult = await sandbox.exec(`kill -0 ${pid}`, "/tmp", 5_000);
    if (!checkResult.success) {
      console.warn(`[code-editor] PID ${pid} from PID file is not alive, cleaning up`);
      await sandbox.exec(
        `rm -f ${shellQuote(CODE_SERVER_PIDFILE)}`,
        "/tmp",
        5_000,
      );
      return null;
    }

    return pid;
  } catch (error) {
    console.warn("[code-editor] Failed to check PID file:", error);
    return null;
  }
}

/**
 * Find code-server processes.
 *
 * Uses pgrep first (searches /proc/<pid>/cmdline), then ps as fallback.
 * System-installed code-server uses a config file, so --port / --bind-addr
 * won't appear in the command line — only check for "code-server" in the path.
 */
async function findCodeServerPid(
  sandbox: ConnectedSandbox,
): Promise<{ pid: string | null; method: string }> {
  // Method 1: pgrep (searches /proc/<pid>/cmdline directly)
  try {
    const pgrepResult = await sandbox.exec(
      "pgrep -f code-server",
      "/tmp",
      5_000,
    );
    if (pgrepResult.success) {
      for (const line of pgrepResult.stdout.trim().split("\n")) {
        const pid = line.trim();
        if (!pid || !/^[1-9][0-9]*$/.test(pid)) continue;
        const checkResult = await sandbox.exec(`kill -0 ${pid}`, "/tmp", 5_000);
        if (checkResult.success) {
          return { pid, method: "pgrep" };
        }
      }
    }
  } catch {
    // pgrep not available
  }

  // Method 2: ps (fallback)
  try {
    const psResult = await sandbox.exec("ps -eo pid=,args=", "/tmp", 5_000);
    if (psResult.success) {
      for (const line of psResult.stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^\s*([1-9][0-9]*)\s+(.*)$/);
        if (!match) continue;
        const [, pid, command] = match;
        if (!command.includes("code-server")) continue;
        const checkResult = await sandbox.exec(`kill -0 ${pid}`, "/tmp", 5_000);
        if (checkResult.success) {
          return { pid, method: "ps" };
        }
      }
    }
  } catch (error) {
    console.warn("[code-editor] Failed to scan process list:", error);
  }

  return { pid: null, method: "none" };
}

/**
 * Check if something is listening on the code-server port by attempting
 * a connection. Uses curl which is universally available in the sandbox
 * (ss/fuser/lsof are not installed).
 */
async function isPortInUse(
  sandbox: ConnectedSandbox,
  port: number,
): Promise<boolean> {
  const result = await sandbox.exec(
    `curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:${port}/healthz 2>/dev/null || curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:${port}/ 2>/dev/null`,
    "/tmp",
    10_000,
  );
  // Any HTTP response (even 302/404) means something is listening
  const code = Number.parseInt(result.stdout.trim(), 10);
  return result.success && !Number.isNaN(code) && code > 0;
}

async function findRunningCodeServerPid(
  sandbox: ConnectedSandbox,
): Promise<{ pid: string | null; method: string }> {
  // Check PID file first (fast path)
  const filePid = await getRunningCodeServerPid(sandbox);
  if (filePid) {
    return { pid: filePid, method: "pidfile" };
  }

  return findCodeServerPid(sandbox);
}

/**
 * Check if code-server is running, using a tracked PID first and then
 * a process-list lookup for code-server specifically.
 */
async function isCodeServerRunning(
  sandbox: ConnectedSandbox,
): Promise<boolean> {
  const { pid } = await findRunningCodeServerPid(sandbox);
  return pid !== null;
}

async function stopCodeServer(sandbox: ConnectedSandbox): Promise<boolean> {
  const { pid } = await findRunningCodeServerPid(sandbox);
  if (!pid) {
    await sandbox
      .exec(`rm -f ${shellQuote(CODE_SERVER_PIDFILE)}`, "/tmp", 5_000)
      .catch(() => undefined);
    return false;
  }

  await sandbox.exec(`kill ${pid} 2>/dev/null || true`, "/tmp", 5_000);
  await sandbox.exec(`rm -f ${shellQuote(CODE_SERVER_PIDFILE)}`, "/tmp", 5_000);

  const checkResult = await sandbox.exec(`kill -0 ${pid}`, "/tmp", 5_000);
  return !checkResult.success;
}

/**
 * Probe port 8000 to determine whether a running listener is code-server.
 * Uses healthz JSON — code-server returns {"status":"alive",...}.
 */
async function probeCodeServerPort(
  sandbox: ConnectedSandbox,
  port: number,
): Promise<"code-server" | "unknown" | "free"> {
  const result = await sandbox.exec(
    `curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:${port}/healthz 2>/dev/null`,
    "/tmp",
    10_000,
  );
  const code = Number.parseInt(result.stdout.trim(), 10);
  if (!result.success || Number.isNaN(code) || code === 0) {
    return "free";
  }

  // Check if healthz returns the code-server JSON signature
  try {
    const healthResult = await sandbox.exec(
      `curl -s --max-time 2 http://127.0.0.1:${port}/healthz 2>/dev/null`,
      "/tmp",
      10_000,
    );
    if (healthResult.success) {
      try {
        const body = JSON.parse(healthResult.stdout);
        if (body && typeof body === "object" && body.status === "alive") {
          return "code-server";
        }
      } catch {
        // Not JSON
      }
    }
  } catch {
    // Probe failed
  }

  return "unknown";
}

async function acquireCodeServerLaunchLock(
  sandbox: ConnectedSandbox,
): Promise<boolean> {
  const result = await sandbox.exec(
    `mkdir ${shellQuote(CODE_SERVER_LOCKDIR)}`,
    "/tmp",
    5_000,
  );
  return result.success;
}

async function releaseCodeServerLaunchLock(
  sandbox: ConnectedSandbox,
): Promise<void> {
  await sandbox
    .exec(`rmdir ${shellQuote(CODE_SERVER_LOCKDIR)}`, "/tmp", 5_000)
    .catch(() => undefined);
}

/**
 * Resolve a stale lock left by a previous POST that did not clean up.
 *
 * Scenarios:
 * - code-server is running → the previous launch succeeded, lock is truly stale
 * - another process is using the port → return conflict
 * - port is free → stale lock, remove it so we can launch fresh
 */
async function resolveStaleCodeServerLock(
  sandbox: ConnectedSandbox,
  port: number,
): Promise<"running" | "conflict" | "stale"> {
  console.warn("[code-editor] Stale lock detected, checking sandbox state...");

  if (await isCodeServerRunning(sandbox)) {
    console.warn("[code-editor] Stale lock resolved: code-server is running, returning success");
    return "running";
  }

  const probe = await probeCodeServerPort(sandbox, port);
  if (probe === "code-server") {
    console.warn("[code-editor] Stale lock resolved: HTTP confirms code-server, returning success");
    return "running";
  }
  if (probe === "unknown") {
    console.warn("[code-editor] Stale lock resolved: port in use by unknown process, conflict");
    return "conflict";
  }

  console.warn("[code-editor] Stale lock resolved: port is free, removing lock and retrying");
  await releaseCodeServerLaunchLock(sandbox);
  return "stale";
}

export async function GET(_req: Request, context: RouteContext) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { sessionId } = await context.params;

  try {
    const sandboxResult = await connectCodeEditorSandbox(
      sessionId,
      authResult.userId,
    );
    if (!sandboxResult.ok) {
      return sandboxResult.response;
    }

    const { sandbox } = sandboxResult;
    const port = CODE_SERVER_PORT;
    const running = await isCodeServerRunning(sandbox);

    return Response.json({
      running,
      url: running && sandbox.domain ? sandbox.domain(port) : null,
      port,
    } satisfies CodeEditorStatusResponse);
  } catch (error) {
    console.error("Failed to check code editor status:", error);
    return Response.json(
      { error: "Failed to check code editor status" },
      { status: 500 },
    );
  }
}

/**
 * Find a working code-server binary by probing known paths with --version.
 * System-installed code-server (via apt) lives at /usr/bin/code-server.
 */
async function findCodeServerBinary(
  sandbox: ConnectedSandbox,
): Promise<string | null> {
  const candidates = ["/usr/bin/code-server", "/usr/local/bin/code-server", "code-server"];
  for (const bin of candidates) {
    try {
      const result = await sandbox.exec(
        `${shellQuote(bin)} --version`,
        "/tmp",
        10_000,
      );
      if (result.success && result.stdout.trim().length > 0) {
        console.log(`[code-editor] Found working code-server at: ${bin}`);
        return bin;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

export async function POST(req: Request, context: RouteContext) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) {
    return authResult.response;
  }

  const session = await getServerSession();
  if (isManagedTemplateTrialUser(session, req.url)) {
    return Response.json(
      { error: MANAGED_TEMPLATE_TRIAL_CODE_EDITOR_ERROR },
      { status: 403 },
    );
  }

  const { sessionId } = await context.params;

  try {
    const sandboxResult = await connectCodeEditorSandbox(
      sessionId,
      authResult.userId,
    );
    if (!sandboxResult.ok) {
      return sandboxResult.response;
    }

    const { sandbox } = sandboxResult;
    if (!sandbox.execDetached) {
      return Response.json(
        { error: "Sandbox does not support background commands" },
        { status: 500 },
      );
    }

    if (!sandbox.domain) {
      return Response.json(
        { error: "Sandbox does not expose preview URLs" },
        { status: 500 },
      );
    }

    const port = CODE_SERVER_PORT;
    const workingDirectory = sandbox.workingDirectory;

    const hasLaunchLock = await acquireCodeServerLaunchLock(sandbox);
    if (!hasLaunchLock) {
      const staleResult = await resolveStaleCodeServerLock(sandbox, port);
      if (staleResult === "running") {
        return Response.json({
          url: sandbox.domain(port),
          port,
        } satisfies CodeEditorLaunchResponse);
      }
      if (staleResult === "conflict") {
        console.error(
          `[code-editor] Port ${port} is in use by an unknown process (not code-server)`,
        );
        return Response.json(
          { error: `Port ${port} is already in use by another process` },
          { status: 409 },
        );
      }
      // stale — lock was removed, retry acquisition once
      const retryLock = await acquireCodeServerLaunchLock(sandbox);
      if (!retryLock) {
        console.error(
          "[code-editor] Lock acquisition failed even after cleaning stale lock",
        );
        return Response.json(
          { error: "Code editor is already launching" },
          { status: 409 },
        );
      }
    }

    try {
      // Reuse an existing code-server process when we can positively identify it.
      if (await isCodeServerRunning(sandbox)) {
        console.log("[code-editor] Reusing existing code-server process");
        return Response.json({
          url: sandbox.domain(port),
          port,
        } satisfies CodeEditorLaunchResponse);
      }

      const probe = await probeCodeServerPort(sandbox, port);
      if (probe === "code-server") {
        console.log(
          "[code-editor] HTTP confirms code-server is running, reusing",
        );
        return Response.json({
          url: sandbox.domain(port),
          port,
        } satisfies CodeEditorLaunchResponse);
      }
      if (probe === "unknown") {
        console.error(
          `[code-editor] Port ${port} in use by unknown process, refusing to launch`,
        );
        return Response.json(
          { error: `Port ${port} is already in use by another process` },
          { status: 409 },
        );
      }

      // Find a working code-server binary (system-installed preferred)
      const codeServerBin = await findCodeServerBinary(sandbox);
      if (!codeServerBin) {
        console.error("[code-editor] No working code-server binary found");
        return Response.json(
          { error: "code-server is not installed in the sandbox" },
          { status: 500 },
        );
      }

      // Launch code-server in detached mode
      const launchCommand = [
        `printf '%s' "$$" > ${shellQuote(CODE_SERVER_PIDFILE)}`,
        `exec ${shellQuote(codeServerBin)} --port ${port} --auth none --bind-addr 0.0.0.0:${port} --disable-telemetry ${shellQuote(workingDirectory)}`,
      ].join(" && ");

      try {
        await sandbox.execDetached(launchCommand, workingDirectory);
      } catch (error) {
        await sandbox
          .exec(
            `rm -f ${shellQuote(CODE_SERVER_PIDFILE)}`,
            workingDirectory,
            5_000,
          )
          .catch(() => undefined);
        throw error;
      }

      return Response.json({
        url: sandbox.domain(port),
        port,
      } satisfies CodeEditorLaunchResponse);
    } finally {
      await releaseCodeServerLaunchLock(sandbox);
    }
  } catch (error) {
    console.error("Failed to launch code editor:", error);
    return Response.json(
      { error: "Failed to launch code editor" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { sessionId } = await context.params;

  try {
    const sandboxResult = await connectCodeEditorSandbox(
      sessionId,
      authResult.userId,
    );
    if (!sandboxResult.ok) {
      return sandboxResult.response;
    }

    const stopped = await stopCodeServer(sandboxResult.sandbox);

    return Response.json({ stopped } satisfies CodeEditorStopResponse);
  } catch (error) {
    console.error("Failed to stop code editor:", error);
    return Response.json(
      { error: "Failed to stop code editor" },
      { status: 500 },
    );
  }
}
