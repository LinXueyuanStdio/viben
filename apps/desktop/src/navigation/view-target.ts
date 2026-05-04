import type { IconData } from "@/components/ui/icon-picker";
import type { DesktopLocation } from "./location";

export type WorkspaceSection =
  | "chat"
  | "kanban"
  | "cron"
  | "ideas"
  | "agent"
  | "files"
  | "github"
  | "chat-monitor";

export interface ViewTarget {
  key: string;
  location: DesktopLocation;
  canonicalUrl: string;
}

export type BreadcrumbItemKind =
  | "workspace-root"
  | "workspace-section"
  | "workspace-page"
  | "workspace-agent"
  | "workspace-executor"
  | "workspace-web"
  | "virtual-folder"
  | "global-route";

export interface BreadcrumbStackItem {
  id: string;
  kind: BreadcrumbItemKind;
  label: string;
  icon?: IconData;
  sourceNodeId?: string;
  parentNodeId?: string;
  target?: ViewTarget;
  meta?: {
    workspaceId?: string;
    section?: WorkspaceSection;
    routePath?: string;
    pageSlug?: string;
    agentId?: string;
    executorType?: string;
    webId?: string;
    url?: string;
    blockId?: string;
  };
}

export type VirtualNodeKind =
  | "workspace-root"
  | "workspace-section"
  | "workspace-page"
  | "workspace-agent"
  | "workspace-executor"
  | "external-web"
  | "virtual-folder"
  | "related-link";

export interface VirtualPageIndexNode {
  id: string;
  kind: VirtualNodeKind;
  label: string;
  icon?: IconData;
  parentId?: string;
  order: number;
  isContainer?: boolean;
  target?: ViewTarget;
  childSource?: {
    type:
      | "static"
      | "workspace-pages"
      | "workspace-agents"
      | "workspace-executors"
      | "page-navigation";
    workspaceId?: string;
    pageSlug?: string;
  };
  contentRef?: {
    pageSlug: string;
    blockId?: string;
  };
}

export interface TabNavigationState {
  location: DesktopLocation;
  breadcrumbStack: BreadcrumbStackItem[];
  activeNodeId?: string;
  activeIndexPath?: string[];
}

export interface PushPageOptions {
  mode?: "push" | "replace";
  preserveTail?: boolean;
}

export interface TabNavigationApi {
  openLocation(next: TabNavigationState): void;
  replaceLocation(
    location: DesktopLocation,
    patch?: Partial<TabNavigationState>
  ): void;
  pushPage(
    item: BreadcrumbStackItem,
    nextLocation: DesktopLocation,
    options?: PushPageOptions
  ): void;
  popTo(index: number): void;
  resetStack(next: TabNavigationState): void;
}

export function buildViewTarget(
  location: DesktopLocation,
  canonicalUrl: string
): ViewTarget {
  return {
    key: canonicalUrl,
    location,
    canonicalUrl,
  };
}
