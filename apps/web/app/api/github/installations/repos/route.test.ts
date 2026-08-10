import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  deletedInstallations: [] as Array<{
    userId: string;
    installationId: number;
  }>,
}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/db/installations", () => ({
  getInstallationByUserAndId: async () => ({
    installationId: 152257360,
    accountLogin: "octocat",
  }),
  deleteInstallationByUserAndId: async (
    userId: string,
    installationId: number,
  ) => {
    mocks.deletedInstallations.push({ userId, installationId });
    return 1;
  },
}));

vi.mock("@/lib/github/repos", () => ({
  listInstallationRepositories: async () => {
    throw Object.assign(new Error("Installation not found"), { status: 404 });
  },
  isMissingGitHubInstallationError: (error: unknown) =>
    error instanceof Error &&
    "status" in error &&
    error.status === 404,
}));

import { GET } from "./route";

describe("GET /api/github/installations/repos", () => {
  beforeEach(() => {
    mocks.deletedInstallations.length = 0;
  });

  test("deletes a stale installation when GitHub reports it missing", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/github/installations/repos?installation_id=152257360&limit=25",
      ),
    );

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: "GitHub installation is no longer available",
      code: "installation_not_found",
    });
    expect(mocks.deletedInstallations).toEqual([
      { userId: "user-1", installationId: 152257360 },
    ]);
  });
});
