import type { IconData } from "@/components/ui/icon-picker";

export type ExtractedNavItemKind = "page-mention" | "external-link" | "embed";

export interface ExtractedNavigationItem {
  id: string;
  kind: ExtractedNavItemKind;
  label?: string;
  blockId?: string;
  order: number;
  pageSlug?: string;
  url?: string;
  nav?: YooptaNavigationMeta;
}

export interface PageNavigationExtract {
  pageSlug: string;
  items: ExtractedNavigationItem[];
}

export interface YooptaNavigationMeta {
  includeInPageIndex?: boolean;
  titleOverride?: string;
  iconOverride?: IconData;
  webViewMode?: "embedded" | "external";
}

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g;
const MARKDOWN_AUTOLINK_RE = /(?<!\]\()https?:\/\/[^\s)]+/g;
const HTML_COMMENT_NAV_RE = /<!--\s*viben:nav\s+({[\s\S]*?})\s*-->/gi;
const RAW_URL_RE = /^https?:\/\//i;

type MaybeRecord = Record<string, unknown>;

function isRecord(value: unknown): value is MaybeRecord {
  return typeof value === "object" && value !== null;
}

function parseMeta(raw: string | undefined): YooptaNavigationMeta | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return undefined;
    const meta: YooptaNavigationMeta = {};
    if (typeof parsed.includeInPageIndex === "boolean") {
      meta.includeInPageIndex = parsed.includeInPageIndex;
    }
    if (typeof parsed.titleOverride === "string" && parsed.titleOverride.trim()) {
      meta.titleOverride = parsed.titleOverride.trim();
    }
    if (isRecord(parsed.iconOverride) && typeof parsed.iconOverride.type === "string" && typeof parsed.iconOverride.value === "string") {
      meta.iconOverride = {
        type: parsed.iconOverride.type as "lucide" | "emoji" | "image",
        value: parsed.iconOverride.value,
      };
    }
    if (parsed.webViewMode === "embedded" || parsed.webViewMode === "external") {
      meta.webViewMode = parsed.webViewMode;
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
  } catch {
    return undefined;
  }
}

function decodePageSlug(raw: string): string {
  return raw
    .replace(/^pages\//, "")
    .replace(/\/SKILL\.md$/i, "")
    .replace(/^\//, "")
    .trim();
}

function getExternalLabel(label: string | undefined, url: string): string {
  const cleaned = label?.trim();
  if (cleaned) return cleaned;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function pushUnique(items: ExtractedNavigationItem[], item: ExtractedNavigationItem) {
  const exists = items.some((candidate) => {
    if (candidate.kind !== item.kind) return false;
    if (candidate.pageSlug && item.pageSlug) return candidate.pageSlug === item.pageSlug;
    if (candidate.url && item.url) return candidate.url === item.url;
    return candidate.id === item.id;
  });
  if (!exists) items.push(item);
}

function buildMentionItem(
  pageSlug: string,
  order: number,
  label?: string,
  nav?: YooptaNavigationMeta,
): ExtractedNavigationItem | null {
  const normalized = decodePageSlug(pageSlug);
  if (!normalized) return null;
  return {
    id: `page:${normalized}:${order}`,
    kind: "page-mention",
    label: label?.trim() || normalized.split("/").at(-1),
    order,
    pageSlug: normalized,
    nav,
  };
}

function buildExternalItem(
  url: string,
  order: number,
  kind: "external-link" | "embed",
  label?: string,
  blockId?: string,
  nav?: YooptaNavigationMeta,
): ExtractedNavigationItem | null {
  if (!RAW_URL_RE.test(url)) return null;
  return {
    id: `${kind}:${url}:${order}`,
    kind,
    label: getExternalLabel(label, url),
    order,
    url,
    blockId,
    nav,
  };
}

export function extractPageNavigation(
  pageSlug: string,
  content: string,
): PageNavigationExtract {
  const items: ExtractedNavigationItem[] = [];
  const body = content ?? "";
  let order = 0;

  for (const match of body.matchAll(HTML_COMMENT_NAV_RE)) {
    const nav = parseMeta(match[1]);
    if (!nav) continue;
    const offset = match.index ?? 0;
    const nearby = body.slice(offset + match[0].length, offset + match[0].length + 240);
    const linkMatch = MARKDOWN_LINK_RE.exec(nearby);
    MARKDOWN_LINK_RE.lastIndex = 0;
    if (!linkMatch) continue;
    const [, label, target] = linkMatch;
    const item = RAW_URL_RE.test(target)
      ? buildExternalItem(target, order++, "external-link", label, undefined, nav)
      : buildMentionItem(target, order++, label, nav);
    if (item) pushUnique(items, item);
  }

  for (const match of body.matchAll(MARKDOWN_LINK_RE)) {
    const label = match[1];
    const target = match[2];
    const item = RAW_URL_RE.test(target)
      ? buildExternalItem(target, order++, "external-link", label)
      : buildMentionItem(target, order++, label);
    if (item) pushUnique(items, item);
  }

  for (const match of body.matchAll(MARKDOWN_AUTOLINK_RE)) {
    const item = buildExternalItem(match[0], order++, "external-link");
    if (item) pushUnique(items, item);
  }

  return {
    pageSlug,
    items: items.sort((left, right) => left.order - right.order),
  };
}

export function collectPageNavigationFromDom(root: ParentNode, pageSlug: string): PageNavigationExtract {
  const items: ExtractedNavigationItem[] = [];
  let order = 0;

  const mentions = Array.from(root.querySelectorAll<HTMLElement>("[data-mention-type='page'][data-mention-id]"));
  for (const node of mentions) {
    const id = node.dataset.mentionId;
    const item = id ? buildMentionItem(id, order++, node.textContent ?? undefined) : null;
    if (item) pushUnique(items, item);
  }

  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]"));
  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href) continue;
    const item = RAW_URL_RE.test(href)
      ? buildExternalItem(href, order++, "external-link", link.textContent ?? undefined)
      : buildMentionItem(href, order++, link.textContent ?? undefined);
    if (item) pushUnique(items, item);
  }

  const embeds = Array.from(root.querySelectorAll<HTMLIFrameElement>("iframe[src]"));
  for (const embed of embeds) {
    const src = embed.getAttribute("src");
    if (!src) continue;
    const item = buildExternalItem(src, order++, "embed", embed.title || undefined);
    if (item) pushUnique(items, item);
  }

  return {
    pageSlug,
    items: items.sort((left, right) => left.order - right.order),
  };
}
