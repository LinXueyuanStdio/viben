// Markdown roundtrip utilities
export { EXHAUSTIVE_MARKDOWN_SAMPLE } from "./sample-markdown";
export {
  extractFrontmatter,
  prependFrontmatter,
  preprocessTocForDeserialize,
  preprocessMathForDeserialize,
  preprocessRichPluginFallbacksForDeserialize,
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
export * from "./yoopta/runtime";
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
  createCjkSlashInputHandler,
  createYooptaKeyDownHandler,
  findBlockIdAtOrder,
  findLastBlockId,
  focusOrCreateParagraph,
  getPlainBlockText,
  tryConvertFullWidthSlash,
} from "./yoopta/interaction";
export {
  findClosestTextOffsetForX,
  findVerticalNavigationTarget,
  getTargetLineCoordinates,
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
