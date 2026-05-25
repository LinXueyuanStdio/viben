/**
 * GitHub Download Utility
 *
 * Provides functionality for downloading repositories from GitHub.
 * Uses GitHub's zipball API endpoint which doesn't require authentication
 * for public repositories.
 *
 * Usage:
 * ```ts
 * import { downloadFromGitHub } from "../utils/github-download";
 *
 * const result = await downloadFromGitHub({
 *   owner: "anthropics",
 *   repo: "claude-mcp-server",
 *   ref: "v1.0.0", // optional, defaults to default branch
 *   targetDir: "/path/to/install",
 * });
 * ```
 */
import { writeFile, rm, mkdir, rename, readdir } from "node:fs/promises";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { ensureDir, fileExists } from "../config/yaml";
import { proxyFetch } from "../http";

/**
 * Options for downloading from GitHub
 */
export interface GitHubDownloadOptions {
  /** Repository owner (user or organization) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Git ref (branch, tag, or commit SHA). If not provided, uses default branch */
  ref?: string;
  /** Target directory to extract to */
  targetDir: string;
  /** Optional progress callback */
  onProgress?: (progress: number) => void;
}

/**
 * Result of GitHub download operation
 */
export interface GitHubDownloadResult {
  /** Whether the download was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Version/ref that was downloaded */
  version?: string;
}

/**
 * Download and extract a GitHub repository
 *
 * Uses GitHub's zipball API endpoint:
 * https://api.github.com/repos/{owner}/{repo}/zipball/{ref}
 *
 * For public repositories, no authentication is required.
 *
 * @param options - Download options
 * @returns Download result
 */
export async function downloadFromGitHub(
  options: GitHubDownloadOptions
): Promise<GitHubDownloadResult> {
  const { owner, repo, ref, targetDir, onProgress } = options;

  // Build the GitHub API URL for zipball
  // If ref is not provided, GitHub returns the default branch
  const refPath = ref || "HEAD";
  const zipballUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${refPath}`;

  onProgress?.(0);

  try {
    // Fetch the zipball from GitHub
    const response = await proxyFetch(zipballUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "viben-cli",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: `Repository '${owner}/${repo}' not found or ref '${refPath}' does not exist`,
        };
      }
      if (response.status === 403) {
        return {
          success: false,
          error: "GitHub API rate limit exceeded. Please try again later.",
        };
      }
      return {
        success: false,
        error: `GitHub API error: ${response.status} ${response.statusText}`,
      };
    }

    onProgress?.(30);

    // Get the response as array buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    onProgress?.(50);

    // Ensure target directory exists
    await ensureDir(targetDir);

    // Write the zip file to a temporary location
    const zipPath = join(targetDir, ".github-download.zip");
    await writeFile(zipPath, buffer);

    onProgress?.(60);

    // Extract the zip file
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipPath);
    } catch (error) {
      await rm(zipPath, { force: true });
      return {
        success: false,
        error: `Failed to read zip file: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }

    const entries = zip.getEntries();
    if (entries.length === 0) {
      await rm(zipPath, { force: true });
      return {
        success: false,
        error: "Downloaded zip file is empty",
      };
    }

    onProgress?.(70);

    // GitHub zipballs have a root directory like "owner-repo-sha/"
    // We need to extract contents without this root directory
    const rootDir = findRootDirectory(entries);

    // Extract to a temporary directory first
    const tempDir = join(targetDir, ".github-extract-temp");
    await ensureDir(tempDir);

    try {
      zip.extractAllTo(tempDir, true);

      onProgress?.(85);

      // Move contents from the root directory to target
      if (rootDir) {
        const extractedRootPath = join(tempDir, rootDir);
        if (fileExists(extractedRootPath)) {
          // Move all files from extracted root to target
          const items = await readdir(extractedRootPath, { withFileTypes: true });
          for (const item of items) {
            const srcPath = join(extractedRootPath, item.name);
            const destPath = join(targetDir, item.name);
            await rename(srcPath, destPath);
          }
        }
      } else {
        // No root directory, move everything
        const items = await readdir(tempDir, { withFileTypes: true });
        for (const item of items) {
          const srcPath = join(tempDir, item.name);
          const destPath = join(targetDir, item.name);
          await rename(srcPath, destPath);
        }
      }
    } finally {
      // Clean up temporary files
      await rm(tempDir, { recursive: true, force: true });
      await rm(zipPath, { force: true });
    }

    onProgress?.(100);

    // Determine version from ref or try to extract from downloaded content
    const version = ref || "latest";

    return {
      success: true,
      version,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during download",
    };
  }
}

/**
 * Find the root directory in GitHub zipball entries
 *
 * GitHub zipballs always have a single root directory like "owner-repo-sha/"
 * This function finds that root directory name.
 */
function findRootDirectory(entries: AdmZip.IZipEntry[]): string | undefined {
  const roots = new Set<string>();

  for (const entry of entries) {
    const parts = entry.entryName.split("/");
    if (parts.length > 0 && parts[0]) {
      roots.add(parts[0]);
    }
  }

  // GitHub zipballs should have exactly one root
  return roots.size === 1 ? Array.from(roots)[0] : undefined;
}

/**
 * Parse a GitHub spec into owner, repo, and ref
 *
 * Formats:
 * - gh:user/repo
 * - gh:user/repo#ref
 *
 * @param spec - GitHub spec string
 * @returns Parsed components or null if invalid
 */
export function parseGitHubSpec(spec: string): {
  owner: string;
  repo: string;
  ref?: string;
} | null {
  if (!spec.startsWith("gh:")) {
    return null;
  }

  const ghPart = spec.slice(3);
  const [repoPath, ref] = ghPart.split("#");
  const [owner, repo] = repoPath.split("/");

  if (!owner || !repo) {
    return null;
  }

  return {
    owner,
    repo,
    ref: ref || undefined,
  };
}
