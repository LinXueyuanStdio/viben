import type { WorkspaceSection } from "./view-target";
import {
  isWorkspaceSection,
  type SettingsSection,
} from "./navigation-meta";

type LocationUrlSuffix = {
  search?: string;
  hash?: string;
};

export type DesktopLocation = (
  | { kind: "workspace-home"; workspaceId: string }
  | { kind: "workspace-apps"; workspaceId: string }
  | {
      kind: "workspace-section";
      workspaceId: string;
      section: WorkspaceSection;
    }
  | { kind: "workspace-agent-detail"; workspaceId: string; agentId: string }
  | {
      kind: "workspace-executor-detail";
      workspaceId: string;
      executorType: string;
    }
  | { kind: "workspace-page"; workspaceId: string; pageSlug: string }
  | {
      kind: "workspace-web";
      workspaceId: string;
      sourcePageSlug?: string;
      webId?: string;
      title: string;
      url: string;
    }
  | {
      kind: "agent-detail";
      agentId: string;
      workspacePath?: string;
    }
  | {
      kind: "executor-detail";
      executorType: string;
      workspacePath?: string;
    }
  | {
      kind: "skill-detail";
      skillId: string;
      agentId: string;
      workspacePath?: string;
    }
  | {
      kind: "mcp-server-detail";
      serverName: string;
      executorType: string;
      workspacePath?: string;
    }
  | {
      kind: "subagent-detail";
      configId: string;
      executorType: string;
      workspacePath?: string;
    }
  | {
      kind: "prompt-detail";
      promptId: string;
      executorType: string;
      workspacePath?: string;
    }
  | {
      kind: "command-detail";
      commandId: string;
      executorType: string;
      workspacePath?: string;
    }
  | { kind: "settings"; section?: SettingsSection | string }
  | { kind: "documents" }
  | { kind: "device-pair" }
  | { kind: "global-route"; path: string }
) &
  LocationUrlSuffix;

function decodePathPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractWorkspacePageSlug(path: string): string | null {
  const pageMatch = path.match(/^\/workspace\/([^/]+)\/page\/(.+)$/);
  if (!pageMatch) return null;
  return pageMatch[2]
    .split("/")
    .map(decodePathPart)
    .join("/");
}

function extractLegacyPageSlug(rawPagePath: string | null): string | null {
  if (!rawPagePath) return null;

  const pagePath = decodePathPart(rawPagePath);
  const match = pagePath.match(/^pages\/(.+)\/SKILL\.md$/);
  if (match) return match[1];

  if (pagePath.startsWith("pages/")) {
    return pagePath.slice("pages/".length).replace(/\/SKILL\.md$/, "");
  }

  return null;
}

function normalizeSearch(search?: string): string {
  if (!search) return "";
  return search.startsWith("?") ? search : `?${search}`;
}

function normalizeHash(hash?: string): string {
  if (!hash) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
}

function appendUrlSuffix(path: string, location: LocationUrlSuffix): string {
  const search = normalizeSearch(location.search);
  const hash = normalizeHash(location.hash);

  if (!search) {
    return `${path}${hash}`;
  }

  if (path.includes("?")) {
    return `${path}&${search.slice(1)}${hash}`;
  }

  return `${path}${search}${hash}`;
}

