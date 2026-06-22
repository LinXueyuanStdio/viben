# 空 Markdown 页面与 AI 创建入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建页面默认生成正文为空的 Markdown 页面，并在空 Markdown 编辑界面提供手动编辑、模板创建、导入页面和复用 ACP ChatInput 的 AI 创建入口。

**Architecture:** `packages/core` 继续作为页面能力唯一边界，负责创建空 Markdown、应用模板、导入 URL/Markdown/HTML 文件，以及正确发现和 serve 空正文页面。`apps/desktop` 只通过 Gateway client/hooks 调用 page API，空态 UI 放在 `YooptaMarkdownRenderer` 内，AI 创建复用现有 `useAcpSession()` 和 `@viben/chat` 的 `ChatInput` expanded/compact 布局。第一版文件变化监听使用轻量 polling，不引入新的文件 watch 服务。

**Tech Stack:** TypeScript, React 19, Vite, Tauri, TanStack Query, Fastify Gateway, gray-matter, Yoopta editor, `@viben/chat` ChatInput, Vitest, Testing Library.

---

## 设计边界与文件结构

本计划按可独立验证的层次拆分。实现时不要回滚当前工作区已有的 `apps/desktop/src/hooks/use-agent-model-selection.ts` 和 `apps/desktop/src/hooks/use-agent-model-selection.test.ts` 改动。

Core page 层：

- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/types.ts`
  - 新增 `ApplyPageTemplateOptions/Result`、`ImportPageOptions/Result` 类型。
  - 明确 `skill_content` 对空 Markdown 正文使用空字符串。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/crud.ts`
  - `CreatePageOptions` 增加 `empty_body?: boolean`。
  - Markdown 页面在 `empty_body: true` 时只写 frontmatter，不写标题/占位正文。
  - 抽出写模板文件 helper，供 `createPage(template_id)` 与 apply-template 复用。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/discovery.ts`
  - `parseSkillMd()` 对空正文返回 `skill_content: ""`。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/serve.ts`
  - Markdown 页面空正文返回成功，content 为 0-byte Buffer。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/templates.ts`
  - 新增 `applyPageTemplate()`，只允许空正文页面应用模板。
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/import.ts`
  - 新增 `importPage()`，支持 `url`、`markdown_file`、`html_file`。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/index.ts`
  - 导出新增类型与函数。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.ts`
  - `POST /api/page/create` 贯通 `empty_body` 和 `template_id`。
  - 新增 `POST /api/page/apply-template`。
  - 新增 `POST /api/page/import`。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/templates/pages/markdown-docs/SKILL.md.hbs`
  - 将旧 top-level `page:` frontmatter 改为 `metadata.page`。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/templates/pages/static-html/SKILL.md.hbs`
  - 将旧 top-level `page:` frontmatter 改为 `metadata.page`。

Core tests：

- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/crud.test.ts`
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/discovery.test.ts`
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/serve.test.ts`
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/templates.test.ts`
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/import.test.ts`
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.test.ts`

Desktop Gateway 层：

- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/types/page.ts`
  - 增加 `empty_body`、`template_id`、apply-template/import 类型。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/modules/pages.ts`
  - 增加 `applyPageTemplate()`、`importPage()`。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/hooks/use-pages.ts`
  - 增加 `useApplyPageTemplate()`、`useImportPage()`，成功后 invalidate list/detail。
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/modules/pages.test.ts`
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/hooks/use-pages-empty-page.test.tsx`

Desktop page UI 层：

- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/create-page-dialog.tsx`
  - 将默认创建从表单流改为直接创建空 Markdown 页面。
  - 保留高级创建入口时，使用 `empty_body: true` 的 Markdown 默认值。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-app-grid.tsx`
  - 新建按钮点击后直接调用 create mutation，并打开新 page uid。
- 修改：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`
  - 修复空字符串内容加载。
  - 在 title/icon 下方、Yoopta editor 容器上方插入空态 UI。
  - Enter/点击空态手动入口创建或聚焦空 Paragraph。
  - 接入模板对话框、导入对话框、AI 创建 compact loading UI。
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/empty-markdown-page-card.tsx`
  - 空页面卡片壳、手动入口、模板/导入按钮、AI mode segmented control。
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-template-dialog.tsx`
  - 模板搜索和选择。
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-import-dialog.tsx`
  - URL、Markdown 文件、HTML 文件导入入口。
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-input.tsx`
  - 用 `ChatInput` expanded 布局承载初始 AI 输入。
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-compact.tsx`
  - 用 `ChatInput layoutVariant="compact"` 承载创建中 UI。
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/use-page-ai-creation.ts`
  - 管理 ACP session、prompt 构造、polling、停止和恢复空态。
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/empty-markdown-page-utils.ts`
  - `stripYamlFrontmatter()`、`isMarkdownBodyEmpty()`、`buildPageCreationPrompt()`。

Desktop tests：

- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/empty-markdown-page-utils.test.ts`
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/empty-markdown-page-card.test.tsx`
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/page-ai-create-input.test.tsx`
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/yoopta-markdown-renderer-empty.test.tsx`
- 新增：`/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/use-page-ai-creation.test.tsx`

---

### Task 1: Core 创建空 Markdown 页面

**Files:**

- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/types.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/crud.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/crud.test.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.test.ts`

- [ ] **Step 1: 写 createPage 空正文失败测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/crud.test.ts` 新增：

```ts
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { createPage } from "./crud";

const workspaces: string[] = [];

