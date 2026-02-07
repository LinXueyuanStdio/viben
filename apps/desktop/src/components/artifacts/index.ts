/**
 * Artifact Preview Components
 *
 * This module provides a rich file preview system supporting 17 different file types:
 * - html, jsx, css, json, text, code - Code/markup files
 * - markdown - Rendered markdown with YAML frontmatter support
 * - csv - Table view
 * - image (png, jpg, gif, svg, webp) - Image display
 * - pdf - PDF viewer via iframe
 * - audio (mp3, wav, ogg, m4a) - Custom audio player
 * - video (mp4, webm, mov) - Video player
 * - font (ttf, otf, woff) - Font preview (placeholder)
 * - document (docx) - External app prompt
 * - spreadsheet (xlsx) - External app prompt
 * - presentation (pptx) - External app prompt
 * - websearch - Search results list
 */

// Main component
export { ArtifactPreview } from "./artifact-preview";

// Individual preview components
export { CodePreview } from "./code-preview";
export { ImagePreview } from "./image-preview";
export { MarkdownPreview } from "./markdown-preview";
export { AudioPreview } from "./audio-preview";
export { VideoPreview } from "./video-preview";
export { PdfPreview } from "./pdf-preview";
export { WebSearchPreview } from "./websearch-preview";

// Types
export type {
  Artifact,
  ArtifactType,
  ArtifactPreviewProps,
  ViewMode,
  PreviewComponentProps,
  OpenWithAppInfo,
} from "./types";

// Utilities
export {
  MAX_PREVIEW_SIZE,
  formatFileSize,
  getFileExtension,
  isRemoteUrl,
  getArtifactTypeFromExt,
  getLanguageHint,
  getOpenWithApp,
  parseCSV,
  inlineAssets,
  getImageMimeType,
  getAudioMimeType,
  getVideoMimeType,
  getMimeType,
  parseFrontmatter,
  isCodeFile,
} from "./utils";
