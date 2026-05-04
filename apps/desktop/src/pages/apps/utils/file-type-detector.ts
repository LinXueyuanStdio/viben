/**
 * File Type Detector for Static Page Preview
 *
 * Detects the appropriate preview type based on file extension,
 * used to route static pages to the correct preview component.
 */

/** Supported preview types for static page files */
export type FilePreviewType =
  | "html"
  | "pdf"
  | "presentation"
  | "document"
  | "spreadsheet"
  | "image"
  | "audio"
  | "video"
  | "font"
  | "markdown"
  | "iframe-fallback";

const EXTENSION_MAP: Record<string, FilePreviewType> = {
  // HTML
  ".html": "html",
  ".htm": "html",

  // PDF
  ".pdf": "pdf",

  // Presentations
  ".pptx": "presentation",
  ".ppt": "presentation",
  ".odp": "presentation",

  // Documents
  ".docx": "document",
  ".doc": "document",
  ".odt": "document",

  // Spreadsheets
  ".xlsx": "spreadsheet",
  ".xls": "spreadsheet",
  ".ods": "spreadsheet",

  // Images
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".svg": "image",
  ".webp": "image",
  ".bmp": "image",
  ".ico": "image",

  // Audio
  ".mp3": "audio",
  ".wav": "audio",
  ".ogg": "audio",
  ".flac": "audio",
  ".aac": "audio",
  ".m4a": "audio",

  // Video
  ".mp4": "video",
  ".webm": "video",
  ".mov": "video",
  ".avi": "video",
  ".mkv": "video",

  // Fonts
  ".ttf": "font",
  ".otf": "font",
  ".woff": "font",
  ".woff2": "font",

  // Markdown
  ".md": "markdown",
  ".mdx": "markdown",
};

/**
 * Detect the preview type for a given file path based on its extension.
 */
export function detectFilePreviewType(filePath: string): FilePreviewType {
  const ext = getExtension(filePath);
  return EXTENSION_MAP[ext] ?? "iframe-fallback";
}

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filePath.slice(lastDot).toLowerCase();
}
