/**
 * JSON Viewer Component
 *
 * A React wrapper for vanilla-jsoneditor providing a read-only JSON viewer
 * with tree view, search, and dark theme support.
 */
import { useRef, useEffect, memo } from "react";
import { useTranslation } from "react-i18next";
import {
  createJSONEditor,
  Mode,
  type JSONEditorPropsOptional,
  type Content,
  type JSONContent,
} from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";

export interface JsonViewerProps {
  /** JSON data to display (object, array, or string) */
  data: unknown;
  /** Optional class name for the container */
  className?: string;
  /** Whether to use dark theme (default: true) */
  darkTheme?: boolean;
  /** Editor mode: 'tree' for collapsible tree, 'text' for raw text */
  mode?: "tree" | "text";
}

/**
 * Safely parse JSON string, returns null if invalid
 */
function safeParseJson(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

/**
 * Check if data is valid JSON (object or array)
 */
function isValidJson(data: unknown): data is object {
  return data !== null && typeof data === "object";
}

// Type for the editor instance returned by createJSONEditor
type JSONEditorInstance = ReturnType<typeof createJSONEditor>;

/**
 * JSON Viewer component using vanilla-jsoneditor
 */
export const JsonViewer = memo(function JsonViewer({
  data,
  className = "",
  darkTheme = true,
  mode = "tree",
}: JsonViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<JSONEditorInstance | null>(null);

  // Parse string data if needed
  const parsedData = safeParseJson(data);
  const hasValidJson = isValidJson(parsedData);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create editor instance
    const content: Content = hasValidJson
      ? { json: parsedData as JSONContent["json"] }
      : { text: typeof data === "string" ? data : JSON.stringify(data, null, 2) };

    const editorProps: JSONEditorPropsOptional = {
      content,
      mode: hasValidJson ? (mode === "tree" ? Mode.tree : Mode.text) : Mode.text,
      readOnly: true,
      mainMenuBar: false,
      navigationBar: true,
      statusBar: false,
    };

    editorRef.current = createJSONEditor({
      target: containerRef.current,
      props: editorProps,
    });

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);

  // Update content when data changes
  useEffect(() => {
    if (!editorRef.current) return;

    const content: Content = hasValidJson
      ? { json: parsedData as JSONContent["json"] }
      : { text: typeof data === "string" ? data : JSON.stringify(data, null, 2) };

    editorRef.current.update(content);
  }, [data, hasValidJson, parsedData]);

  return (
    <div
      ref={containerRef}
      className={`${darkTheme ? "jse-theme-dark" : ""} ${className}`}
      style={{
        height: "100%",
        minHeight: 0,
        // Override some default styles for better integration
        ["--jse-background-color" as string]: darkTheme ? "#1e1e1e" : undefined,
        ["--jse-panel-background" as string]: darkTheme ? "#252526" : undefined,
      }}
    />
  );
});

/**
 * Fallback component for when JSON editor fails to load
 * Uses i18n for the "No data" text automatically
 */
export function JsonViewerFallback({
  data,
  className = "",
}: {
  data: unknown;
  className?: string;
}) {
  const { t } = useTranslation();
  const displayText =
    typeof data === "string"
      ? data
      : JSON.stringify(data, null, 2);

  return (
    <pre
      className={`p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap overflow-auto ${className}`}
      style={{ backgroundColor: "#1e1e1e" }}
    >
      {displayText || <span className="text-gray-500 italic">{t("common.noData")}</span>}
    </pre>
  );
}

export default JsonViewer;
