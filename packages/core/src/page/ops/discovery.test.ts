import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseSkillMd } from "./discovery";

const roots: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "viben-page-discovery-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("parseSkillMd", () => {
  it("keeps empty markdown body as an empty string", async () => {
    const root = createRoot();
    const pageDir = join(root, "pages", "blank");
    mkdirSync(pageDir, { recursive: true });
    const skillPath = join(pageDir, "SKILL.md");
    writeFileSync(
      skillPath,
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

    const page = await parseSkillMd(skillPath, "blank");

    expect(page?.type).toBe("markdown");
    expect(page?.skill_content).toBe("");
  });
});
