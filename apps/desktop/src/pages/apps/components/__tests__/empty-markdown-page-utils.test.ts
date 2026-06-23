import { describe, expect, it } from "vitest";
import {
  buildPageCreationPrompt,
  isMarkdownBodyEmpty,
  stripYamlFrontmatter,
} from "../empty-markdown-page-utils";

describe("empty markdown page utils", () => {
  it("strips yaml frontmatter from markdown", () => {
    expect(stripYamlFrontmatter("---\nname: test\n---\n\n# Title")).toBe("\n# Title");
  });

  it("treats frontmatter-only markdown as empty", () => {
    expect(isMarkdownBodyEmpty("---\nname: test\n---\n")).toBe(true);
    expect(isMarkdownBodyEmpty("---\nname: test\n---\n\n  \n")).toBe(true);
    expect(isMarkdownBodyEmpty("---\nname: test\n---\n\ncontent")).toBe(false);
  });

  it("builds a mode-aware AI creation prompt", () => {
    expect(buildPageCreationPrompt("写一份说明", "document")).toContain("创建文档");
    expect(buildPageCreationPrompt("做一个页面", "static")).toContain("创建静态网页");
    expect(buildPageCreationPrompt("做一个应用", "fullstack")).toContain("创建全栈应用");
  });
});