function createWorkspace(): string {
  const path = mkdtempSync(join(tmpdir(), "viben-page-crud-"));
  workspaces.push(path);
  return path;
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("createPage", () => {
  it("creates a markdown page with frontmatter only when empty_body is true", async () => {
    const workspacePath = createWorkspace();

    const result = await createPage({
      workspace_path: workspacePath,
      slug: "blank-doc",
      name: "空文档",
      type: "markdown",
      empty_body: true,
    });

    expect(result.success).toBe(true);
    expect(result.page?.type).toBe("markdown");
    expect(result.page?.skill_content).toBe("");

    const skillPath = join(result.page!.path, "SKILL.md");
    const raw = readFileSync(skillPath, "utf-8");
    const parsed = matter(raw);

    expect(parsed.data.name).toBe("空文档");
    expect(parsed.data.metadata.page.type).toBe("markdown");
    expect(parsed.data.metadata.page.permission).toEqual(["read", "write"]);
    expect(parsed.content.trim()).toBe("");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/crud.test.ts
```

Expected: FAIL，TypeScript 报 `empty_body` 不在 `CreatePageOptions`，或断言发现正文包含 `# 空文档`。

- [ ] **Step 3: 实现 `empty_body` 入参和 Markdown 空正文写入**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/crud.ts` 的 `CreatePageOptions` 中增加：

```ts
  empty_body?: boolean;
```

在 `createPage()` 解构参数处改为：

```ts
  const {
    workspace_path,
    slug,
    name,
    description = "",
    icon,
    type,
    template_id,
    parent_uid,
    empty_body = false,
  } = options;
```

在非模板分支构建完 frontmatter 后，将当前固定正文逻辑替换为：

```ts
    skillContent += "---\n\n";

    if (!(type === "markdown" && empty_body)) {
      skillContent += `# ${name}\n\n`;
      skillContent += description || "Page description here.";
    }
```

- [ ] **Step 4: 修正 discovery 返回空字符串**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/discovery.ts` 将 base 中的 `skill_content` 从：

```ts
    skill_content: markdownContent.trim() || undefined,
```

改为：

```ts
    skill_content: markdownContent.trim() ? markdownContent.trim() : "",
```

- [ ] **Step 5: 跑 createPage 测试确认通过**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/crud.test.ts
```

Expected: PASS。

- [ ] **Step 6: 写 Gateway create API 测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.test.ts` 新增或合并：

```ts
import Fastify from "fastify";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { registerPageRoutes } from "./page";

const workspaces: string[] = [];

function createWorkspace(): string {
  const path = mkdtempSync(join(tmpdir(), "viben-page-route-"));
  workspaces.push(path);
  return path;
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("page routes", () => {
  it("POST /api/page/create accepts empty_body and returns an empty markdown page", async () => {
    const app = Fastify({ logger: false });
    registerPageRoutes(app);
    await app.ready();
    const workspacePath = createWorkspace();

    const response = await app.inject({
      method: "POST",
      url: "/api/page/create",
      payload: {
        workspace_path: workspacePath,
        slug: "blank-doc",
        name: "空文档",
        type: "markdown",
        empty_body: true,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.page.skill_content).toBe("");

    const raw = readFileSync(join(body.page.path, "SKILL.md"), "utf-8");
    expect(matter(raw).content.trim()).toBe("");

    await app.close();
  });
});
```

- [ ] **Step 7: 跑 Gateway 测试确认失败**

Run:

```bash
pnpm --filter @viben/core test -- src/gateway/routes/page.test.ts
```

Expected: FAIL，response schema 或 handler 尚未传递 `empty_body`。

- [ ] **Step 8: 贯通 Gateway create route**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.ts` 的 create route Body 类型增加：

```ts
      template_id?: string;
      empty_body?: boolean;
```

在 create body schema properties 增加：

```ts
          template_id: { type: "string", nullable: true, description: "Page template id" },
          empty_body: { type: "boolean", nullable: true, description: "Create markdown page with empty body" },
```

在 handler 解构和 `createPage()` 调用中传递：

```ts
      template_id,
      empty_body,
```

- [ ] **Step 9: 跑 core 创建相关测试**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/crud.test.ts src/gateway/routes/page.test.ts
```

Expected: PASS。

- [ ] **Step 10: Commit**

Run:

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/crud.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/discovery.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/crud.test.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.test.ts
git commit -m "feat: create empty markdown pages"
```

---

### Task 2: Core 发现和 serve 空 Markdown 正文

**Files:**

- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/discovery.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/serve.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/discovery.test.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/serve.test.ts`

- [ ] **Step 1: 写 discovery 空正文测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/discovery.test.ts` 新增：

```ts
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
    writeFileSync(skillPath, [
      "---",
      'name: "空文档"',
      "metadata:",
      "  page:",
      "    type: markdown",
      "    permission: [read, write]",
      "---",
      "",
    ].join("\n"), "utf-8");

    const page = await parseSkillMd(skillPath, "blank");

    expect(page?.type).toBe("markdown");
    expect(page?.skill_content).toBe("");
  });
});
```

- [ ] **Step 2: 写 serve 空正文测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/serve.test.ts` 新增：

```ts
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
    writeFileSync(join(pageDir, "SKILL.md"), [
      "---",
      'name: "空文档"',
      "metadata:",
      "  page:",
      "    type: markdown",
      "    permission: [read, write]",
      "---",
      "",
    ].join("\n"), "utf-8");

    const result = await servePage({
      workspace_path: workspacePath,
      uid: "blank",
    });

    expect(result.success).toBe(true);
    expect(result.content_type).toBe("text/markdown; charset=utf-8");
    expect(result.content?.toString("utf-8")).toBe("");
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/discovery.test.ts src/page/ops/serve.test.ts
```

Expected: discovery 在未完成 Task 1 Step 4 时失败，serve 当前返回 `Markdown page has no content`。

- [ ] **Step 4: 实现 serve 空正文成功**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/serve.ts` 找到 Markdown serve 分支，将 `if (!page.skill_content)` 这类 falsy 判断改成只拒绝 `undefined` 或 `null`：

```ts
  if (page.skill_content === undefined || page.skill_content === null) {
    return {
      success: false,
      error: "Markdown page content is unavailable",
    };
  }

  return {
    success: true,
    content: Buffer.from(page.skill_content, "utf-8"),
    content_type: "text/markdown; charset=utf-8",
  };
```

- [ ] **Step 5: 跑 discovery/serve 测试**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/discovery.test.ts src/page/ops/serve.test.ts
```

Expected: PASS。

- [ ] **Step 6: Commit**

Run:

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/discovery.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/serve.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/discovery.test.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/serve.test.ts
git commit -m "fix: serve empty markdown pages"
```

---

### Task 3: Core 应用模板到当前空页面

**Files:**

- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/types.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/crud.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/templates.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/index.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/templates/pages/markdown-docs/SKILL.md.hbs`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/templates/pages/static-html/SKILL.md.hbs`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/templates.test.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.test.ts`

- [ ] **Step 1: 写 apply-template core 测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/templates.test.ts` 新增：

```ts
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { createPage } from "./crud";
import { applyPageTemplate } from "./templates";

const workspaces: string[] = [];

function createWorkspace(): string {
  const path = mkdtempSync(join(tmpdir(), "viben-page-template-"));
  workspaces.push(path);
  return path;
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("applyPageTemplate", () => {
  it("applies a builtin markdown template to the current empty page", async () => {
    const workspacePath = createWorkspace();
    const created = await createPage({
      workspace_path: workspacePath,
      slug: "blank-doc",
      name: "模板文档",
      type: "markdown",
      empty_body: true,
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
      empty_body: false,
    });

    const result = await applyPageTemplate({
      workspace_path: workspacePath,
      uid: created.page!.uid,
      template_id: "markdown-docs",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("empty");
  });
});
```

- [ ] **Step 2: 跑模板测试确认失败**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/templates.test.ts
```

Expected: FAIL，`applyPageTemplate` 未导出。

- [ ] **Step 3: 新增类型**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/types.ts` 增加：

```ts
export interface ApplyPageTemplateOptions {
  workspace_path: string;
  uid: string;
  template_id: string;
}

export interface ApplyPageTemplateResult extends PageResult {
  page?: PageConfig;
}
```

- [ ] **Step 4: 抽出模板写入 helper**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/crud.ts` 导出 helper：

```ts
export function writeTemplateFilesToPageDir(
  pageDir: string,
  files: Map<string, string>
): void {
  for (const [filePath, content] of files) {
    const fullPath = join(pageDir, filePath);
    const parentDir = dirname(fullPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    const finalPath = filePath === "SKILL.md" ? join(pageDir, SKILL_FILE) : fullPath;
    writeFileSync(finalPath, content, "utf-8");
  }
}
```

并将 `createPage()` template 分支里的循环替换为：

```ts
    writeTemplateFilesToPageDir(pageDir, files);
```

- [ ] **Step 5: 实现 `applyPageTemplate()`**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/templates.ts` 增加 imports：

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";
import { getPageByUid } from "./discovery";
import { writeTemplateFilesToPageDir } from "./crud";
import type {
  ApplyPageTemplateOptions,
  ApplyPageTemplateResult,
  PageTemplate,
  PageType,
  TemplateVars,
  ListTemplatesResult,
} from "./types";
```

保持已有 import 不重复。新增函数：

```ts
export async function applyPageTemplate(
  options: ApplyPageTemplateOptions
): Promise<ApplyPageTemplateResult> {
  const { workspace_path, uid, template_id } = options;
  const page = await getPageByUid(workspace_path, uid);
  if (!page) {
    return { success: false, error: `Page not found: ${uid}` };
  }

  const skillPath = join(page.path, "SKILL.md");
  if (!existsSync(skillPath)) {
    return { success: false, error: `Page SKILL.md not found: ${uid}` };
  }

  const parsed = matter(readFileSync(skillPath, "utf-8"));
  if (parsed.content.trim()) {
    return { success: false, error: "Template can only be applied to an empty page" };
  }

  const template = getTemplate(template_id, workspace_path);
  if (!template) {
    return { success: false, error: `Template not found: ${template_id}` };
  }

  const vars = {
    name: page.name,
    slug: uid,
    description: page.description ?? "",
  };
  const files = loadTemplateFiles(template_id, vars, workspace_path);
  if (files.size === 0) {
    return { success: false, error: `Template has no files: ${template_id}` };
  }

  writeTemplateFilesToPageDir(page.path, files);
  const updated = await getPageByUid(workspace_path, uid);
  return { success: true, page: updated ?? undefined };
}
```

- [ ] **Step 6: 修正内置模板 frontmatter**

将 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/templates/pages/markdown-docs/SKILL.md.hbs` frontmatter 改为：

```md
---
name: "{{name}}"
description: "{{description}}"
metadata:
  page:
    type: markdown
    permission: [read, write]
---
```

将 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/templates/pages/static-html/SKILL.md.hbs` frontmatter 改为：

```md
---
name: "{{name}}"
description: "{{description}}"
metadata:
  page:
    type: static
    file: index.html
    permission: [read, write]
---
```

- [ ] **Step 7: 导出 apply-template**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/index.ts` 导出类型：

```ts
  ApplyPageTemplateOptions,
  ApplyPageTemplateResult,
```

导出函数：

```ts
  applyPageTemplate,
```

- [ ] **Step 8: 跑模板测试确认通过**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/templates.test.ts
```

Expected: PASS。

- [ ] **Step 9: 写 apply-template Gateway 测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.test.ts` 的 `describe("page routes")` 内追加：

```ts
  it("POST /api/page/apply-template applies a template to the current empty page", async () => {
    const app = Fastify({ logger: false });
    registerPageRoutes(app);
    await app.ready();
    const workspacePath = createWorkspace();

    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/page/create",
      payload: {
        workspace_path: workspacePath,
        slug: "blank-doc",
        name: "模板文档",
        type: "markdown",
        empty_body: true,
      },
    });
    const created = createdResponse.json();

    const response = await app.inject({
      method: "POST",
      url: "/api/page/apply-template",
      payload: {
        workspace_path: workspacePath,
        uid: created.page.uid,
        template_id: "markdown-docs",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.page.uid).toBe(created.page.uid);
    expect(body.page.skill_content).toContain("## Getting Started");

    await app.close();
  });
```

- [ ] **Step 10: 实现 apply-template route**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.ts` import `applyPageTemplate` 和类型 `ApplyPageTemplateResult`。新增 response schema 复用 `createPageResponseSchema` 或定义：

```ts
const applyPageTemplateResponseSchema = createPageResponseSchema;
```

在 `registerPageRoutes()` 中新增：

```ts
  fastify.post<{
    Body: { workspace_path: string; uid: string; template_id: string };
    Reply: ApplyPageTemplateResult;
  }>("/api/page/apply-template", {
    schema: {
      description: "Apply a page template to an existing empty page",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path" },
          uid: { type: "string", description: "Page uid" },
          template_id: { type: "string", description: "Template id" },
        },
        required: ["workspace_path", "uid", "template_id"],
      },
      response: {
        200: applyPageTemplateResponseSchema,
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const result = await applyPageTemplate(request.body);
    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return result;
    }
    return result;
  });
```

- [ ] **Step 11: 跑 apply-template core/gateway 测试**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/templates.test.ts src/gateway/routes/page.test.ts
```

Expected: PASS。

- [ ] **Step 12: Commit**

Run:

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/types.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/crud.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/templates.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/index.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/templates/pages/markdown-docs/SKILL.md.hbs /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/templates/pages/static-html/SKILL.md.hbs /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/templates.test.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.test.ts
git commit -m "feat: apply templates to empty pages"
```

---

### Task 4: Core 导入 URL、Markdown 文件和 HTML 文件

**Files:**

- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/types.ts`
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/import.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/index.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/import.test.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.test.ts`

- [ ] **Step 1: 写 Markdown/HTML 导入 core 测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/import.test.ts` 新增：

```ts
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { createPage } from "./crud";
import { importPage } from "./import";

const roots: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "viben-page-import-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("importPage", () => {
  it("imports a markdown file body without imported frontmatter", async () => {
    const workspacePath = createRoot();
    const sourcePath = join(createRoot(), "source.md");
    writeFileSync(sourcePath, [
      "---",
      'name: "外部文档"',
      "---",
      "# 正文标题",
      "",
      "正文内容",
    ].join("\n"), "utf-8");
    const created = await createPage({
      workspace_path: workspacePath,
      slug: "blank-doc",
      name: "当前页面",
      type: "markdown",
      empty_body: true,
    });

    const result = await importPage({
      workspace_path: workspacePath,
      uid: created.page!.uid,
      source_type: "markdown_file",
      source_path: sourcePath,
    });

    expect(result.success).toBe(true);
    expect(result.page?.type).toBe("markdown");
    expect(result.page?.skill_content).toBe("# 正文标题\n\n正文内容");

    const parsed = matter(readFileSync(join(result.page!.path, "SKILL.md"), "utf-8"));
    expect(parsed.data.name).toBe("当前页面");
    expect(parsed.content.trim()).toBe("# 正文标题\n\n正文内容");
  });

  it("imports an html file as a static page with index.html", async () => {
    const workspacePath = createRoot();
    const sourcePath = join(createRoot(), "source.html");
    writeFileSync(sourcePath, "<!doctype html><html><body><h1>Hello</h1></body></html>", "utf-8");
    const created = await createPage({
      workspace_path: workspacePath,
      slug: "blank-static",
      name: "HTML 页面",
      type: "markdown",
      empty_body: true,
    });

    const result = await importPage({
      workspace_path: workspacePath,
      uid: created.page!.uid,
      source_type: "html_file",
      source_path: sourcePath,
    });

    expect(result.success).toBe(true);
    expect(result.page?.type).toBe("static");
    expect(result.page?.file).toBe("index.html");
    expect(existsSync(join(result.page!.path, "index.html"))).toBe(true);
    expect(readFileSync(join(result.page!.path, "index.html"), "utf-8")).toContain("<h1>Hello</h1>");
    expect(result.page?.skill_content).toBe(`从 ${sourcePath} 导入的页面`);
  });

  it("rejects import when the current markdown body is not empty", async () => {
    const workspacePath = createRoot();
    const sourcePath = join(createRoot(), "source.md");
    writeFileSync(sourcePath, "新内容", "utf-8");
    const created = await createPage({
      workspace_path: workspacePath,
      slug: "not-empty",
      name: "已有内容",
      type: "markdown",
      empty_body: false,
    });

    const result = await importPage({
      workspace_path: workspacePath,
      uid: created.page!.uid,
      source_type: "markdown_file",
      source_path: sourcePath,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("empty");
  });
});
```

- [ ] **Step 2: 跑 import 测试确认失败**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/import.test.ts
```

Expected: FAIL，`./import` 文件不存在。

- [ ] **Step 3: 新增导入类型**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/types.ts` 增加：

```ts
export type PageImportSourceType = "url" | "markdown_file" | "html_file";

export interface ImportPageOptions {
  workspace_path: string;
  uid: string;
  source_type: PageImportSourceType;
  source_url?: string;
  source_path?: string;
}

export interface ImportPageResult extends PageResult {
  page?: PageConfig;
}
```

- [ ] **Step 4: 实现 import helpers**

创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/import.ts`：

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import matter from "gray-matter";
import { proxyFetch } from "../../http";
import { getPageByUid } from "./discovery";
import type { ImportPageOptions, ImportPageResult } from "./types";

const SKILL_FILE = "SKILL.md";
const INDEX_HTML = "index.html";
const MAX_URL_IMPORT_BYTES = 2 * 1024 * 1024;

function assertAbsoluteSourcePath(sourcePath: string | undefined): string {
  if (!sourcePath || !isAbsolute(sourcePath)) {
    throw new Error("source_path must be an absolute path");
  }
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }
  return sourcePath;
}

function isPageBodyEmpty(rawSkill: string): boolean {
  return matter(rawSkill).content.trim().length === 0;
}

function writeMarkdownBody(skillPath: string, body: string): void {
  const current = matter(readFileSync(skillPath, "utf-8"));
  writeFileSync(skillPath, matter.stringify(body, current.data), "utf-8");
}

function htmlToMarkdownFallback(html: string, sourceUrl: string): string {
  const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() || sourceUrl;
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "\n$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return body ? body : `# ${title}\n\n来源：${sourceUrl}`;
}

async function importUrlToMarkdown(sourceUrl: string | undefined): Promise<string> {
  if (!sourceUrl?.trim()) {
    throw new Error("source_url is required");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await proxyFetch(sourceUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`URL import failed: HTTP ${response.status}`);
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf-8") > MAX_URL_IMPORT_BYTES) {
      throw new Error("URL import content is too large");
    }
    return htmlToMarkdownFallback(text, sourceUrl);
  } finally {
    clearTimeout(timeout);
  }
}

export async function importPage(options: ImportPageOptions): Promise<ImportPageResult> {
  const { workspace_path, uid, source_type } = options;
  const page = await getPageByUid(workspace_path, uid);
  if (!page) {
    return { success: false, error: `Page not found: ${uid}` };
  }

  const skillPath = join(page.path, SKILL_FILE);
  const currentRaw = readFileSync(skillPath, "utf-8");
  if (!isPageBodyEmpty(currentRaw)) {
    return { success: false, error: "Import can only be applied to an empty page" };
  }

  try {
    if (source_type === "markdown_file") {
      const sourcePath = assertAbsoluteSourcePath(options.source_path);
      const imported = matter(readFileSync(sourcePath, "utf-8"));
      writeMarkdownBody(skillPath, imported.content.trim());
    } else if (source_type === "html_file") {
      const sourcePath = assertAbsoluteSourcePath(options.source_path);
      const html = readFileSync(sourcePath, "utf-8");
      const parsed = matter(currentRaw);
      parsed.data.metadata = parsed.data.metadata ?? {};
      parsed.data.metadata.page = {
        type: "static",
        file: INDEX_HTML,
        permission: ["read", "write"],
      };
      writeFileSync(join(page.path, INDEX_HTML), html, "utf-8");
      writeFileSync(skillPath, matter.stringify(`从 ${sourcePath} 导入的页面`, parsed.data), "utf-8");
    } else if (source_type === "url") {
      const markdown = await importUrlToMarkdown(options.source_url);
      writeMarkdownBody(skillPath, markdown);
    } else {
      return { success: false, error: `Unsupported import source_type: ${source_type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import page",
    };
  }

  const updated = await getPageByUid(workspace_path, uid);
  return { success: true, page: updated ?? undefined };
}
```

- [ ] **Step 5: 导出 importPage**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/index.ts` 增加类型导出：

```ts
  PageImportSourceType,
  ImportPageOptions,
  ImportPageResult,
```

增加函数导出：

```ts
export { importPage } from "./import";
```

- [ ] **Step 6: 跑 import core 测试**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/import.test.ts
```

Expected: PASS。

- [ ] **Step 7: 写 import Gateway 测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.test.ts` 的 `describe("page routes")` 内追加：

```ts
  it("POST /api/page/import imports markdown_file into the current empty page", async () => {
    const app = Fastify({ logger: false });
    registerPageRoutes(app);
    await app.ready();
    const workspacePath = createWorkspace();
    const sourcePath = join(createWorkspace(), "source.md");
    writeFileSync(sourcePath, "---\nname: ignored\n---\n# 导入正文\n", "utf-8");

    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/page/create",
      payload: {
        workspace_path: workspacePath,
        slug: "blank-doc",
        name: "导入文档",
        type: "markdown",
        empty_body: true,
      },
    });
    const created = createdResponse.json();

    const response = await app.inject({
      method: "POST",
      url: "/api/page/import",
      payload: {
        workspace_path: workspacePath,
        uid: created.page.uid,
        source_type: "markdown_file",
        source_path: sourcePath,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.page.skill_content).toBe("# 导入正文");

    await app.close();
  });
```

- [ ] **Step 8: 实现 import route**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.ts` import `importPage` 和 `ImportPageResult`。新增：

```ts
const importPageResponseSchema = createPageResponseSchema;
```

在 `registerPageRoutes()` 中新增：

```ts
  fastify.post<{
    Body: {
      workspace_path: string;
      uid: string;
      source_type: "url" | "markdown_file" | "html_file";
      source_url?: string;
      source_path?: string;
    };
    Reply: ImportPageResult;
  }>("/api/page/import", {
    schema: {
      description: "Import content into an existing empty page",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string" },
          uid: { type: "string" },
          source_type: { type: "string", enum: ["url", "markdown_file", "html_file"] },
          source_url: { type: "string", nullable: true },
          source_path: { type: "string", nullable: true },
        },
        required: ["workspace_path", "uid", "source_type"],
      },
      response: {
        200: importPageResponseSchema,
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const result = await importPage(request.body);
    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return result;
    }
    return result;
  });
```

- [ ] **Step 9: 跑 import core/gateway 测试**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/import.test.ts src/gateway/routes/page.test.ts
```

Expected: PASS。

- [ ] **Step 10: Commit**

Run:

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/types.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/import.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/index.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/page/ops/import.test.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/page.test.ts
git commit -m "feat: import content into empty pages"
```

---

### Task 5: Desktop Gateway client 与 hooks

**Files:**

- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/types/page.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/modules/pages.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/hooks/use-pages.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/modules/pages.test.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/hooks/use-pages-empty-page.test.tsx`

- [ ] **Step 1: 写 Gateway client 请求测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/modules/pages.test.ts` 新增：

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyPageTemplate, createPage, importPage } from "./pages";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockJsonFetch(body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("pages gateway module", () => {
  it("sends empty_body and template_id using snake_case for createPage", async () => {
    const fetchMock = mockJsonFetch({ success: true, page: null });

    await createPage("http://127.0.0.1:18790", {
      workspace_path: "/workspace",
      name: "空文档",
      type: "markdown",
      empty_body: true,
      template_id: "markdown-docs",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:18790/api/page/create", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        workspace_path: "/workspace",
        name: "空文档",
        type: "markdown",
        empty_body: true,
        template_id: "markdown-docs",
      }),
    }));
  });

  it("posts apply-template payload using snake_case", async () => {
    const fetchMock = mockJsonFetch({ success: true, page: null });

    await applyPageTemplate("http://127.0.0.1:18790", {
      workspace_path: "/workspace",
      uid: "page-1",
      template_id: "markdown-docs",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:18790/api/page/apply-template", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        workspace_path: "/workspace",
        uid: "page-1",
        template_id: "markdown-docs",
      }),
    }));
  });

  it("posts import payload using snake_case", async () => {
    const fetchMock = mockJsonFetch({ success: true, page: null });

    await importPage("http://127.0.0.1:18790", {
      workspace_path: "/workspace",
      uid: "page-1",
      source_type: "html_file",
      source_path: "/tmp/source.html",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:18790/api/page/import", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        workspace_path: "/workspace",
        uid: "page-1",
        source_type: "html_file",
        source_path: "/tmp/source.html",
      }),
    }));
  });
});
```

- [ ] **Step 2: 跑 Gateway client 测试确认失败**

Run:

```bash
pnpm --filter @viben/desktop test -- src/lib/gateway/modules/pages.test.ts
```

Expected: FAIL，类型或函数未定义。

- [ ] **Step 3: 更新 desktop page types**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/types/page.ts` 的 `CreatePageParams` 增加：

