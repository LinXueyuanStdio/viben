/**
 * Preview components for artifacts and tools
 * Uses Monaco Editor for code highlighting (read-only mode)
 * Supports static HTML preview via Blob URL and live preview via Vite
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Code, Eye, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Artifact, ToolUsage } from "@/types";
import { getArtifactIcon, getToolIcon, isMcpTool } from "./utils";
import { CodeEditor } from "@/components/skill-files/code-editor";
import { VitePreview } from "../vite-preview";
import type { PreviewStatus } from "@/hooks/use-vite-preview";

/**
 * Get filename from artifact for language detection
 */
function getArtifactFilename(artifact: Artifact): string {
  // If artifact has a path, use it
  if (artifact.path) {
    return artifact.path.split("/").pop() || artifact.name;
  }

  // Otherwise, derive extension from type
  const typeToExt: Record<string, string> = {
    html: "index.html",
    jsx: "component.jsx",
    css: "styles.css",
    json: "data.json",
    markdown: "document.md",
    csv: "data.csv",
    code: artifact.name || "code.txt",
    text: artifact.name || "text.txt",
  };

  return typeToExt[artifact.type] || artifact.name || "file.txt";
}

/**
 * Get filename for tool output based on tool name
 */
function getToolOutputFilename(tool: ToolUsage): string {
  const toolName = tool.name.toLowerCase();

  // File operation tools - use the file path from input
  if (toolName === "read" || toolName === "write" || toolName === "edit") {
    const input = tool.input as Record<string, unknown> | undefined;
    const filePath = input?.file_path || input?.path;
    if (typeof filePath === "string") {
      return filePath.split("/").pop() || "output.txt";
    }
  }

  // Bash output
  if (toolName === "bash") {
    return "output.sh";
  }

  // Grep output
  if (toolName === "grep") {
    return "grep-results.txt";
  }

  // Web fetch
  if (toolName === "webfetch" || toolName === "websearch") {
    return "response.md";
  }

  // Default to JSON for structured output
  return "output.json";
}

/**
 * Check if content is likely code or structured text that benefits from highlighting
 */