function buildDetailQuery(
  workspacePath: string | undefined,
  extraParams?: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();

  if (workspacePath) {
    params.set("workspace_path", workspacePath);
  }

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function locationToUrl(location: DesktopLocation): string {
  switch (location.kind) {
    case "workspace-home":
      return appendUrlSuffix(
        `/workspace/${encodeURIComponent(location.workspaceId)}`,
        location
      );
    case "workspace-apps":
      return appendUrlSuffix(
        `/workspace/${encodeURIComponent(location.workspaceId)}/apps`,
        location
      );
    case "workspace-section":
      return appendUrlSuffix(
        `/workspace/${encodeURIComponent(location.workspaceId)}/${location.section}`,
        location
      );
    case "workspace-agent-detail":
      return appendUrlSuffix(
        `/workspace/${encodeURIComponent(location.workspaceId)}/agent/${encodeURIComponent(location.agentId)}`,
        location
      );
    case "workspace-executor-detail":
      return appendUrlSuffix(
        `/workspace/${encodeURIComponent(location.workspaceId)}/executor/${encodeURIComponent(location.executorType)}`,
        location
      );
    case "workspace-page": {
      const encodedSlug = location.pageSlug
        .split("/")
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join("/");
      return appendUrlSuffix(
        `/workspace/${encodeURIComponent(location.workspaceId)}/page/${encodedSlug}`,
        location
      );
    }
    case "workspace-web": {
      const params = new URLSearchParams({
        url: location.url,
        title: location.title,
      });
      if (location.sourcePageSlug) {
        params.set("source_page", location.sourcePageSlug);
      }
      if (location.webId) {
        params.set("web_id", location.webId);
      }
      return appendUrlSuffix(
        `/workspace/${encodeURIComponent(location.workspaceId)}/web?${params.toString()}`,
        location
      );
    }
    case "agent-detail":
      return appendUrlSuffix(
        `/agent/${encodeURIComponent(location.agentId)}${buildDetailQuery(location.workspacePath)}`,
        location
      );
    case "executor-detail":
      return appendUrlSuffix(
        `/executor/${encodeURIComponent(location.executorType)}${buildDetailQuery(location.workspacePath)}`,
        location
      );
    case "skill-detail":
      return appendUrlSuffix(
        `/skill/${encodeURIComponent(location.skillId)}${buildDetailQuery(location.workspacePath, {
          agent_id: location.agentId,
        })}`,
        location
      );
    case "mcp-server-detail":
      return appendUrlSuffix(
        `/mcp-server/${encodeURIComponent(location.serverName)}${buildDetailQuery(location.workspacePath, {
          executor_type: location.executorType,
        })}`,
        location
      );
    case "subagent-detail":
      return appendUrlSuffix(
        `/subagent/${encodeURIComponent(location.configId)}${buildDetailQuery(location.workspacePath, {
          executor_type: location.executorType,
        })}`,
        location
      );
    case "prompt-detail":
      return appendUrlSuffix(
        `/prompt/${encodeURIComponent(location.promptId)}${buildDetailQuery(location.workspacePath, {
          executor_type: location.executorType,
        })}`,
        location
      );
    case "command-detail":
      return appendUrlSuffix(
        `/command/${encodeURIComponent(location.commandId)}${buildDetailQuery(location.workspacePath, {
          executor_type: location.executorType,
        })}`,
        location
      );
    case "settings":
      return appendUrlSuffix(
        location.section
          ? `/settings/${encodeURIComponent(location.section)}`
          : "/settings/general",
        location
      );
    case "documents":
      return appendUrlSuffix("/documents", location);
    case "device-pair":
      return appendUrlSuffix("/devices/pair", location);
    case "global-route":
      return location.path;
    default: {
      const exhaustive: never = location;
      return exhaustive;
    }
  }
}

export function urlToLocation(url: string): DesktopLocation | null {
  const parsed = new URL(url, "http://desktop.local");
  const pathname = parsed.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const suffix = {
    search: parsed.search || undefined,
    hash: parsed.hash || undefined,
  };

  if (pathname === "/documents") {
    return { kind: "documents", ...suffix };
  }

  if (pathname === "/devices/pair") {
    return { kind: "device-pair", ...suffix };
  }

  if (pathname === "/publish" || pathname === "/my-packages" || pathname === "/analytics") {
    return { kind: "global-route", path: `${pathname}${parsed.search}${parsed.hash}` };
  }

  if (segments[0] === "settings") {
    return {
      kind: "settings",
      section: segments[1] ? decodePathPart(segments[1]) : "general",
      ...suffix,
    };
  }

  if (segments[0] === "agent" && segments[1]) {
    return {
      kind: "agent-detail",
      agentId: decodePathPart(segments[1]),
      workspacePath: parsed.searchParams.get("workspace_path") ?? undefined,
      hash: parsed.hash || undefined,
    };
  }

  if (segments[0] === "executor" && segments[1]) {
    return {
      kind: "executor-detail",
      executorType: decodePathPart(segments[1]),
      workspacePath: parsed.searchParams.get("workspace_path") ?? undefined,
      hash: parsed.hash || undefined,
    };
  }

  if (segments[0] === "skill" && segments[1]) {
    return {
      kind: "skill-detail",
      skillId: decodePathPart(segments[1]),
      agentId: parsed.searchParams.get("agent_id") ?? "",
      workspacePath: parsed.searchParams.get("workspace_path") ?? undefined,
      hash: parsed.hash || undefined,
    };
  }

  if (segments[0] === "mcp-server" && segments[1]) {
    return {
      kind: "mcp-server-detail",
      serverName: decodePathPart(segments[1]),
      executorType: parsed.searchParams.get("executor_type") ?? "CLAUDE_CODE",
      workspacePath: parsed.searchParams.get("workspace_path") ?? undefined,
      hash: parsed.hash || undefined,
    };
  }

  if (segments[0] === "subagent" && segments[1]) {
    return {
      kind: "subagent-detail",
      configId: decodePathPart(segments[1]),
      executorType: parsed.searchParams.get("executor_type") ?? "CLAUDE_CODE",
      workspacePath: parsed.searchParams.get("workspace_path") ?? undefined,
      hash: parsed.hash || undefined,
    };
  }

  if (segments[0] === "prompt" && segments[1]) {
    return {
      kind: "prompt-detail",
      promptId: decodePathPart(segments[1]),
      executorType: parsed.searchParams.get("executor_type") ?? "CLAUDE_CODE",
      workspacePath: parsed.searchParams.get("workspace_path") ?? undefined,
      hash: parsed.hash || undefined,
    };
  }

  if (segments[0] === "command" && segments[1]) {
    return {
      kind: "command-detail",
      commandId: decodePathPart(segments[1]),
      executorType: parsed.searchParams.get("executor_type") ?? "CLAUDE_CODE",
      workspacePath: parsed.searchParams.get("workspace_path") ?? undefined,
      hash: parsed.hash || undefined,
    };
  }

  if (segments[0] === "workspace" && segments[1] === "page") {
    const workspaceId = parsed.searchParams.get("workspace_id");
    const pageSlug = extractLegacyPageSlug(parsed.searchParams.get("page_path"));
    if (workspaceId && pageSlug) {
      return {
        kind: "workspace-page",
        workspaceId,
        pageSlug,
        hash: parsed.hash || undefined,
      };
    }
  }

  if (segments[0] === "workspace" && segments[1]) {
    const workspaceId = decodePathPart(segments[1]);

    if (segments.length === 2) {
      return { kind: "workspace-home", workspaceId, ...suffix };
    }

    if (segments[2] === "apps" && !segments[3]) {
      return {
        kind: "workspace-apps",
        workspaceId,
        ...suffix,
      };
    }

    if (segments[2] === "agents" && !segments[3]) {
      return {
        kind: "workspace-section",
        workspaceId,
        section: "agent",
        ...suffix,
      };
    }

    if (segments[2] === "agent" && segments[3]) {
      return {
        kind: "workspace-agent-detail",
        workspaceId,
        agentId: decodePathPart(segments[3]),
        ...suffix,
      };
    }

    if (segments[2] === "executor" && segments[3]) {
      return {
        kind: "workspace-executor-detail",
        workspaceId,
        executorType: decodePathPart(segments[3]),
        ...suffix,
      };
    }

    if (segments[2] === "web") {
      const targetUrl = parsed.searchParams.get("url");
      const title = parsed.searchParams.get("title");
      if (targetUrl && title) {
        return {
          kind: "workspace-web",
          workspaceId,
          url: targetUrl,
          title,
          sourcePageSlug: parsed.searchParams.get("source_page") ?? undefined,
          webId: parsed.searchParams.get("web_id") ?? undefined,
          hash: parsed.hash || undefined,
        };
      }
    }

    if (segments[2] === "page") {
      const pageSlug = extractWorkspacePageSlug(pathname);
      if (pageSlug) {
        return {
          kind: "workspace-page",
          workspaceId,
          pageSlug,
          hash: parsed.hash || undefined,
        };
      }
    }

    const section = decodePathPart(segments[2]);
    if (isWorkspaceSection(section)) {
      return {
        kind: "workspace-section",
        workspaceId,
        section,
        ...suffix,
      };
    }
  }

  if (pathname === "/") {
    return null;
  }

  return {
    kind: "global-route",
    path: `${pathname}${parsed.search}${parsed.hash}`,
  };
}