```ts
  template_id?: string;
  empty_body?: boolean;
```

并新增：

```ts
export interface ApplyPageTemplateParams {
  workspace_path: string;
  uid: string;
  template_id: string;
}

export interface ApplyPageTemplateResult extends PageResult {
  page?: PageConfig;
}

export type PageImportSourceType = "url" | "markdown_file" | "html_file";

export interface ImportPageParams {
  workspace_path: string;
  uid: string;
  source_type: PageImportSourceType;
  source_url?: string;
  source_path?: string;
}

export interface ImportPageResult extends PageResult {
  page?: PageConfig;
}
```

- [ ] **Step 4: 更新 desktop pages module**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/modules/pages.ts` import/export 新类型，并新增：

```ts
export async function applyPageTemplate(
  baseUrl: string,
  params: ApplyPageTemplateParams
): Promise<ApplyPageTemplateResult> {
  const response = await fetch(`${baseUrl}/api/page/apply-template`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(`Failed to apply page template: ${errorMessage}`, response.status);
  }

  return response.json();
}

export async function importPage(
  baseUrl: string,
  params: ImportPageParams
): Promise<ImportPageResult> {
  const response = await fetch(`${baseUrl}/api/page/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(`Failed to import page: ${errorMessage}`, response.status);
  }

  return response.json();
}
```

- [ ] **Step 5: 跑 Gateway client 测试**

Run:

```bash
pnpm --filter @viben/desktop test -- src/lib/gateway/modules/pages.test.ts
```

Expected: PASS。

- [ ] **Step 6: 写 hooks invalidate 测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/hooks/use-pages-empty-page.test.tsx` 新增：

```tsx
// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { pageKeys, useApplyPageTemplate, useImportPage } from "./use-pages";

vi.mock("@/lib/gateway", async () => {
  const actual = await vi.importActual("@/lib/gateway");
  return {
    ...(actual as object),
    getGatewayUrl: () => "http://127.0.0.1:18790",
    applyPageTemplate: vi.fn(async () => ({ success: true, page: { uid: "page-1" } })),
    importPage: vi.fn(async () => ({ success: true, page: { uid: "page-1" } })),
  };
});

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("empty page hooks", () => {
  it("invalidates page list and detail after applying a template", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useApplyPageTemplate(), {
      wrapper: wrapperFor(queryClient),
    });

    result.current.mutate({
      workspace_path: "/workspace",
      uid: "page-1",
      template_id: "markdown-docs",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pageKeys.list("/workspace") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pageKeys.detail("/workspace", "page-1") });
  });

  it("invalidates page list and detail after importing content", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useImportPage(), {
      wrapper: wrapperFor(queryClient),
    });

    result.current.mutate({
      workspace_path: "/workspace",
      uid: "page-1",
      source_type: "markdown_file",
      source_path: "/tmp/source.md",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pageKeys.list("/workspace") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pageKeys.detail("/workspace", "page-1") });
  });
});
```

- [ ] **Step 7: 更新 hooks**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/hooks/use-pages.ts` import：

