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

interface McpServersConfig {
  mcpServers: Record<string, unknown>;
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
 * Get the MCP servers config file path
 */
function getMcpServersPath(): string {
  return join(getConfigDir(), "mcp-servers.json");
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
   * Read MCP servers config file
   * GET /api/files/mcp-servers
   */
  fastify.get("/api/files/mcp-servers", async () => {
    const configPath = getMcpServersPath();

    try {
      if (!existsSync(configPath)) {
        return { mcpServers: {} };
      }

      const content = await readFile(configPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return { mcpServers: {} };
    }
  });

  /**
   * Write MCP servers config file
   * PUT /api/files/mcp-servers
   */
  fastify.put<{
    Body: McpServersConfig;
  }>("/api/files/mcp-servers", async (request) => {
    const configPath = getMcpServersPath();
    const dir = dirname(configPath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(configPath, JSON.stringify(request.body, null, 2), "utf-8");
    return { written: true };
  });

  /**
   * Get config directory path
   * GET /api/files/config-dir
   */
  fastify.get("/api/files/config-dir", async () => {
    return { path: getConfigDir() };
  });
}
