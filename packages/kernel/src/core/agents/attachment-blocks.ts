/**
 * Attachment handling utilities for building ACP prompt content blocks.
 *
 * Extracted as a pure module so the logic can be unit-tested independently
 * of AgentInstance (which requires a subprocess to instantiate).
 */

import type { Attachment } from "../types.js";

/** Image MIME types supported by the Claude API for base64 inline content. */
export const SUPPORTED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
]);

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

export interface PromptCapabilities {
  image?: boolean;
  audio?: boolean;
}

/**
 * Determines if an attachment should be skipped (not included as base64 content block).
 *
 * Returns a human-readable note to append to the prompt text when the attachment
 * cannot be embedded, or null when the attachment should be included normally.
 *
 * This function does NOT read the file — it only classifies the attachment based
 * on its metadata. Path validation and file reading remain in AgentInstance.prompt().
 */
export function buildAttachmentNote(
  att: Attachment,
  capabilities: PromptCapabilities,
): string | null {
  const tooLarge = att.size > MAX_ATTACHMENT_SIZE;

  if (tooLarge) {
    const sizeMB = Math.round(att.size / 1024 / 1024);
    return `[Attachment skipped: "${att.fileName}" is too large (${sizeMB}MB > 10MB limit)]`;
  }

  if (att.type === "image") {
    if (!capabilities.image) {
      // Agent doesn't support image content — will fall back to file path
      return null;
    }
    if (!SUPPORTED_IMAGE_MIMES.has(att.mimeType)) {
      return `[Attachment skipped: image format not supported (${att.mimeType})]`;
    }
    // Supported — include as base64 block
    return null;
  }

  if (att.type === "audio") {
    if (!capabilities.audio) {
      // Agent doesn't support audio content — will fall back to file path
      return null;
    }
    // Supported — include as base64 block
    return null;
  }

  // Generic file attachment — always falls back to file path, no note needed
  return null;
}
