import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  createJSONEditor,
  Mode,
  type Content,
  type JSONContent,
  type JSONEditorPropsOptional,
} from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";

type JsonEditorInstance = ReturnType<typeof createJSONEditor>;

export interface JsonPanelProps {
  value: unknown;
  className?: string;
  preClassName?: string;
  mode?: "tree" | "text";
  nullishValue?: unknown;
}

export interface JsonBlockProps extends JsonPanelProps {
  title: ReactNode;
  titleClassName?: string;
}

export function JsonPanel({
  value,
  className,
  preClassName,
  mode = "tree",
  nullishValue,
}: JsonPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<JsonEditorInstance | null>(null);
  const normalizedValue = value ?? nullishValue ?? null;
  const content = useMemo(() => valueToEditorContent(normalizedValue), [normalizedValue]);
  const editorMode = contentHasJson(content) && mode === "tree" ? Mode.tree : Mode.text;

  useEffect(() => {
    if (!containerRef.current) return;

    const props: JSONEditorPropsOptional = {
      content,
      mode: editorMode,
      readOnly: true,
      mainMenuBar: false,
      navigationBar: true,
      statusBar: false,
    };

    editorRef.current = createJSONEditor({
      target: containerRef.current,
      props,
    });

    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.update({
      content,
      mode: editorMode,
    });
  }, [content, editorMode]);

  return (
    <div className={classNames("json-panel jse-theme-dark", preClassName)}>
      <div ref={containerRef} className={classNames("json-editor-host", className)} />
    </div>
  );
}

export function JsonBlock({
  title,
  value,
  className,
  titleClassName,
  preClassName,
  mode,
  nullishValue,
}: JsonBlockProps) {
  return (
    <div className={classNames("mb-3 last:mb-0", className)}>
      <div className={classNames("mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground", titleClassName)}>
        {title}
      </div>
      <JsonPanel
        value={value}
        preClassName={classNames("max-h-44 text-code-foreground", preClassName)}
        mode={mode}
        nullishValue={nullishValue}
      />
    </div>
  );
}

export function formatJson(value: unknown): string {
  const formatted = JSON.stringify(value, null, 2);
  return formatted === undefined ? "null" : formatted;
}

export function normalizeJsonText(text: string): string {
  return formatJson(parseJsonOrFallback(text, { type: "object", properties: {} }));
}

export function parseJsonOrFallback(text: string, fallback: unknown): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function valueToEditorContent(value: unknown): Content {
  if (typeof value === "string") {
    try {
      return { json: JSON.parse(value) as JSONContent["json"] };
    } catch {
      return { text: value };
    }
  }
  return { json: value as JSONContent["json"] };
}

function contentHasJson(content: Content): content is JSONContent {
  return "json" in content;
}

function classNames(...values: Array<string | false | undefined>): string | undefined {
  const className = values.filter(Boolean).join(" ");
  return className || undefined;
}
