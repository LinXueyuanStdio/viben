import fs from "node:fs";
import path from "node:path";
import { OggOpusDecoder } from "ogg-opus-decoder";
import wav from "node-wav";
import type { Attachment } from "../../core/types.js";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "audio/ogg": ".ogg",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/webm": ".webm",
  "audio/mp4": ".m4a",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
};

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
};

function classifyMime(mimeType: string): Attachment["type"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

/**
 * Provides file I/O for session attachments and agent-generated files.
 *
 * All files are stored under `baseDir/<sessionId>/` so that access is naturally
 * scoped per session and cleanup is a single directory removal. File names are
 * sanitized and prefixed with a timestamp to prevent collisions and path traversal.
 *
 * This service acts as the security boundary between adapters/agents and the
 * filesystem — callers never write directly; they go through `saveFile` so that
 * naming, MIME classification, and path normalization are always applied.
 */
export class FileService {
  constructor(readonly baseDir: string) {}

  /**
   * Remove session file directories older than maxAgeDays.
   * Called on startup to prevent unbounded disk growth.
   */
  async cleanupOldFiles(maxAgeDays: number): Promise<number> {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    try {
      const entries = await fs.promises.readdir(this.baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirPath = path.join(this.baseDir, entry.name);
        try {
          const stat = await fs.promises.stat(dirPath);
          if (stat.mtimeMs < cutoff) {
            await fs.promises.rm(dirPath, { recursive: true, force: true });
            removed++;
          }
        } catch {
          // Skip inaccessible directories
        }
      }
    } catch {
      // Base dir doesn't exist yet — nothing to clean
    }
    return removed;
  }

  /**
   * Persist a file to the session's directory and return an `Attachment` descriptor.
   *
   * The file name is sanitized (non-safe characters replaced with `_`) and prefixed
   * with a millisecond timestamp to prevent name collisions across multiple saves in
   * the same session. The original `fileName` is preserved in the returned descriptor
   * so the user-facing name is not lost.
   */
  async saveFile(
    sessionId: string,
    fileName: string,
    data: Buffer,
    mimeType: string,
  ): Promise<Attachment> {
    const sessionDir = path.join(this.baseDir, sessionId);
    await fs.promises.mkdir(sessionDir, { recursive: true });

    // Sanitize to prevent path traversal and filesystem issues
    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(sessionDir, safeName);
    await fs.promises.writeFile(filePath, data);

    return {
      type: classifyMime(mimeType),
      filePath,
      fileName,
      mimeType,
      size: data.length,
    };
  }

  /**
   * Build an `Attachment` descriptor for a file that already exists on disk.
   * Returns `null` if the path does not exist or is not a regular file.
   */
  async resolveFile(filePath: string): Promise<Attachment | null> {
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) return null;

      const ext = path.extname(filePath).toLowerCase();
      const mimeType = EXT_TO_MIME[ext] || "application/octet-stream";

      return {
        type: classifyMime(mimeType),
        filePath,
        fileName: path.basename(filePath),
        mimeType,
        size: stat.size,
      };
    } catch {
      return null;
    }
  }

  /**
   * Convert OGG Opus audio to WAV format.
   * Telegram voice messages use OGG Opus which many AI agents can't read.
   */
  async convertOggToWav(oggData: Buffer): Promise<Buffer> {
    const decoder = new OggOpusDecoder();
    await decoder.ready;
    try {
      const { channelData, sampleRate } = await decoder.decode(new Uint8Array(oggData));
      const wavData = wav.encode(channelData, { sampleRate, float: true, bitDepth: 32 });
      return Buffer.from(wavData);
    } finally {
      decoder.free();
    }
  }

  /** Instance method — delegates to static for FileServiceInterface compliance */
  async readTextFileWithRange(
    filePath: string,
    options?: { line?: number; limit?: number },
  ): Promise<string> {
    return FileService.readTextFileWithRange(filePath, options);
  }

  static async readTextFileWithRange(
    filePath: string,
    options?: { line?: number; limit?: number },
  ): Promise<string> {
    // Delegate to core utility (canonical implementation)
    const { readTextFileWithRange } = await import("../../core/utils/read-text-file.js");
    return readTextFileWithRange(filePath, options);
  }

  /** Instance method — delegates to static for FileServiceInterface compliance */
  extensionFromMime(mimeType: string): string {
    return FileService.extensionFromMime(mimeType);
  }

  /** Returns the canonical file extension for a given MIME type (e.g. `"image/png"` → `".png"`). */
  static extensionFromMime(mimeType: string): string {
    return MIME_TO_EXT[mimeType] || ".bin";
  }
}
