/**
 * Filesystem routes
 *
 * Provides HTTP API for filesystem operations like opening folders,
 * reading directories, and managing config files.
 */
import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size?: number;
  modified?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the viben config directory
 */
function getConfigDir(): string {
  return process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "viben")
    : process.platform === "win32"
      ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "viben")
      : join(homedir(), ".config", "viben");
}

/**
 * Open a folder in the system file manager
 */
async function openFolder(folderPath: string): Promise<void> {
  const platform = process.platform;

  if (platform === "darwin") {
    await execAsync(`open "${folderPath}"`);
  } else if (platform === "win32") {
    await execAsync(`explorer "${folderPath}"`);
  } else {
    await execAsync(`xdg-open "${folderPath}"`);
  }
}

/**
 * Reveal a path in the system file manager
 */
async function revealInFileManager(targetPath: string): Promise<void> {
  const platform = process.platform;

  if (platform === "darwin") {
    await execAsync(`open -R "${targetPath}"`);
  } else if (platform === "win32") {
    await execAsync(`explorer /select,"${targetPath}"`);
  } else {
    // Linux doesn't have a universal "reveal" command, so open the parent directory
    const dir = dirname(targetPath);
    await execAsync(`xdg-open "${dir}"`);
  }
}

/**
 * Open a file with a specific application
 */
async function openWithApp(filePath: string, appId?: string): Promise<void> {
  const platform = process.platform;

  if (platform === "darwin") {
    if (appId) {
      // Try to open with specific app
      const appMapping: Record<string, string> = {
        vscode: "Visual Studio Code",
        cursor: "Cursor",
        preview: "Preview",
      };
      const appName = appMapping[appId] || appId;
      try {
        await execAsync(`open -a "${appName}" "${filePath}"`);
        return;
      } catch {
        // Fall back to default app
      }
    }
    await execAsync(`open "${filePath}"`);
  } else if (platform === "win32") {
    if (appId) {
      const appMapping: Record<string, string> = {
        vscode: "code",
        cursor: "cursor",
      };
      const appCmd = appMapping[appId];
      if (appCmd) {
        try {
          await execAsync(`${appCmd} "${filePath}"`);
          return;
        } catch {
          // Fall back to default app
        }
      }
    }
    await execAsync(`start "" "${filePath}"`);
  } else {
    if (appId) {
      const appMapping: Record<string, string> = {
        vscode: "code",
        cursor: "cursor",
      };
      const appCmd = appMapping[appId];
      if (appCmd) {
        try {
          await execAsync(`${appCmd} "${filePath}"`);
          return;
        } catch {
          // Fall back to default app
        }
      }
    }
    await execAsync(`xdg-open "${filePath}"`);
  }
}

/**
 * Read directory contents
 */
