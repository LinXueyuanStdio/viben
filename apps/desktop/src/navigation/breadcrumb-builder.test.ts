// apps/desktop/src/navigation/breadcrumb-builder.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  buildColdStartBreadcrumb,
  deriveAncestorsFromPrefix,
  buildBreadcrumbItem,
  pickMatchingParams,
} from "./breadcrumb-builder";
import { compilePattern } from "./route-compiler";
import type { RouteEntry } from "./route-compiler";

describe("deriveAncestorsFromPrefix", () => {
  it("derives ancestors for workspace agent detail", () => {
    const ancestors = deriveAncestorsFromPrefix("/workspace/:workspaceId/agent/:agentId");
    expect(ancestors).toEqual([
      "/workspace",
      "/workspace/:workspaceId",
      "/workspace/:workspaceId/agent",
    ]);
  });

  it("returns empty for top-level route with no parent", () => {
    const ancestors = deriveAncestorsFromPrefix("/documents");
    expect(ancestors).toEqual([]);
  });

  it("finds /settings as ancestor of /settings/:section", () => {
    const ancestors = deriveAncestorsFromPrefix("/settings/:section");
    expect(ancestors).toEqual(["/settings"]);
  });

  it("finds /mcp-services as ancestor of /mcp-services/dashboard", () => {
    const ancestors = deriveAncestorsFromPrefix("/mcp-services/dashboard");
    expect(ancestors).toEqual(["/mcp-services"]);
  });
});

describe("buildColdStartBreadcrumb", () => {
  it("builds breadcrumb for workspace section", () => {
    const stack = buildColdStartBreadcrumb("/workspace/my-proj/chat");
    expect(stack).toHaveLength(3);
    expect(stack[0].label).toBe("Workspaces");
    expect(stack[0].href).toBe("/workspace");
    expect(stack[1].label).toBe("my-proj");
    expect(stack[1].href).toBe("/workspace/my-proj");
    expect(stack[2].label).toBe("Chat");
    expect(stack[2].href).toBe("/workspace/my-proj/chat");
  });

  it("expands rest param segments", () => {
    const stack = buildColdStartBreadcrumb("/workspace/x/pages/first/second/third");
    expect(stack).toHaveLength(6);
    // Ancestors
    expect(stack[0].href).toBe("/workspace");
    expect(stack[1].href).toBe("/workspace/x");
    expect(stack[2].href).toBe("/workspace/x/pages");
    // Rest intermediates (label = last segment only)
    expect(stack[3].label).toBe("First");
    expect(stack[3].href).toBe("/workspace/x/pages/first");
    expect(stack[4].label).toBe("Second");
    expect(stack[4].href).toBe("/workspace/x/pages/first/second");
    // Current
    expect(stack[5].label).toBe("Third");
    expect(stack[5].href).toBe("/workspace/x/pages/first/second/third");
  });

  it("handles single-segment rest param (no expansion)", () => {
    const stack = buildColdStartBreadcrumb("/workspace/x/pages/single");
    expect(stack).toHaveLength(4); // workspace, x, pages, single
    expect(stack[3].label).toBe("Single");
  });

  it("applies headers override to current node", () => {
    const stack = buildColdStartBreadcrumb("/workspace/x/agent/gpt", { label: "GPT-4o" });
    const last = stack[stack.length - 1];
    expect(last.label).toBe("GPT-4o");
  });

  it("returns empty for unknown URL", () => {
    expect(buildColdStartBreadcrumb("/totally/unknown")).toEqual([]);
  });

  it("builds settings breadcrumb with parent", () => {
    const stack = buildColdStartBreadcrumb("/settings/general");
    expect(stack).toHaveLength(2);
    expect(stack[0].label).toBe("Settings");
    expect(stack[1].label).toBe("General");
  });
});

describe("buildBreadcrumbItem", () => {
  it("builds item from a route entry with string title and icon", () => {
    // /workspace has static title "Workspaces" and static icon
    const entry: RouteEntry = {
      pattern: "/workspace",
      icon: { type: "lucide", value: "home" },
      title: "Workspaces",
    };
    const params: Record<string, string> = {};

    const item = buildBreadcrumbItem(entry, params);

    expect(item.label).toBe("Workspaces");
    expect(item.icon).toEqual({ type: "lucide", value: "home" });
    expect(item.href).toBe("/workspace");
    expect(item.pattern).toBe("/workspace");
    expect(item.id).toBe("/workspace");
  });

  it("builds item from a route entry with function title (calls function with params)", () => {
    const titleFn = vi.fn((p: Record<string, string>) => `Agent: ${p.agentId}`);
    const entry: RouteEntry = {
      pattern: "/workspace/:workspaceId/agent/:agentId",
      icon: { type: "lucide", value: "bot" },
      title: titleFn,
    };
    const params = { workspaceId: "proj-1", agentId: "gpt-4o" };

    const item = buildBreadcrumbItem(entry, params);

    expect(titleFn).toHaveBeenCalledWith(params);
    expect(item.label).toBe("Agent: gpt-4o");
    expect(item.href).toBe("/workspace/proj-1/agent/gpt-4o");
  });

  it("applies headers overrides (label, icon, id) when provided", () => {
    const entry: RouteEntry = {
      pattern: "/workspace/:workspaceId",
      icon: { type: "lucide", value: "home" },
      title: (p) => p.workspaceId,
    };
    const params = { workspaceId: "my-proj" };
    const headers = {
      label: "My Project",
      icon: { type: "lucide" as const, value: "star" },
      id: "custom-id-123",
      sourceNodeId: "source-1",
      parentNodeId: "parent-1",
      meta: { workspaceId: "my-proj", section: "pages" as const },
    };

    const item = buildBreadcrumbItem(entry, params, headers);

    expect(item.label).toBe("My Project");
    expect(item.icon).toEqual({ type: "lucide", value: "star" });
    expect(item.id).toBe("custom-id-123");
    expect(item.sourceNodeId).toBe("source-1");
    expect(item.parentNodeId).toBe("parent-1");
    expect(item.meta).toEqual({ workspaceId: "my-proj", section: "pages" });
    // href is still derived from pattern + params, not overridden
    expect(item.href).toBe("/workspace/my-proj");
  });
});

describe("pickMatchingParams", () => {
  it("picks only params that exist in the target pattern's paramNames", () => {
    // /workspace/:workspaceId has paramNames = ["workspaceId"]
    const targetPattern = "/workspace/:workspaceId";
    // Verify paramNames with compilePattern
    const compiled = compilePattern(targetPattern);
    expect(compiled.paramNames).toEqual(["workspaceId"]);

    const allParams = { workspaceId: "proj-1", agentId: "gpt-4o", section: "general" };
    const result = pickMatchingParams(targetPattern, allParams);

    expect(result).toEqual({ workspaceId: "proj-1" });
  });

  it("returns empty object when no params match", () => {
    // /workspace has no paramNames (all constant segments)
    const targetPattern = "/workspace";
    const compiled = compilePattern(targetPattern);
    expect(compiled.paramNames).toEqual([]);

    const allParams = { agentId: "gpt-4o", section: "general" };
    const result = pickMatchingParams(targetPattern, allParams);

    expect(result).toEqual({});
  });
});
