import { checkBotProtection } from "@/lib/botid";
import {
  getOrCreatePageSession,
  PageNotFoundError,
  PageSessionLimitError,
} from "@/lib/page-chat/page-session-service";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getServerSession } from "@/lib/session/get-server-session";

type PageSessionRequest = {
  user_slug: string;
  page_slug: string;
};

function isValidRequestBody(body: unknown): body is PageSessionRequest {
  if (!body || typeof body !== "object") {
    return false;
  }

  const record = body as Record<string, unknown>;
  return (
    typeof record.user_slug === "string" &&
    record.user_slug.trim().length > 0 &&
    typeof record.page_slug === "string" &&
    record.page_slug.trim().length > 0
  );
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const botVerification = await checkBotProtection();
  if (botVerification.isBot) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  const limited = await checkRateLimit({
    key: rateLimitKey(["sessions-create", session.user.id]),
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) {
    return limited;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidRequestBody(body)) {
    return Response.json(
      { error: "Invalid page session body" },
      { status: 400 },
    );
  }

  try {
    const result = await getOrCreatePageSession({
      userId: session.user.id,
      userSlug: session.user.username,
      authSession: session,
      requestUrl: request.url,
      pageUserSlug: body.user_slug.trim(),
      pageSlug: body.page_slug.trim(),
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof PageNotFoundError) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }
    if (error instanceof PageSessionLimitError) {
      return Response.json({ error: error.message }, { status: 403 });
    }

    console.error("Failed to get or create page session:", error);
    return Response.json(
      { error: "Failed to get or create page session" },
      { status: 500 },
    );
  }
}
