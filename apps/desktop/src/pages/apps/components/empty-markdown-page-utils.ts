import i18n from "@/i18n";

const YAML_FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export type PageCreationMode = "document" | "static" | "fullstack";

export function stripYamlFrontmatter(markdown: string): string {
  return markdown.replace(YAML_FRONTMATTER_RE, "");
}

export function isMarkdownBodyEmpty(markdown: string | null | undefined): boolean {
  return stripYamlFrontmatter(markdown ?? "").trim().length === 0;
}

export function getPageCreationModeLabel(mode: PageCreationMode): string {
  if (mode === "static") return i18n.t("page.emptyPage.staticPage", "静态网页");
  if (mode === "fullstack") return i18n.t("page.emptyPage.fullstackApp", "全栈应用");
  return i18n.t("page.emptyPage.document", "文档");
}

export function buildPageCreationPrompt(input: string, mode: PageCreationMode): string {
  const label = getPageCreationModeLabel(mode);
  const trimmedInput = input.trim();
  return [
    i18n.t("page.emptyPage.aiCreatePrompt", "请在当前空白 Markdown 页面中使用 AI 助手创建{{label}}。", { label }),
    "",
    i18n.t("page.emptyPage.userRequirement", "用户需求："),
    trimmedInput,
  ].join("\n");
}
