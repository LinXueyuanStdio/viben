/**
 * File operations routes
 *
 * Provides HTTP API for file system operations:
 * - GET /api/files/list - List directory contents
 * - POST /api/files - Create file
 * - POST /api/files/directory - Create directory
 * - GET /api/files/content - Read file content
 * - PUT /api/files/content - Write file content
 * - DELETE /api/files - Delete file or directory
 * - PUT /api/files/rename - Rename file or directory
 * - POST /api/files/copy - Copy file or directory
 * - POST /api/files/move - Move file or directory
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  readdir,
  stat,
  mkdir,
  readFile,
  writeFile,
  rm,
  rename,
  cp,
} from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, dirname, basename, resolve, extname } from "node:path";
import { homedir, platform } from "node:os";
import { spawn } from "node:child_process";

// ============================================================================
// Types
// ============================================================================

/**
 * File entry in directory listing
 */
interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_file: boolean;
  is_symlink: boolean;
  size: number;
  created_at: string;
  modified_at: string;
  extension?: string;
}

/**
 * Query parameters for listing directory
 */
interface ListQuery {
  path: string;
  show_hidden?: string;
}

/**
 * Query parameters for reading file
 */
interface ReadQuery {
  path: string;
  encoding?: string;
}

/**
 * Body for creating file
 */
interface CreateFileBody {
  path: string;
  content?: string;
  encoding?: string;
}

/**
 * Body for creating directory
 */
interface CreateDirectoryBody {
  path: string;
  recursive?: boolean;
}

/**
 * Body for writing file content
 */
interface WriteFileBody {
  path: string;
  content: string;
  encoding?: string;
}

/**
 * Body for deleting file/directory
 */
interface DeleteBody {
  path: string;
  recursive?: boolean;
}

/**
 * Body for renaming file/directory
 */
interface RenameBody {
  old_path: string;
  new_path: string;
}

/**
 * Body for copying file/directory
 */
interface CopyBody {
  source: string;
  destination: string;
  recursive?: boolean;
}

/**
 * Body for moving file/directory
 */
interface MoveBody {
  source: string;
  destination: string;
}

/**
 * Body for opening file with specific app
 */
