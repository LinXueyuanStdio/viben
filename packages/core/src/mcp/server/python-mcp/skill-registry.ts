import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { SkillConfig, SkillMeta } from "./types";

export class SkillRegistry {
  private skillDir: string;

  constructor(skillDir: string) {
    this.skillDir = skillDir;
  }

  async listSkills(): Promise<SkillMeta[]> {
    await mkdir(this.skillDir, { recursive: true });
    const files = await readdir(this.skillDir).catch(() => [] as string[]);
    const skills: SkillMeta[] = [];

    for (const file of files) {
      if (!file.startsWith("skill_") || !file.endsWith(".md")) continue;
      const content = await readFile(join(this.skillDir, file), "utf-8");
      const { data } = matter(content);
      skills.push({
        name: data.name ?? file.replace(/^skill_/, "").replace(/\.md$/, ""),
        description: data.description ?? "",
      });
    }
    return skills;
  }

  async getSkill(name: string): Promise<SkillConfig> {
    const filePath = join(this.skillDir, `skill_${name}.md`);
    const content = await readFile(filePath, "utf-8");
    return this.parseSkillMarkdown(content);
  }

  async createSkill(config: SkillConfig): Promise<void> {
    await mkdir(this.skillDir, { recursive: true });
    const filePath = join(this.skillDir, `skill_${config.name}.md`);
    const content = this.serializeSkillMarkdown(config);
    await writeFile(filePath, content, "utf-8");
  }

  async updateSkill(name: string, partial: Partial<SkillConfig>): Promise<void> {
    const existing = await this.getSkill(name);
    const updated = { ...existing, ...partial, name };
    await this.createSkill(updated);
  }

  async deleteSkill(name: string): Promise<void> {
    const filePath = join(this.skillDir, `skill_${name}.md`);
    await unlink(filePath);
  }

  private parseSkillMarkdown(raw: string): SkillConfig {
    const { data, content } = matter(raw);
    const codeForAgent = this.extractCodeBlock(content, "Code for Agent");
    const codeForInterpreter = this.extractCodeBlock(content, "Code for Interpreter");

    return {
      name: data.name ?? "",
      description: data.description ?? "",
      code_for_agent: codeForAgent || undefined,
      code_for_interpreter: codeForInterpreter || undefined,
    };
  }

  private serializeSkillMarkdown(config: SkillConfig): string {
    const frontmatter = matter.stringify("", {
      name: config.name,
      description: config.description,
    });

    let body = "";
    if (config.code_for_agent) {
      body += `\n## Code for Agent\n\`\`\`python\n${config.code_for_agent}\n\`\`\`\n`;
    }
    if (config.code_for_interpreter) {
      body += `\n## Code for Interpreter\n\`\`\`python\n${config.code_for_interpreter}\n\`\`\`\n`;
    }

    return frontmatter.trim() + "\n" + body;
  }

  private extractCodeBlock(content: string, heading: string): string | null {
    const regex = new RegExp(
      `## ${heading}\\s*\\n\`\`\`(?:python)?\\n([\\s\\S]*?)\`\`\``,
      "m",
    );
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }
}
