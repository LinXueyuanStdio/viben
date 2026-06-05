import type { ContextMode } from "../context-provider.js";
import { cleanSystemTags, isSkillPrompt, isNoiseMessage } from "./message-cleaner.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssistantPart {
  type: "text" | "edit" | "write";
  content?: string;
  file?: string;
  old?: string;
  new?: string;
  fileContent?: string;
}

export interface Turn {
  userText: string;
  userTimestamp: string;
  assistantParts: AssistantPart[];
}

export interface ParseResult {
  turns: Turn[];
  branch: string;
  firstTimestamp: string;
  lastTimestamp: string;
}

export interface SessionMarkdownInput {
  markdown: string;
  startTime: string;
  endTime: string;
  agent: string;
  turns: number;
  branch: string;
  files: string[];
}

// ─── Mode selection ────────────────────────────────────────────────────────────

/**
 * Select rendering mode based on total turn count.
 * Mirrors the same thresholds used by HistoryProvider to keep context depth consistent.
 *   ≤10  → full
 *   11-25 → balanced
 *   >25  → compact
 */
export function selectMode(totalTurns: number): ContextMode {
  if (totalTurns <= 10) return "full";
  if (totalTurns <= 25) return "balanced";
  return "compact";
}

// ─── Token estimation ─────────────────────────────────────────────────────────

// Rough heuristic: 1 token ≈ 4 chars for English/code mixed text.
export function estimateTokens(text: string): number {
  return Math.floor(text.length / 4);
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

function shortenPath(fp: string): string {
  const parts = fp.split("/");
  if (parts.length >= 2) return parts.slice(-2).join("/");
  return fp;
}

function countLines(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split("\n").length;
}

// ─── Content extraction ───────────────────────────────────────────────────────

type ContentBlock = { type: string; [key: string]: unknown };

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b): b is ContentBlock => typeof b === "object" && b !== null && (b as ContentBlock).type === "text")
      .map((b) => (b as unknown as { text: string }).text)
      .join("\n");
  }
  return "";
}

function extractContentBlocks(content: unknown): ContentBlock[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (Array.isArray(content)) {
    return content.filter((b): b is ContentBlock => typeof b === "object" && b !== null);
  }
  return [];
}

function isToolResultOnly(content: unknown): boolean {
  if (typeof content === "string") return false;
  if (!Array.isArray(content)) return true;
  for (const block of content) {
    if (typeof block === "object" && block !== null) {
      const b = block as ContentBlock;
      if (b.type === "text" && typeof b.text === "string" && (b.text as string).trim()) return false;
      if (b.type === "image") return false;
    }
  }
  return true;
}

function hasImage(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some((b) => typeof b === "object" && b !== null && (b as ContentBlock).type === "image");
}

// ─── Format functions ─────────────────────────────────────────────────────────

function formatEditFull(filePath: string, oldStr: string, newStr: string): string {
  const lines: string[] = [];
  lines.push(`✏️ \`${filePath}\``);
  lines.push("```diff");
  for (const line of oldStr.split("\n")) lines.push(`- ${line}`);
  for (const line of newStr.split("\n")) lines.push(`+ ${line}`);
  lines.push("```");
  return lines.join("\n");
}

function formatEditBalanced(filePath: string, oldStr: string, newStr: string, maxDiffLines = 12): string {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const total = oldLines.length + newLines.length;
  const lines: string[] = [];
  lines.push(`✏️ \`${filePath}\``);
  lines.push("```diff");
  if (total <= maxDiffLines) {
    for (const line of oldLines) lines.push(`- ${line}`);
    for (const line of newLines) lines.push(`+ ${line}`);
  } else {
    const half = Math.floor(maxDiffLines / 2);
    for (const line of oldLines.slice(0, half)) lines.push(`- ${line}`);
    if (oldLines.length > half) lines.push(`  ... (-${oldLines.length} lines total)`);
    for (const line of newLines.slice(0, half)) lines.push(`+ ${line}`);
    if (newLines.length > half) lines.push(`  ... (+${newLines.length} lines total)`);
  }
  lines.push("```");
  return lines.join("\n");
}

