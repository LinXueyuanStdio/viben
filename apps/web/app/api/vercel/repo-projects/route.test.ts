import { beforeEach, describe, expect, test, vi } from "vitest";
import type { VercelProjectSelection } from "@/lib/vercel/types";

const state = vi.hoisted(() => {
  const s = {
    currentSession: { user: { id: "user-1" } } as { user: { id: string } } | null,
    currentToken: "token" as string | null,
    savedLink: null as VercelProjectSelection | null,
    projects: [] as VercelProjectSelection[],
    projectsError: null as Error | null,
  };
  return s;
});

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.currentSession,
}));

vi.mock("@/lib/vercel/token", () => ({
  getUserVercelToken: async () => state.currentToken,
}));

vi.mock("@/lib/db/vercel-project-links", () => ({
  getVercelProjectLinkByRepo: async () => state.savedLink,
}));

vi.mock("@/lib/vercel/projects", () => ({
  isVercelInvalidTokenError: (error: unknown) =>
    state.projectsError !== null && error === state.projectsError,
  listMatchingVercelProjects: async () => {
    if (state.projectsError) {
      throw state.projectsError;
    }
    return state.projects;
  },
}));

import * as route from "./route";

describe("/api/vercel/repo-projects", () => {
  beforeEach(() => {
    state.currentSession = { user: { id: "user-1" } };
    state.currentToken = "token";
    state.savedLink = null;
    state.projects = [];
    state.projectsError = null;
  });

  test("returns the remembered default when it still exists in live candidates", async () => {
    const { GET } = route;

    state.savedLink = {
      projectId: "project-2",
      projectName: "marketing",
      teamId: "team-1",
      teamSlug: "acme",
    };
    state.projects = [
      {
        projectId: "project-1",
        projectName: "app",
        teamId: null,
        teamSlug: null,
      },
      state.savedLink,
    ];

    const response = await GET(
      new Request(
        "http://localhost/api/vercel/repo-projects?repoOwner=viben&repoName=viben-agent",
      ),
    );
    const body = (await response.json()) as {
      projects: VercelProjectSelection[];
      selectedProjectId: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.projects).toEqual(state.projects);
    expect(body.selectedProjectId).toBe("project-2");
  });

  test("auto-selects the lone matching live project when there is no saved default", async () => {
    const { GET } = route;

    state.projects = [
      {
        projectId: "project-1",
        projectName: "app",
        teamId: null,
        teamSlug: null,
      },
    ];

    const response = await GET(
      new Request(
        "http://localhost/api/vercel/repo-projects?repoOwner=viben&repoName=viben-agent",
      ),
    );
    const body = (await response.json()) as {
      selectedProjectId: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.selectedProjectId).toBe("project-1");
  });

  test("asks the client to reconnect Vercel when the token is invalid", async () => {
    const { GET } = route;

    state.projectsError = new Error("invalid Vercel token");

    const response = await GET(
      new Request(
        "http://localhost/api/vercel/repo-projects?repoOwner=viben&repoName=viben-agent",
      ),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Reconnect Vercel to load matching projects");
  });
});
