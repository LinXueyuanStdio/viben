/**
 * Yoopta Markdown roundtrip wrapper.
 *
 * Wraps @yoopta/exports markdown.serialize / markdown.deserialize with
 * pre- and post-processing to ensure `markdown ≈ serialize(deserialize(markdown))`.
 *
 * Known Yoopta upstream issues this wrapper fixes:
 * 1. Block separator is `\n` (single) → paragraphs merge on re-import because
 *    `marked` with `breaks: true` treats `\n` as `<br>`.
 *    Fix: post-process serialized output to use `\n\n` between blocks.
 * 2. YAML frontmatter is corrupted (marked parses `---` as `<hr>`).
 *    Fix: strip frontmatter before deserialize, prepend it back on serialize.
 * 3. Math blocks `$$..$$` are not recognized by marked.
 *    Fix: pre-process math fences into `<div data-math-block>` before marked.
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

// ---- Math pre-processing ----

/**
 * Convert `[TOC]` markers into HTML that Yoopta's TableOfContents plugin
 * can recognize via its HTML deserializer (NAV with data-type="table-of-contents").
 */
export function preprocessTocForDeserialize(md: string): string {
  return md.replace(
    /^\[TOC\]\s*$/gm,
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Serialize post-processing ----

/**
 * Yoopta's `getMarkdown` joins blocks with `\n`.
 * Standard markdown requires `\n\n` between block-level elements.
 * This function ensures double-newline separation while preserving:
 * - Code fences (```...```)
 * - Math fences ($$...$$)
 * - Existing double-newlines
 */
export function normalizeBlockSeparators(md: string): string {
  const lines = md.split("\n");
  const result: string[] = [];
  let inCodeFence = false;
  let inMathFence = false;

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

    result.push(line);

    // If inside a fenced block, don't add extra newlines
    if (inCodeFence || inMathFence) continue;

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

      // Don't add blank lines after headings that are followed by content
      // (they already have correct separation)

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

// ---- Public API ----

/**
 * Deserialize markdown string to Yoopta editor content.
 * Handles frontmatter stripping and math pre-processing.
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
 * Serialize a single block to markdown.
 * Handles blocks that @yoopta/exports doesn't natively support
 * (MathBlock, MathInline, TableOfContents have empty parsers.markdown).
 */
function serializeBlock(
  editor: YooEditor,
  block: { type: string; value: any[]; meta: any },
): string {
  // MathBlock: props.latex → $$ fenced block
  if (block.type === "MathBlock") {
    const latex = block.value?.[0]?.props?.latex ?? "";
    return `$$\n${latex}\n$$`;
  }

  // TableOfContents → [TOC] marker
  if (block.type === "TableOfContents") {
    return "[TOC]";
  }

  // For other blocks, use the plugin's markdown serializer if available
  const plugin = editor.plugins[block.type];
  if (plugin?.parsers?.markdown?.serialize) {
    const element = block.value[0];
    const childText = element?.children?.map((c: any) => c.text || "").join("") ?? "";
    const result = plugin.parsers.markdown.serialize(element, childText, block.meta);
    if (result) return result;
  }

  return "";
}

/**
 * Serialize a block that may contain inline math elements.
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
      return child.text;
    }
    // Nested element (e.g. link) — recurse into its children
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

/**
 * Serialize Yoopta editor content to markdown string.
 * Handles frontmatter prepending, block separator normalization,
 * and blocks that @yoopta/exports doesn't support (MathBlock, TableOfContents).
 *
 * Fix for upstream issue: MathBlock, MathInline, and TableOfContents plugins
 * have empty `parsers.markdown`, so `markdown.serialize()` drops them.
 * We handle these types manually.
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

    // For blocks containing inline math, we need custom serialization
    // to preserve $latex$ syntax that the default serializer drops
    if (blockHasInlineMath(block) && block.type !== "MathBlock") {
      // Use the plugin's markdown serializer but with inline math injected
      const plugin = editor.plugins[block.type];
      if (plugin?.parsers?.markdown?.serialize) {
        const element = block.value[0] as any;
        // Build text with inline math preserved
        const childText = serializeInlineContent(element?.children ?? []);
        const result = plugin.parsers.markdown.serialize(element, childText, block.meta);
        if (result) {
          parts.push(result);
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