```ts
  applyPageTemplate as applyPageTemplateApi,
  importPage as importPageApi,
```

类型 import 增加：

```ts
import type {
  CreatePageParams,
  UpdatePageConfigParams,
  ReorderPagesParams,
  DuplicatePageParams,
  ApplyPageTemplateParams,
  ImportPageParams,
} from "@/lib/gateway";
```

新增 hooks：

```ts
export function useApplyPageTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: ApplyPageTemplateParams) =>
      applyPageTemplateApi(getGatewayUrl(), params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.list(variables.workspace_path) });
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.workspace_path, variables.uid) });
    },
  });
}

export function useImportPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: ImportPageParams) =>
      importPageApi(getGatewayUrl(), params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.list(variables.workspace_path) });
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.workspace_path, variables.uid) });
    },
  });
}
```

- [ ] **Step 8: 跑 desktop Gateway/hooks 测试**

Run:

```bash
pnpm --filter @viben/desktop test -- src/lib/gateway/modules/pages.test.ts src/hooks/use-pages-empty-page.test.tsx
```

Expected: PASS。

- [ ] **Step 9: Commit**

Run:

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/types/page.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/modules/pages.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/hooks/use-pages.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/gateway/modules/pages.test.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/hooks/use-pages-empty-page.test.tsx
git commit -m "feat: add empty page gateway hooks"
```

---

### Task 6: 新建页面默认直接创建空 Markdown

**Files:**

- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-app-grid.tsx`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/create-page-dialog.tsx`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/create-empty-page-flow.test.tsx`

- [ ] **Step 1: 写新建按钮行为测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/create-empty-page-flow.test.tsx` 新增：

```tsx
// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageAppGrid } from "../page-app-grid";

const mutateAsync = vi.fn(async () => ({
  success: true,
  page: {
    uid: "page-1",
    name: "未命名",
    type: "markdown",
    permission: ["read", "write"],
    path: "/workspace/pages/page-1",
    skill_content: "",
  },
}));
const onOpenPage = vi.fn();

vi.mock("@/hooks/use-pages", async () => {
  const actual = await vi.importActual("@/hooks/use-pages");
  return {
    ...(actual as object),
    useCreatePage: () => ({ mutateAsync, isPending: false }),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

describe("PageAppGrid empty page creation", () => {
  it("creates an empty markdown page directly from the new page button", async () => {
    render(
      <PageAppGrid
        workspacePath="/workspace"
        pages={[]}
        index={{ root: [] }}
        onOpenPage={onOpenPage}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Create Page|创建页面|page.createPage/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        workspace_path: "/workspace",
        name: "未命名",
        type: "markdown",
        empty_body: true,
      }));
    });
    expect(onOpenPage).toHaveBeenCalledWith("page-1");
  });
});
```

如果 `PageAppGrid` 当前 props 与上面不一致，按实际导出的 props 调整 render 入参，但断言保持不变：点击新建后直接调用 create mutation，不打开详细表单。

- [ ] **Step 2: 跑测试确认失败**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/apps/components/__tests__/create-empty-page-flow.test.tsx
```

Expected: FAIL，当前点击会打开 `CreatePageDialog`，不会直接 mutate。

- [ ] **Step 3: 修改新建按钮为直接创建**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-app-grid.tsx`：

1. 引入 `useCreatePage()`。
2. 新建按钮点击 handler 改为：

```ts
const createPageMutation = useCreatePage();

const handleCreateBlankMarkdownPage = useCallback(async () => {
  if (!workspacePath || createPageMutation.isPending) return;
  try {
    const result = await createPageMutation.mutateAsync({
      workspace_path: workspacePath,
      name: "未命名",
      type: "markdown",
      empty_body: true,
    });
    if (result.page?.uid) {
      onOpenPage?.(result.page.uid);
    }
  } catch (error) {
    console.error("[PageAppGrid] failed to create blank markdown page:", error);
    toast.error(t("page.createFailed", "Failed to create page"));
  }
}, [workspacePath, createPageMutation, onOpenPage, t]);
```

3. 将主新建按钮 `onClick` 指向 `handleCreateBlankMarkdownPage`。
4. 对需要高级创建的入口保留 `CreatePageDialog`，不要删除组件。

- [ ] **Step 4: 调整 CreatePageDialog 默认值**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/create-page-dialog.tsx`：

