import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  GitHubInstallationRequestError,
  isMissingGitHubInstallationError,
  listInstallationRepositories,
} from "./repos";

const originalFetch = globalThis.fetch;
const originalGitHubAppId = process.env.GITHUB_APP_ID;
const originalGitHubAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;

vi.mock("@octokit/auth-app", () => ({
  createAppAuth: () => async () => ({ token: "app-jwt" }),
}));

function createRepository(name: string, updatedAt: string) {
  return {
    name,
    full_name: `acme/${name}`,
    description: null,
    private: false,
    clone_url: `https://github.com/acme/${name}.git`,
    updated_at: updatedAt,
    language: null,
    owner: {
      login: "acme",
    },
  };
}

function createPage(
  repositories: ReturnType<typeof createRepository>[],
  page: number,
) {
  return [
    ...repositories,
    ...Array.from({ length: 50 - repositories.length }, (_, index) =>
      createRepository(
        `filler-${page}-${index}`,
        `2023-01-${`${(index % 28) + 1}`.padStart(2, "0")}T00:00:00Z`,
      ),
    ),
  ];
}

describe("installation-repos", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
    process.env.GITHUB_APP_ID = "777";
    process.env.GITHUB_APP_PRIVATE_KEY = "test-private-key";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalGitHubAppId === undefined) {
      delete process.env.GITHUB_APP_ID;
    } else {
      process.env.GITHUB_APP_ID = originalGitHubAppId;
    }
    if (originalGitHubAppPrivateKey === undefined) {
      delete process.env.GITHUB_APP_PRIVATE_KEY;
    } else {
      process.env.GITHUB_APP_PRIVATE_KEY = originalGitHubAppPrivateKey;
    }
  });

  test("classifies a missing installation when token minting returns 404", async () => {
    const error = new GitHubInstallationRequestError(
      "Failed to mint installation token: 404",
      404,
    );

    expect(isMissingGitHubInstallationError(error)).toBe(true);
  });

  test("stops paging once it has enough matches to satisfy the limit", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/access_tokens")) {
        return Response.json({ token: "installation-token" });
      }

      const page = url.searchParams.get("page");

      expect(url.searchParams.get("per_page")).toBe("50");

      if (page === "1") {
        return Response.json({
          repositories: createPage(
            [
              createRepository("zeta", "2024-01-01T00:00:00Z"),
              createRepository("alpha", "2024-03-01T00:00:00Z"),
              createRepository("beta", "2024-02-01T00:00:00Z"),
            ],
            1,
          ),
        });
      }

      return Response.json({
        repositories: [createRepository("omega", "2024-04-01T00:00:00Z")],
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const repos = await listInstallationRepositories({
      installationId: 123,
      owner: "acme",
      limit: 2,
    });

    expect(repos.map((repo) => repo.name)).toEqual(["alpha", "beta"]);
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        new URL(input.toString()).pathname.endsWith(
          "/installation/repositories",
        ),
      ),
    ).toHaveLength(1);
  });

  test("continues paging until a query has enough matches", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/access_tokens")) {
        return Response.json({ token: "installation-token" });
      }

      const page = url.searchParams.get("page");

      expect(url.searchParams.get("per_page")).toBe("50");

      if (page === "1") {
        return Response.json({
          repositories: createPage(
            [
              createRepository("docs", "2024-01-01T00:00:00Z"),
              createRepository("frontend", "2024-02-01T00:00:00Z"),
            ],
            1,
          ),
        });
      }

      if (page === "2") {
        return Response.json({
          repositories: createPage(
            [
              createRepository("docs-site", "2024-03-01T00:00:00Z"),
              createRepository("infra", "2024-04-01T00:00:00Z"),
            ],
            2,
          ),
        });
      }

      return Response.json({
        repositories: [createRepository("docs-api", "2024-05-01T00:00:00Z")],
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const repos = await listInstallationRepositories({
      installationId: 123,
      owner: "acme",
      query: "docs",
      limit: 2,
    });

    expect(repos.map((repo) => repo.name)).toEqual(["docs-site", "docs"]);
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        new URL(input.toString()).pathname.endsWith(
          "/installation/repositories",
        ),
      ),
    ).toHaveLength(2);
  });
});
