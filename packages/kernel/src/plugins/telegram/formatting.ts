import type {
  ToolCallMeta,
  ToolUpdateMeta,
  ViewerLinks,
} from "../../core/adapter-primitives/format-types.js";
import type { ToolCardSnapshot } from "../../core/adapter-primitives/primitives/tool-card-state.js";
import type { ToolDisplaySpec } from "../../core/adapter-primitives/display-spec-builder.js";
import {
  STATUS_ICONS,
  KIND_ICONS,
  KIND_LABELS,
} from "../../core/adapter-primitives/format-types.js";
import {
  progressBar,
  formatTokens,
  truncateContent,
  stripCodeFences,
  splitMessage as sharedSplitMessage,
} from "../../core/adapter-primitives/format-utils.js";
import {
  extractContentText,
  formatToolSummary,
  formatToolTitle,
  resolveToolIcon,
} from "../../core/adapter-primitives/message-formatter.js";
import type { DisplayVerbosity } from "../../core/adapter-primitives/format-types.js";

/**
 * Escape characters that have special meaning in Telegram HTML parse mode.
 * Must be applied to all user/agent-provided strings before embedding in HTML messages.
 */
export function escapeHtml(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert Markdown to Telegram HTML parse mode.
 *
 * Telegram supports HTML rather than MarkdownV2 because MarkdownV2 requires
 * escaping almost every punctuation character, which breaks real-world agent
 * output (file paths, diffs, JSON, etc.). HTML mode only requires escaping
 * `&`, `<`, and `>`, making it far more reliable for agent-generated content.
 *
 * Strategy: code blocks/inline code are extracted into placeholders first so
 * that subsequent HTML escaping and markdown transformations don't corrupt them.
 */
export function markdownToTelegramHtml(md: string): string {
  // Step 1: Extract code blocks and inline code into placeholders
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  // Extract fenced code blocks (```lang\n...\n```)
  let text = md.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_match, lang: string, code: string) => {
      const index = codeBlocks.length;
      const escapedCode = escapeHtml(code);
      const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      codeBlocks.push(`<pre><code${langAttr}>${escapedCode}</code></pre>`);
      return `\x00CODE_BLOCK_${index}\x00`;
    },
  );

  // Extract inline code (`...`)
  text = text.replace(/`([^`]+)`/g, (_match, code: string) => {
    const index = inlineCodes.length;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `\x00INLINE_CODE_${index}\x00`;
  });

  // Step 2: Escape HTML in remaining text
  text = escapeHtml(text);

  // Step 3: Apply markdown transformations
  // Bold: **text** → <b>text</b>
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

  // Italic: *text* → <i>text</i> (but not the ** used for bold)
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<i>$1</i>");

  // Links: [text](url) → <a href="url">text</a>
  // Note: after escapeHtml, parentheses are not affected, but we need to handle
  // the escaped brackets properly. Since [ ] and ( ) are not escaped, this works directly.
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Step 4: Restore fenced code blocks
  text = text.replace(/\x00CODE_BLOCK_(\d+)\x00/g, (_match, idx: string) => {
    return codeBlocks[parseInt(idx, 10)];
  });

  // Step 5: Restore inline code
  text = text.replace(/\x00INLINE_CODE_(\d+)\x00/g, (_match, idx: string) => {
    return inlineCodes[parseInt(idx, 10)];
  });

  return text;
}

/**
 * Render a tool call event as Telegram HTML.
 * Higher verbosity levels show more input/output detail.
 */
export function formatToolCall(
  tool: ToolCallMeta,
  verbosity: DisplayVerbosity = "medium",
): string {
  const si = resolveToolIcon(tool);
  const name = tool.name || "Tool";
  const label =
    verbosity === "low"
      ? formatToolTitle(name, tool.rawInput, tool.displayTitle)
      : formatToolSummary(name, tool.rawInput, tool.displaySummary);
  let text = `${si} <b>${escapeHtml(label)}</b>`;
  // viewer links always shown regardless of verbosity
  text += formatViewerLinks(tool.viewerLinks, tool.viewerFilePath);
  // high only: rawInput + content
  if (verbosity === "high") {
    text += formatHighDetails(tool.rawInput, tool.content, 3800);
  }
  return text;
}

export function formatToolUpdate(
  update: ToolUpdateMeta,
  verbosity: DisplayVerbosity = "medium",
): string {
  return formatToolCall(update, verbosity);
}

function formatHighDetails(
  rawInput: unknown,
  content: unknown,
  maxLen: number,
): string {
  let text = "";
  if (rawInput) {
    const inputStr =
      typeof rawInput === "string"
        ? rawInput
        : JSON.stringify(rawInput, null, 2);
    if (inputStr && inputStr !== "{}") {
      text += `\n<b>Input:</b>\n<pre>${escapeHtml(truncateContent(inputStr, maxLen))}</pre>`;
    }
  }
  const details = stripCodeFences(extractContentText(content));
  if (details) {
    text += `\n<b>Output:</b>\n<pre>${escapeHtml(truncateContent(details, maxLen))}</pre>`;
  }
  return text;
}

function formatViewerLinks(links?: ViewerLinks, filePath?: string): string {
  if (!links) return "";
  const fileName = filePath ? filePath.split("/").pop() || filePath : "";
  let text = "\n";
  if (links.file)
    text += `\n📄 <a href="${escapeHtml(links.file)}">View ${escapeHtml(fileName || "file")}</a>`;
  if (links.diff)
    text += `\n📝 <a href="${escapeHtml(links.diff)}">View diff${fileName ? ` — ${escapeHtml(fileName)}` : ""}</a>`;
  return text;
}

export function formatPlan(plan: {
  entries: Array<{ content: string; status: string }>;
}): string {
  const { entries } = plan;
  const statusIcon: Record<string, string> = {
    pending: "⬜",
    in_progress: "🔄",
    completed: "✅",
  };
  const lines = entries.map(
    (e, i) =>
      `${statusIcon[e.status] || "⬜"} ${i + 1}. ${escapeHtml(e.content)}`,
  );
  return `<b>Plan:</b>\n${lines.join("\n")}`;
}

/**
 * Render token usage as a visual bar + percentage.
 * Shows a warning emoji when context is ≥85% full to alert users before hitting limits.
 */
export function formatUsage(
  usage: { tokensUsed?: number; contextSize?: number; cost?: number },
  _verbosity: DisplayVerbosity = "medium",
): string {
  const { tokensUsed, contextSize } = usage;
  if (tokensUsed == null) return "📊 Usage data unavailable";
  if (contextSize == null) return `📊 ${formatTokens(tokensUsed)} tokens`;

  const ratio = tokensUsed / contextSize;
  const pct = Math.round(ratio * 100);
  const bar = progressBar(ratio);
  const emoji = pct >= 85 ? "⚠️" : "📊";
  return `${emoji} ${formatTokens(tokensUsed)} / ${formatTokens(contextSize)} tokens\n${bar} ${pct}%`;
}

export function formatSummary(summary: string, sessionName?: string): string {
  const header = sessionName
    ? `📋 <b>Summary — ${escapeHtml(sessionName)}</b>`
    : "📋 <b>Session Summary</b>";
  return `${header}\n\n${escapeHtml(summary)}`;
}

export function splitMessage(text: string, maxLength = 3800): string[] {
  return sharedSplitMessage(text, maxLength);
}

export function renderToolCard(snap: ToolCardSnapshot): string {
  const sections: string[] = [];

  const { totalVisible, completedVisible, allComplete } = snap;
  const headerCheck = allComplete ? " ✅" : "";
  if (totalVisible > 0) {
    sections.push(`<b>📋 Tools (${completedVisible}/${totalVisible})</b>${headerCheck}`);
  }

  const DONE = new Set(["completed", "done", "failed", "error"]);
  const visible = snap.specs.filter((s) => !s.isHidden);
  const completed = visible.filter((s) => DONE.has(s.status));
  const running = visible.filter((s) => !DONE.has(s.status));

  for (const spec of completed) {
    sections.push(renderSpecSection(spec));
  }

  if (snap.planEntries && snap.planEntries.length > 0) {
    const planDone = snap.planEntries.filter((e) => e.status === "completed").length;
    const planTotal = snap.planEntries.length;
    sections.push(`── Plan: ${planDone}/${planTotal} ──`);
    const statusIcon: Record<string, string> = { completed: "✅", in_progress: "🔄", pending: "⬜" };
    for (let i = 0; i < snap.planEntries.length; i++) {
      const e = snap.planEntries[i];
      sections.push(`${statusIcon[e.status] ?? "⬜"} ${i + 1}. ${escapeHtml(e.content)}`);
    }
    sections.push("────");
  }

  for (const spec of running) {
    sections.push(renderSpecSection(spec));
  }

  return sections.join("\n\n");
}

const FILE_KINDS = new Set(["read", "edit", "write", "delete"]);

function normalizePathLike(pathLike: string): string {
  return pathLike.replace(/\\/g, "/");
}

/**
 * Shorten a file-path title for display in Telegram tool cards.
 *
 * Strategy (in priority order):
 * 1. If `workingDirectory` is provided and the path starts with it,
 *    return the relative path  →  "src/foo.ts (lines 1–10)"
 *    Also handles comma-separated multi-file titles (e.g. apply_patch).
 * 2. For file-kind titles, fall back to basename  →  "foo.ts (lines 1–10)"
 * 3. Non-file-kind titles are returned unchanged.
 */
function shortenTitle(title: string, kind: string, workingDirectory?: string): string {
  if (!title.includes("/")) return title;

  const parenIdx = title.indexOf(" (");
  const pathPart = parenIdx > 0 ? title.slice(0, parenIdx) : title;
  const rangePart = parenIdx > 0 ? title.slice(parenIdx) : "";

  if (workingDirectory) {
    const normalizedPathPart = normalizePathLike(pathPart);
    const normalizedCwd = normalizePathLike(workingDirectory).replace(/\/+$/, "");
    const prefix = `${normalizedCwd}/`;
    const relativized = normalizedPathPart
      .split(", ")
      .map((segment) => (segment.startsWith(prefix) ? segment.slice(prefix.length) : segment))
      .join(", ");
    if (relativized !== normalizedPathPart) return relativized + rangePart;
  }

  if (FILE_KINDS.has(kind)) return basename(pathPart) + rangePart;
  return title;
}

/** Extract the last path segment for use in link labels. */
function basename(pathLike: string): string {
  return pathLike.replace(/\\/g, "/").split("/").pop() || pathLike;
}

function renderSpecSection(spec: ToolDisplaySpec): string {
  const lines: string[] = [];

  const DONE = new Set(["completed", "done", "failed", "error"]);
  // Status prefix at the start so text doesn't shift when status changes
  const statusPrefix =
    spec.status === "error" || spec.status === "failed"
      ? "❌ "
      : DONE.has(spec.status)
        ? "✅ "
        : "🔄 ";

  // Build title line: "✅ 📖 Read · filename.ts"
  const kindLabel = KIND_LABELS[spec.kind];
  const displayTitle = shortenTitle(spec.title, spec.kind, spec.workingDirectory);
  // Suppress title when it duplicates the kind label (e.g. "Edit · Edit")
  const hasUniqueTitle = displayTitle && displayTitle.toLowerCase() !== kindLabel?.toLowerCase()
    && displayTitle.toLowerCase() !== spec.kind;
  let titleLine: string;
  if (kindLabel) {
    titleLine = hasUniqueTitle
      ? `${statusPrefix}${spec.icon} <b>${kindLabel}</b> · ${escapeHtml(displayTitle)}`
      : `${statusPrefix}${spec.icon} <b>${kindLabel}</b>`;
  } else {
    titleLine = `${statusPrefix}${spec.icon} ${escapeHtml(displayTitle)}`;
  }
  if (spec.diffStats) {
    const { added, removed } = spec.diffStats;
    if (added > 0 && removed > 0) titleLine += ` · <i>+${added}/-${removed} lines</i>`;
    else if (added > 0) titleLine += ` · <i>+${added} lines</i>`;
    else if (removed > 0) titleLine += ` · <i>-${removed} lines</i>`;
  }
  lines.push(titleLine);

  if (spec.description) lines.push(`   <i>${escapeHtml(spec.description)}</i>`);
  if (spec.command) lines.push(`   <code>${escapeHtml(spec.command)}</code>`);
  if (spec.inputContent) {
    const truncated = spec.inputContent.length > 800 ? spec.inputContent.slice(0, 797) + "…" : spec.inputContent;
    lines.push(`   <pre><code>${escapeHtml(truncated)}</code></pre>`);
  }
  if (spec.outputSummary) lines.push(`   · ${escapeHtml(spec.outputSummary)}`);
  if (spec.outputContent || spec.outputFallbackContent) {
    const raw = spec.outputContent ?? spec.outputFallbackContent!;
    const truncated =
      raw.length > 800
        ? raw.slice(0, 797) + "…"
        : raw;
    lines.push(`   <pre><code>${escapeHtml(truncated)}</code></pre>`);
  }

  if (spec.viewerLinks?.file || spec.viewerLinks?.diff || spec.outputViewerLink) {
    const linkParts: string[] = [];
    // Use basename for link labels so they stay compact even with relative paths
    const linkName = basename(displayTitle || kindLabel || spec.kind);
    if (spec.viewerLinks?.file)
      linkParts.push(`<a href="${escapeHtml(spec.viewerLinks.file)}">View ${escapeHtml(linkName)}</a>`);
    if (spec.viewerLinks?.diff)
      linkParts.push(`<a href="${escapeHtml(spec.viewerLinks.diff)}">View diff</a>`);
    if (spec.outputViewerLink)
      linkParts.push(`<a href="${escapeHtml(spec.outputViewerLink)}">View output</a>`);
    lines.push(`      ${linkParts.join(" · ")}`);
  }

  return lines.join("\n");
}

const TELEGRAM_MAX_LENGTH = 4096;

/**
 * Close any HTML tags that were opened but not closed in the given text.
 * Handles the Telegram HTML subset: b, i, u, s, code, pre, a, tg-spoiler.
 */
function closeOpenHtmlTags(text: string): string {
  const openStack: string[] = [];
  const tagRe = /<\/?([a-z][\w-]*)(?:\s[^>]*)?\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(text)) !== null) {
    const full = m[0];
    const tag = m[1].toLowerCase();
    if (full.endsWith("/>")) continue;
    if (full.startsWith("</")) {
      const idx = openStack.lastIndexOf(tag);
      if (idx !== -1) openStack.splice(idx, 1);
    } else {
      openStack.push(tag);
    }
  }
  if (openStack.length === 0) return text;
  return text + openStack.reverse().map((t) => `</${t}>`).join("");
}

/**
 * Split text on "\n\n" boundaries that are NOT inside <code> or <pre> blocks.
 * Naive splitting breaks HTML when commands contain blank lines.
 */
function splitAtSafeBoundaries(text: string): string[] {
  const sections: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; ) {
    if (text[i] === "<") {
      // Detect opening or closing <code>/<pre> tags to track depth
      if (text.startsWith("</code>", i) || text.startsWith("</pre>", i)) {
        depth = Math.max(0, depth - 1);
        i += text[i + 1] === "/" ? 7 : 6;
        continue;
      }
      if (text.startsWith("<code", i) || text.startsWith("<pre", i)) {
        depth++;
      }
    }

    if (depth === 0 && text[i] === "\n" && text[i + 1] === "\n") {
      sections.push(text.slice(start, i));
      start = i + 2;
      i += 2;
      continue;
    }

    i++;
  }

  sections.push(text.slice(start));
  return sections;
}

/**
 * Split a tool card into multiple chunks at entry boundaries.
 * Each chunk stays under the Telegram message length limit.
 */
export function splitToolCardText(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) return [text];

  const sections = splitAtSafeBoundaries(text);
  const chunks: string[] = [];
  let current = "";

  for (const section of sections) {
    // Truncate oversized sections: slice, append ellipsis, then close open tags.
    // Order matters: ellipsis goes inside the code block, closing tag wraps it.
    // Buffer of 20 chars leaves room for closing tags after the ellipsis.
    const safeSection =
      section.length > TELEGRAM_MAX_LENGTH
        ? closeOpenHtmlTags(section.slice(0, TELEGRAM_MAX_LENGTH - 20) + "...")
        : section;

    const candidate = current ? `${current}\n\n${safeSection}` : safeSection;
    if (candidate.length > TELEGRAM_MAX_LENGTH && current) {
      chunks.push(closeOpenHtmlTags(current));
      current = safeSection;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(closeOpenHtmlTags(current));
  return chunks;
}
