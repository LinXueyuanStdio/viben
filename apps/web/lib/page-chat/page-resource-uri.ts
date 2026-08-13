export const PAGE_RESOURCE_SCHEME = "viben";
export const PAGE_RESOURCE_AUTHORITY = "api";
export const PAGE_RESOURCE_PAGES_SEGMENT = "pages";
export const PAGE_RESOURCE_CONTENT_SEGMENT = "content";

export type PageResourceUri = {
  type: "published_page_content";
  publishedPageId: string;
};

export function buildPublishedPageContentResourceUri(
  publishedPageId: string,
): string {
  if (!publishedPageId) {
    throw new Error("publishedPageId is required");
  }
  if (publishedPageId.includes("/")) {
    throw new Error("publishedPageId must not contain slash");
  }
  return `${PAGE_RESOURCE_SCHEME}://${PAGE_RESOURCE_AUTHORITY}/${PAGE_RESOURCE_PAGES_SEGMENT}/${encodeURIComponent(publishedPageId)}/${PAGE_RESOURCE_CONTENT_SEGMENT}`;
}

export function parsePageResourceUri(uri: string): PageResourceUri | null {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${PAGE_RESOURCE_SCHEME}:`) return null;
  if (parsed.hostname !== PAGE_RESOURCE_AUTHORITY) return null;
  if (parsed.search || parsed.hash) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (
    segments.length !== 3 ||
    segments[0] !== PAGE_RESOURCE_PAGES_SEGMENT ||
    segments[2] !== PAGE_RESOURCE_CONTENT_SEGMENT
  ) {
    return null;
  }

  let publishedPageId: string;
  try {
    publishedPageId = decodeURIComponent(segments[1] ?? "");
  } catch {
    return null;
  }
  if (!publishedPageId || publishedPageId.includes("/")) {
    return null;
  }

  return { type: "published_page_content", publishedPageId };
}
