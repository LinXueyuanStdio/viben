// apps/desktop/src/navigation/navigate.test.ts
import { describe, it, expect } from "vitest";
import { buildNavigateLeaf, isStackPrefixOf } from "./navigate";
import type { BreadcrumbStackItem } from "./breadcrumb-builder";

describe("buildNavigateLeaf", () => {
  it("builds leaf from URL with registry defaults", () => {
    const leaf = buildNavigateLeaf("/workspace/x/agent/gpt");
    expect(leaf.id).toBe("/workspace/x/agent/gpt");
    expect(leaf.label).toBe("gpt");
    expect(leaf.pattern).toBe("/workspace/:workspaceId/agent/:agentId");
    expect(leaf.href).toBe("/workspace/x/agent/gpt");
  });

  it("applies headers overrides", () => {
    const leaf = buildNavigateLeaf("/workspace/x/agent/gpt", {
      label: "GPT-4o",
      id: "custom-id",
      icon: { type: "lucide", value: "sparkles" },
    });
    expect(leaf.id).toBe("custom-id");
    expect(leaf.label).toBe("GPT-4o");
    expect(leaf.icon).toEqual({ type: "lucide", value: "sparkles" });
  });

  it("handles unknown URL gracefully", () => {
    const leaf = buildNavigateLeaf("/unknown/path");
    expect(leaf.label).toBe("path"); // last segment
    expect(leaf.pattern).toBeUndefined();
  });
});

describe("isStackPrefixOf", () => {
  it("returns true when stack top is ancestor of target", () => {
    const stack: BreadcrumbStackItem[] = [
      { id: "1", label: "Workspaces", pattern: "/workspace", href: "/workspace" },
      { id: "2", label: "my-proj", pattern: "/workspace/:workspaceId", href: "/workspace/my-proj" },
      { id: "3", label: "Agents", pattern: "/workspace/:workspaceId/agent", href: "/workspace/my-proj/agent" },
    ];
    const match = { pattern: "/workspace/:workspaceId/agent/:agentId", params: {}, icon: {} as any, title: "", entry: {} as any };
    expect(isStackPrefixOf(stack, match)).toBe(true);
  });

  it("returns false when stack top is unrelated", () => {
    const stack: BreadcrumbStackItem[] = [
      { id: "1", label: "Settings", pattern: "/settings", href: "/settings" },
    ];
    const match = { pattern: "/workspace/:workspaceId/agent/:agentId", params: {}, icon: {} as any, title: "", entry: {} as any };
    expect(isStackPrefixOf(stack, match)).toBe(false);
  });

  it("returns false for empty stack", () => {
    expect(isStackPrefixOf([], { pattern: "/documents", params: {}, icon: {} as any, title: "", entry: {} as any })).toBe(false);
  });
});
