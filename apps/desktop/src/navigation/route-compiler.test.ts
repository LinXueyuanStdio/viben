import { describe, it, expect } from "vitest";
import {
  compilePattern,
  compileRegistry,
  matchUrl,
  buildUrl,
  type RouteEntry,
} from "./route-compiler";

// ─── compilePattern ──────────────────────────────────────────────────────────

describe("compilePattern", () => {
  it("compiles constant-only pattern", () => {
    const compiled = compilePattern("/documents");
    expect(compiled.regex.test("/documents")).toBe(true);
    expect(compiled.regex.test("/documents/extra")).toBe(false);
    expect(compiled.paramNames).toEqual([]);
    expect(compiled.restParam).toBeNull();
  });

  it("compiles single param pattern", () => {
    const compiled = compilePattern("/workspace/:workspaceId");
    expect(compiled.regex.test("/workspace/my-proj")).toBe(true);
    expect(compiled.regex.test("/workspace/my-proj/extra")).toBe(false);
    expect(compiled.paramNames).toEqual(["workspaceId"]);
    expect(compiled.restParam).toBeNull();
  });

  it("compiles rest param pattern", () => {
    const compiled = compilePattern("/workspace/:workspaceId/pages/:pageSlug+");
    expect(compiled.regex.test("/workspace/x/pages/a/b/c")).toBe(true);
    expect(compiled.regex.test("/workspace/x/pages/")).toBe(false);
    expect(compiled.regex.test("/workspace/x/pages")).toBe(false);
    expect(compiled.paramNames).toEqual(["workspaceId", "pageSlug"]);
    expect(compiled.restParam).toBe("pageSlug");
  });

  it("uses ^ and $ anchoring", () => {
    const compiled = compilePattern("/settings/:section");
    expect(compiled.regex.test("/settings/general")).toBe(true);
    expect(compiled.regex.test("/settings/general/extra")).toBe(false);
    expect(compiled.regex.test("prefix/settings/general")).toBe(false);
  });
});

// ─── Test Data ───────────────────────────────────────────────────────────────

const TEST_ENTRIES: RouteEntry[] = [
  {
    pattern: "/documents",
    icon: { type: "lucide", value: "file-text" },
    title: "Documents",
  },
  {
    pattern: "/workspace",
    icon: { type: "lucide", value: "home" },
    title: "Workspaces",
  },
  {
    pattern: "/workspace/:workspaceId",
    icon: { type: "lucide", value: "home" },
    title: (p) => p.workspaceId,
  },
  {
    pattern: "/workspace/:workspaceId/pages",
    icon: { type: "lucide", value: "layout-grid" },
    title: "Pages",
  },
  {
    pattern: "/workspace/:workspaceId/pages/:pageSlug+",
    icon: { type: "lucide", value: "file-text" },
    title: (p) => p.pageSlug.split("/").pop()!,
  },
  {
    pattern: "/workspace/:workspaceId/web",
    icon: { type: "lucide", value: "globe" },
    title: (p) => p.title ?? "Web",
    queryParams: ["url", "title"],
  },
  {
    pattern: "/workspace/:workspaceId/agent/:agentId",
    icon: { type: "lucide", value: "bot" },
    title: (p) => p.agentId,
  },
  {
    pattern: "/settings",
    icon: { type: "lucide", value: "settings" },
    title: "Settings",
    isContainer: true,
  },
  {
    pattern: "/settings/:section",
    icon: { type: "lucide", value: "settings" },
    title: (p) => p.section,
  },
];

// ─── matchUrl ────────────────────────────────────────────────────────────────

describe("matchUrl", () => {
  it("matches exact path", () => {
    const match = matchUrl("/documents", TEST_ENTRIES);
    expect(match).not.toBeNull();
    expect(match!.pattern).toBe("/documents");
    expect(match!.params).toEqual({});
  });

  it("matches parameterized path", () => {
    const match = matchUrl("/workspace/my-proj", TEST_ENTRIES);
    expect(match!.pattern).toBe("/workspace/:workspaceId");
    expect(match!.params).toEqual({ workspaceId: "my-proj" });
    expect(match!.icon).toEqual({ type: "lucide", value: "home" });
    expect(match!.title).toBe("my-proj");
  });

  it("matches parameterized pattern with agent route", () => {
    const match = matchUrl("/workspace/my-proj/agent/summarizer", TEST_ENTRIES);
    expect(match).not.toBeNull();
    expect(match!.pattern).toBe("/workspace/:workspaceId/agent/:agentId");
    expect(match!.params).toEqual({ workspaceId: "my-proj", agentId: "summarizer" });
    expect(typeof match!.title).toBe("string");
    expect(match!.title).toBe("summarizer");
    expect(match!.icon).toBeDefined();
    expect(match!.icon).toEqual({ type: "lucide", value: "bot" });
  });

  it("matches rest param path", () => {
    const match = matchUrl("/workspace/x/pages/a/b/c", TEST_ENTRIES);
    expect(match!.pattern).toBe("/workspace/:workspaceId/pages/:pageSlug+");
    expect(match!.params).toEqual({ workspaceId: "x", pageSlug: "a/b/c" });
  });

  it("extracts declared query params", () => {
    const match = matchUrl(
      "/workspace/x/web?url=https%3A%2F%2Fexample.com&title=Test&extra=ignored",
      TEST_ENTRIES,
    );
    expect(match!.params).toEqual({
      workspaceId: "x",
      url: "https://example.com",
      title: "Test",
    });
  });

  it("prefers more specific route (no splat over splat)", () => {
    const match = matchUrl("/workspace/x/pages", TEST_ENTRIES);
    expect(match!.pattern).toBe("/workspace/:workspaceId/pages");
  });

  it("returns null for unknown URL", () => {
    expect(matchUrl("/unknown/path", TEST_ENTRIES)).toBeNull();
  });
});

