import Editor from "@monaco-editor/react";
import { useTheme } from "@/hooks/use-theme";
import { Loader2 } from "lucide-react";

interface CodeEditorProps {
  value: string;
  filename: string;
  className?: string;
  height?: string;
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

export function CodeEditor({ value, filename, className, height = "100%" }: CodeEditorProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const language = getLanguage(filename);

  return (
    <div className={className} style={{ height }}>
      <Editor
        height="100%"
        language={language}
        value={value}
        theme={isDark ? "vs-dark" : "light"}
        loading={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        }
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineNumbers: "on",
          renderLineHighlight: "none",
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
        }}
      />
    </div>
  );
}

export default CodeEditor;
