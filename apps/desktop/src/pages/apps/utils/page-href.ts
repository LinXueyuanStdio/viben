export function getPageHref(workspaceId: string, pageSlug: string): string {
  const normalizedSlug = pageSlug
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/workspace/${encodeURIComponent(workspaceId)}/page/${normalizedSlug}`;
}

export function getWorkspaceWebHref(params: {
  workspaceId: string;
  url: string;
  title?: string;
  sourcePageSlug?: string;
  webId?: string;
}): string {
  const search = new URLSearchParams({
    url: params.url,
    title: params.title ?? "",
  });

  if (params.sourcePageSlug) {
    search.set("source_page", params.sourcePageSlug);
  }

  if (params.webId) {
    search.set("web_id", params.webId);
  }

  return `/workspace/${encodeURIComponent(params.workspaceId)}/web?${search.toString()}`;
}

export function getLegacyPageHref(workspaceId: string, pageSlug: string): string {
  const pagePath = `pages/${pageSlug}/SKILL.md`;
  return `/workspace/page?workspace_id=${encodeURIComponent(workspaceId)}&page_path=${encodeURIComponent(pagePath)}`;
}