async function readDirectory(dirPath: string): Promise<FileEntry[]> {
  if (!existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: FileEntry[] = [];

  for (const entry of entries) {
    // Skip hidden files
    if (entry.name.startsWith(".")) {
      continue;
    }

    const entryPath = join(dirPath, entry.name);

    try {
      const stats = await stat(entryPath);
      files.push({
        name: entry.name,
        path: entryPath,
        is_directory: entry.isDirectory(),
        size: entry.isFile() ? stats.size : undefined,
        modified: stats.mtime.toISOString(),
      });
    } catch {
      // Skip files we can't stat
      files.push({
        name: entry.name,
        path: entryPath,
        is_directory: entry.isDirectory(),
      });
    }
  }

  // Sort: directories first, then files, alphabetically
  files.sort((a, b) => {
    if (a.is_directory && !b.is_directory) return -1;
    if (!a.is_directory && b.is_directory) return 1;
    return a.name.localeCompare(b.name);
  });

  return files;
}

// ============================================================================
// Routes
// ============================================================================

export function registerFilesystemRoutes(fastify: FastifyInstance): void {
  /**
   * Open a folder in file manager
   * POST /api/files/open-folder
   */
  fastify.post<{
    Body: { path: string };
  }>("/api/files/open-folder", async (request, reply) => {
    const { path } = request.body;

    if (!path) {
      reply.code(400);
      return { error: "path is required" };
    }

    try {
      await openFolder(path);
      return { opened: true };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Note: /api/files/reveal and /api/files/open are defined in files.ts
  // to avoid duplicate route registration

  /**
   * Read directory contents
   * GET /api/files/directory
   */
  fastify.get<{
    Querystring: { workspace_path: string; dir_path?: string };
  }>("/api/files/directory", async (request, reply) => {
    const { workspace_path, dir_path } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required" };
    }

    const targetPath = dir_path || workspace_path;

    // Security check: ensure target is within workspace
    if (!targetPath.startsWith(workspace_path)) {
      reply.code(403);
      return { error: "Access denied: path outside workspace" };
    }

    try {
      const files = await readDirectory(targetPath);
      return files;
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Note: GET /api/files/content is defined in files.ts
  // to avoid duplicate route registration


  /**
   * Get config directory path
   * GET /api/files/config-dir
   */
  fastify.get("/api/files/config-dir", async () => {
    return { path: getConfigDir() };
  });

  /**
   * Get git status for a directory
   * GET /api/files/git-status?workspace_path=...&dir_path=...
   * Returns list of changed files relative to the directory
   */
  fastify.get<{
    Querystring: { workspace_path: string; dir_path?: string };
  }>("/api/files/git-status", async (request, reply) => {
    const { workspace_path, dir_path } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required" };
    }

    const targetDir = dir_path
      ? (dir_path.startsWith(workspace_path) ? dir_path : join(workspace_path, dir_path))
      : workspace_path;

    try {
      // Use --untracked-files=all so individual files are listed instead of collapsed directories
      const { stdout } = await execAsync(
        `git -C "${workspace_path}" status --porcelain --no-renames --untracked-files=all "${targetDir}"`,
      );

      if (!stdout.trim()) {
        return [];
      }

      const changes = stdout.trim().split("\n").map((line) => {
        const statusCode = line.substring(0, 2).trim();
        const filePath = line.substring(3);

        let status: "modified" | "added" | "deleted" | "renamed";
        switch (statusCode) {
          case "M":
          case "MM":
          case "AM":
            status = "modified";
            break;
          case "A":
          case "??":
            status = "added";
            break;
          case "D":
            status = "deleted";
            break;
          case "R":
            status = "renamed";
            break;
          default:
            status = "modified";
        }

        return { path: filePath, status };
      });

      return changes;
    } catch (err) {
      // Not a git repo or git not available
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not a git repository") || message.includes("command not found")) {
        return [];
      }
      reply.code(500);
      return { error: message };
    }
  });

  /**
   * Get git diff for a specific file
   * GET /api/files/git-diff?workspace_path=...&file_path=...
   * Returns old and new content for diff viewing
   */
  fastify.get<{
    Querystring: { workspace_path: string; file_path: string };
  }>("/api/files/git-diff", async (request, reply) => {
    const { workspace_path, file_path } = request.query;

    if (!workspace_path || !file_path) {
      reply.code(400);
      return { error: "workspace_path and file_path are required" };
    }

    try {
      // Get the original (HEAD) version
      let oldContent = "";
      try {
        const { stdout } = await execAsync(
          `git -C "${workspace_path}" show HEAD:"${file_path}"`,
        );
        oldContent = stdout;
      } catch {
        // File is new (untracked), no HEAD version
        oldContent = "";
      }

      // Get the current working version
      const fullPath = file_path.startsWith("/") ? file_path : join(workspace_path, file_path);
      let newContent = "";
      try {
        newContent = await readFile(fullPath, "utf-8");
      } catch {
        // File was deleted
        newContent = "";
      }

      return { oldContent, newContent };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });
}
