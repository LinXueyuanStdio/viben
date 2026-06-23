const YAML_FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export type PageCreationMode = "document" | "static" | "fullstack";

export function stripYamlFrontmatter(markdown: string): string {
  return markdown.replace(YAML_FRONTMATTER_RE, "");
}

export function isMarkdownBodyEmpty(markdown: string | null | undefined): boolean {
  return stripYamlFrontmatter(markdown ?? "").trim().length === 0;
}

export function getPageCreationModeLabel(mode: PageCreationMode): string {
  if (mode === "static") return "静态网页";
  if (mode === "fullstack") return "全栈应用";
  return "文档";
}

export function buildPageCreationPrompt(input: string, mode: PageCreationMode): string {
  const label = getPageCreationModeLabel(mode);
  const trimmedInput = input.trim();
  return [
    `请在当前空白 Markdown 页面中使用 AI 助手创建${label}。`,
    "",
    "用户需求：",
    trimmedInput,
  ].join("\n");
}
