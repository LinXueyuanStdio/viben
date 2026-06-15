import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SkillRegistry } from "../skill-registry";

describe("SkillRegistry", () => {
  let skillDir: string;
  let registry: SkillRegistry;

  beforeEach(async () => {
    skillDir = await mkdtemp(join(tmpdir(), "skill-registry-test-"));
    registry = new SkillRegistry(skillDir);
  });

  afterEach(async () => {
    await rm(skillDir, { recursive: true, force: true });
  });

  describe("createSkill / getSkill", () => {
    it("should create a markdown file and read it back", async () => {
      await registry.createSkill({
        name: "pandas",
        description: "Data analysis with Pandas",
        code_for_interpreter: "import pandas as pd\nprint('ready')",
        code_for_agent: "import pandas as pd\ndf = pd.read_csv('data.csv')",
      });

      const skill = await registry.getSkill("pandas");

      expect(skill.name).toBe("pandas");
      expect(skill.description).toBe("Data analysis with Pandas");
      expect(skill.code_for_interpreter).toBe("import pandas as pd\nprint('ready')");
      expect(skill.code_for_agent).toBe("import pandas as pd\ndf = pd.read_csv('data.csv')");

      const raw = await readFile(join(skillDir, "skill_pandas.md"), "utf-8");
      expect(raw).toContain("name: pandas");
      expect(raw).toContain("## Code for Agent");
      expect(raw).toContain("## Code for Interpreter");
    });
  });

  describe("listSkills", () => {
    it("should list all skill files", async () => {
      await registry.createSkill({ name: "pandas", description: "Pandas" });
      await registry.createSkill({ name: "plotly", description: "Plotly" });

      const list = await registry.listSkills();

      expect(list).toHaveLength(2);
      expect(list.map((s) => s.name).sort()).toEqual(["pandas", "plotly"]);
    });

    it("should return empty array when no skills", async () => {
      const list = await registry.listSkills();
      expect(list).toEqual([]);
    });
  });

  describe("updateSkill", () => {
    it("should update specific fields", async () => {
      await registry.createSkill({ name: "pandas", description: "old" });
      await registry.updateSkill("pandas", { description: "new description" });

      const skill = await registry.getSkill("pandas");
      expect(skill.description).toBe("new description");
      expect(skill.name).toBe("pandas");
    });
  });

  describe("deleteSkill", () => {
    it("should remove the file", async () => {
      await registry.createSkill({ name: "pandas", description: "Pandas" });
      await registry.deleteSkill("pandas");

      const list = await registry.listSkills();
      expect(list).toEqual([]);
    });
  });
});
