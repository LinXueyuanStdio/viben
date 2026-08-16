import { describe, expect, test, vi } from "vitest";
import { botIdProtectedRoutes } from "./instrumentation-client";

const state = vi.hoisted(() => ({
  initBotIdCalls: [] as unknown[],
}));

vi.mock("botid/client/core", () => ({
  initBotId: (config: unknown) => {
    state.initBotIdCalls.push(config);
  },
}));

describe("BotID client instrumentation", () => {
  test("protects session creation to match the server-side BotID gate", () => {
    expect(botIdProtectedRoutes).toContainEqual({
      path: "/api/sessions",
      method: "POST",
    });
    expect(botIdProtectedRoutes).toContainEqual({
      path: "/api/page-sessions",
      method: "POST",
    });
    expect(state.initBotIdCalls).toContainEqual({
      protect: botIdProtectedRoutes,
    });
  });
});
