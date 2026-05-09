import { describe, it, expect } from "vitest";
import {
  compilePattern,
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
