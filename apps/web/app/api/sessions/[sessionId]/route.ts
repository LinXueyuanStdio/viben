import {
  requireAuthenticatedUser,
  requireOwnedSession,
} from "@/app/api/sessions/_lib/session-context";
import {
  deleteSession,
  updateSession,
} from "@/lib/db/sessions";

interface PatchSessionRequest {
  title?: string;
  status?: string;
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

  const updated = await updateSession(sessionId, updates);

  return Response.json({ session: updated });
}
