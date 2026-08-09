import { requireAuthenticatedUser } from "@/app/api/sessions/_lib/session-context";
import { getSessionById } from "@/lib/db/sessions";
import { createChat } from "@/lib/db/sessions";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { sessionId } = await params;

  const session = await getSessionById(sessionId);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.userId !== auth.userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: string };
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return Response.json({ error: "Missing chat id" }, { status: 400 });
  }

  const chat = await createChat({
    id: body.id,
    sessionId,
    title: "New chat",
    modelId: null,
    activeStreamId: null,
    lastAssistantMessageAt: null,
  });

  return Response.json({ chat }, { status: 201 });
}
