import type { ReactNode } from "react";

interface JsonToken {
  text: string;
  className?: string;
}

interface JsonCodeProps {
  value: unknown;
  className?: string;
  wrap?: boolean;
  nullishValue?: unknown;
}

export interface JsonPanelProps extends JsonCodeProps {
  preClassName?: string;
}

export interface JsonBlockProps extends JsonPanelProps {
  title: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function JsonCode({
  value,
  className,
  wrap = false,
  nullishValue,
}: JsonCodeProps) {
  return (
    <code className={classNames("json-code", wrap && "json-code-wrap", className)}>
      {tokenizeJson(formatJson(value ?? nullishValue ?? null)).map((token, index) => (
        <span key={`${index}-${token.text}`} className={token.className}>
          {token.text}
        </span>
      ))}
    </code>
  );
}

export function JsonPanel({
  value,
  preClassName,
  className,
  wrap,
  nullishValue,
}: JsonPanelProps) {
  return (
    <pre className={classNames("json-panel", preClassName)}>
      <JsonCode value={value} className={className} wrap={wrap} nullishValue={nullishValue} />
    </pre>
  );
}

export function JsonBlock({
  title,
  value,
  className,
  titleClassName,
  preClassName,
  wrap,
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
        wrap={wrap}
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

function parseJsonOrFallback(text: string, fallback: unknown): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let cursor = 0;
  const pattern = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:])/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(json)) !== null) {
    if (match.index > cursor) {
      tokens.push({ text: json.slice(cursor, match.index) });
    }
    tokens.push({
      text: match[0],
      className: getJsonTokenClass(match[0]),
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < json.length) {
    tokens.push({ text: json.slice(cursor) });
  }
  return tokens;
}

function getJsonTokenClass(token: string): string {
  if (/^"/.test(token)) return token.endsWith(":") ? "json-key" : "json-string";
  if (/^-?\d/.test(token)) return "json-number";
  if (token === "true" || token === "false") return "json-boolean";
  if (token === "null") return "json-null";
  return "json-punctuation";
}

function classNames(...values: Array<string | false | undefined>): string | undefined {
  const className = values.filter(Boolean).join(" ");
  return className || undefined;
}
