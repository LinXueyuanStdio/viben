/**
 * Markdown Preview Component
 *
 * Renders markdown content with support for YAML frontmatter.
 * Uses simple markdown rendering without external dependencies.
 */

import * as React from "react";
import type { PreviewComponentProps } from "./types";
import { parseFrontmatter } from "./utils";

/**
 * Simple markdown to HTML converter
 * Note: For more complex markdown, consider adding react-markdown as a dependency
 */
function simpleMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (must be before other transformations)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre class="bg-muted rounded-lg p-4 overflow-x-auto my-4"><code class="text-sm">$2</code></pre>'
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>'
  );

  // Headers
  html = html.replace(
    /^### (.*$)/gim,
    '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>'
  );
  html = html.replace(
    /^## (.*$)/gim,
    '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>'
  );
  html = html.replace(
    /^# (.*$)/gim,
    '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>'
  );

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" class="text-primary underline hover:opacity-80">$1</a>'
  );

  // Images
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4" />'
  );

  // Blockquotes
  html = html.replace(
    /^\> (.*$)/gim,
    '<blockquote class="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">$1</blockquote>'
  );

  // Unordered lists
  html = html.replace(
    /^\s*[-*+] (.*$)/gim,
    '<li class="ml-4">$1</li>'
  );

  // Ordered lists
  html = html.replace(
    /^\s*\d+\. (.*$)/gim,
    '<li class="ml-4 list-decimal">$1</li>'
  );

  // Wrap consecutive list items
  html = html.replace(
    /(<li[^>]*>.*<\/li>\n?)+/g,
    (match) => `<ul class="my-4 space-y-1">${match}</ul>`
  );

  // Horizontal rules
  html = html.replace(
    /^[-*_]{3,}$/gim,
    '<hr class="border-border my-6" />'
  );

  // Paragraphs (wrap remaining text in p tags)
  html = html.replace(/\n\n+/g, "</p><p class=\"my-3\">");
  html = `<p class="my-3">${html}</p>`;

  // Clean up empty paragraphs and fix nesting issues
  html = html.replace(/<p class="my-3"><\/p>/g, "");
  html = html.replace(/<p class="my-3">(<h[1-6])/g, "$1");
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, "$1");
  html = html.replace(/<p class="my-3">(<pre)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");
  html = html.replace(/<p class="my-3">(<ul)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p class="my-3">(<blockquote)/g, "$1");
  html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");
  html = html.replace(/<p class="my-3">(<hr)/g, "$1");

  return html;
}

/**
 * Expandable text component for long frontmatter values
 */
function ExpandableText({
  text,
  maxLength = 100,
}: {
  text: string;
  maxLength?: number;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const needsTruncation = text.length > maxLength;

  if (!needsTruncation) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {isExpanded ? text : `${text.slice(0, maxLength)}...`}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-primary ml-1 text-xs hover:underline"
      >
        {isExpanded ? "Show less" : "Show more"}
      </button>
    </span>
  );
}

export function MarkdownPreview({ artifact }: PreviewComponentProps) {
  if (!artifact.content) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">No content available</p>
      </div>
    );
  }

  // Parse YAML frontmatter and content
  const { frontmatter, content: markdownContent } = parseFrontmatter(
    artifact.content
  );
  const htmlContent = simpleMarkdownToHtml(markdownContent);

  return (
    <div className="bg-background h-full overflow-auto">
      <div className="max-w-none p-6">
        {/* Frontmatter Table */}
        {frontmatter && Object.keys(frontmatter).length > 0 && (
          <div className="border-border/50 mb-6 overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(frontmatter).map(([key, value]) => (
                  <tr
                    key={key}
                    className="border-border/30 border-b last:border-b-0"
                  >
                    <td className="bg-muted/30 text-muted-foreground w-32 px-4 py-2 align-top font-medium">
                      {key}
                    </td>
                    <td className="text-foreground px-4 py-2">
                      <ExpandableText text={value} maxLength={100} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Markdown Content */}
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  );
}
