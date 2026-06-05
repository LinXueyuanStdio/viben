// src/core/adapter-primitives/display-spec-builder.ts

import { KIND_ICONS } from "./format-types.js";
import type { OutputMode, ViewerLinks } from "./format-types.js";
import type { ToolEntry } from "./stream-accumulator.js";
import type { TunnelServiceInterface } from "../plugin/types.js";
import { isApplyPatchOtherTool } from "../utils/apply-patch-detection.js";

// ─── Output spec interfaces ────────────────────────────────────────────────

/**
 * A fully resolved, platform-agnostic description of how to display a tool call.
 * Built by DisplaySpecBuilder from a ToolEntry + output mode, then consumed
 * by adapters to render tool cards.
 */
export interface ToolDisplaySpec {
  id: string;
  kind: string;
  icon: string;
  title: string;
  description: string | null;
  command: string | null;
  inputContent: string | null;
  outputSummary: string | null;
  outputContent: string | null;
  diffStats: { added: number; removed: number } | null;
  viewerLinks?: ViewerLinks;
  outputViewerLink?: string;
  outputFallbackContent?: string;
  /** Working directory of the session that produced this tool call.
   *  Adapters can use this to display relative paths instead of absolute ones. */
  workingDirectory?: string;
  status: string;
  isNoise: boolean;
  isHidden: boolean;
}