function formatEditCompact(filePath: string, oldStr: string, newStr: string): string {
  const oldLines = countLines(oldStr);
  const newLines = countLines(newStr);
  let firstNew = "";
  for (const line of newStr.split("\n")) {
    const stripped = line.trim();
    if (stripped && !stripped.startsWith("//") && !stripped.startsWith("*")) {
      firstNew = stripped.slice(0, 80);
      break;
    }
  }
  if (firstNew) {
    return `✏️ \`${filePath}\` (-${oldLines}/+${newLines} lines): \`${firstNew}\``;
  }
  return `✏️ \`${filePath}\` (-${oldLines}/+${newLines} lines)`;
}

function formatWriteFull(filePath: string, content: string): string {
  const lines: string[] = [];
  lines.push(`📝 \`${filePath}\``);
  lines.push("```");
  lines.push(content);
  lines.push("```");
  return lines.join("\n");
}

function formatWriteBalanced(filePath: string, content: string, maxLines = 15): string {
  const contentLines = content.split("\n");
  const lines: string[] = [];
  lines.push(`📝 \`${filePath}\` (${contentLines.length} lines)`);
  lines.push("```");
  for (const line of contentLines.slice(0, maxLines)) lines.push(line);
  if (contentLines.length > maxLines) lines.push(`... (${contentLines.length - maxLines} more lines)`);
  lines.push("```");
  return lines.join("\n");
}

function formatWriteCompact(filePath: string, content: string): string {
  const numLines = countLines(content);
  return `📝 \`${filePath}\` (${numLines} lines written)`;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

interface RawEvent {
  type?: string;
  message?: { role?: string; content?: unknown };
  timestamp?: string;
  uuid?: string;
  parentUuid?: string | null;
  sessionId?: string;
  gitBranch?: string;
}

/**
 * Parse a Claude Code JSONL transcript into structured turns.
 *
 * The JSONL format emitted by Claude Code contains one JSON object per line,
 * with `type` being either "user" or "assistant". Tool results appear as
 * "user" messages with `tool_result` content blocks — these are filtered out
 * since they duplicate information already captured in the assistant's tool_use
 * blocks. Only Edit and Write tool calls are surfaced; read-only tools are skipped
 * because they don't contribute meaningful context about what the agent did.
 */
export function parseJsonlToTurns(jsonl: string): ParseResult {
  const events: RawEvent[] = [];
  for (const rawLine of jsonl.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      events.push(JSON.parse(line) as RawEvent);
    } catch {
      // skip invalid JSON lines
    }
  }

  // Extract gitBranch from first event that has it
  let branch = "unknown";
  for (const e of events) {
    if (e.gitBranch) {
      branch = e.gitBranch;
      break;
    }
  }

  const convEvents = events.filter((e) => e.type === "user" || e.type === "assistant");

  const turns: Turn[] = [];
  let currentTurn: Turn | null = null;

  for (const e of convEvents) {
    const etype = e.type;
    const content = e.message?.content ?? [];
    const ts = e.timestamp ?? "";

    if (etype === "user") {
      if (isToolResultOnly(content)) continue;

      const text = extractText(content);

      if (isSkillPrompt(text)) continue;
      if (isNoiseMessage(text)) continue;

      const cleaned = cleanSystemTags(text);
      if (!cleaned) continue;

      // Push previous turn if any
      if (currentTurn) turns.push(currentTurn);

      const imgSuffix = hasImage(content) ? " [image]" : "";
      currentTurn = {
        userText: cleaned + imgSuffix,
        userTimestamp: ts,
        assistantParts: [],
      };
    } else if (etype === "assistant" && currentTurn) {
      const blocks = extractContentBlocks(content);
      let pendingText: string | null = null;

      for (const block of blocks) {
        const btype = block.type;

        if (btype === "text") {
          const text = typeof block.text === "string" ? (block.text as string).trim() : "";
          if (text) pendingText = text;
        } else if (btype === "tool_use") {
          const name = typeof block.name === "string" ? block.name : "";
          const inp = (typeof block.input === "object" && block.input !== null ? block.input : {}) as Record<string, string>;

          if (name === "Edit") {
            if (pendingText) {
              currentTurn.assistantParts.push({ type: "text", content: pendingText });
              pendingText = null;
            }
            currentTurn.assistantParts.push({
              type: "edit",
              file: shortenPath(inp.file_path ?? ""),
              old: inp.old_string ?? "",
              new: inp.new_string ?? "",
            });
          } else if (name === "Write") {
            if (pendingText) {
              currentTurn.assistantParts.push({ type: "text", content: pendingText });
              pendingText = null;
            }
            currentTurn.assistantParts.push({
              type: "write",
              file: shortenPath(inp.file_path ?? ""),
              fileContent: inp.content ?? "",
            });
          }
          // Skip Read, Bash, Grep, Glob, etc. — these don't show what was *changed*
        }
      }

      if (pendingText) {
        currentTurn.assistantParts.push({ type: "text", content: pendingText });
      }
    }
  }

  if (currentTurn) turns.push(currentTurn);

  const firstTimestamp = turns[0]?.userTimestamp ?? "";
  const lastTimestamp = turns[turns.length - 1]?.userTimestamp ?? "";

  return { turns, branch, firstTimestamp, lastTimestamp };
}

