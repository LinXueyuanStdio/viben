import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  createJSONEditor,
  Mode,
  type Content,
  type JSONContent,
  type TextContent,
  type JSONEditorPropsOptional,
} from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";

type JsonEditorInstance = ReturnType<typeof createJSONEditor>;
export type JsonPanelSize = "default" | "compact" | "inline" | "row" | "permission";

export interface JsonPanelProps {
  value: unknown;
  className?: string;
  preClassName?: string;
  mode?: "tree" | "text";
  nullishValue?: unknown;
  size?: JsonPanelSize;
  lazyMount?: boolean;
}

export interface JsonEditorPanelProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  preClassName?: string;
  size?: JsonPanelSize;
  mode?: "tree" | "text";
}

export interface JsonBlockProps extends JsonPanelProps {
  title: ReactNode;
  titleClassName?: string;
}

export function JsonEditorPanel({
  value,
  onChange,
  className,
  preClassName,
  size = "default",
  mode = "text",
}: JsonEditorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<JsonEditorInstance | null>(null);
  const changeHandlerRef = useRef(onChange);
  const valueRef = useRef(value);
  const content = useMemo(() => textToEditorContent(value), [value]);
  const editorMode = mode === "tree" && contentHasJson(content) ? Mode.tree : Mode.text;

  useEffect(() => {
    changeHandlerRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!containerRef.current) return;

    const props: JSONEditorPropsOptional = {
      content,
      mode: editorMode,
      readOnly: false,
      mainMenuBar: false,
      navigationBar: true,
      statusBar: false,
      onChange: (updatedContent) => {
        const nextValue = editorContentToText(updatedContent);
        if (nextValue !== valueRef.current) {
          valueRef.current = nextValue;
          changeHandlerRef.current(nextValue);
        }
      },
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
    editorRef.current.updateProps({ mode: editorMode });
    editorRef.current.update(content);
  }, [content, editorMode]);

  return (
    <div className={classNames("json-panel jse-theme-dark", `json-panel-${size}`, preClassName)}>
      <div ref={containerRef} className={classNames("json-editor-host", className)} />
    </div>
  );
}

export function JsonPanel({
  value,
  className,
  preClassName,
  mode = "tree",
  nullishValue,
  size = "default",
  lazyMount = false,
}: JsonPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<JsonEditorInstance | null>(null);
  const [canMount, setCanMount] = useState(!lazyMount);
  const normalizedValue = value ?? nullishValue ?? null;
  const content = useMemo(() => valueToEditorContent(normalizedValue), [normalizedValue]);
  const editorMode = contentHasJson(content) && mode === "tree" ? Mode.tree : Mode.text;

  useEffect(() => {
    if (!lazyMount || canMount) return;
    const panel = panelRef.current;
    if (!panel) return;

    const checkVisibility = () => {
      const rect = panel.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanMount(true);
      }
    };

    checkVisibility();

    const observer = new ResizeObserver(checkVisibility);
    observer.observe(panel);
    const frame = window.requestAnimationFrame(checkVisibility);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [canMount, lazyMount]);

  useEffect(() => {
    if (!containerRef.current || !canMount) return;

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
  }, [canMount]);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.updateProps({ mode: editorMode });
    editorRef.current.update(content);
  }, [content, editorMode]);

  return (
    <div ref={panelRef} className={classNames("json-panel jse-theme-dark", `json-panel-${size}`, preClassName)}>
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
  size,
  lazyMount,
}: JsonBlockProps) {
  return (
    <div className={classNames("mb-3 last:mb-0", className)}>
      <div className={classNames("mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground", titleClassName)}>
        {title}
      </div>
      <JsonPanel
        value={value}
        preClassName={classNames("text-code-foreground", preClassName)}
        mode={mode}
        nullishValue={nullishValue}
        size={size ?? "compact"}
        lazyMount={lazyMount}
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

function textToEditorContent(value: string): Content {
  try {
    return { json: JSON.parse(value) as JSONContent["json"] };
  } catch {
    return { text: value };
  }
}

function editorContentToText(content: Content): string {
  if ("text" in content) return (content as TextContent).text;
  return formatJson((content as JSONContent).json);
}

function contentHasJson(content: Content): content is JSONContent {
  return "json" in content;
}

function classNames(...values: Array<string | false | undefined>): string | undefined {
  const className = values.filter(Boolean).join(" ");
  return className || undefined;
}
