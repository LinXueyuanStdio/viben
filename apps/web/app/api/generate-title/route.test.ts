import { beforeEach, describe, expect, test, vi } from "vitest";

const state = vi.hoisted(() => {
  const s = {
    generateTextCalls: [] as Array<{ prompt: string }>,
    currentSession: { user: { id: "user-1" } } as { user: { id: string } } | null,
    generateTextResult: { text: "Generated session title" } as
      | { text: string }
      | Error,
  };
  return s;
});

vi.mock("@viben/agent", () => ({
  gateway: (modelId: string) => modelId,
}));

vi.mock("ai", () => ({
  generateText: async (input: { prompt: string }) => {
    state.generateTextCalls.push(input);

    if (state.generateTextResult instanceof Error) {
      throw state.generateTextResult;
    }

    return state.generateTextResult;
  },
}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.currentSession,
}));

import * as route from "./route";

function createJsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/generate-title", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/generate-title", () => {
  beforeEach(() => {
    state.currentSession = { user: { id: "user-1" } };
    state.generateTextResult = { text: "Generated session title" };
    state.generateTextCalls.length = 0;
  });

  test("returns 401 when user is not authenticated", async () => {
    state.currentSession = null;
    const { POST } = route;

    const response = await POST(createJsonRequest({ message: "hello" }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Not authenticated");
  });

  test("returns 400 for invalid JSON", async () => {
    const { POST } = route;

    const response = await POST(
      new Request("http://localhost/api/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  test("returns 400 when message is missing or blank", async () => {
    const { POST } = route;

    const missingResponse = await POST(createJsonRequest({}));
    const missingBody = (await missingResponse.json()) as { error: string };

    expect(missingResponse.status).toBe(400);
    expect(missingBody.error).toBe("Missing required field: message");

    const blankResponse = await POST(createJsonRequest({ message: "   " }));
    const blankBody = (await blankResponse.json()) as { error: string };

    expect(blankResponse.status).toBe(400);
    expect(blankBody.error).toBe("Missing required field: message");
  });

  test("returns generated title when request is valid", async () => {
    state.generateTextResult = {
      text: "  Fix API Validation\nIgnore this line",
    };

    const { POST } = route;

    const response = await POST(
      createJsonRequest({ message: "  hello world  " }),
    );
    const body = (await response.json()) as { title: string };

    expect(response.status).toBe(200);
    expect(body.title).toBe("Fix API Validation");
    expect(state.generateTextCalls).toHaveLength(1);
    expect(state.generateTextCalls[0]?.prompt).toContain("hello world");
  });

  test("injects language hint into prompt when language is provided", async () => {
    const { POST } = route;

    const response = await POST(
      createJsonRequest({ message: "hello world", language: "zh-CN" }),
    );

    expect(response.status).toBe(200);
    expect(state.generateTextCalls).toHaveLength(1);
    expect(state.generateTextCalls[0]?.prompt).toContain(
      "Generate the title in Chinese (Simplified)",
    );
  });

  test("does not inject language hint when language is omitted", async () => {
    const { POST } = route;

    const response = await POST(createJsonRequest({ message: "hello world" }));

    expect(response.status).toBe(200);
    expect(state.generateTextCalls[0]?.prompt).not.toContain(
      "Generate the title in",
    );
  });

  test("returns 500 when title generation fails", async () => {
    state.generateTextResult = new Error("failed");
    const { POST } = route;

    const response = await POST(createJsonRequest({ message: "hello" }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to generate title");
  });
});
