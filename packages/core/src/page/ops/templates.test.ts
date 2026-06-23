import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { createPage, uploadPageAsset } from "./crud";
import { applyPageTemplate } from "./templates";
import { writeTemplateFilesToPageDir } from "./template-files";

const workspaces: string[] = [];

function createWorkspace(): string {
  const workspacePath = mkdtempSync(join(tmpdir(), "viben-page-template-"));
  workspaces.push(workspacePath);
  return workspacePath;
}

afterEach(() => {
  for (const workspacePath of workspaces.splice(0)) {
    rmSync(workspacePath, { recursive: true, force: true });
  }
});

describe("applyPageTemplate", () => {
  it("applies a builtin markdown template to the current empty page", async () => {
    const workspacePath = createWorkspace();
    const created = await createPage({
      workspace_path: workspacePath,
      slug: "blank-doc",
      type: "markdown",
    });

    const result = await applyPageTemplate({
      workspace_path: workspacePath,
      uid: created.page!.uid,
      template_id: "markdown-docs",
    });

    expect(result.success).toBe(true);
    expect(result.page?.uid).toBe(created.page!.uid);
    expect(result.page?.type).toBe("markdown");
    expect(result.page?.skill_content).toContain("## Getting Started");

    const raw = readFileSync(join(result.page!.path, "SKILL.md"), "utf-8");
    const parsed = matter(raw);
    expect(parsed.data.metadata.page.type).toBe("markdown");
    expect(parsed.data.page).toBeUndefined();
  });

  it("rejects applying a template when the markdown body is not empty", async () => {
    const workspacePath = createWorkspace();
    const created = await createPage({
      workspace_path: workspacePath,
      slug: "not-empty",
      name: "已有内容",
      type: "markdown",
      content: "# 已有内容\n\n正文",
    });

    const result = await applyPageTemplate({
      workspace_path: workspacePath,
      uid: created.page!.uid,
      template_id: "markdown-docs",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("rejects escaping template file paths without damaging the existing page", async () => {
    const workspacePath = createWorkspace();
    const created = await createPage({
      workspace_path: workspacePath,
      slug: "blank-doc",
      type: "markdown",
    });
    const skillPath = join(created.page!.path, "SKILL.md");
    const before = readFileSync(skillPath, "utf-8");

    expect(() => writeTemplateFilesToPageDir(created.page!.path, new Map([
      ["SKILL.md", "---\nname: changed\n---\n\nchanged"],
      ["../escape.txt", "escape"],
    ]))).toThrow("escapes page directory");

    expect(readFileSync(skillPath, "utf-8")).toBe(before);
  });

  it("rejects uploaded asset filenames that escape the assets directory", async () => {
    const workspacePath = createWorkspace();
    const created = await createPage({
      workspace_path: workspacePath,
      slug: "asset-doc",
      type: "markdown",
    });

    const result = await uploadPageAsset({
      workspace_path: workspacePath,
      uid: created.page!.uid,
      filename: "../secret.png",
      data: Buffer.from("x"),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid asset filename");
  });
});
