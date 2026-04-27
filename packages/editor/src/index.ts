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

// Re-export core types for convenience
export type { YooEditor, YooptaContentValue } from "@yoopta/editor";
export { createYooptaEditor } from "@yoopta/editor";