1. 默认 `pageType` 从 `"static"` 改为 `"markdown"`。
2. reset 时 `setPageType("markdown")`。
3. 创建 Markdown params 时加入：

```ts
params.empty_body = true;
```

4. 不再设置 `params.file = "content.md"`。

- [ ] **Step 5: 跑新建页面测试**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/apps/components/__tests__/create-empty-page-flow.test.tsx
```

Expected: PASS。

- [ ] **Step 6: Commit**

Run:

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-app-grid.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/create-page-dialog.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/create-empty-page-flow.test.tsx
git commit -m "feat: create blank markdown pages by default"
```

---

### Task 7: 空正文判定工具与 Yoopta 空内容加载修复

**Files:**

- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/empty-markdown-page-utils.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/empty-markdown-page-utils.test.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/yoopta-markdown-renderer-empty.test.tsx`

- [ ] **Step 1: 写空正文工具测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/empty-markdown-page-utils.test.ts` 新增：

```ts
import { describe, expect, it } from "vitest";
import { isMarkdownBodyEmpty, stripYamlFrontmatter } from "../empty-markdown-page-utils";

describe("empty markdown page utils", () => {
  it("strips leading YAML frontmatter", () => {
    expect(stripYamlFrontmatter("---\nname: test\n---\n\n正文")).toBe("正文");
  });

  it("treats frontmatter-only content as empty", () => {
    expect(isMarkdownBodyEmpty("---\nname: test\n---\n\n")).toBe(true);
  });

  it("treats empty string as empty", () => {
    expect(isMarkdownBodyEmpty("")).toBe(true);
  });

  it("hides empty state when body has any non-empty content", () => {
    expect(isMarkdownBodyEmpty("---\nname: test\n---\n\nx")).toBe(false);
  });

  it("does not strip non-frontmatter horizontal rule content", () => {
    expect(stripYamlFrontmatter("---\n正文")).toBe("---\n正文");
  });
});
```

- [ ] **Step 2: 实现空正文工具**

创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/empty-markdown-page-utils.ts`：

```ts
export function stripYamlFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) {
    return markdown;
  }

  const endMatch = markdown.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  if (!endMatch) {
    return markdown;
  }

  return markdown.slice(endMatch[0].length).trimStart();
}

export function isMarkdownBodyEmpty(markdown: string | undefined | null): boolean {
  if (!markdown) {
    return true;
  }
  return stripYamlFrontmatter(markdown).trim().length === 0;
}

export type PageAiCreationMode = "document" | "static" | "fullstack";

export function buildPageCreationPrompt(input: {
  mode: PageAiCreationMode;
  prompt: string;
  workspacePath: string;
  pageUid: string;
  pagePath: string;
}): string {
  const modeText = input.mode === "document"
    ? "文档"
    : input.mode === "static"
      ? "静态网页"
      : "全栈应用";

  const target = [
    `工作区路径：${input.workspacePath}`,
    `目标页面 UID：${input.pageUid}`,
    `目标页面目录：${input.pagePath}`,
  ].join("\n");

  const requirement = input.mode === "document"
    ? "请将内容写入 pages/<uid>/SKILL.md 的正文，保留 YAML front matter。"
    : input.mode === "static"
      ? "请在目标页面目录创建 index.html，并将 SKILL.md 的 metadata.page.type 更新为 static，file 更新为 index.html。"
      : "请在目标页面目录创建 Vite 全栈应用关键文件，至少包含 package.json 和 vite.config.js，并将 SKILL.md 的 metadata.page.type 更新为 server。";

  return [
    `请使用 AI 助手创建${modeText}。`,
    target,
    requirement,
    "用户需求：",
    input.prompt.trim(),
  ].join("\n\n");
}
```

- [ ] **Step 3: 跑工具测试**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/apps/components/__tests__/empty-markdown-page-utils.test.ts
```

Expected: PASS。

- [ ] **Step 4: 写 Yoopta 空内容加载回归测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/yoopta-markdown-renderer-empty.test.tsx` 新增：

```tsx
// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { YooptaMarkdownRenderer } from "../yoopta-markdown-renderer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock("../yoopta-markdown", () => ({
  deserializeMarkdown: vi.fn(() => ({ value: {}, frontmatter: "---\nname: test\n---\n" })),
  serializeMarkdown: vi.fn(() => ""),
}));

function renderRenderer(content: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <YooptaMarkdownRenderer
        content={content}
        editable
        workspacePath="/workspace"
        uid="page-1"
        title="空文档"
      />
    </QueryClientProvider>
  );
}