interface OpenWithBody {
  path: string;
  app_id?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolve path, supporting ~ for home directory
 */
function resolvePath(path: string): string {
  if (path.startsWith("~")) {
    return join(homedir(), path.slice(1));
  }
  return resolve(path);
}

/**
 * Get file entry info
 */
async function getFileEntry(filePath: string, name: string): Promise<FileEntry> {
  const stats = await stat(filePath);
  return {
    name,
    path: filePath,
    is_directory: stats.isDirectory(),
    is_file: stats.isFile(),
    is_symlink: stats.isSymbolicLink(),
    size: stats.size,
    created_at: stats.birthtime.toISOString(),
    modified_at: stats.mtime.toISOString(),
    extension: stats.isFile() ? extname(name).slice(1) || undefined : undefined,
  };
}

/**
 * Validate and resolve path. Throws on invalid paths.
 */
function validateAndResolvePath(path: string): string {
  const resolved = resolvePath(path);

  // Basic validation - path should not be empty
  if (!resolved || resolved.length === 0) {
    throw new Error("Path cannot be empty");
  }

  // Check for common dangerous patterns
  if (resolved.includes("\0")) {
    throw new Error("Path contains null bytes");
  }

  return resolved;
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register file operation routes
 */
export function registerFileRoutes(fastify: FastifyInstance): void {
  // ========================================================================
  // List Directory
  // ========================================================================

  /**
   * List directory contents
   * GET /api/files/list?path=...&show_hidden=true
   */
  fastify.get(
    "/api/files/list",
    async (
      request: FastifyRequest<{ Querystring: ListQuery }>,
      reply: FastifyReply
    ) => {
      const { path: requestPath, show_hidden } = request.query;

      if (!requestPath) {
        reply.code(400);
        return { error: "Path is required" };
      }

      let dirPath: string;
      try {
        dirPath = validateAndResolvePath(requestPath);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Invalid path" };
      }

      if (!existsSync(dirPath)) {
        reply.code(404);
        return { error: `Path does not exist: ${dirPath}` };
      }

      try {
        const stats = await stat(dirPath);
        if (!stats.isDirectory()) {
          reply.code(400);
          return { error: `Path is not a directory: ${dirPath}` };
        }

        const entries = await readdir(dirPath, { withFileTypes: true });
        const showHidden = show_hidden === "true";

        const files: FileEntry[] = [];
        for (const entry of entries) {
          // Skip hidden files unless explicitly requested
          if (!showHidden && entry.name.startsWith(".")) {
            continue;
          }

          try {
            const entryPath = join(dirPath, entry.name);
            const fileEntry = await getFileEntry(entryPath, entry.name);
            files.push(fileEntry);
          } catch {
            // Skip entries we can't stat (permission issues, etc.)
          }
        }

        // Sort: directories first, then alphabetically
        files.sort((a, b) => {
          if (a.is_directory && !b.is_directory) return -1;
          if (!a.is_directory && b.is_directory) return 1;
          return a.name.localeCompare(b.name);
        });

        return {
          path: dirPath,
          entries: files,
          total: files.length,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to list directory" };
      }
    }
  );

  // ========================================================================
  // Read File
  // ========================================================================

  /**
   * Read file content
   * GET /api/files/content?path=...&encoding=utf-8
   */
  fastify.get(
    "/api/files/content",
    async (
      request: FastifyRequest<{ Querystring: ReadQuery }>,
      reply: FastifyReply
    ) => {
      const { path: requestPath, encoding = "utf-8" } = request.query;

      if (!requestPath) {
        reply.code(400);
        return { error: "Path is required" };
      }

      let filePath: string;
      try {
        filePath = validateAndResolvePath(requestPath);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Invalid path" };
      }

      if (!existsSync(filePath)) {
        reply.code(404);
        return { error: `File does not exist: ${filePath}` };
      }

      try {
        const stats = await stat(filePath);
        if (!stats.isFile()) {
          reply.code(400);
          return { error: `Path is not a file: ${filePath}` };
        }

        const content = await readFile(filePath, {
          encoding: encoding as BufferEncoding,
        });

        return {
          path: filePath,
          content,
          size: stats.size,
          encoding,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to read file" };
      }
    }
  );

  // ========================================================================
  // Create File
  // ========================================================================

  /**
   * Create a new file
   * POST /api/files
   */
  fastify.post(
    "/api/files",
    async (
      request: FastifyRequest<{ Body: CreateFileBody }>,
      reply: FastifyReply
    ) => {
      const { path: requestPath, content = "", encoding = "utf-8" } = request.body;

      if (!requestPath) {
        reply.code(400);
        return { error: "Path is required" };
      }

      let filePath: string;
      try {
        filePath = validateAndResolvePath(requestPath);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Invalid path" };
      }

      try {
        // Ensure parent directory exists
        const parentDir = dirname(filePath);
        if (!existsSync(parentDir)) {
          await mkdir(parentDir, { recursive: true });
        }

        // Check if file already exists
        if (existsSync(filePath)) {
          reply.code(409);
          return { error: `File already exists: ${filePath}` };
        }

        await writeFile(filePath, content, {
          encoding: encoding as BufferEncoding,
        });

        const fileEntry = await getFileEntry(filePath, basename(filePath));
        reply.code(201);
        return fileEntry;
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to create file" };
      }
    }
  );

  // ========================================================================
  // Create Directory
  // ========================================================================

  /**
   * Create a new directory
   * POST /api/files/directory
   */
  fastify.post(
    "/api/files/directory",
    async (
      request: FastifyRequest<{ Body: CreateDirectoryBody }>,
      reply: FastifyReply
    ) => {
      const { path: requestPath, recursive = true } = request.body;

      if (!requestPath) {
        reply.code(400);
        return { error: "Path is required" };
      }

      let dirPath: string;
      try {
        dirPath = validateAndResolvePath(requestPath);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Invalid path" };
      }

      try {
        // Check if already exists
        if (existsSync(dirPath)) {
          const stats = await stat(dirPath);
          if (stats.isDirectory()) {
            reply.code(409);
            return { error: `Directory already exists: ${dirPath}` };
          }
          reply.code(400);
          return { error: `Path exists but is not a directory: ${dirPath}` };
        }

        await mkdir(dirPath, { recursive });

        const fileEntry = await getFileEntry(dirPath, basename(dirPath));
        reply.code(201);
        return fileEntry;
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to create directory" };
      }
    }
  );

  // ========================================================================
  // Write File
  // ========================================================================

  /**
   * Write content to file (create or overwrite)
   * PUT /api/files/content
   */
  fastify.put(
    "/api/files/content",
    async (
      request: FastifyRequest<{ Body: WriteFileBody }>,
      reply: FastifyReply
    ) => {
      const { path: requestPath, content, encoding = "utf-8" } = request.body;

      if (!requestPath) {
        reply.code(400);
        return { error: "Path is required" };
      }

      if (content === undefined) {
        reply.code(400);
        return { error: "Content is required" };
      }

      let filePath: string;
      try {
        filePath = validateAndResolvePath(requestPath);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Invalid path" };
      }

      try {
        // Ensure parent directory exists
        const parentDir = dirname(filePath);
        if (!existsSync(parentDir)) {
          await mkdir(parentDir, { recursive: true });
        }

        await writeFile(filePath, content, {
          encoding: encoding as BufferEncoding,
        });

        const fileEntry = await getFileEntry(filePath, basename(filePath));
        return {
          success: true,
          file: fileEntry,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to write file" };
      }
    }
  );

  // ========================================================================
  // Delete File/Directory
  // ========================================================================

  /**
   * Delete a file or directory
   * DELETE /api/files
   */
  fastify.delete(
    "/api/files",
    async (
      request: FastifyRequest<{ Body: DeleteBody }>,
      reply: FastifyReply
    ) => {
      const { path: requestPath, recursive = false } = request.body;

      if (!requestPath) {
        reply.code(400);
        return { error: "Path is required" };
      }

      let targetPath: string;
      try {
        targetPath = validateAndResolvePath(requestPath);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Invalid path" };
      }

      if (!existsSync(targetPath)) {
        reply.code(404);
        return { error: `Path does not exist: ${targetPath}` };
      }

      try {
        await rm(targetPath, { recursive, force: false });

        return {
          success: true,
          deleted: targetPath,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to delete" };
      }
    }
  );

  // ========================================================================
  // Rename File/Directory
  // ========================================================================

  /**
   * Rename a file or directory
   * PUT /api/files/rename
   */
  fastify.put(
    "/api/files/rename",
    async (
      request: FastifyRequest<{ Body: RenameBody }>,
      reply: FastifyReply
    ) => {
      const { old_path, new_path } = request.body;

      if (!old_path || !new_path) {
        reply.code(400);
        return { error: "Both old_path and new_path are required" };
      }

      let oldPath: string;
      let newPath: string;
      try {
        oldPath = validateAndResolvePath(old_path);
        newPath = validateAndResolvePath(new_path);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Invalid path" };
      }

      if (!existsSync(oldPath)) {
        reply.code(404);
        return { error: `Source path does not exist: ${oldPath}` };
      }

      if (existsSync(newPath)) {
        reply.code(409);
        return { error: `Destination path already exists: ${newPath}` };
      }

      try {
        // Ensure parent directory of new path exists
        const parentDir = dirname(newPath);
        if (!existsSync(parentDir)) {
          await mkdir(parentDir, { recursive: true });
        }

        await rename(oldPath, newPath);

        const fileEntry = await getFileEntry(newPath, basename(newPath));
        return {
          success: true,
          old_path: oldPath,
          new_path: newPath,
          file: fileEntry,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to rename" };
      }
    }
  );

  // ========================================================================
  // Copy File/Directory
  // ========================================================================

  /**
   * Copy a file or directory
   * POST /api/files/copy
   */
  fastify.post(
    "/api/files/copy",
    async (
      request: FastifyRequest<{ Body: CopyBody }>,
      reply: FastifyReply
    ) => {
      const { source, destination, recursive = true } = request.body;

      if (!source || !destination) {
        reply.code(400);
        return { error: "Both source and destination are required" };
      }

      let sourcePath: string;
      let destPath: string;
      try {
        sourcePath = validateAndResolvePath(source);
        destPath = validateAndResolvePath(destination);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Invalid path" };
      }

      if (!existsSync(sourcePath)) {
        reply.code(404);
        return { error: `Source path does not exist: ${sourcePath}` };
      }

      try {
        // Ensure parent directory of destination exists
        const parentDir = dirname(destPath);
        if (!existsSync(parentDir)) {
          await mkdir(parentDir, { recursive: true });
        }

        await cp(sourcePath, destPath, { recursive });

        const fileEntry = await getFileEntry(destPath, basename(destPath));
        reply.code(201);
        return {
          success: true,
          source: sourcePath,
          destination: destPath,
          file: fileEntry,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to copy" };
      }
    }
  );

  // ========================================================================
  // Move File/Directory
  // ========================================================================

  /**
   * Move a file or directory
   * POST /api/files/move
   */
  fastify.post(
    "/api/files/move",
    async (
      request: FastifyRequest<{ Body: MoveBody }>,
      reply: FastifyReply
    ) => {
      const { source, destination } = request.body;

      if (!source || !destination) {
        reply.code(400);
        return { error: "Both source and destination are required" };
      }

      let sourcePath: string;
      let destPath: string;
      try {
        sourcePath = validateAndResolvePath(source);
        destPath = validateAndResolvePath(destination);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Invalid path" };
      }

      if (!existsSync(sourcePath)) {
        reply.code(404);
        return { error: `Source path does not exist: ${sourcePath}` };
      }

      try {
        // Ensure parent directory of destination exists
        const parentDir = dirname(destPath);
        if (!existsSync(parentDir)) {
          await mkdir(parentDir, { recursive: true });
        }

        await rename(sourcePath, destPath);

        const fileEntry = await getFileEntry(destPath, basename(destPath));
        return {
          success: true,
          source: sourcePath,
          destination: destPath,
          file: fileEntry,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to move" };
      }
    }
  );

  // ========================================================================
  // Open File With App
  // ========================================================================

  /**
   * Open a file with a specific application
   * POST /api/files/open
   */
  fastify.post(
    "/api/files/open",
    async (
      request: FastifyRequest<{ Body: OpenWithBody }>,
      reply: FastifyReply
    ) => {
      const { path: requestPath, app_id } = request.body;

      if (!requestPath) {
        reply.code(400);
        return { error: "Path is required" };
      }

      let filePath: string;
      try {
        filePath = validateAndResolvePath(requestPath);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Invalid path" };
      }

      if (!existsSync(filePath)) {
        reply.code(404);
        return { error: `Path does not exist: ${filePath}` };
      }

      try {
        const currentPlatform = platform();

        if (currentPlatform === "darwin") {
          // macOS
          if (app_id) {
            switch (app_id) {
              case "vscode": {
                // Try 'code' command first
                const codeProcess = spawn("code", [filePath], {
                  detached: true,
                  stdio: "ignore",
                });
                codeProcess.unref();
                break;
              }
              case "cursor": {
                // Try 'cursor' command first
                const cursorProcess = spawn("cursor", [filePath], {
                  detached: true,
                  stdio: "ignore",
                });
                cursorProcess.unref();
                break;
              }
              case "preview": {
                // Use open -a Preview
                const previewProcess = spawn("open", ["-a", "Preview", filePath], {
                  detached: true,
                  stdio: "ignore",
                });
                previewProcess.unref();
                break;
              }
              default: {
                // Unknown app, try to open with default
                const defaultProcess = spawn("open", [filePath], {
                  detached: true,
                  stdio: "ignore",
                });
                defaultProcess.unref();
              }
            }
          } else {
            // Open with system default
            const openProcess = spawn("open", [filePath], {
              detached: true,
              stdio: "ignore",
            });
            openProcess.unref();
          }
        } else if (currentPlatform === "win32") {
          // Windows
          if (app_id) {
            switch (app_id) {
              case "vscode": {
                const codeProcess = spawn("code", [filePath], {
                  detached: true,
                  stdio: "ignore",
                  shell: true,
                });
                codeProcess.unref();
                break;
              }
              case "cursor": {
                const cursorProcess = spawn("cursor", [filePath], {
                  detached: true,
                  stdio: "ignore",
                  shell: true,
                });
                cursorProcess.unref();
                break;
              }
              default: {
                const defaultProcess = spawn("cmd", ["/c", "start", "", filePath], {
                  detached: true,
                  stdio: "ignore",
                });
                defaultProcess.unref();
              }
            }
          } else {
            const openProcess = spawn("cmd", ["/c", "start", "", filePath], {
              detached: true,
              stdio: "ignore",
            });
            openProcess.unref();
          }
        } else {
          // Linux
          if (app_id) {
            switch (app_id) {
              case "vscode": {
                const codeProcess = spawn("code", [filePath], {
                  detached: true,
                  stdio: "ignore",
                });
                codeProcess.unref();
                break;
              }
              case "cursor": {
                const cursorProcess = spawn("cursor", [filePath], {
                  detached: true,
                  stdio: "ignore",
                });
                cursorProcess.unref();
              break;
              }
              default: {
                const defaultProcess = spawn("xdg-open", [filePath], {
                  detached: true,
                  stdio: "ignore",
                });
                defaultProcess.unref();
              }
            }
          } else {
            const openProcess = spawn("xdg-open", [filePath], {
              detached: true,
              stdio: "ignore",
            });
            openProcess.unref();
          }
        }

        return {
          success: true,
          path: filePath,
          app_id: app_id || "default",
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to open file" };
      }
    }
  );

  // ========================================================================
  // Show in Finder/Explorer
  // ========================================================================

  /**
   * Show file in system file manager (Finder/Explorer)
   * POST /api/files/reveal
   */
  fastify.post(
    "/api/files/reveal",
    async (
      request: FastifyRequest<{ Body: { path: string } }>,
      reply: FastifyReply
    ) => {
      const { path: requestPath } = request.body;

      if (!requestPath) {
        reply.code(400);
        return { error: "Path is required" };
      }

      let filePath: string;
      try {
        filePath = validateAndResolvePath(requestPath);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Invalid path" };
      }

      if (!existsSync(filePath)) {
        reply.code(404);
        return { error: `Path does not exist: ${filePath}` };
      }

      try {
        const currentPlatform = platform();
        const stats = await stat(filePath);
        const targetPath = stats.isDirectory() ? filePath : dirname(filePath);

        if (currentPlatform === "darwin") {
          // macOS - use 'open' to reveal in Finder
          const revealProcess = spawn("open", [targetPath], {
            detached: true,
            stdio: "ignore",
          });
          revealProcess.unref();
        } else if (currentPlatform === "win32") {
          // Windows - use 'explorer'
          const revealProcess = spawn("explorer", [targetPath], {
            detached: true,
            stdio: "ignore",
          });
          revealProcess.unref();
        } else {
          // Linux - use 'xdg-open'
          const revealProcess = spawn("xdg-open", [targetPath], {
            detached: true,
            stdio: "ignore",
          });
          revealProcess.unref();
        }

        return {
          success: true,
          path: targetPath,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to reveal in file manager" };
      }
    }
  );
}
