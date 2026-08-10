import {
  requireAuthenticatedUser,
  requireOwnedSession,
} from "@/app/api/sessions/_lib/session-context";
import {
  deleteSession,
  getActivePageSession,
  updateSession,
} from "@/lib/db/sessions";

interface PatchSessionRequest {
  title?: string;
  status?: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function activePageSessionConflict(sessionId: string): Response {
  return Response.json(
    {
      error: "An active page session already exists",
      session_id: sessionId,
    },
    { status: 409 },
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { sessionId } = await params;

  const sessionCtx = await requireOwnedSession({
    userId: auth.userId,
    sessionId,
  });
  if (!sessionCtx.ok) return sessionCtx.response;

  await deleteSession(sessionId);

  return Response.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { sessionId } = await params;

  const sessionCtx = await requireOwnedSession({
    userId: auth.userId,
    sessionId,
  });
  if (!sessionCtx.ok) return sessionCtx.response;

  let body: PatchSessionRequest;
  try {
    body = (await req.json()) as PatchSessionRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: { title?: string; status?: "running" | "completed" | "failed" | "archived" } = {};

  if (body.title !== undefined) {
    const trimmed = body.title.trim();
    if (!trimmed) {
      return Response.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    updates.title = trimmed;
  }

  if (body.status !== undefined) {
    const validStatuses = [
      "running",
      "completed",
      "failed",
      "archived",
    ] as const;
    if (!(validStatuses as readonly string[]).includes(body.status)) {
      return Response.json(
        { error: "Invalid session status" },
        { status: 400 },
      );
    }
    updates.status = body.status as typeof validStatuses[number];
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const currentSession = sessionCtx.sessionRecord;
  if (
    currentSession.agentType === "chat" &&
    currentSession.status === "archived" &&
    updates.status !== undefined &&
    updates.status !== "archived" &&
    currentSession.publishedPageId
  ) {
    const activePageSession = await getActivePageSession(
      auth.userId,
      currentSession.publishedPageId,
    );
    if (activePageSession && activePageSession.id !== currentSession.id) {
      return activePageSessionConflict(activePageSession.id);
    }
  }

  let updated;
  try {
    updated = await updateSession(sessionId, updates);
  } catch (error) {
    if (
      isUniqueViolation(error) &&
      currentSession.agentType === "chat" &&
      currentSession.status === "archived" &&
      updates.status !== undefined &&
      updates.status !== "archived" &&
      currentSession.publishedPageId
    ) {
      const winner = await getActivePageSession(
        auth.userId,
        currentSession.publishedPageId,
      );
      if (winner && winner.id !== currentSession.id) {
        return activePageSessionConflict(winner.id);
      }
    }
    throw error;
  }

  return Response.json({ session: updated });
}
