/**
 * Highlighted Input Component
 *
 * A textarea with an overlay that highlights slash commands.
 * Uses a backdrop div technique to show highlighting while
 * keeping the actual textarea functional.
 */

import * as React from "react";
import { useRef, useCallback } from "react";
import { cn } from "@viben/ui";

export interface HighlightedInputProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Current content value */
  value: string;
  /** Whether slash command highlighting is enabled */
  highlightSlashCommand?: boolean;
  /** Whether there's an active slash command menu */
  isSlashMenuOpen?: boolean;
}

/**
 * Extract the slash command from content (if any)
 * Returns the command including the leading slash
 */
function extractSlashCommand(content: string): string | null {
  if (!content.startsWith("/")) {
    return null;
  }
  // Match /command (letters, numbers, hyphens, underscores)
  const match = content.match(/^\/[\w-]*/);
  return match ? match[0] : null;
}

export const HighlightedInput = React.forwardRef<
  HTMLTextAreaElement,
  HighlightedInputProps
>(function HighlightedInput(
  {
    value,
    highlightSlashCommand = true,
    isSlashMenuOpen = false,
    className,
    style,
    ...props
  },
  ref
) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const slashCommand = highlightSlashCommand ? extractSlashCommand(value) : null;

  // Sync scroll position between textarea and backdrop
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (backdropRef.current) {
        backdropRef.current.scrollTop = e.currentTarget.scrollTop;
        backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
    },
    []
  );

  // Build the highlighted content for the backdrop
  const renderBackdrop = () => {
    if (!slashCommand) {
      // No command to highlight - render transparent placeholder to maintain layout
      return <span className="invisible">{value || " "}</span>;
    }

    const restContent = value.slice(slashCommand.length);

    return (
      <>
        <span
          className={cn(
            "rounded px-0.5 -mx-0.5",
            isSlashMenuOpen
              ? "bg-primary/20 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {slashCommand}
        </span>
        <span className="invisible">{restContent || " "}</span>
      </>
    );
  };

  return (
    <div className="relative w-full">
      {/* Backdrop layer for highlighting */}
      <div
        ref={backdropRef}
        aria-hidden="true"
        className={cn(
          "absolute inset-0 pointer-events-none whitespace-pre-wrap break-words overflow-hidden",
          "text-transparent", // Text is invisible, only highlights show
          className
        )}
        style={{
          ...style,
          // Match textarea padding and font
          fontFamily: "inherit",
          fontSize: "inherit",
          lineHeight: "inherit",
          letterSpacing: "inherit",
        }}
      >
        {renderBackdrop()}
      </div>

      {/* Actual textarea */}
      <textarea
        ref={ref}
        value={value}
        onScroll={handleScroll}
        className={cn("bg-transparent relative z-10", className)}
        style={style}
        {...props}
      />
    </div>
  );
});
