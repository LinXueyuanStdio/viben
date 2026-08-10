import { nanoid } from "nanoid";
import {
  createPageSessionWithInitialChat,
  countSessionsByUserId,
  getActivePageSession,
  getLatestChatBySessionId,
  syncPageSessionSnapshot,
} from "@/lib/db/sessions";
import { findEditablePage } from "@/lib/db/page-auth";
import { getUserPreferences } from "@/lib/db/user-preferences";
import { sanitizeUserPreferencesForSession } from "@/lib/model-access";
import {
  isManagedTemplateTrialUser,
  MANAGED_TEMPLATE_TRIAL_SESSION_LIMIT,
  MANAGED_TEMPLATE_TRIAL_SESSION_LIMIT_ERROR,
} from "@/lib/managed-template-trial";
import {
  canReadPage,
  getPublishedPageContext,
} from "@/lib/services/community";
import type { Session as CommunityAuthSession } from "@/lib/auth/types";
import type { Session as AuthSession } from "@/lib/session/types";
import type { PageSessionResponse } from "./types";

export type GetOrCreatePageSessionInput = {
  userId: string;
  userSlug: string;
  authSession: AuthSession;
  requestUrl: string;
  pageUserSlug: string;
  pageSlug: string;
};

export class PageNotFoundError extends Error {
  constructor() {
    super("Page not found");
    this.name = "PageNotFoundError";
  }
}

export class PageSessionLimitError extends Error {
  constructor() {
    super(MANAGED_TEMPLATE_TRIAL_SESSION_LIMIT_ERROR);
    this.name = "PageSessionLimitError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function buildCommunityAuthSession(
  input: GetOrCreatePageSessionInput,
): CommunityAuthSession {
  return {
    userId: input.userId,
    username: input.authSession.user.username,
    userSlug: input.userSlug,
    displayName: input.authSession.user.name,
    email: input.authSession.user.email ?? "",
    role: "user",
    avatarUrl: input.authSession.user.avatar,
    expiresAt: Number.MAX_SAFE_INTEGER,
  };
}

async function restorePageSession(
  session: Awaited<ReturnType<typeof getActivePageSession>>,
  context: NonNullable<Awaited<ReturnType<typeof getPublishedPageContext>>>,
) {
  if (!session) {
    throw new Error("Active page session was not found");
  }

  const syncedSession = await syncPageSessionSnapshot(session.id, {
    title: context.page.title,
    pageUserSlug: context.page.authorSlug,
    pageSlug: context.page.uid,
  });
  const chat = await getLatestChatBySessionId(session.id);
  if (!chat) {
    throw new Error("Page session has no chat");
  }

  return { session: syncedSession, chat };
}

export async function getOrCreatePageSession(
  input: GetOrCreatePageSessionInput,
): Promise<PageSessionResponse> {
  const context = await getPublishedPageContext(
    input.pageUserSlug,
    input.pageSlug,
  );
  if (
    !context ||
    !canReadPage(context.page, buildCommunityAuthSession(input))
  ) {
    throw new PageNotFoundError();
  }

  let result;
  const activeSession = await getActivePageSession(
    input.userId,
    context.page.id,
  );
  if (activeSession) {
    result = await restorePageSession(activeSession, context);
  } else {
    if (isManagedTemplateTrialUser(input.authSession, input.requestUrl)) {
      const existingSessionCount = await countSessionsByUserId(input.userId);
      if (existingSessionCount >= MANAGED_TEMPLATE_TRIAL_SESSION_LIMIT) {
        throw new PageSessionLimitError();
      }
    }

    const preferences = sanitizeUserPreferencesForSession(
      await getUserPreferences(input.userId),
      input.authSession,
      input.requestUrl,
    );

    try {
      result = await createPageSessionWithInitialChat({
        userId: input.userId,
        publishedPageId: context.page.id,
        pageUserSlug: context.page.authorSlug,
        pageSlug: context.page.uid,
        title: context.page.title,
        chatId: nanoid(),
        chatTitle: "New chat",
        modelId: preferences.defaultModelId,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const winner = await getActivePageSession(input.userId, context.page.id);
      result = await restorePageSession(winner, context);
    }
  }

  const currentUserSlug = context.page.authorSlug;
  const currentPageSlug = context.page.uid;
  const editablePage = await findEditablePage(context.page.uid, input.userId);
  const canEdit =
    context.page.userId === input.userId || editablePage?.id === context.page.id;
  return {
    session: result.session,
    chat: result.chat,
    page: {
      published_page_id: context.page.id,
      user_slug: currentUserSlug,
      page_slug: currentPageSlug,
      title: context.page.title,
      url: `/${encodeURIComponent(currentUserSlug)}/${encodeURIComponent(currentPageSlug)}?tab=read`,
      can_edit: canEdit,
      available: true,
    },
  };
}