// ─── Markdown builder ─────────────────────────────────────────────────────────

export function buildSessionMarkdown(turns: Turn[], mode: ContextMode): string {
  const out: string[] = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const userText = turn.userText.trim();
    if (!userText) continue;

    out.push(`**User [${i + 1}]:**`);
    out.push(userText);
    out.push("");

    let hasContent = false;

    for (const part of turn.assistantParts) {
      if (part.type === "text") {
        if (!hasContent) {
          out.push("**Assistant:**");
          hasContent = true;
        }
        out.push(part.content ?? "");
        out.push("");
      } else if (part.type === "edit") {
        if (!hasContent) {
          out.push("**Assistant:**");
          hasContent = true;
        }
        const file = part.file ?? "";
        const oldStr = part.old ?? "";
        const newStr = part.new ?? "";
        if (mode === "full") {
          out.push(formatEditFull(file, oldStr, newStr));
        } else if (mode === "balanced") {
          out.push(formatEditBalanced(file, oldStr, newStr));
        } else {
          out.push(formatEditCompact(file, oldStr, newStr));
        }
        out.push("");
      } else if (part.type === "write") {
        if (!hasContent) {
          out.push("**Assistant:**");
          hasContent = true;
        }
        const file = part.file ?? "";
        const content = part.fileContent ?? "";
        if (mode === "full") {
          out.push(formatWriteFull(file, content));
        } else if (mode === "balanced") {
          out.push(formatWriteBalanced(file, content));
        } else {
          out.push(formatWriteCompact(file, content));
        }
        out.push("");
      }
    }

    out.push("---");
    out.push("");
  }

  return out.join("\n");
}

// ─── Session merger ───────────────────────────────────────────────────────────

const DISCLAIMER = `> **Note:** This conversation history may contain outdated information. File contents, code, and project state may have changed since these sessions were recorded. Use this as context only — always verify against current files before acting.`;

export function mergeSessionsMarkdown(
  sessions: SessionMarkdownInput[],
  mode: ContextMode,
  title: string
): string {
  // Sort sessions chronologically (oldest first)
  const sorted = [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const totalTurns = sorted.reduce((sum, s) => sum + s.turns, 0);
  const overallStart = sorted[0]?.startTime.slice(0, 16) ?? "?";
  const overallEnd = sorted[sorted.length - 1]?.endTime.slice(0, 16) ?? "?";

  const out: string[] = [];
  out.push(`# Conversation History from ${title}`);
  out.push(`${sorted.length} sessions | ${totalTurns} turns | ${overallStart} → ${overallEnd} | mode: ${mode}`);
  out.push("");

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const start = s.startTime.slice(0, 16);
    const end = s.endTime.slice(0, 16);
    out.push(`## Session Conversation History ${i + 1} — ${start} → ${end} (${s.agent}, ${s.turns} turns, branch: ${s.branch})`);
    out.push("");
    out.push(s.markdown);
  }

  out.push(DISCLAIMER);
  out.push("");

  return out.join("\n");
}
