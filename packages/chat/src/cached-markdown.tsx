import * as React from "react";
import { Streamdown } from "streamdown";

// Module-level rendered content cache — survives unmount/remount during virtual scroll.
// Key: content string (messages < 2KB) or hash (longer content).
// Value: rendered JSX element. Max 500 entries.
const renderedCache = new Map<string, React.ReactElement>();
const KEY_ORDER: string[] = []; // LRU eviction tracking
const MAX_CACHE_SIZE = 500;

function cacheKey(content: string): string {
  // For short content, use content directly as key (saves hash computation).
  // For longer content, use dual FNV-1a hashes with distinct seeds/primes.
  if (content.length <= 2048) return content;
  let h1 = 2166136261; // FNV offset basis
  let h2 = 2654435761; // golden ratio * 2^32 (different seed)
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619); // FNV prime
    h2 ^= c;
    h2 = Math.imul(h2, 1099511628211 & 0xFFFFFFFF); // different prime (FNV-1a 64-bit prime truncated)
  }
  return `h:${h1 >>> 0}:${h2 >>> 0}:${content.length}`;
}

function evictIfNeeded() {
  while (KEY_ORDER.length > MAX_CACHE_SIZE) {
    const oldest = KEY_ORDER.shift()!;
    renderedCache.delete(oldest);
  }
}

// Plain-text fast path regex — detects whether content needs markdown parsing.
// Only checks first 500 chars (markdown syntax appears at the start in practice).
const MD_SYNTAX_RE = /[#*`|[\]>\-_~\\]|\n\n|^\d+\. |\n\d+\. /;
export function hasMarkdownSyntax(s: string): boolean {
  return MD_SYNTAX_RE.test(s.length > 500 ? s.slice(0, 500) : s);
}

/**
 * Detect if content is raw HTML that should be rendered directly (not as markdown).
 * Matches content that starts with an HTML document structure or contains <script>/<style> tags.
 */
const RAW_HTML_RE = /^\s*(<!(DOCTYPE|doctype)|<html[\s>]|<head[\s>]|<body[\s>])/;
const HAS_SCRIPT_OR_STYLE_RE = /<(script|style)[\s>]/i;
export function isRawHtml(s: string): boolean {
  return RAW_HTML_RE.test(s) || HAS_SCRIPT_OR_STYLE_RE.test(s);
}

/**
 * Renders raw HTML content inside a sandboxed iframe using srcdoc.
 * Uses allow-same-origin to read content dimensions for auto-sizing.
 * Width fits content; height fully expands.
 */
export function RawHtmlRenderer({ content }: { content: string }) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 300, h: 150 });
  const observerRef = React.useRef<ResizeObserver | null>(null);

  const handleLoad = React.useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;
    observerRef.current?.disconnect();
    const update = () => {
      const h = doc.documentElement.scrollHeight;
      const w = doc.documentElement.scrollWidth;
      if (h > 0 && w > 0) setSize({ w, h });
    };
    observerRef.current = new ResizeObserver(update);
    observerRef.current.observe(doc.documentElement);
    update();
  }, []);

  React.useEffect(() => () => observerRef.current?.disconnect(), []);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={content}
      sandbox="allow-same-origin allow-scripts"
      onLoad={handleLoad}
      style={{ width: size.w, height: size.h, maxWidth: "100%", border: "none", display: "block" }}
    />
  );
}

interface CachedStreamdownProps {
  content: string;
  mode: "static" | "streaming";
  components: Record<string, React.ComponentType<any>>;
  caret?: "block" | undefined;
}

/**
 * Wrapper around Streamdown that caches rendered output for static content.
 * - mode="static": checks LRU cache before rendering, stores result after.
 * - mode="streaming": passes through to Streamdown directly (no caching).
 * - Plain text without markdown syntax: renders as <p> directly (fast path).
 * - Raw HTML (with <script>/<style> or DOCTYPE): renders via dangerouslySetInnerHTML.
 */
export const CachedStreamdown = React.memo(function CachedStreamdown({
  content,
  mode,
  components,
  caret,
}: CachedStreamdownProps) {
  // Raw HTML detection — render directly with script execution
  if (isRawHtml(content)) {
    return <RawHtmlRenderer content={content} />;
  }

  // Streaming mode — no caching, delegate directly
  if (mode === "streaming") {
    return (
      <Streamdown mode="streaming" components={components} caret={caret}>
        {content}
      </Streamdown>
    );
  }

  // Static mode — try cache first
  const key = cacheKey(content);

  // Check cache
  const cached = renderedCache.get(key);
  if (cached) return cached;

  // Plain-text fast path — skip markdown parser entirely
  if (!hasMarkdownSyntax(content)) {
    const ParagraphComp = components.p || "p";
    const element = <ParagraphComp>{content}</ParagraphComp>;
    renderedCache.set(key, element);
    KEY_ORDER.push(key);
    evictIfNeeded();
    return element;
  }

  // Full markdown parse via Streamdown
  const element = (
    <Streamdown mode="static" components={components}>
      {content}
    </Streamdown>
  );
  renderedCache.set(key, element);
  KEY_ORDER.push(key);
  evictIfNeeded();
  return element;
});
