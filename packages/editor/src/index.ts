// Markdown roundtrip utilities
export {
  extractFrontmatter,
  prependFrontmatter,
  preprocessTocForDeserialize,
  preprocessMathForDeserialize,
  normalizeBlockSeparators,
  deserializeMarkdown,
  serializeMarkdown,
} from "./markdown";

// Plugin registry
export { createYooptaPlugins, YOOPTA_PLUGINS } from "./plugins";
export type { YooptaPluginOptions } from "./plugins";

// Mark registry
export { YOOPTA_MARKS } from "./marks";

// Yoopta UI adapter
export { YooptaActionMenuList } from "./yoopta/action-menu";
export { YooptaFloatingBlockActions } from "./yoopta/block-actions";
export { YooptaBlockOptions } from "./yoopta/block-options";
export {
  BLOCK_ICONS,
  BLOCK_CATEGORIES,
  createBlockCategories,
  getCategoryOrder,
  IS_MAC,
  MOD_KEY,
} from "./yoopta/constants";
export { YooptaErrorBoundary } from "./yoopta/error-boundary";
export { ensureBlockFocus } from "./yoopta/focus-utils";
export {
  findVerticalNavigationTarget,
  groupRectsByVisualLine,
  handleYooptaVerticalNavigation,
} from "./yoopta/keyboard-navigation";
export type {
  BlockOrderEntry,
  RectLike,
  VerticalDirection,
  VerticalNavigationTarget,
} from "./yoopta/keyboard-navigation";
export { YooptaSlashCommandMenu } from "./yoopta/slash-menu";
export { YooptaTocSidebar } from "./yoopta/toc-sidebar";
export { YooptaToolbar } from "./yoopta/toolbar";

// Re-export core types for convenience
export type { RenderBlockProps, SlateElement, YooEditor, YooptaContentValue, YooptaPlugin } from "@yoopta/editor";
export { createYooptaEditor } from "@yoopta/editor";
