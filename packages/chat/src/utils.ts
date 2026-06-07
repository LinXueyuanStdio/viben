export { cn } from "@viben/ui";

/**
 * Check if file is an image (by MIME type or file extension)
 */
export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"].includes(ext || "");
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    // Images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    // Documents
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    csv: "text/csv",
    // Spreadsheets
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    // Presentations
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Convert an absolute file path to a shorter display form.
 * - If path is under `cwd`, show relative path
 * - If path starts with home directory, show ~/...
 * - Otherwise show last 3 segments
 */
export function getDisplayPath(filePath: string, cwd?: string): string {
  if (!filePath) return "";

  // Try relative to cwd
  if (cwd && filePath.startsWith(cwd)) {
    const relative = filePath.slice(cwd.length);
    return relative.startsWith("/") ? relative.slice(1) : relative;
  }

  // For browser context, just show last 3 segments
  const segments = filePath.split("/").filter(Boolean);
  if (segments.length <= 3) return filePath;
  return segments.slice(-3).join("/");
}