/** Display specification for an agent's extended thinking block. */
export interface ThoughtDisplaySpec {
  indicator: string;
  /** Full thought text, only populated at high verbosity. */
  content: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Kinds that have a runnable command in rawInput.command */
const EXECUTE_KINDS = new Set(["execute", "bash", "command", "terminal"]);

const INLINE_MAX_LINES = 15;
const INLINE_MAX_CHARS = 800;

// ─── Helpers ──────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/**
 * Try multiple field name variants (snake_case and camelCase) and return the
 * first non-empty string value found. Needed because different agents use
 * different naming conventions (e.g. Claude Code uses `file_path`, OpenCode
 * uses `filePath`).
 */
function getStringField(input: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

/**
 * Extract target file paths from an apply_patch patch text.
 * Handles "Update File", "Add File", and "Delete File" directives.
 */
function parseApplyPatchTargets(patchText: string): string[] {
  const targets: string[] = [];
  const seen = new Set<string>();
  for (const line of patchText.split("\n")) {
    const match = line.match(/^\*\*\*\s+(?:Update|Add|Delete)\s+File:\s+(.+)$/);
    if (!match) continue;
    const p = match[1].trim();
    if (p && !seen.has(p)) { seen.add(p); targets.push(p); }
  }
  return targets;
}

function buildTitle(entry: ToolEntry, kind: string): string {
  // Explicit overrides take highest priority
  if (entry.displayTitle) return entry.displayTitle;
  if (entry.displaySummary) return entry.displaySummary;

  const input = asRecord(entry.rawInput);
  const nameLower = entry.name.toLowerCase();

  // apply_patch: keep title parsing based on patchText even when we map display
  // kind to "edit" for simpler icon/label compatibility.
  if (isApplyPatchOtherTool(entry.kind, entry.name, entry.rawInput)) {
    const patchText = getStringField(input, ["patchText", "patch_text"]);
    if (patchText) {
      const targets = parseApplyPatchTargets(patchText);
      if (targets.length === 1) return targets[0];
      if (targets.length > 1) {
        const shown = targets.slice(0, 2).join(", ");
        const rest = targets.length - 2;
        return rest > 0 ? `${shown} (+${rest} more)` : shown;
      }
    }
    return "apply_patch";
  }

  if (kind === "read") {
    // Support both snake_case (Claude Code) and camelCase (OpenCode) field names
    const filePath = getStringField(input, ["file_path", "filePath", "path"]);
    if (filePath) {
      // start_line/end_line style
      const startLine = typeof input.start_line === "number" ? input.start_line : null;
      const endLine = typeof input.end_line === "number" ? input.end_line : null;
      if (startLine !== null && endLine !== null) return `${filePath} (lines ${startLine}–${endLine})`;
      if (startLine !== null) return `${filePath} (from line ${startLine})`;
      // offset/limit style (Claude Code Read tool)
      const offset = typeof input.offset === "number" ? input.offset : null;
      const limit = typeof input.limit === "number" ? input.limit : null;
      if (offset !== null && limit !== null) return `${filePath} (lines ${offset}–${offset + limit - 1})`;
      if (offset !== null) return `${filePath} (from line ${offset})`;
      return filePath;
    }
    return capitalize(entry.name);
  }

  if (kind === "edit" || kind === "write" || kind === "delete") {
    // Support both snake_case and camelCase field names
    const filePath = getStringField(input, ["file_path", "filePath", "path"]);
    if (filePath) return filePath;
    return capitalize(entry.name);
  }

  if (EXECUTE_KINDS.has(kind)) {
    const description = typeof input.description === "string" ? input.description : null;
    if (description) return description;
    const command = typeof input.command === "string" ? input.command : null;
    if (command) return command.length > 60 ? command.slice(0, 57) + "..." : command;
    return capitalize(entry.name);
  }

  if (kind === "agent") {
    const skill = typeof input.skill === "string" ? input.skill : null;
    const description = typeof input.description === "string" ? input.description : null;
    const subtype = typeof input.subagent_type === "string" ? input.subagent_type : null;
    if (skill) return skill;
    if (description) return description.length > 60 ? description.slice(0, 57) + "..." : description;
    if (subtype) return subtype;
    return capitalize(entry.name);
  }

  if (kind === "search") {
    const pattern =
      typeof input.pattern === "string"
        ? input.pattern
        : typeof input.query === "string"
          ? input.query
          : null;
    if (pattern) {
      let title = `${capitalize(entry.name)} "${pattern}"`;
      const glob = typeof input.glob === "string" ? input.glob : null;
      const type = typeof input.type === "string" ? input.type : null;
      if (glob) title += ` (glob: ${glob})`;
      else if (type) title += ` (type: ${type})`;
      return title;
    }
    return capitalize(entry.name);
  }

  if (kind === "fetch" || kind === "web") {
    const url = typeof input.url === "string" ? input.url : null;
    if (url && url !== "undefined") return url.length > 60 ? url.slice(0, 57) + "..." : url;
    const query = typeof input.query === "string" ? input.query : null;
    if (query && query !== "undefined") return query.length > 60 ? query.slice(0, 57) + "..." : query;
    return capitalize(entry.name);
  }

  // Show skill name for Skill tool calls (e.g. Claude Code's Skill tool)
  if (nameLower === "skill" && typeof input.skill === "string" && input.skill) {
    return input.skill;
  }

  // todowrite / TodoWrite: well-known todo list tool (Claude Code, others)
  // Summarise progress so the card shows "Todo list (2/5 done, 1 active)"
  // rather than just the bare tool name.
  if (nameLower === "todowrite") {
    const todos = Array.isArray(input.todos) ? input.todos : [];
    if (todos.length > 0) {
      const completed = todos.filter((t) => isRecord(t) && t.status === "completed").length;
      const active = todos.filter((t) => isRecord(t) && t.status === "in_progress").length;
      return `Todo list (${completed}/${todos.length} done${active > 0 ? `, ${active} active` : ""})`;
    }
    return "Todo list";
  }

  return entry.name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function buildOutputSummary(content: string): string {
  const lines = content.split("\n").length;
  return `${lines} line${lines === 1 ? "" : "s"} of output`;
}

function isShortOutput(content: string): boolean {
  return content.split("\n").length <= INLINE_MAX_LINES && content.length <= INLINE_MAX_CHARS;
}

/** Check if title was derived from the command (exact match or truncated version) */
function isTitleFromCommand(title: string, command: string): boolean {
  return title === command || (command.length > 60 && title === command.slice(0, 57) + "...");
}

// ─── DisplaySpecBuilder ───────────────────────────────────────────────────

/**
 * Transforms raw ToolEntry state into display-ready ToolDisplaySpec objects.
 *
 * This is the central place where output mode (low/medium/high) controls what
 * information is included in tool cards. Low mode strips metadata; medium mode
 * includes summaries; high mode includes full output content and viewer links.
 */
export class DisplaySpecBuilder {
  constructor(private tunnelService?: TunnelServiceInterface) {}

  /**
   * Builds a display spec for a single tool call entry.
   *
   * Deduplicates fields to avoid repeating the same info (e.g., if the title
   * was derived from the command, the command field is omitted). For long
   * output, generates a viewer link via the tunnel service when available.
   */
  buildToolSpec(
    entry: ToolEntry,
    mode: OutputMode,
    sessionContext?: { id: string; workingDirectory: string },
  ): ToolDisplaySpec {
    const effectiveKind = entry.displayKind ?? (isApplyPatchOtherTool(entry.kind, entry.name, entry.rawInput) ? "edit" : entry.kind);
    const icon = KIND_ICONS[effectiveKind] ?? KIND_ICONS["other"] ?? "🛠️";
    const title = buildTitle(entry, effectiveKind);
    const isHidden = entry.isNoise && mode !== "high";

    // Fields that are always null on low
    const includeMeta = mode !== "low";

    const input = asRecord(entry.rawInput);

    // Deduplicate: skip description if it matches title, kind label, or tool name
    const rawDescription = typeof input.description === "string" ? input.description : null;
    const descLower = rawDescription?.toLowerCase();
    const description =
      includeMeta && rawDescription && rawDescription !== title
        && descLower !== effectiveKind && descLower !== entry.name.toLowerCase()
        ? rawDescription : null;

    // Deduplicate: skip command if title was derived from it
    const rawCommand =
      EXECUTE_KINDS.has(effectiveKind) && typeof input.command === "string"
        ? input.command
        : null;
    const command =
      includeMeta && rawCommand && !isTitleFromCommand(title, rawCommand)
        ? rawCommand
        : null;

    const inputContent: string | null = null;

    const content = entry.content;

    let outputSummary: string | null = null;
    let outputContent: string | null = null;
    let outputViewerLink: string | undefined = undefined;
    let outputFallbackContent: string | undefined = undefined;

    if (content && content.trim().length > 0 && includeMeta) {
      outputSummary = buildOutputSummary(content);

      const isLong = !isShortOutput(content);

      if (isLong) {
        const publicUrl = this.tunnelService?.getPublicUrl();
        const hasPublicTunnel = !!publicUrl && !publicUrl.startsWith("http://localhost") && !publicUrl.startsWith("http://127.0.0.1");
        if (this.tunnelService && sessionContext && hasPublicTunnel) {
          const label =
            typeof input.command === "string" ? input.command : entry.name;
          const id = this.tunnelService.getStore().storeOutput(sessionContext.id, label, content);
          if (id !== null) {
            outputViewerLink = this.tunnelService.outputUrl(id);
          }
        } else if (mode === "high") {
          outputFallbackContent = content;
        }
      } else if (mode === "high") {
        outputContent = content;
      }
    }

    const diffStats = includeMeta ? (entry.diffStats ?? null) : null;

    return {
      id: entry.id,
      kind: effectiveKind,
      icon,
      title,
      description,
      command,
      inputContent,
      outputSummary,
      outputContent,
      diffStats,
      viewerLinks: entry.viewerLinks,
      outputViewerLink,
      outputFallbackContent,
      workingDirectory: sessionContext?.workingDirectory,
      status: entry.status,
      isNoise: entry.isNoise,
      isHidden,
    };
  }

  /** Builds a display spec for an agent thought. Content is only included at high verbosity. */
  buildThoughtSpec(content: string, mode: OutputMode): ThoughtDisplaySpec {
    const indicator = "Thinking...";
    return {
      indicator,
      content: mode === "high" ? content : null,
    };
  }
}
