/**
 * Artifact preview type definitions
 *
 * This module defines types for the artifact preview system,
 * supporting 17 different file types.
 */

export type ArtifactType =
  | "html"
  | "jsx"
  | "css"
  | "json"
  | "text"
  | "image"
  | "code"
  | "markdown"
  | "csv"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "pdf"
  | "audio"
  | "video"
  | "font"
  | "websearch";

export interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  content?: string;
  path?: string;
  /** For presentations: array of slide contents (HTML or image URLs) */
  slides?: string[];
  /** For spreadsheets: parsed data */
  data?: string[][];
  /** File size in bytes (used when file is too large) */
  fileSize?: number;
  /** Flag indicating the file is too large to preview */
  fileTooLarge?: boolean;
}

export interface ArtifactPreviewProps {
  artifact: Artifact | null;
  onClose?: () => void;
  /** All artifacts for resolving relative imports (used for HTML with CSS/JS) */
  allArtifacts?: Artifact[];
  className?: string;
  /** Live preview URL (e.g., http://localhost:5173) */
  livePreviewUrl?: string | null;
  /** Live preview status */
  livePreviewStatus?: LivePreviewStatus;
  /** Live preview error message */
  livePreviewError?: string | null;
  /** Callback to start live preview */
  onStartLivePreview?: () => void;
  /** Callback to stop live preview */
  onStopLivePreview?: () => void;
}

export type ViewMode = "preview" | "code";

/** Preview mode for HTML artifacts */
export type PreviewMode = "static" | "live";

/** Live preview status (matches useVitePreview hook) */
export type LivePreviewStatus =
  | "idle"
  | "starting"
  | "running"
  | "error"
  | "stopped";

/** Props for individual preview components */
export interface PreviewComponentProps {
  artifact: Artifact;
}

/** Open with app info for external app launch */
export interface OpenWithAppInfo {
  name: string;
  icon: string;
}
