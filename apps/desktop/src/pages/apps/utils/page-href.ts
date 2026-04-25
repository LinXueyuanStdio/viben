/**
 * Get the page path for navigation.
 * Per spec: /workspace/page?workspace_id=<id>&page_path=pages/xxx/SKILL.md
 */
export function getPageHref(workspaceId: string, pageSlug: string): string {
  const pagePath = `pages/${pageSlug}/SKILL.md`;
  return `/workspace/page?workspace_id=${encodeURIComponent(workspaceId)}&page_path=${encodeURIComponent(pagePath)}`;
}