// ─── buildUrl ────────────────────────────────────────────────────────────────

describe("buildUrl", () => {
  it("builds constant-only URL", () => {
    expect(buildUrl("/documents", {}, TEST_ENTRIES)).toBe("/documents");
  });

  it("builds parameterized URL", () => {
    expect(
      buildUrl("/workspace/:workspaceId", { workspaceId: "my-proj" }, TEST_ENTRIES),
    ).toBe("/workspace/my-proj");
  });

  it("builds rest param URL", () => {
    expect(
      buildUrl(
        "/workspace/:workspaceId/pages/:pageSlug+",
        { workspaceId: "x", pageSlug: "a/b" },
        TEST_ENTRIES,
      ),
    ).toBe("/workspace/x/pages/a/b");
  });

  it("appends declared query params in order", () => {
    expect(
      buildUrl(
        "/workspace/:workspaceId/web",
        { workspaceId: "x", url: "https://a.com", title: "T" },
        TEST_ENTRIES,
      ),
    ).toBe("/workspace/x/web?url=https%3A%2F%2Fa.com&title=T");
  });

  it("throws on empty rest param", () => {
    expect(() =>
      buildUrl(
        "/workspace/:workspaceId/pages/:pageSlug+",
        { workspaceId: "x", pageSlug: "" },
        TEST_ENTRIES,
      ),
    ).toThrow();
  });

  it("throws for unknown pattern", () => {
    expect(() => buildUrl("/no/such/pattern", {}, TEST_ENTRIES)).toThrow("Unknown pattern");
  });

  it("round-trips with matchUrl", () => {
    const url1 = buildUrl(
      "/workspace/:workspaceId/pages/:pageSlug+",
      { workspaceId: "x", pageSlug: "a/b" },
      TEST_ENTRIES,
    );
    const match = matchUrl(url1, TEST_ENTRIES)!;
    const url2 = buildUrl(match.pattern, match.params, TEST_ENTRIES);
    expect(url1).toBe(url2);
  });
});

// ─── compileRegistry ──────────────────────────────────────────────────────────

describe("compileRegistry", () => {
  it("sorts routes with more constant segments before fewer", () => {
    const entries: RouteEntry[] = [
      {
        pattern: "/workspace/:workspaceId",
        icon: { type: "lucide", value: "home" },
        title: "Workspace",
      },
      {
        pattern: "/workspace/:workspaceId/pages",
        icon: { type: "lucide", value: "layout-grid" },
        title: "Pages",
      },
    ];

    const compiled = compileRegistry(entries);
    // "/workspace/:workspaceId/pages" has 2 constant segments (workspace, pages)
    // "/workspace/:workspaceId" has 1 constant segment (workspace)
    // So the route with more constant segments should come first
    expect(compiled[0].pattern).toBe("/workspace/:workspaceId/pages");
    expect(compiled[1].pattern).toBe("/workspace/:workspaceId");
  });

  it("sorts non-rest routes before rest routes with equal constant counts", () => {
    const entries: RouteEntry[] = [
      {
        pattern: "/workspace/:workspaceId/pages/:pageSlug+",
        icon: { type: "lucide", value: "file-text" },
        title: "Page",
      },
      {
        pattern: "/workspace/:workspaceId/pages",
        icon: { type: "lucide", value: "layout-grid" },
        title: "Pages",
      },
    ];

    const compiled = compileRegistry(entries);
    // Both have 2 constant segments (workspace, pages)
    // The non-rest route should come first
    expect(compiled[0].pattern).toBe("/workspace/:workspaceId/pages");
    expect(compiled[0].restParam).toBeNull();
    expect(compiled[1].pattern).toBe("/workspace/:workspaceId/pages/:pageSlug+");
    expect(compiled[1].restParam).toBe("pageSlug");
  });
});
