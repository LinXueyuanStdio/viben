/**
 * Callout Block Extension
 *
 * A Notion-style callout block for tiptap editors.
 * Renders a colored box with an emoji icon on the left and editable text content.
 * Supports types: default (gray), info (blue), warning (yellow), error (red), success (green).
 * Click the emoji to cycle through types.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
} from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const CALLOUT_TYPES = {
  default: {
    emoji: "\u{1F4A1}",
    bg: "bg-muted/50",
    border: "border-border",
    text: "text-foreground",
  },
  info: {
    emoji: "\u2139\uFE0F",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-900 dark:text-blue-100",
  },
  warning: {
    emoji: "\u26A0\uFE0F",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-800",
    text: "text-yellow-900 dark:text-yellow-100",
  },
  error: {
    emoji: "\u{1F6AB}",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-900 dark:text-red-100",
  },
  success: {
    emoji: "\u2705",
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-900 dark:text-green-100",
  },
} as const;

type CalloutType = keyof typeof CALLOUT_TYPES;

const CALLOUT_ORDER: CalloutType[] = [
  "default",
  "info",
  "warning",
  "error",
  "success",
];

// ---------------------------------------------------------------------------
// React node view component
// ---------------------------------------------------------------------------

function CalloutComponent({ node, updateAttributes }: ReactNodeViewProps) {
  const type = (node.attrs.type as CalloutType) || "default";
  const emoji =
    (node.attrs.emoji as string) || CALLOUT_TYPES[type].emoji;
  const style = CALLOUT_TYPES[type];

  const cycleType = () => {
    const currentIndex = CALLOUT_ORDER.indexOf(type);
    const nextIndex = (currentIndex + 1) % CALLOUT_ORDER.length;
    const nextType = CALLOUT_ORDER[nextIndex];
    updateAttributes({ type: nextType, emoji: CALLOUT_TYPES[nextType].emoji });
  };

  return (
    <NodeViewWrapper>
      <div
        className={cn(
          "flex gap-3 rounded-lg border p-4 my-2",
          style.bg,
          style.border,
        )}
      >
        <button
          type="button"
          contentEditable={false}
          onClick={cycleType}
          className="shrink-0 text-xl leading-none cursor-pointer hover:scale-110 transition-transform select-none mt-0.5"
          title="Click to change callout type"
        >
          {emoji}
        </button>
        <div className={cn("flex-1 min-w-0", style.text)}>
          <NodeViewContent className="callout-content" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// Tiptap extension
// ---------------------------------------------------------------------------

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",

  addAttributes() {
    return {
      type: { default: "default" },
      emoji: { default: "\u{1F4A1}" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent);
  },
});
