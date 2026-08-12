import { db } from "@/lib/db";
import type { Session as CommunityAuthSession } from "@/lib/auth/types";
import type { Session as AuthSession } from "@/lib/session/types";
import { getServerSession } from "@/lib/session/get-server-session";
import { canReadPage } from "@/lib/services/community";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export type PagePreviewResponse = {
  published_page_id: string;
  user_slug: string;
  page_slug: string;
  title: string;
  html: string;
  url: string;
};

function buildCommunityAuthSession(session: AuthSession): CommunityAuthSession {
  return {
    userId: session.user.id,
    username: session.user.username,
    userSlug: session.user.username,
    displayName: session.user.name,
    email: session.user.email ?? "",
    role: "user",
    avatarUrl: session.user.avatar,
    expiresAt: Number.MAX_SAFE_INTEGER,
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authSession = await getServerSession();
  if (!authSession?.user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { sessionId } = await params;
  const session = await db.query.sessions.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, sessionId), eq(table.userId, authSession.user.id)),
  });

  if (!session) {
    return Response.json({ error: "Page not found" }, { status: 404 });
  }

  if (session.agentType !== "chat" || !session.publishedPageId) {
    return Response.json(
      { error: "Page chat session required" },
      { status: 400 },
    );
  }

  const publishedPageId = session.publishedPageId;
  const page = await db.query.publishedPages.findFirst({
    where: (table, { eq }) => eq(table.id, publishedPageId),
  });

  if (!page || !canReadPage(page, buildCommunityAuthSession(authSession))) {
    return Response.json({ error: "Page not found" }, { status: 404 });
  }

  const url = `/${encodeURIComponent(page.authorSlug)}/${encodeURIComponent(page.uid)}?tab=read`;
  const response: PagePreviewResponse = {
    published_page_id: page.id,
    user_slug: page.authorSlug,
    page_slug: page.uid,
    title: page.title,
    html: page.html,
    url,
  };

  return Response.json(response, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
