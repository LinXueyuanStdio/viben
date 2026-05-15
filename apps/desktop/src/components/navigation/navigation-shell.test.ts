import { describe, expect, it } from "vitest";
import { resolveNavigationShellHeader } from "./navigation-shell";
import type { DesktopBreadcrumbSegment } from "@/navigation/page-index";
import type { Workspace } from "@/types";

const workspace: Workspace = {
  id: "ws-1",
  name: "Workspace",
  path: "/tmp/workspace",
  type: "custom",
  created_at: "2026-05-16T00:00:00.000Z",
  last_accessed: "2026-05-16T00:00:00.000Z",
};

function segment(label: string, href: string): DesktopBreadcrumbSegment {
  return {
    id: href,
    label,
    href,
  };
}

describe("resolveNavigationShellHeader", () => {
  it("uses derived breadcrumb segments over stale registered segments", () => {
    const resolved = resolveNavigationShellHeader(
      {
        ownerId: "old-page",
        workspace,
        segments: [segment("Chat", "/workspace/ws-1/chat")],
        className: "sticky",
      },
      {
        workspace,
        segments: [segment("Kanban", "/workspace/ws-1/kanban")],
      }
    );

    expect(resolved).toEqual({
      workspace,
      segments: [segment("Kanban", "/workspace/ws-1/kanban")],
      className: "sticky",
    });
  });

  it("falls back to registered header when no derived breadcrumb exists", () => {
    const resolved = resolveNavigationShellHeader(
      {
        ownerId: "page",
        workspace,
        segments: [segment("Chat", "/workspace/ws-1/chat")],
      },
      null
    );

    expect(resolved).toEqual({
      workspace,
      segments: [segment("Chat", "/workspace/ws-1/chat")],
      className: undefined,
    });
  });
});
