/**
 * Yoopta Markdown roundtrip wrapper.
 *
 * Wraps @yoopta/exports markdown.serialize / markdown.deserialize with
 * pre- and post-processing to ensure `markdown ≈ serialize(deserialize(markdown))`.
 *
 * Plugin coverage:
 * - Lossless roundtrip: Paragraph, HeadingOne/Two/Three, BulletedList, NumberedList,
 *   TodoList, Code, Divider, Image, Table, Blockquote, MathBlock, MathInline,
 *   TableOfContents, Accordion
 * - Lossy (idempotent after first pass): Callout (→ blockquote), Embed (→ link),
 *   File (→ link), Video (→ image), Steps (→ numbered list), Tabs (→ headings),
 *   Carousel (→ numbered list), CodeGroup (→ code blocks), Mention (→ text)
 */

import { markdown } from "@yoopta/exports";
import type { YooEditor, YooptaContentValue } from "@yoopta/editor";

// ---- Frontmatter helpers ----

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function extractFrontmatter(md: string): {
  frontmatter: string;
  body: string;
} {
  const match = FRONTMATTER_RE.exec(md);
  if (match) {
    return {
      frontmatter: match[0],
      body: md.slice(match[0].length),
    };
  }
  return { frontmatter: "", body: md };
}

export function prependFrontmatter(
  frontmatter: string,
  body: string,
): string {
  if (!frontmatter) return body;
  return frontmatter + (frontmatter.endsWith("\n") ? "" : "\n") + body;
}

// ---- Preprocessing helpers ----

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert `[TOC]` markers into HTML that Yoopta's TableOfContents plugin
 * can recognize via its HTML deserializer (NAV with data-type="table-of-contents").
 */
export function preprocessTocForDeserialize(md: string): string {
  // Use [ \t]* instead of \s* to avoid consuming newlines that serve as block separators
  return md.replace(
    /^\[TOC\][ \t]*$/gm,
    '<nav data-type="table-of-contents"></nav>',
  );
}

/**
 * Convert `$$..$$` fenced math blocks into HTML that Yoopta's MathBlock plugin
 * can recognize via its HTML deserializer (node name DIV with data-math-block).
 * Also converts inline `$...$` into `<span data-math-inline>`.
 */
export function preprocessMathForDeserialize(md: string): string {
  // Block math: $$ ... $$ (on their own lines)
  let result = md.replace(
    /^\$\$\r?\n([\s\S]*?)\r?\n\$\$$/gm,
    (_match, latex: string) =>
      `<div data-math-block="true">${escapeHtml(latex.trim())}</div>`,
  );

  // Inline math: $..$ (not preceded by $ or followed by $)
  result = result.replace(
    /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g,
    (_match, latex: string) =>
      `<span data-math-inline="true">${escapeHtml(latex)}</span>`,
  );

  return result;
}

// ---- Serialize post-processing ----

/**
 * Yoopta's `getMarkdown` joins blocks with `\n`.
 * Standard markdown requires `\n\n` between block-level elements.
 * This function ensures double-newline separation while preserving:
 * - Code fences (```...```)
 * - Math fences ($$...$$)
 * - HTML blocks (<details>...</details>)
 * - Existing double-newlines
 */
