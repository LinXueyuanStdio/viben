import { describe, expect, test } from "vitest";
import {
  CHAT_APP_COMPACT_GREETING_COUNT,
  CHAT_APP_COMPACT_GREETING_FALLBACKS,
  DEFAULT_CHAT_APP_AGENTS,
  DEFAULT_CHAT_APP_SESSIONS,
} from "./ChatAppDemoData";

describe("ChatAppDemoData", () => {
  test("keeps display-only demo defaults outside ChatApp", () => {
    expect(DEFAULT_CHAT_APP_SESSIONS.map((session) => session.id)).toEqual([
      "2c88f85a-690d-49ca-95f4-c3aa71da1da8",
      "2e83fc8b-a852-4530-a5f3-497bcafa9da6",
      "3bbcc4d2-0267-4938-98c3-c06a380828ba",
    ]);
    expect(DEFAULT_CHAT_APP_AGENTS.map((agent) => agent.id)).toEqual(["claude-code", "openai-browser"]);
    expect(CHAT_APP_COMPACT_GREETING_COUNT).toBe(50);
    expect(CHAT_APP_COMPACT_GREETING_FALLBACKS).toHaveLength(CHAT_APP_COMPACT_GREETING_COUNT);
  });
});
