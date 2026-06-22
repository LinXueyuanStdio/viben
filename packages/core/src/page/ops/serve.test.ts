import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { servePage } from "./serve";

const roots: string[] = [];

function createWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "viben-page-serve-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("servePage", () => {
  it("serves an empty markdown body as a successful text/markdown response", async () => {
    const workspacePath = createWorkspace();
    const pageDir = join(workspacePath, "pages", "blank");
    mkdirSync(pageDir, { recursive: true });
    writeFileSync(
      join(pageDir, "SKILL.md"),
      [
        "---",
        'name: "空文档"',
        "metadata:",
        "  page:",
        "    type: markdown",
        "    permission: [read, write]",
        "---",
        "",
      ].join("\n"),
      "utf-8"
    );

    const result = await servePage({
      workspace_path: workspacePath,
      uid: "blank",
    });

    expect(result.success).toBe(true);
    expect(result.content_type).toBe("text/markdown; charset=utf-8");
    expect(result.content?.toString("utf-8")).toBe("");
  });
});
