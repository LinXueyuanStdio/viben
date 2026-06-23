import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertSafePageUid,
  resolveExistingPageDir,
  resolvePageAssetPath,
  resolvePageDir,
  resolvePageRelativePath,
} from "./page-paths";

const roots: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "viben-page-paths-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("page path safety", () => {
  it("rejects unsafe page uids", () => {
    expect(() => assertSafePageUid("../secret")).toThrow("Invalid page uid");
    expect(() => assertSafePageUid("nested/page")).toThrow("Invalid page uid");
    expect(() => assertSafePageUid("nested\\page")).toThrow("Invalid page uid");
  });

  it("resolves page directories inside workspace pages", () => {
    const workspacePath = createRoot();
    expect(resolvePageDir(workspacePath, "page-1")).toBe(join(workspacePath, "pages", "page-1"));
  });

  it("rejects existing page directories that are symlinks outside the pages directory", () => {
    const workspacePath = createRoot();
    const outside = createRoot();
    mkdirSync(join(workspacePath, "pages"), { recursive: true });
    symlinkSync(outside, join(workspacePath, "pages", "linked-page"));

    expect(() => resolveExistingPageDir(workspacePath, "linked-page")).toThrow("escapes page directory");
  });

  it("rejects template output paths escaping the page directory", () => {
    const pageDir = join(createRoot(), "pages", "page-1");
    expect(() => resolvePageRelativePath(pageDir, "../SKILL.md")).toThrow("escapes page directory");
    expect(() => resolvePageRelativePath(pageDir, "/tmp/outside")).toThrow("relative path");
  });

  it("rejects uploaded asset filenames that escape the assets directory", () => {
    const pageDir = join(createRoot(), "pages", "page-1");
    expect(() => resolvePageAssetPath(pageDir, "../secret.txt")).toThrow("Invalid asset filename");
    expect(() => resolvePageAssetPath(pageDir, "nested/secret.txt")).toThrow("Invalid asset filename");
  });
});
