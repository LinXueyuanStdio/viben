import * as React from "react";
import { useRef, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Streamdown } from "streamdown";
import { Bot } from "lucide-react";
import { cn } from "@viben/ui";
import { ASSISTANT_MARKDOWN_TYPOGRAPHY } from "./message-typography";

export interface StreamingTextBlockProps {
  /** The accumulated streaming text. When null, nothing renders. */
  text: string | null;
  /** Custom link handler for markdown links */
  onLinkClick?: (href: string) => void;
  /** Maximum width constraint (CSS value) */
  maxWidth?: string;
  /** Additional CSS class name for the outer wrapper */
  className?: string;
}

/**
 * Markdown components matching AssistantMessage's visual style.
 */
const createMarkdownComponents = (onLinkClick?: (href: string) => void) => ({
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className={cn(
        "bg-code-block my-2 max-w-full overflow-x-auto rounded-md p-3 [&>code]:block",
        ASSISTANT_MARKDOWN_TYPOGRAPHY.codeBlock
      )}
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className={cn(
            "bg-code-block rounded px-1 py-0.5 font-mono",
            ASSISTANT_MARKDOWN_TYPOGRAPHY.inlineCode
          )}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  a: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (href) {
          if (onLinkClick) {
            onLinkClick(href);
          } else {
            window.open(href, "_blank");
          }
        }
      }}
      className="text-primary cursor-pointer hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn("my-1", ASSISTANT_MARKDOWN_TYPOGRAPHY.paragraph)} {...props}>
      {children}
    </p>
  ),
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className={cn("mt-3 mb-1.5 font-semibold", ASSISTANT_MARKDOWN_TYPOGRAPHY.h1)} {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className={cn("mt-2.5 mb-1.5 font-semibold", ASSISTANT_MARKDOWN_TYPOGRAPHY.h2)} {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className={cn("mt-2 mb-1 font-semibold", ASSISTANT_MARKDOWN_TYPOGRAPHY.h3)} {...props}>{children}</h3>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc ml-4 my-2 space-y-1" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal ml-4 my-2 space-y-1" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li className={ASSISTANT_MARKDOWN_TYPOGRAPHY.listItem} {...props}>{children}</li>
  ),
  blockquote: ({
    children,
    ...props
  }: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="border-l-4 border-primary/30 pl-4 my-2 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
});

/**
 * StreamingTextBlock renders streaming assistant text as a separate sibling
 * outside the message list, preventing full list reconciliation on each frame.
 *
 * Uses a stable-prefix optimization inspired by Claude Code's StreamingMarkdown:
 * splits at the last paragraph boundary (\n\n), renders the stable prefix in
 * "static" mode (memoized), and only the trailing suffix in "streaming" mode.
 *
 * Unmounts entirely when `text` becomes null (resets state between streams).
 */
export function StreamingTextBlock({
  text,
  onLinkClick,
  maxWidth,
  className,
}: StreamingTextBlockProps) {
  const prefersReducedMotion = useReducedMotion();
  const markdownComponents = useMemo(
    () => createMarkdownComponents(onLinkClick),
    [onLinkClick]
  );

  // Stable-prefix tracking: only re-parse the suffix after the last
  // paragraph boundary. Resets on unmount (stream ends → null → remounts).
  const stableBoundaryRef = useRef(0);

  // Reset if text was replaced (e.g., new stream without unmounting)
  if (text && text.length < stableBoundaryRef.current) {
    stableBoundaryRef.current = 0;
  }

  // Advance stable boundary to the last double-newline
  if (text) {
    const lastBoundary = text.lastIndexOf("\n\n");
    if (lastBoundary > stableBoundaryRef.current) {
      stableBoundaryRef.current = lastBoundary + 2;
    }
  }

  const stablePrefix = text ? text.substring(0, stableBoundaryRef.current) : "";
  const unstableSuffix = text ? text.substring(stableBoundaryRef.current) : "";

  if (!text) return null;

  const maxWidthStyle = maxWidth
    ? { maxWidth } as React.CSSProperties
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
      className={cn("flex gap-3 w-full min-w-0", className)}
      style={maxWidthStyle}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Bot className="h-4 w-4 text-secondary-foreground" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 overflow-hidden">
          <div
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none overflow-hidden break-words text-foreground",
              ASSISTANT_MARKDOWN_TYPOGRAPHY.container
            )}
          >
            {stablePrefix && (
              <Streamdown
                mode="static"
                components={markdownComponents}
              >
                {stablePrefix}
              </Streamdown>
            )}
            <Streamdown
              mode="streaming"
              components={markdownComponents}
              caret="block"
            >
              {unstableSuffix}
            </Streamdown>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
