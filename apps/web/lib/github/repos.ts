import { createAppAuth } from "@octokit/auth-app";
import { z } from "zod";

// ---- installation repos listing ----

const INSTALLATION_REPOS_MAX_PAGES = 20;

const installationRepoSchema = z.object({
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  private: z.boolean(),
  clone_url: z.string().url(),
  updated_at: z.string(),
  language: z.string().nullable(),
  owner: z.object({ login: z.string() }),
});

const installationReposResponseSchema = z.object({
  repositories: z.array(installationRepoSchema),
});

export interface InstallationRepository {
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  clone_url: string;
  updated_at: string;
  language: string | null;
}

// ---- helpers ----

function normalizeLimit(limit?: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return 50;
  return Math.max(1, Math.min(limit, 100));
}

function compareByActivity(
  a: Pick<InstallationRepository, "name" | "updated_at">,
  b: Pick<InstallationRepository, "name" | "updated_at">,
): number {
  const aTime = Date.parse(a.updated_at);
  const bTime = Date.parse(b.updated_at);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return bTime - aTime;
  }
  if (Number.isFinite(aTime) !== Number.isFinite(bTime)) {
    return Number.isFinite(aTime) ? -1 : 1;
  }
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

async function getAppJwt(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) throw new Error("GitHub App is not configured");

  const auth = createAppAuth({
    appId: Number.parseInt(appId, 10),
    privateKey: privateKey.replace(/\\n/g, "\n"),
  });
  const result = await auth({ type: "app" });
  return result.token;
}

// ---- public API ----

interface ListReposOptions {
  installationId: number;
  owner?: string;
  query?: string;
  limit?: number;
}

export class GitHubInstallationRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubInstallationRequestError";
    this.status = status;
  }
}

export function isMissingGitHubInstallationError(error: unknown): boolean {
  return (
    error instanceof GitHubInstallationRequestError && error.status === 404
  );
}

/** List repos for an installation via App JWT (mints an installation token). */
export async function listInstallationRepositories(
  options: ListReposOptions,
): Promise<InstallationRepository[]> {
  const { installationId, owner, query, limit } = options;
  const ownerFilter = owner?.trim().toLowerCase();
  const queryFilter = query?.trim().toLowerCase();
  const normalizedLimit = normalizeLimit(limit);

  const appJwt = await getAppJwt();

  // Mint an installation access token
  const tokenRes = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );
  if (!tokenRes.ok) {
    throw new GitHubInstallationRequestError(
      `Failed to mint installation token: ${tokenRes.status}`,
      tokenRes.status,
    );
  }
  const { token: installationToken } = (await tokenRes.json()) as { token: string };

  // List repos with installation token
  const perPage = 50;
  const matched: z.infer<typeof installationRepoSchema>[] = [];

  for (let page = 1; page <= INSTALLATION_REPOS_MAX_PAGES; page++) {
    const url = new URL("https://api.github.com/installation/repositories");
    url.searchParams.set("per_page", `${perPage}`);
    url.searchParams.set("page", `${page}`);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${installationToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (!res.ok) {
      throw new Error(
        `Failed to fetch repos: ${res.status}`,
      );
    }

    const parsed = installationReposResponseSchema.safeParse(await res.json());
    if (!parsed.success || parsed.data.repositories.length === 0) break;

    const pageMatches = parsed.data.repositories.filter((repo) => {
      if (ownerFilter && repo.owner.login.toLowerCase() !== ownerFilter) return false;
      if (queryFilter && !repo.name.toLowerCase().includes(queryFilter)) return false;
      return true;
    });
    matched.push(...pageMatches);
    if (matched.length >= normalizedLimit) break;
    if (parsed.data.repositories.length < perPage) break;
  }

  matched.sort(compareByActivity);
  return matched.slice(0, normalizedLimit).map((repo) => ({
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    private: repo.private,
    clone_url: repo.clone_url,
    updated_at: repo.updated_at,
    language: repo.language,
  }));
}

// ---- branches ----

interface GitHubBranch {
  name: string;
}

interface GitHubRepoInfo {
  default_branch: string;
}

function normalizeGitHubLimit(limit: number | undefined): number | undefined {
  return typeof limit === "number" && Number.isFinite(limit)
    ? Math.max(1, Math.min(limit, 100))
    : undefined;
}

async function fetchGitHubAPI<T>(
  endpoint: string,
  token: string,
): Promise<T | null> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

export async function fetchGitHubBranches(
  token: string,
  owner: string,
  repo: string,
  limit?: number,
) {
  const repoInfo = await fetchGitHubAPI<GitHubRepoInfo>(
    `/repos/${owner}/${repo}`,
    token,
  );
  if (!repoInfo) return null;

  const defaultBranch = repoInfo.default_branch;
  const normalizedLimit = normalizeGitHubLimit(limit);
  const allBranches: string[] = [];
  let page = 1;
  const perPage = normalizedLimit ?? 100;
  const maxPages = normalizedLimit ? 1 : 50;

  while (page <= maxPages) {
    const branches = await fetchGitHubAPI<GitHubBranch[]>(
      `/repos/${owner}/${repo}/branches?per_page=${perPage}&page=${page}`,
      token,
    );
    if (!branches) {
      if (page === 1) return null;
      break;
    }
    if (branches.length === 0) break;
    allBranches.push(...branches.map((b) => b.name));
    if (normalizedLimit && allBranches.length >= normalizedLimit) break;
    if (branches.length < perPage) break;
    page++;
  }

  if (normalizedLimit && !allBranches.includes(defaultBranch)) {
    allBranches.push(defaultBranch);
  }

  allBranches.sort((a, b) => {
    if (a === defaultBranch) return -1;
    if (b === defaultBranch) return 1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  return {
    branches: normalizedLimit
      ? allBranches.slice(0, normalizedLimit)
      : allBranches,
    defaultBranch,
  };
}