describe("YooptaMarkdownRenderer empty markdown", () => {
  it("shows the empty page card when content is empty", () => {
    renderRenderer("");
    expect(screen.getByText("开始")).toBeInTheDocument();
    expect(screen.getByText("按 Enter 键开始编辑内容")).toBeInTheDocument();
  });

  it("shows the empty page card when content only has frontmatter", () => {
    renderRenderer("---\nname: test\n---\n\n");
    expect(screen.getByText("开始")).toBeInTheDocument();
  });

  it("hides the empty page card when markdown body has content", () => {
    renderRenderer("---\nname: test\n---\n\n正文");
    expect(screen.queryByText("开始")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 5: 修复 Yoopta content effect**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`：

1. import `isMarkdownBodyEmpty`：

```ts
import { isMarkdownBodyEmpty } from "./empty-markdown-page-utils";
```

2. 将 `lastContentRef` 初始化为：

```ts
  const lastContentRef = useRef<string | null>(null);
```

3. 将 load effect 改为接受空字符串：

```ts
  useEffect(() => {
    if (content === lastContentRef.current) return;
    lastContentRef.current = content;
    try {
      const { value, frontmatter } = deserializeMarkdown(editor, content);
      frontmatterRef.current = frontmatter;
      editor.withoutSavingHistory(() => {
        editor.setEditorValue(value);
      });
    } catch (err) {
      console.error("[YooptaMarkdownRenderer] deserialize failed:", err);
    }
  }, [editor, content]);
```

4. 在 render 前增加：

```ts
  const shouldShowEmptyPageCard = isEditable && isMarkdownBodyEmpty(content);
```

- [ ] **Step 6: 跑 Yoopta 空内容测试**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/apps/components/__tests__/empty-markdown-page-utils.test.ts src/pages/apps/components/__tests__/yoopta-markdown-renderer-empty.test.tsx
```

Expected: 测试仍可能因空态卡片组件未实现而 FAIL；content effect 相关错误消失。

- [ ] **Step 7: Commit**

Run:

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/empty-markdown-page-utils.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/empty-markdown-page-utils.test.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/yoopta-markdown-renderer-empty.test.tsx
git commit -m "fix: handle empty markdown renderer content"
```

---

### Task 8: 空页面卡片、模板对话框和导入对话框

**Files:**

- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/empty-markdown-page-card.tsx`
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-template-dialog.tsx`
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-import-dialog.tsx`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/empty-markdown-page-card.test.tsx`

- [ ] **Step 1: 写空页面卡片交互测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/empty-markdown-page-card.test.tsx` 新增：

```tsx
// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyMarkdownPageCard } from "../empty-markdown-page-card";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

describe("EmptyMarkdownPageCard", () => {
  it("renders manual, template, import and ai creation controls", () => {
    render(
      <EmptyMarkdownPageCard
        mode="document"
        onModeChange={vi.fn()}
        onStartEditing={vi.fn()}
        onOpenTemplateDialog={vi.fn()}
        onOpenImportDialog={vi.fn()}
        aiInput={<div>AI input</div>}
      />
    );

    expect(screen.getByText("开始")).toBeInTheDocument();
    expect(screen.getByText("按 Enter 键开始编辑内容")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "从模板创建" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /导入新页面/ })).toBeInTheDocument();
    expect(screen.getByText("使用 AI 助手创建")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "文档" })).toHaveAttribute("data-state", "active");
    expect(screen.getByText("AI input")).toBeInTheDocument();
  });

  it("calls onStartEditing when the manual area receives Enter", () => {
    const onStartEditing = vi.fn();
    render(
      <EmptyMarkdownPageCard
        mode="document"
        onModeChange={vi.fn()}
        onStartEditing={onStartEditing}
        onOpenTemplateDialog={vi.fn()}
        onOpenImportDialog={vi.fn()}
        aiInput={<div />}
      />
    );

    fireEvent.keyDown(screen.getByText("按 Enter 键开始编辑内容"), { key: "Enter" });
    expect(onStartEditing).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 实现空页面卡片**

创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/empty-markdown-page-card.tsx`：

```tsx
import type { ReactNode } from "react";
import { FilePlus2, Import, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PageAiCreationMode } from "./empty-markdown-page-utils";

interface EmptyMarkdownPageCardProps {
  mode: PageAiCreationMode;
  onModeChange: (mode: PageAiCreationMode) => void;
  onStartEditing: () => void;
  onOpenTemplateDialog: () => void;
  onOpenImportDialog: () => void;
  aiInput: ReactNode;
}

const MODES: Array<{ value: PageAiCreationMode; label: string }> = [
  { value: "document", label: "文档" },
  { value: "static", label: "静态网页" },
  { value: "fullstack", label: "全栈应用" },
];

export function EmptyMarkdownPageCard({
  mode,
  onModeChange,
  onStartEditing,
  onOpenTemplateDialog,
  onOpenImportDialog,
  aiInput,
}: EmptyMarkdownPageCardProps) {
  return (
    <section className="mx-14 my-6 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-5 py-3 text-center text-sm font-medium">开始</div>

      <div className="space-y-3 border-b border-border px-5 py-4">
        <button
          type="button"
          className="block text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          onClick={onStartEditing}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onStartEditing();
            }
          }}
        >
          按 Enter 键开始编辑内容
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOpenTemplateDialog}>
            <FilePlus2 className="mr-1.5 size-4" />
            从模板创建
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onOpenImportDialog}>
            <Import className="mr-1.5 size-4" />
            导入新页面
          </Button>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            使用 AI 助手创建
          </div>
          <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
            {MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                data-state={mode === item.value ? "active" : "inactive"}
                className={cn(
                  "rounded px-2.5 py-1 text-xs text-muted-foreground transition-colors",
                  mode === item.value && "bg-background text-foreground shadow-sm"
                )}
                onClick={() => onModeChange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {aiInput}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: 实现模板对话框**

创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-template-dialog.tsx`：

```tsx
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PageTemplate } from "@/lib/gateway/types/page";

interface PageTemplateDialogProps {
  open: boolean;
  templates: PageTemplate[];
  isApplying: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (templateId: string) => void;
}

export function PageTemplateDialog({
  open,
  templates,
  isApplying,
  onOpenChange,
  onSelectTemplate,
}: PageTemplateDialogProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return templates;
    return templates.filter((template) =>
      [template.name, template.description, template.type]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, templates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <DialogTitle>选择模板</DialogTitle>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模板" className="pl-9" />
        </div>
        <div className="max-h-[360px] overflow-y-auto rounded-lg border border-border">
          {filtered.map((template) => (
            <button
              key={template.id}
              type="button"
              className="flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/50"
              disabled={isApplying}
              onClick={() => onSelectTemplate(template.id)}
            >
              <span className="text-sm font-medium">{template.name}</span>
              <span className="text-xs text-muted-foreground">{template.description}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">没有匹配的模板</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: 实现导入对话框**

创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-import-dialog.tsx`：

```tsx
import { useState } from "react";
import { FileCode2, FileText, Globe2, Loader2, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PageImportSourceType } from "@/lib/gateway/types/page";

interface PageImportDialogProps {
  open: boolean;
  isImporting: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (input: { source_type: PageImportSourceType; source_url?: string; source_path?: string }) => void;
}

export function PageImportDialog({ open: isOpen, isImporting, onOpenChange, onImport }: PageImportDialogProps) {
  const [url, setUrl] = useState("");

  async function chooseFile(sourceType: "markdown_file" | "html_file") {
    const selected = await open({
      multiple: false,
      filters: sourceType === "markdown_file"
        ? [{ name: "Markdown", extensions: ["md", "markdown"] }]
        : [{ name: "HTML", extensions: ["html", "htm"] }],
    });
    if (typeof selected === "string") {
      onImport({ source_type: sourceType, source_path: selected });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <DialogTitle>选择导入方式</DialogTitle>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Globe2 className="size-4" />
              从网络连接导入
            </div>
            <div className="flex gap-2">
              <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" />
              <Button
                type="button"
                disabled={isImporting || !url.trim()}
                onClick={() => onImport({ source_type: "url", source_url: url.trim() })}
              >
                {isImporting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                开始导入
              </Button>
            </div>
          </div>
          <Button type="button" variant="outline" className="w-full justify-start" disabled={isImporting} onClick={() => chooseFile("markdown_file")}>
            <FileText className="mr-2 size-4" />
            导入 Markdown 文件
          </Button>
          <Button type="button" variant="outline" className="w-full justify-start" disabled={isImporting} onClick={() => chooseFile("html_file")}>
            <FileCode2 className="mr-2 size-4" />
            导入 HTML 文件
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: 将空态卡片接入 Yoopta**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`：

1. import 新组件和 hooks：

```ts
import { EmptyMarkdownPageCard } from "./empty-markdown-page-card";
import { PageTemplateDialog } from "./page-template-dialog";
import { PageImportDialog } from "./page-import-dialog";
import { useApplyPageTemplate, useImportPage, usePageTemplates } from "@/hooks/use-pages";
```

2. 新增 state/mutations：

```ts
  const [aiCreationMode, setAiCreationMode] = useState<PageAiCreationMode>("document");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { data: pageTemplates = [] } = usePageTemplates(workspacePath);
  const applyTemplateMutation = useApplyPageTemplate();
  const importPageMutation = useImportPage();
```

3. 抽出开始编辑函数，复用 `handleEmptyAreaClick` 里的逻辑：

```ts
  const focusOrCreateEmptyParagraph = useCallback(() => {
    if (!isEditable) return;
    const blockIds = Object.keys(editor.children);
    if (blockIds.length === 0) {
      const newId = editor.insertBlock("Paragraph");
      if (newId) ensureBlockFocus(editor, newId);
      return;
    }
    handleEmptyAreaClick({ stopPropagation: () => undefined } as React.MouseEvent<HTMLDivElement>);
  }, [editor, handleEmptyAreaClick, isEditable]);
```

4. 在 `PageTitleArea` 后、`containerBoxRef` 前插入：

```tsx
        {shouldShowEmptyPageCard && (
          <EmptyMarkdownPageCard
            mode={aiCreationMode}
            onModeChange={setAiCreationMode}
            onStartEditing={focusOrCreateEmptyParagraph}
            onOpenTemplateDialog={() => setTemplateDialogOpen(true)}
            onOpenImportDialog={() => setImportDialogOpen(true)}
            aiInput={<div data-testid="page-ai-create-input-placeholder" />}
          />
        )}
```

5. 在 `IconPicker/CoverPicker` 附近插入 dialogs：

```tsx
        {workspacePath && uid && (
          <PageTemplateDialog
            open={templateDialogOpen}
            templates={pageTemplates}
            isApplying={applyTemplateMutation.isPending}
            onOpenChange={setTemplateDialogOpen}
            onSelectTemplate={async (templateId) => {
              await applyTemplateMutation.mutateAsync({ workspace_path: workspacePath, uid, template_id: templateId });
              setTemplateDialogOpen(false);
            }}
          />
        )}
        {workspacePath && uid && (
          <PageImportDialog
            open={importDialogOpen}
            isImporting={importPageMutation.isPending}
            onOpenChange={setImportDialogOpen}
            onImport={async (input) => {
              await importPageMutation.mutateAsync({ workspace_path: workspacePath, uid, ...input });
              setImportDialogOpen(false);
            }}
          />
        )}
```

- [ ] **Step 6: 跑空态 UI 测试**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/apps/components/__tests__/empty-markdown-page-card.test.tsx src/pages/apps/components/__tests__/yoopta-markdown-renderer-empty.test.tsx
```

Expected: PASS。

- [ ] **Step 7: Commit**

Run:

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/empty-markdown-page-card.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-template-dialog.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-import-dialog.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/empty-markdown-page-card.test.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/yoopta-markdown-renderer-empty.test.tsx
git commit -m "feat: add empty markdown page card"
```

---

### Task 9: AI 创建输入、compact 创建中 UI 和 ACP session 复用

**Files:**

- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-input.tsx`
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-compact.tsx`
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/use-page-ai-creation.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/page-ai-create-input.test.tsx`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/use-page-ai-creation.test.tsx`

- [ ] **Step 1: 写 AI input 测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/page-ai-create-input.test.tsx` 新增：

```tsx
// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageAiCreateInput } from "../page-ai-create-input";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

describe("PageAiCreateInput", () => {
  it("uses expanded ChatInput controls and submits text", () => {
    const onSubmit = vi.fn();
    render(
      <PageAiCreateInput
        disabled={false}
        isLoading={false}
        sendDisabled={false}
        onSubmit={onSubmit}
        selector={<div>selector</div>}
        contextStatus={<div>context</div>}
      />
    );

    expect(screen.getByText("selector")).toBeInTheDocument();
    expect(screen.getByText("context")).toBeInTheDocument();
    const input = screen.getByPlaceholderText("描述你想创建的内容");
    fireEvent.change(input, { target: { value: "写一份项目说明" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledWith("写一份项目说明", undefined);
  });
});
```

- [ ] **Step 2: 实现 PageAiCreateInput**

创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-input.tsx`：

```tsx
import type { ReactNode } from "react";
import type { Attachment } from "@viben/chat";
import { ChatInput, ChatInputBottomToolbar, ChatInputTopToolbar } from "@viben/chat";

interface PageAiCreateInputProps {
  disabled: boolean;
  isLoading: boolean;
  sendDisabled: boolean;
  sendBlockedReason?: string;
  selector: ReactNode;
  contextStatus: ReactNode;
  onSubmit: (content: string, attachments?: Attachment[]) => void;
}

export function PageAiCreateInput({
  disabled,
  isLoading,
  sendDisabled,
  sendBlockedReason,
  selector,
  contextStatus,
  onSubmit,
}: PageAiCreateInputProps) {
  return (
    <ChatInput
      className="rounded-lg border border-border bg-background"
      showTopToolbar
      showBottomToolbar
      defaultHeight={132}
      minHeight={120}
      maxHeight={220}
      disabled={disabled}
      isLoading={isLoading}
      sendDisabled={sendDisabled}
      sendBlockedReason={sendBlockedReason}
      placeholder="描述你想创建的内容"
      onSend={onSubmit}
      topToolbar={<ChatInputTopToolbar />}
      bottomToolbar={(
        <ChatInputBottomToolbar
          leftContent={(
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {selector}
              {contextStatus}
            </div>
          )}
        />
      )}
    />
  );
}
```

如果 `Attachment` 类型未从 `@viben/chat` 导出，则在 `packages/chat/src/chat-input/types.ts` 中确认实际导出名，使用显式 `import type`，不要使用内联模块类型引用。

- [ ] **Step 3: 实现 compact 创建中 UI**

创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-compact.tsx`：

```tsx
import { Bot, Loader2, X } from "lucide-react";
import { ChatInput } from "@viben/chat";
import { Button } from "@/components/ui/button";
import type { PageAiCreationMode } from "./empty-markdown-page-utils";

interface PageAiCreateCompactProps {
  mode: PageAiCreationMode;
  isLoading: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
  onDismiss: () => void;
  onExpand: () => void;
}

const MODE_LABEL: Record<PageAiCreationMode, string> = {
  document: "文档",
  static: "静态网页",
  fullstack: "全栈应用",
};

export function PageAiCreateCompact({
  mode,
  isLoading,
  onSend,
  onStop,
  onDismiss,
  onExpand,
}: PageAiCreateCompactProps) {
  return (
    <div className="mx-14 my-4 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <button type="button" className="flex min-w-0 items-center gap-2 text-sm" onClick={onExpand}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="size-4" />
          </span>
          <span className="truncate">使用 AI 助手创建 {MODE_LABEL[mode]} 中...</span>
        </button>
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onDismiss}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 px-2">
        {isLoading && <Loader2 className="ml-2 size-4 animate-spin text-muted-foreground" />}
        <ChatInput
          className="flex-1 bg-transparent"
          layoutVariant="compact"
          showBottomToolbar={false}
          isLoading={isLoading}
          allowSendWhileLoading
          onCancel={onStop}
          onRequestExpand={onExpand}
          onSend={(content) => onSend(content)}
          placeholder="继续补充要求"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 写 `usePageAiCreation` 测试**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/use-page-ai-creation.test.tsx` 新增：

```tsx
// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePageAiCreation } from "../use-page-ai-creation";

const sendPrompt = vi.fn(async () => undefined);
const sendSteerPrompt = vi.fn(async () => "steer-1");
const interrupt = vi.fn(async () => undefined);
const selectSession = vi.fn();

vi.mock("@/components/acp-chat/use-acp-session", () => ({
  useAcpSession: () => ({
    activeSessionId: "session-1",
    connected: true,
    configLoading: false,
    selectedAgentId: "agent-1",
    effectiveSelectedProviderId: "provider-1",
    effectiveSelectedModel: "model-1",
    isAgentRunning: true,
    sendPrompt,
    sendSteerPrompt,
    interrupt,
    selectSession,
  }),
}));

describe("usePageAiCreation", () => {
  it("starts document creation by sending a page-scoped ACP prompt", async () => {
    const { result } = renderHook(() => usePageAiCreation({
      workspacePath: "/workspace",
      pageUid: "page-1",
      pagePath: "/workspace/pages/page-1",
      content: "",
      onRefreshPage: vi.fn(),
      onSwitchPreviewMode: vi.fn(),
    }));

    await act(async () => {
      await result.current.startCreation("document", "写项目说明");
    });

    expect(sendPrompt).toHaveBeenCalledWith(expect.stringContaining("目标页面 UID：page-1"));
    expect(sendPrompt).toHaveBeenCalledWith(expect.stringContaining("写项目说明"));
    expect(result.current.state.status).toBe("creating");
    expect(result.current.state.sessionId).toBe("session-1");
  });

  it("interrupts creation and restores empty state when content is still empty", async () => {
    const { result } = renderHook(() => usePageAiCreation({
      workspacePath: "/workspace",
      pageUid: "page-1",
      pagePath: "/workspace/pages/page-1",
      content: "",
      onRefreshPage: vi.fn(),
      onSwitchPreviewMode: vi.fn(),
    }));

    await act(async () => {
      await result.current.startCreation("document", "写项目说明");
      await result.current.stopCreation();
    });

    expect(interrupt).toHaveBeenCalled();
    expect(result.current.state.status).toBe("idle");
  });
});
```

- [ ] **Step 5: 实现 `usePageAiCreation`**

创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/use-page-ai-creation.ts`：

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAcpSession } from "@/components/acp-chat/use-acp-session";
import { buildPageCreationPrompt, isMarkdownBodyEmpty, type PageAiCreationMode } from "./empty-markdown-page-utils";

type CreationStatus = "idle" | "creating" | "dismissed";

interface PageAiCreationState {
  status: CreationStatus;
  mode: PageAiCreationMode;
  sessionId: string | null;
  input: string;
}

interface UsePageAiCreationOptions {
  workspacePath?: string;
  pageUid?: string;
  pagePath?: string;
  content: string;
  onRefreshPage: () => void;
  onSwitchPreviewMode: (mode: "static" | "server") => void;
}

export function usePageAiCreation({
  workspacePath,
  pageUid,
  pagePath,
  content,
  onRefreshPage,
  onSwitchPreviewMode,
}: UsePageAiCreationOptions) {
  const acp = useAcpSession({ defaultCwd: workspacePath });
  const [state, setState] = useState<PageAiCreationState>({
    status: "idle",
    mode: "document",
    sessionId: null,
    input: "",
  });

  const canSend = useMemo(
    () => Boolean(workspacePath && pageUid && pagePath && acp.connected && !acp.configLoading),
    [workspacePath, pageUid, pagePath, acp.connected, acp.configLoading]
  );

  const startCreation = useCallback(async (mode: PageAiCreationMode, prompt: string) => {
    if (!workspacePath || !pageUid || !pagePath || !prompt.trim()) return;
    const fullPrompt = buildPageCreationPrompt({
      mode,
      prompt,
      workspacePath,
      pageUid,
      pagePath,
    });
    await acp.sendPrompt(fullPrompt);
    setState({
      status: "creating",
      mode,
      sessionId: acp.activeSessionId,
      input: prompt,
    });
  }, [acp, pagePath, pageUid, workspacePath]);

  const sendFollowup = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;
    if (state.sessionId) {
      acp.selectSession(state.sessionId);
    }
    await acp.sendSteerPrompt(prompt);
  }, [acp, state.sessionId]);

  const stopCreation = useCallback(async () => {
    if (state.sessionId) {
      acp.selectSession(state.sessionId);
    }
    await acp.interrupt();
    setState((current) => ({
      ...current,
      status: isMarkdownBodyEmpty(content) ? "idle" : "dismissed",
    }));
  }, [acp, content, state.sessionId]);

  const dismiss = useCallback(() => {
    setState((current) => ({ ...current, status: "dismissed" }));
  }, []);

  const expand = useCallback(() => {
    if (state.sessionId) {
      acp.selectSession(state.sessionId);
    }
  }, [acp, state.sessionId]);

  useEffect(() => {
    if (state.status !== "creating" || !pagePath) return;
    const timer = window.setInterval(() => {
      onRefreshPage();
    }, 1200);
    return () => window.clearInterval(timer);
  }, [onRefreshPage, pagePath, state.status]);

  useEffect(() => {
    if (state.status !== "creating") return;
    if (state.mode === "document" && !isMarkdownBodyEmpty(content)) {
      onRefreshPage();
    }
  }, [content, onRefreshPage, state.mode, state.status]);

  useEffect(() => {
    if (state.status !== "creating" || !pagePath) return;
    if (state.mode === "static") {
      onRefreshPage();
      onSwitchPreviewMode("static");
    }
    if (state.mode === "fullstack") {
      onRefreshPage();
      onSwitchPreviewMode("server");
    }
  }, [onRefreshPage, onSwitchPreviewMode, pagePath, state.mode, state.status]);

  return {
    state,
    canSend,
    acp,
    startCreation,
    sendFollowup,
    stopCreation,
    dismiss,
    expand,
  };
}
```

文件产物存在性检查第一版在 Yoopta 层通过 page detail polling 间接刷新。如果需要直接判定 `index.html`、`package.json`、`vite.config.js`，在 Task 11 手动验证后再添加 Gateway files API，不在本任务引入新的核心边界。

- [ ] **Step 6: 跑 AI hook/input 测试**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/apps/components/__tests__/page-ai-create-input.test.tsx src/pages/apps/components/__tests__/use-page-ai-creation.test.tsx
```

Expected: PASS。

- [ ] **Step 7: 接入 Yoopta 空态 AI 输入和 compact UI**

在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`：

1. import：

```ts
import { PageAiCreateInput } from "./page-ai-create-input";
import { PageAiCreateCompact } from "./page-ai-create-compact";
import { usePageAiCreation } from "./use-page-ai-creation";
```

2. 创建 hook：

```ts
  const aiCreation = usePageAiCreation({
    workspacePath,
    pageUid: uid,
    pagePath: workspacePath && uid ? `${workspacePath}/pages/${uid}` : undefined,
    content,
    onRefreshPage: () => {
      if (workspacePath && uid) {
        queryClient.invalidateQueries({ queryKey: pageKeys.detail(workspacePath, uid) });
        queryClient.invalidateQueries({ queryKey: pageKeys.list(workspacePath) });
      }
    },
    onSwitchPreviewMode: () => {
      if (workspacePath && uid) {
        queryClient.invalidateQueries({ queryKey: pageKeys.detail(workspacePath, uid) });
      }
    },
  });
```

3. `shouldShowEmptyPageCard` 改为：

```ts
  const shouldShowEmptyPageCard =
    isEditable &&
    aiCreation.state.status !== "creating" &&
    isMarkdownBodyEmpty(content);
```

4. `EmptyMarkdownPageCard` 的 `aiInput` 从 placeholder 改为：

```tsx
            aiInput={(
              <PageAiCreateInput
                disabled={!aiCreation.canSend}
                isLoading={aiCreation.acp.isAgentRunning}
                sendDisabled={!aiCreation.canSend}
                sendBlockedReason={!aiCreation.canSend ? "智能体未连接或配置未就绪" : undefined}
                selector={<span className="text-xs text-muted-foreground">{aiCreation.acp.selectedAgent?.name ?? "默认智能体"}</span>}
                contextStatus={<span className="text-xs text-muted-foreground">上下文已就绪</span>}
                onSubmit={(prompt) => aiCreation.startCreation(aiCreationMode, prompt)}
              />
            )}
```

5. 在 editor 后或最后一个 block 下方位置插入：

```tsx
        {aiCreation.state.status === "creating" && (
          <PageAiCreateCompact
            mode={aiCreation.state.mode}
            isLoading={aiCreation.acp.isAgentRunning}
            onSend={aiCreation.sendFollowup}
            onStop={aiCreation.stopCreation}
            onDismiss={aiCreation.dismiss}
            onExpand={aiCreation.expand}
          />
        )}
```

- [ ] **Step 8: 跑 Yoopta 空态和 AI 测试**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/apps/components/__tests__/yoopta-markdown-renderer-empty.test.tsx src/pages/apps/components/__tests__/page-ai-create-input.test.tsx src/pages/apps/components/__tests__/use-page-ai-creation.test.tsx
```

Expected: PASS。

- [ ] **Step 9: Commit**

Run:

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-input.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-compact.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/use-page-ai-creation.ts /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/page-ai-create-input.test.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/__tests__/use-page-ai-creation.test.tsx
git commit -m "feat: add ai creation entry for empty pages"
```

---

### Task 10: UI 集成打磨、文本与 i18n

**Files:**

- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/empty-markdown-page-card.tsx`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-template-dialog.tsx`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-import-dialog.tsx`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-input.tsx`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-compact.tsx`
- Modify: locale files if existing desktop locale JSON contains page/editor strings.

- [ ] **Step 1: 搜索 locale 文件位置**

Run:

```bash
rg -n "\"page\\.createPage\"|editor\\.renderer|common\\.cancel" /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/public
```

Expected: 输出现有 i18n key 文件位置。若没有 locale JSON，保留中文硬编码，因为本轮用户指定中文设计且现有组件中已有 fallback 文案。

- [ ] **Step 2: 将可见中文文案接入 i18n**

如果 locale 文件存在，在对应中文 locale 添加 keys：

```json
{
  "page.empty.start": "开始",
  "page.empty.pressEnter": "按 Enter 键开始编辑内容",
  "page.empty.createFromTemplate": "从模板创建",
  "page.empty.importPage": "导入新页面",
  "page.empty.aiCreate": "使用 AI 助手创建",
  "page.empty.mode.document": "文档",
  "page.empty.mode.static": "静态网页",
  "page.empty.mode.fullstack": "全栈应用",
  "page.templateDialog.title": "选择模板",
  "page.templateDialog.search": "搜索模板",
  "page.importDialog.title": "选择导入方式",
  "page.importDialog.fromUrl": "从网络连接导入",
  "page.importDialog.start": "开始导入",
  "page.importDialog.markdownFile": "导入 Markdown 文件",
  "page.importDialog.htmlFile": "导入 HTML 文件",
  "page.aiCreate.placeholder": "描述你想创建的内容",
  "page.aiCreate.followupPlaceholder": "继续补充要求"
}
```

在组件中使用 `useTranslation()` 的 `t(key, fallback)`。

- [ ] **Step 3: 检查 Tailwind v4 色彩用法**

Run:

```bash
rg -n "hsl\\(var\\(--(background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring|sidebar|surface)" /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components
```

Expected: no output。若有输出，改为 Tailwind 语义类或 `var(--token)`。

- [ ] **Step 4: 检查按钮/文本溢出风险**

Run:

```bash
rg -n "text-4xl|text-5xl|tracking-\\[-|w-\\[|min-w-\\[" /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/empty-markdown-page-card.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-compact.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-template-dialog.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-import-dialog.tsx
```

Expected: no negative tracking; fixed widths only where paired with responsive wrapping/truncation.

- [ ] **Step 5: 跑 desktop 空态相关测试**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/apps/components/__tests__/empty-markdown-page-card.test.tsx src/pages/apps/components/__tests__/page-ai-create-input.test.tsx src/pages/apps/components/__tests__/yoopta-markdown-renderer-empty.test.tsx
```

Expected: PASS。

- [ ] **Step 6: Commit**

Run:

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/empty-markdown-page-card.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-template-dialog.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-import-dialog.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-input.tsx /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-ai-create-compact.tsx
git commit -m "chore: polish empty page creation ui"
```

---

### Task 11: 端到端验证和构建

**Files:**

- No new source files expected.

- [ ] **Step 1: 跑 core page 相关测试**

Run:

```bash
pnpm --filter @viben/core test -- src/page/ops/crud.test.ts src/page/ops/discovery.test.ts src/page/ops/serve.test.ts src/page/ops/templates.test.ts src/page/ops/import.test.ts src/gateway/routes/page.test.ts
```

Expected: PASS。

- [ ] **Step 2: 跑 desktop 空态相关测试**

Run:

```bash
pnpm --filter @viben/desktop test -- src/lib/gateway/modules/pages.test.ts src/hooks/use-pages-empty-page.test.tsx src/pages/apps/components/__tests__/empty-markdown-page-utils.test.ts src/pages/apps/components/__tests__/empty-markdown-page-card.test.tsx src/pages/apps/components/__tests__/page-ai-create-input.test.tsx src/pages/apps/components/__tests__/yoopta-markdown-renderer-empty.test.tsx src/pages/apps/components/__tests__/use-page-ai-creation.test.tsx src/pages/apps/components/__tests__/create-empty-page-flow.test.tsx
```

Expected: PASS。

- [ ] **Step 3: 跑 typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS。若现有 unrelated user changes 导致失败，记录失败文件和错误，不回滚用户改动。

- [ ] **Step 4: 跑 build**

Run:

```bash
pnpm build
```

Expected: PASS。若因为环境依赖或已有 unrelated changes 失败，记录命令输出关键错误。

- [ ] **Step 5: 启动桌面开发服务做视觉验证**

Run:

```bash
pnpm desktop:restart
```

Expected: Tauri/Vite desktop dev server 启动，端口 1549 可用。

- [ ] **Step 6: 手动验证空态路径**

在桌面应用中验证：

1. 点击新建页面，立即创建并打开 Markdown 页面。
2. `pages/<uid>/SKILL.md` 只有 YAML frontmatter，正文为空。
3. 标题/icon 下方显示空页面卡片。
4. 按 Enter 或点击“按 Enter 键开始编辑内容”后，创建或聚焦空 Paragraph，不立即写入正文。
5. 输入任意正文并保存后，空页面卡片隐藏。
6. 删除正文保存后，空页面卡片恢复。

- [ ] **Step 7: 手动验证模板和导入**

在桌面应用中验证：

1. 空态点击“从模板创建”，打开模板对话框。
2. 搜索模板能按名称/描述/type 过滤。
3. 选择 `Markdown Documentation` 后，当前页面 uid 不变，正文变为模板正文。
4. 新建另一个空页面，导入 Markdown 文件，导入文件 frontmatter 被丢弃，只写正文。
5. 新建另一个空页面，导入 HTML 文件，页面切到 static，`index.html` 存在，`SKILL.md` 正文为 `从 /.../xxx.html 导入的页面`。

- [ ] **Step 8: 手动验证 AI 创建**

在桌面应用中验证：

1. 空态 AI 输入默认 mode 为“文档”。
2. 提交 prompt 后空页面卡片隐藏，compact loading UI 显示。
3. 文档模式下，AI 写入 `SKILL.md` 正文后 Yoopta 内容刷新，compact loading UI 保持在内容下方。
4. 点击停止调用 interrupt；若正文仍为空，空态恢复；若正文已有内容，空态不恢复。
5. 静态网页模式下，AI 生成 `index.html` 后刷新 page detail，页面进入 static preview。
6. 全栈应用模式下，AI 生成 `package.json` 和 `vite.config.js` 后刷新 page detail，页面进入 server preview。
7. 点击 compact UI 摘要区域时，左侧 ACP Chat 选择当前 `session_id`，后续对话继续同一 session。

- [ ] **Step 9: 最终状态检查**

Run:

```bash
git status --short
```

Expected: 只包含本功能相关变更；若 `apps/desktop/src/hooks/use-agent-model-selection.ts` 和 `.test.ts` 仍是用户改动，保持不动并在最终说明中标明未纳入本功能提交。

- [ ] **Step 10: 最终 Commit**

如果 Task 11 产生了修复或测试调整，运行：

```bash
git add /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
git commit -m "test: verify empty page creation flow"
```

如果没有新增变更，不创建空提交。

---

## 自检结果

**Spec coverage:** 计划覆盖了默认创建空 Markdown、frontmatter-only 空态判定、Yoopta 内部空态位置、Enter 创建/聚焦空段落、模板选择并应用当前页面、URL/Markdown/HTML 导入、AI expanded 输入、compact 创建中 UI、停止恢复规则、文档/static/fullstack 三种生成流和 ACP session 复用。

**Placeholder scan:** 本计划没有未细化占位项或无代码的泛化测试要求。每个实现任务都给出文件、代码片段、命令和期望结果。

**Type consistency:** API 和文件字段统一使用 snake_case：`workspace_path`、`parent_uid`、`template_id`、`empty_body`、`source_type`、`source_url`、`source_path`。前端类型与 core 类型保持同名。AI 创建 mode 统一为 `document | static | fullstack`。