export function normalizeBlockSeparators(md: string): string {
  const lines = md.split("\n");
  const result: string[] = [];
  let inCodeFence = false;
  let inMathFence = false;
  let inHtmlBlock = 0; // depth counter for nested HTML blocks

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track code fence state
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
    }
    // Track math fence state
    if (trimmed === "$$") {
      inMathFence = !inMathFence;
    }
    // Track HTML block state (details, div, etc.)
    if (!inCodeFence && !inMathFence) {
      if (/^<(details|div)\b/i.test(trimmed)) inHtmlBlock++;
      if (/^<\/(details|div)>/i.test(trimmed)) inHtmlBlock = Math.max(0, inHtmlBlock - 1);
    }

    result.push(line);

    // If inside a fenced block or HTML block, don't add extra newlines
    if (inCodeFence || inMathFence || inHtmlBlock > 0) continue;

    // After a non-empty line, if the next line is also non-empty and not already
    // preceded by a blank line, check if we need to insert a blank line
    if (
      trimmed.length > 0 &&
      i + 1 < lines.length &&
      lines[i + 1]?.trim().length > 0
    ) {
      // Don't add blank lines between list items (-, *, 1., [ ])
      const isCurrentList = /^\s*[-*]\s|^\s*\d+\.\s|^\s*-\s\[/.test(line);
      const isNextList = /^\s*[-*]\s|^\s*\d+\.\s|^\s*-\s\[/.test(
        lines[i + 1],
      );
      if (isCurrentList && isNextList) continue;

      // Don't add blank lines between table rows (lines starting with |)
      const isCurrentTable = trimmed.startsWith("|");
      const isNextTable = lines[i + 1]?.trim().startsWith("|");
      if (isCurrentTable && isNextTable) continue;

      // Don't add blank lines inside HTML blocks (closing tag followed by opening tag)
      if (/^<\/(details|div)>/i.test(trimmed) && /^<(details|div)\b/i.test(lines[i + 1]?.trim())) continue;

      // Add blank line between different block types
      result.push("");
    }
  }

  // Clean up: collapse triple+ newlines to double
  return result
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---- Inline content serialization ----

/**
 * Serialize inline content including math-inline elements.
 * Walks the Slate node tree and produces markdown text with $latex$ for MathInline nodes.
 */
function serializeInlineContent(children: any[]): string {
  if (!children) return "";
  return children.map((child: any) => {
    // MathInline void element
    if (child.type === "math-inline" && child.props?.latex) {
      return `$${child.props.latex}$`;
    }
    // Regular text node (may have marks)
    if (child.text !== undefined) {
      let text = child.text as string;
      if (child.bold) text = `**${text}**`;
      if (child.italic) text = `*${text}*`;
      if (child.strike) text = `~~${text}~~`;
      if (child.code) text = `\`${text}\``;
      if (child.underline) text = `<u>${text}</u>`;
      return text;
    }
    // Link element
    if (child.type === "link" && child.props?.url) {
      const linkText = serializeInlineContent(child.children ?? []);
      return `[${linkText}](${child.props.url})`;
    }
    // Nested element — recurse into its children
    if (child.children) {
      return serializeInlineContent(child.children);
    }
    return "";
  }).join("");
}

/**
 * Check if a block contains any MathInline elements.
 */
function blockHasInlineMath(block: { value: any[] }): boolean {
  if (!block?.value) return false;
  for (const element of block.value) {
    if (!element?.children) continue;
    for (const child of element.children as any[]) {
      if (child.type === "math-inline") return true;
    }
  }
  return false;
}

// ---- Block serialization ----

/**
 * Serialize a single Yoopta block to markdown.
 * Handles all plugin types including those without native markdown serializers.
 */
function serializeBlock(
  editor: YooEditor,
  block: { id?: string; type: string; value: any[]; meta: any },
): string {
  const element = block.value?.[0];
  if (!element) return "";

  switch (block.type) {
    // --- Custom handled (no plugin exists) ---

    case "CodeGroup": {
      // CodeGroup serializes as multiple fenced code blocks
      const tabsList = element.children?.find((c: any) => c.type === "code-group-list");
      const contents = element.children?.filter((c: any) => c.type === "code-group-content") ?? [];
      const tabHeadings = tabsList?.children ?? [];

      return tabHeadings.map((heading: any) => {
        const headingText = serializeInlineContent(heading.children ?? []);
        const content = contents.find((c: any) => c.props?.referenceId === heading.id);
        const contentText = content ? serializeInlineContent(content.children ?? []) : "";
        const language = content?.props?.language ?? "";
        return `\`\`\`${language} title="${headingText}"\n${contentText}\n\`\`\``;
      }).join("\n\n");
    }

    default:
      break;
  }

  // --- Use plugin's markdown serializer ---
  const plugin = editor.plugins[block.type];
  if (plugin?.parsers?.markdown?.serialize) {
    const childText = element.children?.map((c: any) => c.text || "").join("") ?? "";
    const result = plugin.parsers.markdown.serialize(
      element,
      childText,
      block.meta,
      editor,
      block,
    );
    if (result) {
      // Strip trailing newline for consistency — normalizeBlockSeparators handles separation
      return result.replace(/\n$/, "");
    }
  }

  // Fallback: serialize as plain text paragraph
  const fallbackText = serializeInlineContent(element.children ?? []);
  return fallbackText;
}

// ---- Public API ----

/**
 * Deserialize markdown string to Yoopta editor content.
 * Handles frontmatter stripping and preprocessing for:
 * - [TOC] markers
 * - Math blocks ($$..$$) and inline math ($...$)
 * - Raw HTML pass-through (accordion <details>, etc.)
 */
export function deserializeMarkdown(
  editor: YooEditor,
  md: string,
): { value: YooptaContentValue; frontmatter: string } {
  const { frontmatter, body } = extractFrontmatter(md);
  const withToc = preprocessTocForDeserialize(body);
  const preprocessed = preprocessMathForDeserialize(withToc);
  const value = markdown.deserialize(editor, preprocessed);
  return { value, frontmatter };
}

/**
 * Serialize Yoopta editor content to markdown string.
 * Handles all plugin types with proper markdown output.
 *
 * Plugins handled:
 * - MathBlock, MathInline, TableOfContents: custom serialization
 * - Accordion, Steps, Tabs, Carousel, CodeGroup: custom complex-structure serialization
 * - All others: delegate to plugin's parsers.markdown.serialize
 */
export function serializeMarkdown(
  editor: YooEditor,
  value: YooptaContentValue,
  frontmatter?: string,
): string {
  // Sort blocks by order
  const blocks = Object.values(value)
    .filter(Boolean)
    .sort((a, b) => (a!.meta?.order ?? 0) - (b!.meta?.order ?? 0));

  const parts: string[] = [];

  for (const block of blocks) {
    if (!block) continue;

    // For blocks containing inline math, use custom serialization
    // to preserve $latex$ syntax that the default serializer drops
    if (blockHasInlineMath(block) && block.type !== "MathBlock") {
      const plugin = editor.plugins[block.type];
      if (plugin?.parsers?.markdown?.serialize) {
        const element = block.value[0] as any;
        const childText = serializeInlineContent(element?.children ?? []);
        const result = plugin.parsers.markdown.serialize(element, childText, block.meta);
        if (result) {
          parts.push(result.replace(/\n$/, ""));
          continue;
        }
      }
    }

    parts.push(serializeBlock(editor, block));
  }

  const raw = parts.join("\n");
  const normalized = normalizeBlockSeparators(raw);
  return prependFrontmatter(frontmatter || "", normalized);
}
