import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import {
  buildFallbackDesktopSegment,
  stackToDesktopSegments,
} from "@/navigation/page-index";

function isEmbeddableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function WorkspaceWebPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams] = useSearchParams();
  const { getWorkspace } = useLocalWorkspaces();
  const { currentStack, currentDescriptor, openWorkspaceSection } = useDesktopRouting();

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;
  const url = searchParams.get("url") ?? "";
  const fallbackTitle = searchParams.get("title") || searchParams.get("web_id") || "Web";
  const canEmbed = isEmbeddableUrl(url);
  const serializedSearchParams = searchParams.toString();

  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }, [url]);

  const resolvedTitle = currentDescriptor?.label || fallbackTitle;

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
    const stackSegments = stackToDesktopSegments(currentStack);
    if (stackSegments.length > 0) {
      return stackSegments.map((item, index, items) =>
        index === items.length - 1
          ? {
              id: item.id,
              label: item.label,
              href: item.href || fallbackHref,
              icon: item.icon ?? { type: "lucide" as const, value: "globe" },
              kind: item.kind,
              meta: {
                ...item.meta,
                ...webMeta,
              },
            }
          : {
              id: item.id,
              label: item.label,
              href: item.href ?? "#",
              icon: item.icon,
              kind: item.kind,
              meta: item.meta,
            }
      );
    }

    return [
      buildFallbackDesktopSegment({
        id: `${workspaceId ?? "global"}:web:${searchParams.get("web_id") ?? url}`,
        label: resolvedTitle,
        location: {
          kind: "workspace-web",
          workspaceId: workspaceId ?? "global",
          title: resolvedTitle,
          url,
          webId: searchParams.get("web_id") ?? undefined,
          sourcePageSlug: searchParams.get("source_page") ?? undefined,
        },
        icon: { type: "lucide", value: "globe" },
        meta: webMeta,
      }),
    ];
  }, [currentStack, resolvedTitle, searchParams, serializedSearchParams, url, workspaceId]);

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
              {resolvedTitle}
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
            onClick={() => openWorkspaceSection(workspace.id, "files")}
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
            {resolvedTitle}
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
          title={resolvedTitle}
          className="h-full w-full border-0 bg-white"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </PageWrapper>
  );
}

export default WorkspaceWebPage;
