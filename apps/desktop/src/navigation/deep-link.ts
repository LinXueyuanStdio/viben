import type { DesktopLocation } from "./location";
import { normalizeWorkspaceSection } from "./navigation-meta";

export interface DesktopDeepLinkIntent {
  route: DesktopLocation;
  openMode?: "focus" | "reuse" | "new-tab";
}

function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseVibenDeepLink(rawUrl: string): DesktopDeepLinkIntent | null {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "viben:") {
    return null;
  }

  const host = url.hostname;
  const pathnameParts = url.pathname.split("/").filter(Boolean).map(decodePart);
  const openMode = parseOpenMode(url.searchParams.get("mode"));

  if (host === "oauth") {
    return null;
  }

  if (host === "settings") {
    return {
      route: {
        kind: "settings",
        section: pathnameParts[0] ?? "general",
      },
      openMode,
    };
  }

  if (host !== "workspace") {
    return null;
  }

  const workspaceId = pathnameParts[0];
  if (!workspaceId) {
    return null;
  }

  const sectionOrKind = pathnameParts[1];
  if (!sectionOrKind) {
    return {
      route: { kind: "workspace-home", workspaceId },
      openMode,
    };
  }

  if (sectionOrKind === "apps") {
    return {
      route: { kind: "workspace-apps", workspaceId },
      openMode,
    };
  }

  if (sectionOrKind === "agent") {
    const agentId = pathnameParts[2];
    return {
      route: agentId
        ? { kind: "workspace-agent-detail", workspaceId, agentId }
        : { kind: "workspace-section", workspaceId, section: "agent" },
      openMode,
    };
  }

  if (sectionOrKind === "executor") {
    const executorType = pathnameParts[2];
    if (!executorType) {
      return null;
    }

    return {
      route: {
        kind: "workspace-executor-detail",
        workspaceId,
        executorType,
      },
      openMode,
    };
  }

  if (sectionOrKind === "page") {
    const pageSlug = pathnameParts.slice(2).join("/");
    if (!pageSlug) {
      return null;
    }

    return {
      route: {
        kind: "workspace-page",
        workspaceId,
        pageSlug,
      },
      openMode,
    };
  }

  if (sectionOrKind === "web") {
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
      return null;
    }

    return {
      route: {
        kind: "workspace-web",
        workspaceId,
        url: targetUrl,
        title: url.searchParams.get("title") ?? targetUrl,
        webId: url.searchParams.get("web_id") ?? undefined,
        sourcePageSlug: url.searchParams.get("source_page") ?? undefined,
      },
      openMode,
    };
  }

  return {
    route: {
      kind: "workspace-section",
      workspaceId,
      section: normalizeWorkspaceSection(sectionOrKind),
    },
    openMode,
  };
}

function parseOpenMode(value: string | null): DesktopDeepLinkIntent["openMode"] {
  if (value === "reuse" || value === "new-tab" || value === "focus") {
    return value;
  }

  return "focus";
}
