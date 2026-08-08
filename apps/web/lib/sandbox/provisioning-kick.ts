import "server-only";

import { start, getRun } from "workflow/api";
import { sandboxProvisioningWorkflow } from "@/app/workflows/sandbox-provisioning";
import {
  clearSessionSandboxProvisioningRunIdIfOwned,
  claimSessionSandboxProvisioningRunId,
  getSessionById,
  updateSession,
} from "@/lib/db/sessions";
import { isSandboxActive } from "@/lib/sandbox/utils";

type KickSandboxProvisioningResult =
  | {
      status: "started" | "existing";
      runId: string;
    }
  | {
      status: "active" | "skipped";
      runId?: undefined;
    };

async function isRunStillLive(runId: string): Promise<boolean> {
  try {
    const run = getRun(runId);
    if (!(await run.exists)) {
      return false;
    }
    const status = await run.status;
    return status === "pending" || status === "running";
  } catch {
    return false;
  }
}

export async function kickSandboxProvisioningWorkflow(
  sessionId: string,
): Promise<KickSandboxProvisioningResult> {
  const session = await getSessionById(sessionId);
  if (!session) {
    console.log("[sandbox:kick] session not found", { sessionId });
    return { status: "skipped" };
  }
  if (session.status === "archived") {
    console.log("[sandbox:kick] session archived", { sessionId });
    return { status: "skipped" };
  }
  if (isSandboxActive(session.sandboxState)) {
    console.log("[sandbox:kick] sandbox already active", { sessionId });
    return { status: "active" };
  }

  if (session.sandboxProvisioningRunId) {
    const live = await isRunStillLive(session.sandboxProvisioningRunId);
    if (live) {
      console.log("[sandbox:kick] existing run still live", { sessionId, runId: session.sandboxProvisioningRunId });
      return {
        status: "existing",
        runId: session.sandboxProvisioningRunId,
      };
    }
    const cleared = await clearSessionSandboxProvisioningRunIdIfOwned(
      sessionId,
      session.sandboxProvisioningRunId,
    );
    if (!cleared) {
      const latest = await getSessionById(sessionId);
      if (!latest || latest.status === "archived") {
        console.log("[sandbox:kick] session gone/archived after clear", { sessionId });
        return { status: "skipped" };
      }
      if (isSandboxActive(latest.sandboxState)) {
        console.log("[sandbox:kick] sandbox active after clear", { sessionId });
        return { status: "active" };
      }
      if (latest.sandboxProvisioningRunId) {
        console.log("[sandbox:kick] different run claimed", { sessionId, runId: latest.sandboxProvisioningRunId });
        return { status: "existing", runId: latest.sandboxProvisioningRunId };
      }
    }
  }

  console.log("[sandbox:kick] starting provisioning workflow", { sessionId });
  const run = await start(sandboxProvisioningWorkflow, [sessionId]);
  const claimed = await claimSessionSandboxProvisioningRunId(
    sessionId,
    run.runId,
  );
  if (claimed) {
    console.log("[sandbox:kick] workflow started", { sessionId, runId: run.runId });
    await updateSession(sessionId, {
      lifecycleState: "provisioning",
      lifecycleError: null,
    });
    return { status: "started", runId: run.runId };
  }

  console.log("[sandbox:kick] run claim race, checking latest", { sessionId, runId: run.runId });
  const latest = await getSessionById(sessionId);
  if (latest?.sandboxProvisioningRunId === run.runId) {
    await updateSession(sessionId, {
      lifecycleState: "provisioning",
      lifecycleError: null,
    });
    return { status: "started", runId: run.runId };
  }
  if (latest?.sandboxProvisioningRunId) {
    console.log("[sandbox:kick] latest has different run", { sessionId, runId: latest.sandboxProvisioningRunId });
    return { status: "existing", runId: latest.sandboxProvisioningRunId };
  }

  try {
    getRun(run.runId).cancel();
  } catch {
    // Best-effort cleanup for a duplicate run.
  }

  console.log("[sandbox:kick] skipped", { sessionId });
  return { status: "skipped" };
}

export async function waitForSandboxProvisioningRun(runId: string) {
  const run = getRun(runId);
  return run.returnValue;
}
