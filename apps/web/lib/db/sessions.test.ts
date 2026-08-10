import { beforeEach, describe, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { chats, sessions } from "./schema";

type UpsertMode = "inserted" | "updated" | "conflict";

let upsertMode: UpsertMode = "inserted";

// Rows returned by the fakeDb select() chain (used by getUsedSessionTitles)
let fakeSelectRows: { title: string }[] = [];

let recordedSessionInsert: Record<string, unknown> | undefined;
let recordedSessionUpdate: Record<string, unknown> | undefined;
let renderedWhereClause = "";
let recordedChatOrder = "";

const dialect = new PgDialect();

function renderSql(statement: SQL): string {
  const query = dialect.sqlToQuery(statement);
  return `${query.sql} ${query.params.join(" ")}`
    .replaceAll('"', "")
    .replaceAll("sessions.", "")
    .replaceAll("chats.", "");
}

const fakeInsertedMessage = {
  id: "message-1",
  chatId: "chat-1",
  role: "assistant" as const,
  parts: { id: "message-1", role: "assistant", parts: [] },
  createdAt: new Date(),
};

const fakeDb = {
  // Fluent select chain: db.select({…}).from(table).where(condition)
  select: (_columns: unknown) => ({
    from: (_table: unknown) => ({
      where: async (_condition: unknown) => fakeSelectRows,
    }),
  }),

  query: {
    sessions: {
      findFirst: async ({ where }: { where: SQL }) => {
        renderedWhereClause = renderSql(where);
        return undefined;
      },
    },
    chats: {
      findFirst: async ({
        orderBy,
      }: {
        orderBy: SQL[];
      }) => {
        recordedChatOrder = renderSql(orderBy[0] as SQL).trim();
        return undefined;
      },
    },
  },

  update: (table: unknown) => ({
    set: (input: Record<string, unknown>) => ({
      where: (_condition: unknown) => ({
        returning: async () => {
          if (table === sessions) {
            recordedSessionUpdate = input;
            return [{ id: "session-1", sandboxState: null, ...input }];
          }
          return [];
        },
      }),
    }),
  }),

  transaction: async <T>(
    callback: (tx: {
      insert: (table: unknown) => {
        values: (input: unknown) => {
          onConflictDoNothing: (config: unknown) => {
            returning: () => Promise<(typeof fakeInsertedMessage)[]>;
          };
        };
      };
      update: (table: unknown) => {
        set: (input: unknown) => {
          where: (condition: unknown) => {
            returning: () => Promise<(typeof fakeInsertedMessage)[]>;
          };
        };
      };
    }) => Promise<T>,
  ) => {
    const tx = {
      insert: (table: unknown) => ({
        values: (input: Record<string, unknown>) => {
          const returning = async () => {
            if (table === sessions) {
              recordedSessionInsert = input;
              return [input];
            }
            if (table === chats) {
              return [input];
            }
            return [];
          };

          return {
            returning,
            onConflictDoNothing: (_config: unknown) => ({
              returning: async () =>
                upsertMode === "inserted" ? [fakeInsertedMessage] : [],
            }),
          };
        },
      }),
      update: (table: unknown) => ({
        set: (input: Record<string, unknown>) => ({
          where: (_condition: unknown) => ({
            returning: async () => {
              if (table === sessions) {
                recordedSessionUpdate = input;
                return [{ id: "session-1", sandboxState: null, ...input }];
              }
              return upsertMode === "updated" ? [fakeInsertedMessage] : [];
            },
          }),
        }),
      }),
    };

    return callback(tx);
  },
};

vi.mock("./client", () => ({
  db: fakeDb,
}));

const sessionsModulePromise = import("./sessions");

describe("normalizeLegacySandboxState", () => {
  test("rewrites legacy vercel-compatible sandbox ids onto sandboxName", async () => {
    const { normalizeLegacySandboxState } = await sessionsModulePromise;

    const result = normalizeLegacySandboxState({
      type: "hybrid",
      sandboxId: "sbx-legacy-1",
      snapshotId: "snap-legacy-1",
      expiresAt: 123,
    });

    expect(result).toEqual({
      type: "vercel",
      sandboxName: "sbx-legacy-1",
      snapshotId: "snap-legacy-1",
      expiresAt: 123,
    });
  });

  test("moves persisted session_<id> identifiers onto sandboxName", async () => {
    const { normalizeLegacySandboxState } = await sessionsModulePromise;

    expect(
      normalizeLegacySandboxState({
        type: "vercel",
        sandboxId: "session_123",
        expiresAt: 456,
      }),
    ).toEqual({
      type: "vercel",
      sandboxName: "session_123",
      expiresAt: 456,
    });
  });

  test("leaves supported sandbox states unchanged", async () => {
    const { normalizeLegacySandboxState } = await sessionsModulePromise;

    const state = {
      type: "vercel",
      sandboxName: "session_current-1",
      expiresAt: 456,
    } as const;

    expect(normalizeLegacySandboxState(state)).toEqual(state);
  });
});

describe("getUsedSessionTitles", () => {
  beforeEach(() => {
    fakeSelectRows = [];
  });

  test("returns an empty Set when the user has no sessions", async () => {
    const { getUsedSessionTitles } = await sessionsModulePromise;
    fakeSelectRows = [];

    const result = await getUsedSessionTitles("user-1");
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  test("returns a Set containing all existing session titles", async () => {
    const { getUsedSessionTitles } = await sessionsModulePromise;
    fakeSelectRows = [
      { title: "Tokyo" },
      { title: "Paris" },
      { title: "Lagos" },
    ];

    const result = await getUsedSessionTitles("user-1");
    expect(result.size).toBe(3);
    expect(result.has("Tokyo")).toBe(true);
    expect(result.has("Paris")).toBe(true);
    expect(result.has("Lagos")).toBe(true);
  });

  test("deduplicates titles if the DB returns duplicates", async () => {
    const { getUsedSessionTitles } = await sessionsModulePromise;
    fakeSelectRows = [{ title: "Rome" }, { title: "Rome" }];

    const result = await getUsedSessionTitles("user-1");
    expect(result.size).toBe(1);
    expect(result.has("Rome")).toBe(true);
  });
});

describe("page chat sessions", () => {
  beforeEach(() => {
    recordedSessionInsert = undefined;
    recordedSessionUpdate = undefined;
    renderedWhereClause = "";
    recordedChatOrder = "";
  });

  test("creates chat page sessions without sandbox lifecycle fields", async () => {
    const { createPageSessionWithInitialChat } = await sessionsModulePromise;

    const result = await createPageSessionWithInitialChat({
      userId: "user-1",
      publishedPageId: "page-1",
      pageUserSlug: "alice",
      pageSlug: "guide",
      title: "Guide",
      chatId: "chat-1",
      chatTitle: "New chat",
      modelId: "openai/gpt-5",
    });

    expect(recordedSessionInsert).toMatchObject({
      agentType: "chat",
      publishedPageId: "page-1",
      pageUserSlug: "alice",
      pageSlug: "guide",
      sandboxState: null,
      lifecycleState: null,
    });
    expect(result.chat.sessionId).toBe(result.session.id);
  });

  test("active lookup excludes archived and non-chat sessions", async () => {
    const { getActivePageSession } = await sessionsModulePromise;

    await getActivePageSession("user-1", "page-1");

    expect(renderedWhereClause).toContain("agent_type");
    expect(renderedWhereClause).toContain("archived");
  });

  test("latest chat uses updated_at descending", async () => {
    const { getLatestChatBySessionId } = await sessionsModulePromise;

    await getLatestChatBySessionId("session-1");

    expect(recordedChatOrder).toBe("updated_at desc");
  });

  test("snapshot sync only updates display fields", async () => {
    const { syncPageSessionSnapshot } = await sessionsModulePromise;

    await syncPageSessionSnapshot("session-1", {
      title: "Renamed",
      pageUserSlug: "alice-new",
      pageSlug: "guide-new",
    });

    expect(recordedSessionUpdate).toEqual({
      title: "Renamed",
      pageUserSlug: "alice-new",
      pageSlug: "guide-new",
      updatedAt: expect.any(Date),
    });
  });
});

describe("upsertChatMessageScoped", () => {
  beforeEach(() => {
    upsertMode = "inserted";
  });

  test("returns inserted when no existing row conflicts", async () => {
    const { upsertChatMessageScoped } = await sessionsModulePromise;
    upsertMode = "inserted";

    const result = await upsertChatMessageScoped({
      id: "message-1",
      chatId: "chat-1",
      role: "assistant",
      parts: { id: "message-1", role: "assistant", parts: [] },
    });

    expect(result.status).toBe("inserted");
  });

  test("returns updated when id exists in same chat and role", async () => {
    const { upsertChatMessageScoped } = await sessionsModulePromise;
    upsertMode = "updated";

    const result = await upsertChatMessageScoped({
      id: "message-1",
      chatId: "chat-1",
      role: "assistant",
      parts: { id: "message-1", role: "assistant", parts: [{ type: "text" }] },
    });

    expect(result.status).toBe("updated");
  });

  test("returns conflict when id exists for different chat/role scope", async () => {
    const { upsertChatMessageScoped } = await sessionsModulePromise;
    upsertMode = "conflict";

    const result = await upsertChatMessageScoped({
      id: "message-1",
      chatId: "chat-1",
      role: "assistant",
      parts: { id: "message-1", role: "assistant", parts: [{ type: "text" }] },
    });

    expect(result.status).toBe("conflict");
  });
});
