import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  appendPullRequestContextSection,
  resolvePullRequestAppBaseUrl,
  resolvePullRequestContextSection,
} from "./pr-content";

const state = vi.hoisted(() => ({
  sessionRecord: null as { userId: string } | null,
  chats: [] as Array<{ id: string }>,
  userRecord: null as { displayName: string | null; username: string | null } | null,
  githubProfile: null as { username: string; externalUserId: string } | null,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/generate-pr/_lib/generate-pr-helpers", () => ({
  getConversationContext: async () => "",
}));

vi.mock("@/lib/db/sessions", () => ({
  getSessionById: async () => state.sessionRecord,
  getChatsBySessionId: async () => state.chats,
}));

vi.mock("@/lib/github/users", () => ({
  getGitHubUserProfile: async () => state.githubProfile,
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    query: {
      users: {
        findFirst: async () => state.userRecord,
      },
    },
  },
}));

const originalVercelUrl = process.env.VERCEL_URL;
const originalVercelEnv = process.env.VERCEL_ENV;
const originalProductionUrl =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

function restoreEnv() {
  if (originalVercelUrl === undefined) {
    delete process.env.VERCEL_URL;
  } else {
    process.env.VERCEL_URL = originalVercelUrl;
  }

  if (originalVercelEnv === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = originalVercelEnv;
  }

  if (originalProductionUrl === undefined) {
    delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  } else {
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL =
      originalProductionUrl;
  }
}

describe("pr-content", () => {
  beforeEach(() => {
    state.sessionRecord = null;
    state.chats = [];
    state.userRecord = null;
    state.githubProfile = null;
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  test("resolvePullRequestContextSection returns a single-line footer with chat link and attribution", async () => {
    state.sessionRecord = { userId: "user-1" };
    state.chats = [{ id: "chat-2" }, { id: "chat-1" }];
    state.userRecord = { displayName: "Nico Albanese", username: "nico" };
    state.githubProfile = { username: "nicoalbanese10", externalUserId: "12345" };

    const section = await resolvePullRequestContextSection({
      sessionId: "session-1",
      appBaseUrl: "https://openharness.dev",
    });

    expect(section).toBe(
      "[Chat](https://openharness.dev/sessions/session-1/chats/chat-2) - Built with guidance from [Nico Albanese](https://github.com/nicoalbanese10)",
    );
  });

  test("resolvePullRequestContextSection falls back to plain-text attribution when no GitHub account exists", async () => {
    state.sessionRecord = { userId: "user-1" };
    state.userRecord = { displayName: null, username: "nico" };

    const section = await resolvePullRequestContextSection({
      sessionId: "session-1",
    });

    expect(section).toBe("Built with guidance from nico");
  });

  test("resolvePullRequestAppBaseUrl prefers the active deployment url", async () => {
    process.env.VERCEL_URL = "preview-openharness.vercel.app";
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = "openharness.dev";

    expect(resolvePullRequestAppBaseUrl()).toBe(
      "https://preview-openharness.vercel.app",
    );

    delete process.env.VERCEL_URL;
    process.env.VERCEL_ENV = "production";

    expect(resolvePullRequestAppBaseUrl()).toBe("https://openharness.dev");
  });

  test("appendPullRequestContextSection appends the footer after a horizontal rule", async () => {
    expect(
      appendPullRequestContextSection(
        "## Summary\n\nInitial body\n",
        "[Chat](https://example.com) - Built with guidance from Nico",
      ),
    ).toBe(`## Summary

Initial body

---

[Chat](https://example.com) - Built with guidance from Nico`);
  });
});
