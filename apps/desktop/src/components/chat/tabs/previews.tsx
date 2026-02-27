/**
 * Preview components for artifacts and tools
 * Uses Monaco Editor for code highlighting (read-only mode)
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Artifact, ToolUsage } from "@/types";
import { getArtifactIcon, getToolIcon, isMcpTool } from "./utils";
import { CodeEditor } from "@/components/skill-files/code-editor";

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
 * Artifact preview content with code highlighting
 */
export function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  const filename = getArtifactFilename(artifact);
  const content = artifact.content || "";
  const useEditor = content && shouldUseCodeEditor(content, filename);

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
