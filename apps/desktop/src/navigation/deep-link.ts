import { normalizeSettingsSection, normalizeWorkspaceSection } from "./navigation-meta";
import { registry } from "./route-registry";

export interface DesktopDeepLinkIntent {
  url: string;
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
    const section = normalizeSettingsSection(pathnameParts[0]);
    return {
      url: registry.build("/settings/:section", { section }),
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
      url: registry.build("/workspace/:workspaceId", { workspaceId }),
      openMode,
    };
  }

  if (sectionOrKind === "apps" || sectionOrKind === "pages") {
    return {
      url: registry.build("/workspace/:workspaceId/pages", { workspaceId }),
      openMode,
    };
  }

  if (sectionOrKind === "agent") {
    const agentId = pathnameParts[2];
    return {
      url: agentId
        ? registry.build("/workspace/:workspaceId/agent/:agentId", { workspaceId, agentId })
        : registry.build("/workspace/:workspaceId/agent", { workspaceId }),
      openMode,
    };
  }

  if (sectionOrKind === "executor") {
    const executorType = pathnameParts[2];
    if (!executorType) {
      return null;
    }

    return {
      url: registry.build("/workspace/:workspaceId/executor/:executorType", { workspaceId, executorType }),
      openMode,
    };
  }

  if (sectionOrKind === "page") {
    const pageUid = pathnameParts.slice(2).join("/");
    if (!pageUid) {
      return null;
    }

    return {
      url: registry.build("/workspace/:workspaceId/page/:uid", { workspaceId, uid: pageUid }),
      openMode,
    };
  }

  if (sectionOrKind === "web") {
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
      return null;
    }

    const title = url.searchParams.get("title") ?? targetUrl;
    const params: Record<string, string> = { workspaceId, url: targetUrl, title };
    const sourcePage = url.searchParams.get("source_page");
    const webId = url.searchParams.get("web_id");
    if (sourcePage) params.source_page = sourcePage;
    if (webId) params.web_id = webId;

    return {
      url: registry.build("/workspace/:workspaceId/web", params),
      openMode,
    };
  }

  const section = normalizeWorkspaceSection(sectionOrKind);
  return {
    url: registry.build(`/workspace/:workspaceId/${section}`, { workspaceId }),
    openMode,
  };
}

function parseOpenMode(value: string | null): DesktopDeepLinkIntent["openMode"] {
  if (value === "reuse" || value === "new-tab" || value === "focus") {
    return value;
  }

  return "focus";
}
