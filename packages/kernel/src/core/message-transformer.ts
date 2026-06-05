import * as path from "node:path";
import type { AgentEvent, OutgoingMessage } from "./types.js";
import type { TunnelServiceInterface } from "./plugin/types.js";
import { extractFileInfo } from "./utils/extract-file-info.js";
import { isApplyPatchOtherTool } from "./utils/apply-patch-detection.js";
import { createChildLogger } from "./utils/log.js";

const log = createChildLogger({ module: "message-transformer" });

// Binary file extensions that cannot be displayed in the code viewer
const BINARY_VIEWER_EXTENSIONS = new Set([
  '.wav', '.ogg', '.mp3', '.m4a', '.aac', '.flac', '.opus', '.weba',
  '.mp4', '.avi', '.mov', '.webm', '.mkv',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.ico', '.svg',
  '.pdf', '.zip', '.gz', '.tar', '.7z', '.rar',
  '.bin', '.exe', '.dll', '.so', '.dylib', '.wasm',
]);

/**
 * Compute actual line-level diff by stripping common prefix/suffix lines.
 * This avoids counting unchanged context lines as added/removed.
 */
function computeLineDiff(oldStr: string, newStr: string): { added: number; removed: number } {
  const oldLines = oldStr ? oldStr.split("\n") : [];
  const newLines = newStr ? newStr.split("\n") : [];

  // Find common prefix
  let prefixLen = 0;
  const minLen = Math.min(oldLines.length, newLines.length);
  while (prefixLen < minLen && oldLines[prefixLen] === newLines[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix (not overlapping with prefix)
  let suffixLen = 0;
  const maxSuffix = minLen - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldLines[oldLines.length - 1 - suffixLen] === newLines[newLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  return {
    added: Math.max(0, newLines.length - prefixLen - suffixLen),
    removed: Math.max(0, oldLines.length - prefixLen - suffixLen),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * OpenCode ACP apply_patch may include diff counts in rawOutput.metadata:
 * - metadata.files[].additions/deletions
 * - metadata.additions/deletions
 */
function extractDiffStatsFromRawOutput(rawOutput: unknown): { added: number; removed: number } | null {
  const output = asRecord(rawOutput);
  const metadata = asRecord(output?.metadata);
  if (!metadata) return null;

  const files = Array.isArray(metadata.files) ? metadata.files : null;
  if (files && files.length > 0) {
    let added = 0;
    let removed = 0;
    let hasAny = false;

    for (const file of files) {
      const fileMeta = asRecord(file);
      if (!fileMeta) continue;

      const fileAdded = asNonNegativeNumber(fileMeta.additions);
      const fileRemoved = asNonNegativeNumber(fileMeta.deletions);
      if (fileAdded === null && fileRemoved === null) continue;

      added += fileAdded ?? 0;
      removed += fileRemoved ?? 0;
      hasAny = true;
    }

    if (hasAny && (added > 0 || removed > 0)) return { added, removed };
  }

  const added = asNonNegativeNumber(metadata.additions);
  const removed = asNonNegativeNumber(metadata.deletions);
  if (added === null && removed === null) return null;
  if ((added ?? 0) === 0 && (removed ?? 0) === 0) return null;

  return {
    added: added ?? 0,
    removed: removed ?? 0,
  };
}

function extractDiffStatsFromToolPayload(
  name: string,
  kind: string | undefined,
  rawInput: unknown,
  rawOutput: unknown,
): { added: number; removed: number } | null {
  if (kind === "edit" || kind === "write") {
    const ri = asRecord(rawInput);
    if (!ri) return null;

    const oldStr = typeof ri.old_string === "string" ? ri.old_string : typeof ri.oldText === "string" ? ri.oldText : null;
    const newStr = typeof ri.new_string === "string" ? ri.new_string : typeof ri.newText === "string" ? ri.newText : typeof ri.content === "string" ? ri.content : null;

    if (oldStr !== null && newStr !== null) {
      const stats = computeLineDiff(oldStr, newStr);
      return stats.added > 0 || stats.removed > 0 ? stats : null;
    }

    if (oldStr === null && newStr !== null && kind === "write") {
      // New file creation — no old content, count all new lines as added
      const added = newStr.split("\n").length;
      return added > 0 ? { added, removed: 0 } : null;
    }

    return null;
  }

  if (isApplyPatchOtherTool(kind, name, rawInput)) {
    return extractDiffStatsFromRawOutput(rawOutput);
  }

  return null;
}

/**
 * Transforms AgentEvents into OutgoingMessages suitable for adapter delivery.
 *
 * Handles two key concerns beyond simple type mapping:
 * 1. **Tool input caching** — `tool_call` events carry `rawInput`, but subsequent
 *    `tool_update` events for the same tool often omit it. The transformer caches
 *    rawInput so updates can inherit it for viewer link generation.
 * 2. **Viewer link enrichment** — when a tunnel service is available, tool events
 *    for file reads/edits are enriched with public URLs to the code viewer and diff viewer.
 *    Intermediate updates (with raw content) are preferred over completion events
 *    (which have formatted content with line numbers).
 */
export class MessageTransformer {
  tunnelService?: TunnelServiceInterface;
  /** Cache rawInput from tool_call so it's available in tool_update (which often lacks it) */
  private toolRawInputCache: Map<string, unknown> = new Map();
  /** Cache viewer links generated from intermediate updates so completion events carry them */
  private toolViewerCache: Map<string, { viewerLinks: Record<string, string>; viewerFilePath: string }> = new Map();

  constructor(tunnelService?: TunnelServiceInterface) {
    this.tunnelService = tunnelService;
  }

  /**
   * Convert an agent event to an outgoing message for adapter delivery.
   *
   * For tool events, enriches the metadata with diff stats and viewer links
   * when a tunnel service is available.
   */
  transform(
    event: AgentEvent,
    sessionContext?: { id: string; workingDirectory: string },
  ): OutgoingMessage {
    switch (event.type) {
      case "text":
        return { type: "text", text: event.content };
      case "thought":
        return { type: "thought", text: event.content };
      case "tool_call": {
        // Cache rawInput (only if non-empty) for later tool_update events
        if (event.id && this.isNonEmptyInput(event.rawInput)) {
          this.toolRawInputCache.set(event.id, event.rawInput);
        }
        const meta = event.meta as Record<string, unknown> | undefined;
        const metadata: Record<string, unknown> = {
          id: event.id,
          name: event.name,
          kind: event.kind,
          status: event.status,
          content: event.content,
          locations: event.locations,
          rawInput: event.rawInput,
          displaySummary: meta?.displaySummary,
          displayTitle: meta?.displayTitle,
          displayKind: meta?.displayKind,
        };
        this.enrichWithViewerLinks(event, metadata, sessionContext);
        return { type: "tool_call", text: event.name, metadata };
      }
      case "tool_update": {
        // Update cache if this update carries non-empty rawInput (some agents send it on first update)
        if (event.id && this.isNonEmptyInput(event.rawInput)) {
          this.toolRawInputCache.set(event.id, event.rawInput);
        }
        // Merge cached rawInput when tool_update doesn't carry it
        const cachedRawInput = event.id ? this.toolRawInputCache.get(event.id) : undefined;
        const effectiveRawInput = this.isNonEmptyInput(event.rawInput) ? event.rawInput : cachedRawInput;
        // Clean up cache on terminal status
        if (event.id && (event.status === "completed" || event.status === "done" || event.status === "failed" || event.status === "error")) {
          this.toolRawInputCache.delete(event.id);
        }
        const meta = event.meta as Record<string, unknown> | undefined;
        const metadata: Record<string, unknown> = {
          id: event.id,
          name: event.name,
          kind: event.kind,
          status: event.status,
          content: event.content,
          rawInput: effectiveRawInput,
          displaySummary: meta?.displaySummary,
          displayTitle: meta?.displayTitle,
          displayKind: meta?.displayKind,
        };
        // Use a synthetic event with merged rawInput for enrichWithViewerLinks
        const enrichEvent = { ...event, rawInput: effectiveRawInput };
        this.enrichWithViewerLinks(enrichEvent as typeof event, metadata, sessionContext);
        // Viewer link caching: intermediate updates have raw content (preferred),
        // completion events have formatted content (with line numbers) — always prefer cached
        if (event.id) {
          const cached = this.toolViewerCache.get(event.id);
          if (cached) {
            // Cache already has links from intermediate update (raw content) — always use those
            metadata.viewerLinks = cached.viewerLinks;
            metadata.viewerFilePath = cached.viewerFilePath;
          } else if (metadata.viewerLinks) {
            // First time generating links — cache them
            this.toolViewerCache.set(event.id, {
              viewerLinks: metadata.viewerLinks as Record<string, string>,
              viewerFilePath: metadata.viewerFilePath as string,
            });
          }
          // Clean up viewer cache on terminal status
          if (event.status === "completed" || event.status === "done" || event.status === "failed" || event.status === "error") {
            this.toolViewerCache.delete(event.id);
          }
        }
        return { type: "tool_update", text: "", metadata };
      }
      case "plan":
        return {
          type: "plan",
          text: "",
          metadata: { entries: event.entries },
        };
      case "usage":
        return {
          type: "usage",
          text: "",
          metadata: {
            tokensUsed: event.tokensUsed,
            contextSize: event.contextSize,
            cost: event.cost?.amount,
          },
        };
      case "session_end":
        return { type: "session_end", text: `Done (${event.reason})` };
      case "error":
        return { type: "error", text: event.message };
      case "system_message":
        return { type: "system_message", text: event.message };
      case "session_info_update":
        return {
          type: "system_message",
          text: `Session updated: ${event.title ?? ""}`.trim(),
          metadata: { title: event.title, updatedAt: event.updatedAt },
        };
      case "config_option_update":
        return {
          type: "config_update",
          text: "Config updated",
          metadata: { options: event.options },
        };
      case "user_message_chunk":
        return {
          type: "user_replay",
          text: event.content,
        };
      case "resource_content":
        return {
          type: "resource",
          text: event.name,
          metadata: { uri: event.uri, text: event.text, blob: event.blob, mimeType: event.mimeType },
        };
      case "resource_link":
        return {
          type: "resource_link",
          text: event.name,
          metadata: { uri: event.uri, mimeType: event.mimeType, title: event.title, description: event.description, size: event.size },
        };
      default:
        return { type: "text", text: "" };
    }
  }

  /** Clear cached entries whose key starts with the given prefix. */
  clearSessionCaches(prefix: string): void {
    for (const key of this.toolRawInputCache.keys()) {
      if (key.startsWith(prefix)) this.toolRawInputCache.delete(key);
    }
    for (const key of this.toolViewerCache.keys()) {
      if (key.startsWith(prefix)) this.toolViewerCache.delete(key);
    }
  }

  /** Clear all caches. */
  clearCaches(): void {
    this.toolRawInputCache.clear();
    this.toolViewerCache.clear();
  }

  /** Check if rawInput is a non-empty object (not null, not {}) */
  private isNonEmptyInput(input: unknown): input is Record<string, unknown> {
    return input !== null && input !== undefined && typeof input === "object" && !Array.isArray(input) && Object.keys(input as object).length > 0;
  }

  private enrichWithViewerLinks(
    event: AgentEvent & { type: "tool_call" | "tool_update" },
    metadata: Record<string, unknown>,
    sessionContext?: { id: string; workingDirectory: string },
  ): void {
    const name = "name" in event ? event.name || "" : "";
    // Compute diffStats from tool payload even without tunnelService.
    // Includes edit/write rawInput and apply_patch rawOutput compatibility.
    const kind = "kind" in event ? event.kind : undefined;
    if (!metadata.diffStats) {
      const stats = extractDiffStatsFromToolPayload(name, kind, event.rawInput, event.rawOutput);
      if (stats) metadata.diffStats = stats;
    }

    if (!this.tunnelService || !sessionContext) {
      log.debug(
        { hasTunnel: !!this.tunnelService, hasCtx: !!sessionContext, kind },
        "enrichWithViewerLinks: skipping (no tunnel or session context)",
      );
      return;
    }

    log.debug(
      { name, kind, status: event.status, hasContent: !!event.content, hasRawInput: !!event.rawInput },
      "enrichWithViewerLinks: inspecting event",
    );

    const fileInfo = extractFileInfo(
      name,
      kind,
      event.content,
      event.rawInput,
      event.meta,
      event.rawOutput,
    );
    if (!fileInfo) {
      log.debug(
        { name, kind, hasContent: !!event.content, hasRawInput: !!event.rawInput, hasMeta: !!event.meta },
        "enrichWithViewerLinks: extractFileInfo returned null",
      );
      return;
    }

    // Skip binary/non-text files — they cannot be displayed in the code viewer
    const fileExt = path.extname(fileInfo.filePath).toLowerCase();
    if (BINARY_VIEWER_EXTENSIONS.has(fileExt)) {
      log.debug({ kind, filePath: fileInfo.filePath }, "enrichWithViewerLinks: skipping binary file");
      return;
    }

    // Skip viewer link generation if the tunnel only has a localhost URL —
    // Telegram strips <a href="localhost:..."> tags, rendering plain unclickable text.
    const publicUrl = this.tunnelService.getPublicUrl();
    if (publicUrl.startsWith("http://localhost") || publicUrl.startsWith("http://127.0.0.1")) {
      log.debug({ kind, filePath: fileInfo.filePath }, "enrichWithViewerLinks: skipping (no public tunnel URL)");
      return;
    }

    log.info(
      {
        name,
        kind,
        filePath: fileInfo.filePath,
        hasOldContent: !!fileInfo.oldContent,
      },
      "enrichWithViewerLinks: extracted file info",
    );

    const store = this.tunnelService.getStore();
    const viewerLinks: Record<string, string> = {};

    // For edits/writes with diff data (oldText + newText)
    if (fileInfo.oldContent) {
      const id = store.storeDiff(
        sessionContext.id,
        fileInfo.filePath,
        fileInfo.oldContent,
        fileInfo.content,
        sessionContext.workingDirectory,
      );
      if (id) viewerLinks.diff = this.tunnelService.diffUrl(id);

      // Compute diff stats from full file content only if not already set from rawInput
      if (!metadata.diffStats) {
        const stats = computeLineDiff(fileInfo.oldContent, fileInfo.content);
        if (stats.added > 0 || stats.removed > 0) {
          metadata.diffStats = stats;
        }
      }
    }

    // Always store as file view (new file creation or read)
    const id = store.storeFile(
      sessionContext.id,
      fileInfo.filePath,
      fileInfo.content,
      sessionContext.workingDirectory,
    );
    if (id) viewerLinks.file = this.tunnelService.fileUrl(id);

    if (Object.keys(viewerLinks).length > 0) {
      metadata.viewerLinks = viewerLinks;
      metadata.viewerFilePath = fileInfo.filePath;
    }
  }
}
