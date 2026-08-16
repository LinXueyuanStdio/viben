import { beforeEach, describe, expect, test, vi } from "vitest";

type ChatRecord = { id: string };
type MessageRecord = {
  role: "user" | "assistant";
  parts: unknown[];
};

const state = vi.hoisted(() => ({
  chats: [] as ChatRecord[],
  messagesByChatId: {} as Record<string, MessageRecord[]>,
}));

vi.mock("@/lib/db/sessions", () => ({
  getChatsBySessionId: async () => state.chats,
  getChatMessages: async (chatId: string) =>
    state.messagesByChatId[chatId] ?? [],
}));

import {
  extractGitHubOwnerFromRemoteUrl,
  generateBranchName,
  getConversationContext,
  isPermissionPushError,
  looksLikeCommitHash,
  redactGitHubToken,
} from "./generate-pr-helpers";

describe("generate-pr helpers", () => {
  beforeEach(() => {
    state.chats = [];
    state.messagesByChatId = {};
  });

  test("generateBranchName uses initials and 8-char random suffix", async () => {
    const fromName = generateBranchName("octocat", "Alice Bob");
    const fromUsername = generateBranchName("xyUser", null);

    expect(fromName).toMatch(/^ab\/[a-f0-9]{8}$/);
    expect(fromUsername).toMatch(/^xy\/[a-f0-9]{8}$/);
  });

  test("looksLikeCommitHash detects commit-looking strings", async () => {
    expect(looksLikeCommitHash("abc1234")).toBe(true);
    expect(looksLikeCommitHash("ABCDEF1234567")).toBe(true);
    expect(looksLikeCommitHash("feature/branch")).toBe(false);
  });

  test("isPermissionPushError detects permission errors", async () => {
    expect(isPermissionPushError("Permission denied to repository")).toBe(true);
    expect(isPermissionPushError("all good")).toBe(false);
  });

  test("redactGitHubToken removes token from authenticated URLs", async () => {
    const redacted = redactGitHubToken(
      "fatal: could not access https://x-access-token:secret@github.com/org/repo.git",
    );

    expect(redacted).toContain("https://x-access-token:***@github.com");
    expect(redacted).not.toContain("secret@github.com");
  });

  test("extractGitHubOwnerFromRemoteUrl handles https and ssh remotes", async () => {
    expect(
      extractGitHubOwnerFromRemoteUrl("https://github.com/acme/widgets.git"),
    ).toBe("acme");
    expect(
      extractGitHubOwnerFromRemoteUrl("git@github.com:octo/repo.git"),
    ).toBe("octo");
    expect(extractGitHubOwnerFromRemoteUrl("")).toBeNull();
  });

  test("getConversationContext returns only text parts with role labels", async () => {
    state.chats = [{ id: "chat-1" }];
    state.messagesByChatId["chat-1"] = [
      {
        role: "user",
        parts: [
          { type: "text", text: "  first question  " },
          { type: "tool-call", toolName: "search" },
        ],
      },
      {
        role: "assistant",
        parts: [
          { type: "text", text: "  first answer  " },
          { type: "tool-result", result: { ok: true } },
        ],
      },
    ];

    const context = await getConversationContext("session-1");

    expect(context).toBe("User: first question\nAssistant: first answer");
  });
});
