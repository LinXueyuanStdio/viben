/**
 * Artifact preview utility functions
 */

import type { Artifact, ArtifactType, OpenWithAppInfo } from "./types";
import i18n from "@/i18n";

/** Max file size for preview (50MB) */
export const MAX_PREVIEW_SIZE = 50 * 1024 * 1024;

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get file extension from artifact name
 */
export function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

/**
 * Check if a path is a URL (remote file)
 */
export function isRemoteUrl(path: string): boolean {
  return (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("//")
  );
}

/**
 * Get artifact type from file extension
 */
export function getArtifactTypeFromExt(ext: string): ArtifactType {
  const extLower = ext.toLowerCase();

  // HTML
  if (["html", "htm"].includes(extLower)) return "html";

  // JSX/TSX
  if (["jsx", "tsx"].includes(extLower)) return "jsx";

  // CSS
  if (["css", "scss", "less", "sass"].includes(extLower)) return "css";

  // JSON
  if (extLower === "json") return "json";

  // Markdown
  if (["md", "markdown", "mdx"].includes(extLower)) return "markdown";

  // CSV
  if (extLower === "csv") return "csv";

  // PDF
  if (extLower === "pdf") return "pdf";

  // Images
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].includes(extLower))
    return "image";

  // Audio
  if (["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma", "aiff"].includes(extLower))
    return "audio";

  // Video
  if (["mp4", "webm", "mov", "avi", "mkv", "m4v", "wmv", "flv", "3gp"].includes(extLower))
    return "video";

  // Font
  if (["ttf", "otf", "woff", "woff2", "eot"].includes(extLower)) return "font";

  // Document (Word)
  if (["doc", "docx", "rtf", "odt"].includes(extLower)) return "document";

  // Spreadsheet (Excel)
  if (["xls", "xlsx", "ods"].includes(extLower)) return "spreadsheet";

  // Presentation (PowerPoint)
  if (["ppt", "pptx", "odp"].includes(extLower)) return "presentation";

  // Code files
  if (
    [
      "js", "ts", "py", "rb", "go", "rs", "java", "cpp", "c", "h", "hpp",
      "sql", "sh", "bash", "zsh", "toml", "ini", "conf", "env",
      "gitignore", "dockerfile", "makefile", "gradle", "swift", "kt",
      "scala", "php", "vue", "svelte", "yaml", "yml", "xml",
    ].includes(extLower)
  )
    return "code";

  // Plain text
  if (["txt", "log", "text"].includes(extLower)) return "text";

  // Default to code for unknown extensions
  return "code";
}

/**
 * Get language hint for syntax highlighting
 */
export function getLanguageHint(artifact: Artifact): string {
  const ext = getFileExtension(artifact.name);
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    htm: "html",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    toml: "toml",
  };
  return langMap[ext] || "plaintext";
}

/**
 * Get app name for "Open with" button based on file type
 */
export function getOpenWithApp(artifact: Artifact): OpenWithAppInfo | null {
  switch (artifact.type) {
    case "html":
      return { name: i18n.t("artifacts.openWith.browser", "Browser"), icon: "Globe" };
    case "presentation":
      return { name: "Microsoft PowerPoint", icon: "Presentation" };
    case "document":
      return { name: "Microsoft Word", icon: "FileText" };
    case "spreadsheet":
    case "csv":
      return { name: "Microsoft Excel", icon: "FileSpreadsheet" };
    case "pdf":
      return { name: i18n.t("artifacts.openWith.preview", "Preview"), icon: "FileText" };
    case "audio":
      return { name: i18n.t("artifacts.openWith.musicPlayer", "Music Player"), icon: "Music" };
    case "video":
      return { name: i18n.t("artifacts.openWith.videoPlayer", "Video Player"), icon: "Video" };
    case "image":
      return { name: i18n.t("artifacts.openWith.imageViewer", "Image Viewer"), icon: "Eye" };
    case "font":
      return { name: i18n.t("artifacts.openWith.fontViewer", "Font Viewer"), icon: "FileText" };
    default:
      return null;
  }
}

/**
 * Parse CSV content to 2D array
 */
