import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  GitHubInstallationsSyncError,
  isGitHubInstallationsAuthError,
  syncUserInstallations,
} from "./sync";

const originalFetch = globalThis.fetch;
const originalGitHubAppId = process.env.GITHUB_APP_ID;
const mocks = vi.hoisted(() => ({
  upsertedInstallationIds: [] as number[],
  deletedInstallationIdLists: [] as number[][],
}));

vi.mock("@/lib/db/installations", () => ({
  upsertInstallation: async (input: { installationId: number }) => {
    mocks.upsertedInstallationIds.push(input.installationId);
    return input;
  },
  deleteInstallationsNotInList: async (
    _userId: string,
    installationIds: number[],
  ) => {
    mocks.deletedInstallationIdLists.push(installationIds);
    return 0;
  },
}));

beforeEach(() => {
  mocks.upsertedInstallationIds.length = 0;
  mocks.deletedInstallationIdLists.length = 0;
  process.env.GITHUB_APP_ID = "777";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalGitHubAppId === undefined) {
    delete process.env.GITHUB_APP_ID;
  } else {
    process.env.GITHUB_APP_ID = originalGitHubAppId;
  }
});

describe("isGitHubInstallationsAuthError", () => {
  test("treats 401 responses as auth failures", () => {
    expect(
      isGitHubInstallationsAuthError(
        new GitHubInstallationsSyncError("Unauthorized", {
          status: 401,
          responseText: '{"message":"Bad credentials"}',
        }),
      ),
    ).toBe(true);
  });

  test("treats auth-specific 403 responses as auth failures", () => {
    expect(
      isGitHubInstallationsAuthError(
        new GitHubInstallationsSyncError("Forbidden", {
          status: 403,
          responseText:
            '{"message":"Must grant your OAuth app access to this organization."}',
        }),
      ),
    ).toBe(true);
  });

  test("does not treat rate-limited 403 responses as auth failures", () => {
    expect(
      isGitHubInstallationsAuthError(
        new GitHubInstallationsSyncError("Forbidden", {
          status: 403,
          responseText:
            '{"message":"API rate limit exceeded for user ID 123."}',
        }),
      ),
    ).toBe(false);
  });
});

describe("syncUserInstallations", () => {
  test("persists only installations owned by the configured GitHub App", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({
        installations: [
          {
            id: 101,
            app_id: 777,
            repository_selection: "all",
            html_url: "https://github.com/settings/installations/101",
            account: { login: "octocat", type: "User" },
          },
          {
            id: 202,
            app_id: 888,
            repository_selection: "all",
            html_url: "https://github.com/settings/installations/202",
            account: { login: "octocat", type: "User" },
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const count = await syncUserInstallations(
      "user-1",
      "github-user-token",
      "octocat",
    );

    expect(count).toBe(1);
    expect(mocks.upsertedInstallationIds).toEqual([101]);
    expect(mocks.deletedInstallationIdLists).toEqual([[101]]);
  });
});
