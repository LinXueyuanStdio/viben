// apps/desktop/src/navigation/breadcrumb-builder.test.ts
import { describe, it, expect } from "vitest";
import { buildColdStartBreadcrumb, deriveAncestorsFromPrefix } from "./breadcrumb-builder";

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
