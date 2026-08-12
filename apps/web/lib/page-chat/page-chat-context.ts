import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { encryptSession } from "@/lib/auth/jwe";
import type { Session as AuthSession } from "@/lib/auth/types";
import { findEditablePage } from "@/lib/db/page-auth";
import { publishedPages, sessions, users } from "@/lib/db/schema";
import { canReadPage } from "@/lib/services/community";

export type PageChatContext = {
  publishedPageId: string;
  userSlug: string;
  pageSlug: string;
  title: string;
  canEdit: boolean;
  url: string;
};

export class PageChatSessionRequiredError extends Error {
  constructor() {
    super("Page chat session required");
    this.name = "PageChatSessionRequiredError";
  }
}

export class PageUnavailableError extends Error {
  constructor() {
    super("Page unavailable");
    this.name = "PageUnavailableError";
  }
}

function buildAuthSession(user: typeof users.$inferSelect): AuthSession {
  return {
    userId: user.id,
    username: user.username,
    userSlug: user.userSlug,
    displayName: user.displayName ?? undefined,
    email: user.email ?? "",
    role: user.role as AuthSession["role"],
    avatarUrl: user.avatarUrl ?? undefined,
    expiresAt: Number.MAX_SAFE_INTEGER,
  };
}

function pageUrl(userSlug: string, pageSlug: string): string {
  return `/${encodeURIComponent(userSlug)}/${encodeURIComponent(pageSlug)}?tab=read`;
}

export async function resolvePageChatContext(input: {
  sessionId: string;
  userId: string;
}): Promise<{ page: PageChatContext; bearerToken: string }> {
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.id, input.sessionId),
      eq(sessions.userId, input.userId),
    ),
  });

  if (
    !session ||
    session.agentType !== "chat" ||
    session.userId !== input.userId
  ) {
    throw new PageChatSessionRequiredError();
  }

  if (!session.publishedPageId) {
    throw new PageUnavailableError();
  }

  const [page, user] = await Promise.all([
    db.query.publishedPages.findFirst({
      where: eq(publishedPages.id, session.publishedPageId),
    }),
    db.query.users.findFirst({
      where: eq(users.id, input.userId),
    }),
  ]);

  if (!page || !user) {
    throw new PageUnavailableError();
  }

  const authSession = buildAuthSession(user);
  if (!canReadPage(page, authSession)) {
    throw new PageUnavailableError();
  }

  const editablePage = await findEditablePage(page.uid, input.userId, {
    publishedPageId: page.id,
  });
  const canEdit = page.userId === input.userId || editablePage?.id === page.id;
  const currentUserSlug = page.authorSlug;
  const currentPageSlug = page.uid;
  const bearerToken = await encryptSession({
    userId: authSession.userId,
    username: authSession.username,
    userSlug: authSession.userSlug,
    displayName: authSession.displayName,
    email: authSession.email,
    role: authSession.role,
    avatarUrl: authSession.avatarUrl,
  });

  return {
    page: {
      publishedPageId: page.id,
      userSlug: currentUserSlug,
      pageSlug: currentPageSlug,
      title: page.title,
      canEdit,
      url: pageUrl(currentUserSlug, currentPageSlug),
    },
    bearerToken,
  };
}
