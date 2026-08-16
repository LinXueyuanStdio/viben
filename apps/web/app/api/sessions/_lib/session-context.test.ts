import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  requireAuthenticatedUser,
  requireOwnedSession,
  requireOwnedSessionChat,
  requireOwnedSessionWithSandboxGuard,
} from "./session-context";

type AuthSession = { user: { id: string } } | null;

type SessionRecord = {
  id: string;
  userId: string;
  sandboxState: { type: "vercel" } | null;
};

type ChatRecord = {
  id: string;
  sessionId: string;
  activeStreamId: string | null;
};

const state = vi.hoisted(() => ({
  authSession: { user: { id: "user-1" } } as AuthSession,
  sessionRecord: {
    id: "session-1",
    userId: "user-1",
    sandboxState: { type: "vercel" },
  } as SessionRecord | null,
  chatRecord: {
    id: "chat-1",
    sessionId: "session-1",
    activeStreamId: null,
  } as ChatRecord | null,
}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.authSession,
}));

vi.mock("@/lib/db/sessions", () => ({
  getSessionById: async () => state.sessionRecord,
  getChatById: async () => state.chatRecord,
}));

async function getErrorMessage(
  response: Response,
): Promise<string | undefined> {
  const body = (await response.json()) as { error?: string };
  return body.error;
}

describe("session context guards", () => {
  beforeEach(() => {
    state.authSession = { user: { id: "user-1" } };
    state.sessionRecord = {
      id: "session-1",
      userId: "user-1",
      sandboxState: { type: "vercel" },
    };
    state.chatRecord = {
      id: "chat-1",
      sessionId: "session-1",
      activeStreamId: null,
    };
  });

  test("requireAuthenticatedUser returns 401 when unauthenticated", async () => {
    state.authSession = null;

    const result = await requireAuthenticatedUser();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(await getErrorMessage(result.response)).toBe("Not authenticated");
    }
  });

  test("requireAuthenticatedUser returns user id when authenticated", async () => {
    const result = await requireAuthenticatedUser();

    expect(result).toEqual({ ok: true, userId: "user-1" });
  });

  test("requireOwnedSession returns 404 when session is missing", async () => {
    state.sessionRecord = null;

    const result = await requireOwnedSession({
      userId: "user-1",
      sessionId: "session-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
      expect(await getErrorMessage(result.response)).toBe("Session not found");
    }
  });

  test("requireOwnedSession returns 403 when user does not own session", async () => {
    state.sessionRecord = {
      id: "session-1",
      userId: "other-user",
      sandboxState: { type: "vercel" },
    };

    const result = await requireOwnedSession({
      userId: "user-1",
      sessionId: "session-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(await getErrorMessage(result.response)).toBe("Forbidden");
    }
  });

  test("requireOwnedSession allows custom forbidden message", async () => {
    state.sessionRecord = {
      id: "session-1",
      userId: "other-user",
      sandboxState: { type: "vercel" },
    };

    const result = await requireOwnedSession({
      userId: "user-1",
      sessionId: "session-1",
      forbiddenMessage: "Unauthorized",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(await getErrorMessage(result.response)).toBe("Unauthorized");
    }
  });

  test("requireOwnedSession returns session when owned", async () => {
    const result = await requireOwnedSession({
      userId: "user-1",
      sessionId: "session-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessionRecord.id).toBe("session-1");
    }
  });

  test("requireOwnedSessionWithSandboxGuard forwards ownership errors", async () => {
    state.sessionRecord = null;

    const result = await requireOwnedSessionWithSandboxGuard({
      userId: "user-1",
      sessionId: "session-1",
      sandboxGuard: () => true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
      expect(await getErrorMessage(result.response)).toBe("Session not found");
    }
  });

  test("requireOwnedSessionWithSandboxGuard returns sandbox error when guard fails", async () => {
    const result = await requireOwnedSessionWithSandboxGuard({
      userId: "user-1",
      sessionId: "session-1",
      sandboxGuard: () => false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(await getErrorMessage(result.response)).toBe(
        "Sandbox not initialized",
      );
    }
  });

  test("requireOwnedSessionChat returns 404 when chat is missing", async () => {
    state.chatRecord = null;

    const result = await requireOwnedSessionChat({
      userId: "user-1",
      sessionId: "session-1",
      chatId: "chat-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
      expect(await getErrorMessage(result.response)).toBe("Chat not found");
    }
  });

  test("requireOwnedSessionChat returns 404 when chat belongs to another session", async () => {
    state.chatRecord = {
      id: "chat-1",
      sessionId: "session-2",
      activeStreamId: null,
    };

    const result = await requireOwnedSessionChat({
      userId: "user-1",
      sessionId: "session-1",
      chatId: "chat-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
      expect(await getErrorMessage(result.response)).toBe("Chat not found");
    }
  });

  test("requireOwnedSessionChat returns 403 when user does not own session", async () => {
    state.sessionRecord = {
      id: "session-1",
      userId: "other-user",
      sandboxState: { type: "vercel" },
    };

    const result = await requireOwnedSessionChat({
      userId: "user-1",
      sessionId: "session-1",
      chatId: "chat-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(await getErrorMessage(result.response)).toBe("Forbidden");
    }
  });

  test("requireOwnedSessionChat returns session and chat when owned", async () => {
    const result = await requireOwnedSessionChat({
      userId: "user-1",
      sessionId: "session-1",
      chatId: "chat-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessionRecord.id).toBe("session-1");
      expect(result.chat.id).toBe("chat-1");
    }
  });
});
