import { describe, expect, it } from "vitest";
import { SqliteAcpSteerPromptStore } from "./steer-prompt-store";

interface FakeStatement {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
}

interface InjectableStore {
  db: {
    prepare: (sql: string) => FakeStatement;
  };
}

function createStoreWithFakeDb(prepare: (sql: string) => FakeStatement): SqliteAcpSteerPromptStore {
  const store = Object.create(SqliteAcpSteerPromptStore.prototype) as SqliteAcpSteerPromptStore & InjectableStore;
  store.db = { prepare };
  return store;
}

function consumedRow(id: string) {
  return {
    id,
    session_id: "session-1",
    agent_id: "agent-1",
    user_id: "user-1",
    prompt_json: JSON.stringify([{ type: "text", text: "hello" }]),
    status: "consumed",
    created_at: "2026-06-07T00:00:00.000Z",
    consumed_at: "2026-06-07T00:00:01.000Z",
    cancelled_at: null,
    completed_at: null,
    error: null,
    meta_json: null,
  };
}

describe("SqliteAcpSteerPromptStore", () => {
  it("does not return a consumed record when consumeNext loses the queued update race", async () => {
    const store = createStoreWithFakeDb((sql) => {
      if (sql.includes("SELECT id FROM acp_steer_prompts")) {
        return {
          run: () => undefined,
          get: () => ({ id: "prompt-1" }),
          all: () => [],
        };
      }
      if (sql.includes("UPDATE acp_steer_prompts")) {
        return {
          run: () => ({ changes: 0 }),
          get: () => undefined,
          all: () => [],
        };
      }
      if (sql.includes("SELECT * FROM acp_steer_prompts")) {
        return {
          run: () => undefined,
          get: () => consumedRow("prompt-1"),
          all: () => [],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(store.consumeNext("session-1")).resolves.toBeUndefined();
  });

  it("does not return consumed records when consumeQueued loses the queued update race", async () => {
    const store = createStoreWithFakeDb((sql) => {
      if (sql.includes("SELECT id FROM acp_steer_prompts")) {
        return {
          run: () => undefined,
          get: () => undefined,
          all: () => [{ id: "prompt-1" }, { id: "prompt-2" }],
        };
      }
      if (sql.includes("UPDATE acp_steer_prompts")) {
        return {
          run: () => ({ changes: 0 }),
          get: () => undefined,
          all: () => [],
        };
      }
      if (sql.includes("SELECT * FROM acp_steer_prompts")) {
        return {
          run: () => undefined,
          get: (_sessionId: unknown, promptId: unknown) => consumedRow(String(promptId)),
          all: () => [],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(store.consumeQueued("session-1")).resolves.toEqual([]);
  });
});