function shouldUseCodeEditor(content: string, filename: string): boolean {
  // Always use editor for known code file extensions
  const codeExtensions = [
    ".js", ".jsx", ".ts", ".tsx", ".py", ".rs", ".go", ".java",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
    ".kt", ".scala", ".lua", ".r", ".sh", ".bash", ".zsh",
    ".html", ".htm", ".css", ".scss", ".less", ".xml", ".svg",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".conf",
    ".md", ".markdown", ".sql", ".graphql", ".gql",
  ];

  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  if (codeExtensions.includes(ext)) {
    return true;
  }

  // Check if content looks like code (has typical code patterns)
  const codePatterns = [
    /^[\s]*[{[\]]/m,              // Starts with JSON-like structure
    /function\s+\w+/,             // Function declaration
    /const\s+\w+\s*=/,            // Const declaration
    /import\s+.*from/,            // ES6 import
    /def\s+\w+\(/,                // Python function
    /class\s+\w+/,                // Class declaration
    /<\w+[^>]*>/,                 // HTML/XML tags
    /^\s*#.*$/m,                  // Comments or headers
  ];

  return codePatterns.some(pattern => pattern.test(content));
}

/**
 * Check if artifact is HTML type
 */
function isHtmlArtifact(artifact: Artifact): boolean {
  // Check by type
  if (artifact.type === "html") {
    return true;
  }

  // Check by filename extension
  const filename = getArtifactFilename(artifact);
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return ext === ".html" || ext === ".htm";
}

/**
 * View mode for HTML artifacts
 */
type HtmlViewMode = "preview" | "code" | "live";

/**
 * Props for ArtifactPreview with optional live preview support
 */
export interface ArtifactPreviewProps {
  artifact: Artifact;
  // Live preview props (optional)
  livePreviewUrl?: string | null;
  livePreviewStatus?: PreviewStatus;
  livePreviewError?: string | null;
  onStartLivePreview?: () => void;
  onStopLivePreview?: () => void;
  /** Whether Node.js is available for live preview */
  isNodeAvailable?: boolean | null;
}

/**
 * Artifact preview content with code highlighting
 * For HTML artifacts, supports Static preview (Blob URL), Code view, and Live preview (Vite)
 */
export function ArtifactPreview({
  artifact,
  livePreviewUrl,
  livePreviewStatus = "idle",
  livePreviewError,
  onStartLivePreview,
  onStopLivePreview,
  isNodeAvailable,
}: ArtifactPreviewProps) {
  const { t } = useTranslation();
  const filename = getArtifactFilename(artifact);
  const content = artifact.content || "";
  const useEditor = content && shouldUseCodeEditor(content, filename);
  const isHtml = isHtmlArtifact(artifact);

  // View mode state for HTML artifacts
  const [viewMode, setViewMode] = React.useState<HtmlViewMode>("preview");

  // Create blob URL for static HTML preview
  const iframeSrc = React.useMemo(() => {
    if (!isHtml || !content) return null;
    const blob = new Blob([content], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [isHtml, content]);

  // Cleanup blob URL on unmount or content change
  React.useEffect(() => {
    return () => {
      if (iframeSrc) {
        URL.revokeObjectURL(iframeSrc);
      }
    };
  }, [iframeSrc]);

  // Determine if live preview is available
  const canUseLivePreview = isNodeAvailable && onStartLivePreview;
  const isLivePreviewRunning = livePreviewStatus === "running" || livePreviewStatus === "starting";

  // For HTML artifacts, use special preview UI
  if (isHtml && content) {
    return (
      <div className="flex flex-col h-full">
        {/* Header with view mode toggle */}
        <div className="flex items-center gap-2 p-4 border-b shrink-0">
          {(() => {
            const IconComponent = getArtifactIcon(artifact.type);
            return <IconComponent className="h-5 w-5 text-muted-foreground" />;
          })()}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{artifact.name}</h3>
            <p className="text-xs text-muted-foreground">{artifact.type}</p>
          </div>

          {/* View mode toggle buttons */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {/* Preview button (Static) */}
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "preview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t("preview.staticPreview", "Static Preview")}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{t("preview.preview", "Preview")}</span>
            </button>

            {/* Code button */}
            <button
              type="button"
              onClick={() => setViewMode("code")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "code"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t("preview.viewCode", "View Code")}
            >
              <Code className="h-3.5 w-3.5" />
              <span>{t("preview.code", "Code")}</span>
            </button>

            {/* Live button (only if Vite preview is available) */}
            {canUseLivePreview && (
              <button
                type="button"
                onClick={() => {
                  setViewMode("live");
                  if (!isLivePreviewRunning && onStartLivePreview) {
                    onStartLivePreview();
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "live"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={t("preview.livePreview", "Live Preview")}
              >
                {isLivePreviewRunning ? (
                  <Square className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                <span>{t("preview.live", "Live")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Content based on view mode */}
        <div className="flex-1 min-h-0">
          {viewMode === "preview" && iframeSrc && (
            <iframe
              src={iframeSrc}
              className="h-full w-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin"
              title={t("preview.staticPreview", "Static Preview")}
            />
          )}

          {viewMode === "code" && (
            <CodeEditor
              value={content}
              filename={filename}
              readOnly
              height="100%"
            />
          )}

          {viewMode === "live" && (
            <VitePreview
              previewUrl={livePreviewUrl ?? null}
              status={livePreviewStatus}
              error={livePreviewError ?? null}
              onStart={onStartLivePreview}
              onStop={onStopLivePreview}
            />
          )}
        </div>
      </div>
    );
  }

  // Non-HTML artifacts: use original code/text view
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b shrink-0">
        {(() => {
          const IconComponent = getArtifactIcon(artifact.type);
          return <IconComponent className="h-5 w-5 text-muted-foreground" />;
        })()}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{artifact.name}</h3>
          <p className="text-xs text-muted-foreground">{artifact.type}</p>
        </div>
      </div>

      {/* Content */}
      {content ? (
        useEditor ? (
          <div className="flex-1 min-h-0">
            <CodeEditor
              value={content}
              filename={filename}
              readOnly
              height="100%"
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <pre className="bg-muted/50 rounded-lg p-3 text-xs whitespace-pre-wrap break-words font-mono">
              {content}
            </pre>
          </div>
        )
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No content
        </div>
      )}
    </div>
  );
}

/**
 * Tool preview content with code highlighting
 */
export function ToolPreview({ tool }: { tool: ToolUsage }) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = React.useState<"input" | "output">("output");

  const formatInput = (input: unknown): string => {
    if (!input) return "";
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };

  const formatOutput = (output: string | undefined): string => {
    if (!output) return "";
    if (output.length > 50000) {
      return output.slice(0, 50000) + "\n\n... (truncated)";
    }
    return output;
  };

  const inputContent = formatInput(tool.input);
  const outputContent = formatOutput(tool.output);
  const outputFilename = getToolOutputFilename(tool);

  // Determine if we should use editor for output
  const useEditorForOutput = outputContent && shouldUseCodeEditor(outputContent, outputFilename);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b shrink-0">
        {(() => {
          const IconComponent = getToolIcon(tool.name);
          return <IconComponent className={cn(
            "h-5 w-5",
            tool.isError ? "text-destructive" : "text-muted-foreground"
          )} />;
        })()}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="font-medium truncate">{tool.displayName}</h3>
          {isMcpTool(tool.name) && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary shrink-0">
              MCP
            </span>
          )}
          {tool.isError && (
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-500 shrink-0">
              {t("chat.error")}
            </span>
          )}
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex border-b shrink-0">
        <button
          type="button"
          onClick={() => setActiveSection("output")}
          className={cn(
            "flex-1 px-4 py-2 text-xs font-medium transition-colors",
            activeSection === "output"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("chat.toolOutput", "Output")}
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("input")}
          className={cn(
            "flex-1 px-4 py-2 text-xs font-medium transition-colors",
            activeSection === "input"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("chat.toolInput", "Input")}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeSection === "input" ? (
          inputContent ? (
            <CodeEditor
              value={inputContent}
              filename="input.json"
              readOnly
              height="100%"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No input
            </div>
          )
        ) : (
          outputContent ? (
            useEditorForOutput ? (
              <CodeEditor
                value={outputContent}
                filename={outputFilename}
                readOnly
                height="100%"
                className={tool.isError ? "bg-red-500/5" : undefined}
              />
            ) : (
              <div className="h-full overflow-auto p-4">
                <pre
                  className={cn(
                    "bg-muted/50 rounded-lg p-3 text-xs whitespace-pre-wrap break-words font-mono",
                    tool.isError && "bg-red-500/10 text-red-400"
                  )}
                >
                  {outputContent}
                </pre>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No output
            </div>
          )
        )}
      </div>
    </div>
  );
}
