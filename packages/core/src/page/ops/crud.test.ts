import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { createPage } from "./crud";

const workspaces: string[] = [];

function createWorkspace(): string {
  const workspacePath = mkdtempSync(join(tmpdir(), "viben-page-crud-"));
  workspaces.push(workspacePath);
  return workspacePath;
}

afterEach(() => {
  for (const workspacePath of workspaces.splice(0)) {
    rmSync(workspacePath, { recursive: true, force: true });
  }
});

describe("createPage", () => {
  it("creates a markdown page with frontmatter only by default", async () => {
    const workspacePath = createWorkspace();

    const result = await createPage({
      workspace_path: workspacePath,
      slug: "blank-doc",
      type: "markdown",
    });

    expect(result.success).toBe(true);
    expect(result.page?.type).toBe("markdown");
    expect(result.page?.skill_content).toBe("");

    const skillPath = join(result.page!.path, "SKILL.md");
    const raw = readFileSync(skillPath, "utf-8");
    const parsed = matter(raw);

    expect(parsed.data.name).toBe("");
    expect(parsed.data.metadata.page.type).toBe("markdown");
    expect(parsed.data.metadata.page.permission).toEqual(["read", "write"]);
    expect(parsed.content.trim()).toBe("");
  });

  it("uses provided content when creating a markdown page with content", async () => {
    const workspacePath = createWorkspace();

    const result = await createPage({
      workspace_path: workspacePath,
      slug: "filled-doc",
      name: "文档",
      type: "markdown",
      content: "# 标题\n\n正文",
    });

    expect(result.success).toBe(true);
    expect(result.page?.skill_content).toBe("# 标题\n\n正文");
  });
});
