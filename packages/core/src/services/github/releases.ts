/**
 * GitHub Releases Service
 *
 * Handles release operations:
 * - List releases
 * - Get release details
 * - Create release
 */

import { requireAuth } from "./auth";
import { requireRepository } from "./repository";
import { githubRequest } from "./utils";
import type {
  GitHubRelease,
  GitHubReleaseAsset,
  GitHubUser,
  GitHubListReleasesParams,
  GitHubPaginatedResponse,
  GitHubCreateReleaseRequest,
} from "../../types/github";

// ============================================================================
// API Response Types
// ============================================================================

interface ReleaseAPIResponse {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  author: {
    id: number;
    login: string;
    name?: string;
    avatar_url: string;
    html_url: string;
    email?: string;
  };
  html_url: string;
  target_commitish: string;
  assets: Array<{
    id: number;
    name: string;
    content_type: string;
    size: number;
    browser_download_url: string;
    download_count: number;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapUser(user: ReleaseAPIResponse["author"]): GitHubUser {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    email: user.email,
  };
}

function mapAsset(asset: ReleaseAPIResponse["assets"][0]): GitHubReleaseAsset {
  return {
    id: asset.id,
    name: asset.name,
    content_type: asset.content_type,
    size: asset.size,
    browser_download_url: asset.browser_download_url,
    download_count: asset.download_count,
  };
}

function mapRelease(release: ReleaseAPIResponse): GitHubRelease {
  return {
    id: release.id,
    tag_name: release.tag_name,
    name: release.name || undefined,
    body: release.body || undefined,
    draft: release.draft,
    prerelease: release.prerelease,
    created_at: release.created_at,
    published_at: release.published_at || undefined,
    author: mapUser(release.author),
    html_url: release.html_url,
    target_commitish: release.target_commitish,
    assets: release.assets.map(mapAsset),
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List releases for connected repository
 * @param workspacePath - Absolute path to the workspace
 * @param params - Query parameters
 * @returns Paginated list of releases
 */
export async function listReleases(
  workspacePath: string,
  params: GitHubListReleasesParams = {}
): Promise<GitHubPaginatedResponse<GitHubRelease>> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const { page = 1, per_page = 30 } = params;

  const queryParams = new URLSearchParams({
    page: String(page),
    per_page: String(per_page),
  });

  const { data } = await githubRequest<ReleaseAPIResponse[]>(
    token,
    `/repos/${repo.owner}/${repo.name}/releases?${queryParams.toString()}`
  );

  const releases = data.map(mapRelease);

  return {
    items: releases,
    page,
    per_page,
    has_more: data.length === per_page,
  };
}

/**
 * Get a release by ID
 * @param workspacePath - Absolute path to the workspace
 * @param releaseId - Release ID
 * @returns Release details
 */
export async function getRelease(
  workspacePath: string,
  releaseId: number
): Promise<GitHubRelease> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const { data } = await githubRequest<ReleaseAPIResponse>(
    token,
    `/repos/${repo.owner}/${repo.name}/releases/${releaseId}`
  );

  return mapRelease(data);
}

/**
 * Get release by tag name
 * @param workspacePath - Absolute path to the workspace
 * @param tagName - Tag name
 * @returns Release details
 */
export async function getReleaseByTag(
  workspacePath: string,
  tagName: string
): Promise<GitHubRelease> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const { data } = await githubRequest<ReleaseAPIResponse>(
    token,
    `/repos/${repo.owner}/${repo.name}/releases/tags/${tagName}`
  );

  return mapRelease(data);
}

/**
 * Get latest release
 * @param workspacePath - Absolute path to the workspace
 * @returns Latest release details
 */
export async function getLatestRelease(
  workspacePath: string
): Promise<GitHubRelease> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const { data } = await githubRequest<ReleaseAPIResponse>(
    token,
    `/repos/${repo.owner}/${repo.name}/releases/latest`
  );

  return mapRelease(data);
}

/**
 * Create a new release
 * @param workspacePath - Absolute path to the workspace
 * @param request - Release creation parameters
 * @returns Created release
 */
export async function createRelease(
  workspacePath: string,
  request: GitHubCreateReleaseRequest
): Promise<GitHubRelease> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const { data } = await githubRequest<ReleaseAPIResponse>(
    token,
    `/repos/${repo.owner}/${repo.name}/releases`,
    {
      method: "POST",
      body: {
        tag_name: request.tag_name,
        name: request.name,
        body: request.body,
        draft: request.draft,
        prerelease: request.prerelease,
        target_commitish: request.target_commitish || repo.default_branch,
      },
    }
  );

  return mapRelease(data);
}

/**
 * Generate release notes
 * @param workspacePath - Absolute path to the workspace
 * @param tagName - Tag name for the release
 * @param previousTag - Previous tag for comparison (optional)
 * @returns Generated release notes
 */
export async function generateReleaseNotes(
  workspacePath: string,
  tagName: string,
  previousTag?: string
): Promise<{ name: string; body: string }> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  interface ReleaseNotesResponse {
    name: string;
    body: string;
  }

  const body: Record<string, string> = {
    tag_name: tagName,
  };

  if (previousTag) {
    body.previous_tag_name = previousTag;
  }

  const { data } = await githubRequest<ReleaseNotesResponse>(
    token,
    `/repos/${repo.owner}/${repo.name}/releases/generate-notes`,
    {
      method: "POST",
      body,
    }
  );

  return {
    name: data.name,
    body: data.body,
  };
}
