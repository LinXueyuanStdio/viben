import type { Attachment } from '../../../core/types.js';
import type { FileServiceInterface } from '../../../core/plugin/types.js';
import type { AttachmentInput } from '../schemas/sessions.js';
import { promises as fs } from 'node:fs';

/**
 * Decode base64 attachment inputs and persist them via FileService.
 *
 * Cleans up already-written files if a subsequent write fails, so the caller
 * never observes a partially-saved set of attachments on disk.
 *
 * @throws {Error} if fileService is unavailable or any individual save fails
 *   (after cleanup of previously written files in the same batch).
 */
export async function resolveAttachments(
  fileService: FileServiceInterface,
  sessionId: string,
  inputs: AttachmentInput[],
): Promise<Attachment[]> {
  const saved: Attachment[] = [];
  try {
    for (const att of inputs) {
      const buf = Buffer.from(att.data, 'base64');
      const attachment = await fileService.saveFile(sessionId, att.fileName, buf, att.mimeType);
      saved.push(attachment);
    }
  } catch (err) {
    // Clean up any files already persisted in this batch to avoid orphans
    await Promise.allSettled(saved.map((a) => fs.unlink(a.filePath)));
    throw err;
  }
  return saved;
}
