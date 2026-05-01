import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { usePageTabs } from "@/hooks/use-page-tabs";

function isEmbeddableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function WorkspaceWebPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams] = useSearchParams();
  const { getWorkspace } = useLocalWorkspaces();
  const { openWorkspaceView, currentNavigationState } = usePageTabs();

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;
  const url = searchParams.get("url") ?? "";
  const title = searchParams.get("title") || searchParams.get("web_id") || "Web";
  const canEmbed = isEmbeddableUrl(url);
  const serializedSearchParams = searchParams.toString();

  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }, [url]);

  const headerSegments = useMemo(() => {
    const fallbackHref = workspaceId
      ? `/workspace/${encodeURIComponent(workspaceId)}/web?${serializedSearchParams}`
      : "#";
    const webMeta = {
      workspaceId,
      webId: searchParams.get("web_id") ?? undefined,
      pageSlug: searchParams.get("source_page") ?? undefined,
      url: url || undefined,
    };
    const stack = currentNavigationState?.breadcrumbStack;
    if (stack && stack.length > 1) {
      const mappedSegments = stack.slice(1).map((item) => ({
        id: item.id,
        label: item.label,
        href: item.target?.canonicalUrl ?? "#",
        icon: item.icon,
        kind: item.kind,
        meta: item.meta,
      }));

      return mappedSegments.map((segment, index) =>
        index === mappedSegments.length - 1
          ? {
              ...segment,
              label: title,
              href: segment.href === "#" ? fallbackHref : segment.href,
              icon: { type: "lucide" as const, value: "globe" },
              kind: "workspace-web" as const,
              meta: {
                ...segment.meta,
                ...webMeta,
              },
            }
          : segment
      );
    }

    return [
      {
        label: title,
        href: fallbackHref,
        icon: { type: "lucide" as const, value: "globe" },
        kind: "workspace-web" as const,
        meta: webMeta,
      },
    ];
  }, [currentNavigationState?.breadcrumbStack, searchParams, serializedSearchParams, title, url, workspaceId]);

  if (!workspace) {
    return (
      <PageWrapper className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Workspace not found.</div>
      </PageWrapper>
    );
  }

  if (!url || !canEmbed) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <WorkspaceHeader
          workspace={workspace}
          segments={headerSegments}
          showRefresh={false}
          showRemove={false}
          centerContent={
            <div className="max-w-[420px] truncate text-xs text-muted-foreground">
              Invalid web page
            </div>
          }
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Invalid web page</h2>
            <p className="text-sm text-muted-foreground">
              The requested workspace web page is missing a valid `url` query parameter.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              openWorkspaceView(workspace.id, "files", "Files", {
                type: "lucide",
                value: "folder-open",
              })
            }
          >
            <>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to files
            </>
          </Button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      <WorkspaceHeader
        workspace={workspace}
        segments={headerSegments}
        showRefresh={false}
        showRemove={false}
        centerContent={
          <div className="max-w-[420px] truncate text-xs text-muted-foreground">
            {title}
            {hostname ? ` · ${hostname}` : ""}
          </div>
        }
        rightContent={
          <Button asChild size="sm" variant="ghost">
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open externally
            </a>
          </Button>
        }
      />
      <div className="flex-1 bg-background">
        <iframe
          src={url}
          title={title}
          className="h-full w-full border-0 bg-white"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </PageWrapper>
  );
}

export default WorkspaceWebPage;
