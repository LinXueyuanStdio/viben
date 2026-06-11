export function getPageHref(workspaceId: string, uid: string): string {
  return `/workspace/${encodeURIComponent(workspaceId)}/page/${encodeURIComponent(uid)}`;
}

export function getWorkspaceWebHref(params: {
  workspaceId: string;
  url: string;
  title?: string;
  sourcePageUid?: string;
  webId?: string;
}): string {
  const search = new URLSearchParams({
    url: params.url,
    title: params.title ?? "",
  });

  if (params.sourcePageUid) {
    search.set("source_page", params.sourcePageUid);
  }

  if (params.webId) {
    search.set("web_id", params.webId);
  }

  return `/workspace/${encodeURIComponent(params.workspaceId)}/web?${search.toString()}`;
}
