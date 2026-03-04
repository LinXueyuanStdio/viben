import { useState, useEffect, useRef, useCallback } from "react";
import Editor, { OnChange } from "@monaco-editor/react";
import { useTheme } from "@/hooks/use-theme";
import { Loader2, Save, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "@/hooks";
import { useTranslation } from "react-i18next";

export interface CodeEditorProps {
  value: string;
  filename: string;
  className?: string;
  height?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: (value: string) => Promise<void>;
  saveStatus?: SaveStatus;
}

// Language extension mappings for Monaco Editor
const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  javascript: ["js", "jsx", "mjs", "cjs"],
  typescript: ["ts", "mts", "cts", "tsx"],
  python: ["py", "pyw", "pyi"],
  json: ["json", "jsonc", "json5"],
  markdown: ["md", "mdx", "markdown"],
  rust: ["rs"],
  html: ["html", "htm"],
  xml: ["xml", "svg", "xhtml"],
  css: ["css"],
  scss: ["scss", "sass"],
  less: ["less"],
  yaml: ["yaml", "yml"],
  sql: ["sql"],
  shell: ["sh", "bash", "zsh", "fish"],
  ini: ["toml", "ini", "conf", "cfg"],
  go: ["go"],
  java: ["java"],
  c: ["c", "h"],
  cpp: ["cpp", "cc", "cxx", "hpp", "hxx"],
  csharp: ["cs"],
  php: ["php"],
  ruby: ["rb", "ruby"],
  swift: ["swift"],
  kotlin: ["kt", "kts"],
  scala: ["scala", "sc"],
  dockerfile: ["dockerfile"],
  graphql: ["graphql", "gql"],
  lua: ["lua"],
  r: ["r"],
  plaintext: ["txt", "text", "log"],
};

// Build reverse mapping from extension to language
const EXTENSION_TO_LANGUAGE_MAP = Object.entries(LANGUAGE_EXTENSIONS).reduce(
  (acc, [language, extensions]) => {
    for (const ext of extensions) {
      acc[ext] = language;
    }
    return acc;
  },
  {} as Record<string, string>
);

// Map file extensions to Monaco language identifiers
function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return (ext && EXTENSION_TO_LANGUAGE_MAP[ext]) || "plaintext";
}

/**
 * Internal CodeEditor implementation
 * This is the actual component that uses Monaco Editor
 */
export function CodeEditorImpl({
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