export function parseCSV(content: string): string[][] {
  const lines = content.trim().split("\n");
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

/**
 * Inline CSS and JS into HTML content
 */
export function inlineAssets(html: string, allArtifacts: Artifact[]): string {
  let result = html;

  // Find and inline CSS files
  const cssRegex = /<link[^>]*href=["']([^"']+\.css)["'][^>]*>/gi;
  result = result.replace(cssRegex, (match, filename) => {
    if (filename.startsWith("http") || filename.startsWith("//")) return match;

    const cssArtifact = allArtifacts.find(
      (a) => a.name === filename || a.name.endsWith(`/${filename}`)
    );

    if (cssArtifact?.content) {
      return `<style>/* Inlined from ${filename} */\n${cssArtifact.content}</style>`;
    }
    return match;
  });

  // Find and inline JS files
  const jsRegex = /<script[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/gi;
  result = result.replace(jsRegex, (match, filename) => {
    if (filename.startsWith("http") || filename.startsWith("//")) return match;

    const jsArtifact = allArtifacts.find(
      (a) => a.name === filename || a.name.endsWith(`/${filename}`)
    );

    if (jsArtifact?.content) {
      return `<script>/* Inlined from ${filename} */\n${jsArtifact.content}</script>`;
    }
    return match;
  });

  return result;
}

/**
 * Get MIME type for image files
 */
export function getImageMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon",
  };
  return mimeTypes[ext] || "image/png";
}

/**
 * Get MIME type for audio files
 */
export function getAudioMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    flac: "audio/flac",
    wma: "audio/x-ms-wma",
    aiff: "audio/aiff",
  };
  return mimeTypes[ext] || "audio/mpeg";
}

/**
 * Get MIME type for video files
 */
export function getVideoMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    ogg: "video/ogg",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    m4v: "video/x-m4v",
    wmv: "video/x-ms-wmv",
    flv: "video/x-flv",
    "3gp": "video/3gpp",
  };
  return mimeTypes[ext] || "video/mp4";
}

/**
 * Get generic MIME type from extension
 */
export function getMimeType(ext: string): string {
  const extLower = ext.toLowerCase();

  // Images
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(extLower)) {
    return getImageMimeType(extLower);
  }

  // Audio
  if (["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma", "aiff"].includes(extLower)) {
    return getAudioMimeType(extLower);
  }

  // Video
  if (["mp4", "webm", "mov", "avi", "mkv", "m4v", "wmv", "flv", "3gp"].includes(extLower)) {
    return getVideoMimeType(extLower);
  }

  // Documents
  if (extLower === "pdf") return "application/pdf";
  if (["doc", "docx"].includes(extLower)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (["xls", "xlsx"].includes(extLower)) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (["ppt", "pptx"].includes(extLower)) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }

  // Text-based
  if (["json", "xml", "html", "htm", "css", "js", "ts", "md", "txt"].includes(extLower)) {
    return "text/plain";
  }

  return "application/octet-stream";
}

/**
 * Parse YAML frontmatter from markdown content
 * Returns { frontmatter: parsed key-value pairs, content: remaining markdown }
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, string> | null;
  content: string;
} {
  // Match frontmatter: starts with ---, contains YAML content, ends with ---
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: null, content: content.trim() };
  }

  // Parse YAML key-value pairs (simple parsing for common cases)
  const yamlContent = match[1];
  const frontmatter: Record<string, string> = {};

  yamlContent.split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      // Remove surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && value) {
        frontmatter[key] = value;
      }
    }
  });

  const remainingContent = content.replace(frontmatterRegex, "").trim();
  return {
    frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : null,
    content: remainingContent,
  };
}

/**
 * Check if artifact is a code file (for "Open in Editor" button)
 */
export function isCodeFile(artifact: Artifact): boolean {
  const codeTypes: ArtifactType[] = ["code", "jsx", "css", "json", "text", "markdown"];
  if (codeTypes.includes(artifact.type)) return true;

  const ext = getFileExtension(artifact.name);
  const codeExtensions = [
    "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "cpp", "c",
    "h", "hpp", "css", "scss", "less", "html", "htm", "json", "xml",
    "yaml", "yml", "md", "sql", "sh", "bash", "zsh", "toml", "ini",
    "conf", "env", "gitignore", "dockerfile", "makefile", "gradle",
    "swift", "kt", "scala", "php", "vue", "svelte",
  ];
  return codeExtensions.includes(ext);
}
