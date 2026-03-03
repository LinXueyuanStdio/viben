import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import Editor, { OnChange } from "@monaco-editor/react";
import { useTheme } from "@/hooks/use-theme";
import { Loader2, Save, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "@/hooks";
import { useTranslation } from "react-i18next";

interface CodeEditorProps {
  value: string;
  filename: string;
  className?: string;
  height?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: (value: string) => Promise<void>;
  saveStatus?: SaveStatus;
}

// Map file extensions to Monaco language identifiers
function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    // JavaScript/TypeScript
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "ts":
    case "mts":
    case "cts":
      return "typescript";
    case "tsx":
      return "typescript";

    // Python
    case "py":
    case "pyw":
    case "pyi":
      return "python";

    // JSON
    case "json":
    case "jsonc":
    case "json5":
      return "json";

    // Markdown
    case "md":
    case "mdx":
    case "markdown":
      return "markdown";

    // Rust
    case "rs":
      return "rust";

    // HTML/XML
    case "html":
    case "htm":
      return "html";
    case "xml":
    case "svg":
    case "xhtml":
      return "xml";

    // CSS
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "sass":
      return "scss";
    case "less":
      return "less";

    // YAML
    case "yaml":
    case "yml":
      return "yaml";

    // SQL
    case "sql":
      return "sql";

    // Shell scripts
    case "sh":
    case "bash":
    case "zsh":
    case "fish":
      return "shell";

    // Config files
    case "toml":
      return "ini";
    case "ini":
    case "conf":
    case "cfg":
      return "ini";

    // Go
    case "go":
      return "go";

    // Java
    case "java":
      return "java";

    // C/C++
    case "c":
    case "h":
      return "c";
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
    case "hxx":
      return "cpp";

    // C#
    case "cs":
      return "csharp";

    // PHP
    case "php":
      return "php";

    // Ruby
    case "rb":
    case "ruby":
      return "ruby";

    // Swift
    case "swift":
      return "swift";

    // Kotlin
    case "kt":
    case "kts":
      return "kotlin";

    // Scala
    case "scala":
    case "sc":
      return "scala";

    // Dockerfile
    case "dockerfile":
      return "dockerfile";

    // GraphQL
    case "graphql":
    case "gql":
      return "graphql";

    // Lua
    case "lua":
      return "lua";

    // R
    case "r":
      return "r";

    // Plain text / unknown
    case "txt":
    case "text":
    case "log":
    default:
      return "plaintext";
  }
}

/**
 * Loading fallback component for Monaco Editor
 */
function EditorLoadingFallback({ height = "100%" }: { height?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center" style={{ height, minHeight: "200px" }}>
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">{t("common.loading")}</p>
      </div>
    </div>
  );
}

/**
 * Internal CodeEditor implementation
 * This is the actual component that uses Monaco Editor
 */
function CodeEditorImpl({
  value,
  filename,
  className,
  height = "100%",
  readOnly = false,
  onChange,
  onSave,
  saveStatus = "idle",
}: CodeEditorProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const language = getLanguage(filename);

  // Track current content for auto-save
  const [localValue, setLocalValue] = useState(value);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update local value when prop changes (new file selected)
  useEffect(() => {
    setLocalValue(value);
    setIsDirty(false);
  }, [value]);

  // Auto-save with debounce
  const handleChange: OnChange = useCallback(
    (newValue) => {
      if (newValue === undefined) return;

      setLocalValue(newValue);
      setIsDirty(newValue !== value);
      onChange?.(newValue);

      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Auto-save after 1 second of inactivity
      if (onSave && newValue !== value) {
        saveTimeoutRef.current = setTimeout(() => {
          onSave(newValue);
        }, 1000);
      }
    },
    [value, onChange, onSave]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save status indicator
  const renderSaveStatus = () => {
    if (readOnly) return null;

    return (
      <div
        className={cn(
          "absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs z-10",
          "transition-all duration-200",
          saveStatus === "saving" && "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
          saveStatus === "saved" && "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
          saveStatus === "error" && "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
          saveStatus === "idle" && isDirty && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
          saveStatus === "idle" && !isDirty && "opacity-0"
        )}
      >
        {saveStatus === "saving" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{t("codeEditor.saving")}</span>
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Check className="h-3 w-3" />
            <span>{t("codeEditor.saved")}</span>
          </>
        )}
        {saveStatus === "error" && (
          <>
            <AlertCircle className="h-3 w-3" />
            <span>{t("codeEditor.saveFailed")}</span>
          </>
        )}
        {saveStatus === "idle" && isDirty && (
          <>
            <Save className="h-3 w-3" />
            <span>{t("codeEditor.unsaved")}</span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={cn("relative", className)} style={{ height }}>
      {renderSaveStatus()}
      <Editor
        height="100%"
        language={language}
        value={localValue}
        theme={isDark ? "vs-dark" : "light"}
        onChange={readOnly ? undefined : handleChange}
        loading={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        }
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineNumbers: "on",
          renderLineHighlight: readOnly ? "none" : "line",
          wordWrap: "on",
          folding: true,
          automaticLayout: true,
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          renderValidationDecorations: "off",
          contextmenu: true,
          mouseWheelZoom: false,
          links: true,
          padding: { top: 8, bottom: 8 },
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: false,
          formatOnType: false,
        }}
      />
    </div>
  );
}

// Lazy load the CodeEditor implementation to split Monaco Editor into a separate chunk
const LazyCodeEditorImpl = lazy(() =>
  Promise.resolve({ default: CodeEditorImpl })
);

/**
 * CodeEditor component with lazy loading
 * Monaco Editor is loaded on-demand to improve initial bundle size
 */
export function CodeEditor(props: CodeEditorProps) {
  return (
    <Suspense fallback={<EditorLoadingFallback height={props.height} />}>
      <LazyCodeEditorImpl {...props} />
    </Suspense>
  );
}

export default CodeEditor;
