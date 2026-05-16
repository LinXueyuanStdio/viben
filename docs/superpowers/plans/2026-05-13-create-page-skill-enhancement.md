# Create-Page Skill Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强 create-page skill，提供 Design System tokens、iframe 主题通信 SDK、Gateway 分发路由、Desktop App postMessage 集成，以及完整的 AI 页面创建指导文档。

**Architecture:** 页面端通过 viben-page-sdk.js 与 Desktop App 建立 postMessage 通信，实现主题同步。SDK 和 CSS tokens 由 Gateway 的 `/api/page/_sdk/v1/*` 路由分发。Skill 文档采用 SKILL.md + references/ 渐进式结构。

**Tech Stack:** TypeScript, Fastify (Gateway routes), React (Desktop App), CSS Custom Properties (oklch), postMessage API

**Spec:** `docs/superpowers/specs/2026-05-13-create-page-skill-enhancement-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `packages/core/assets/viben-page-sdk.js` | 页面端通信 SDK (~70行) |
| Create | `packages/core/assets/viben-page-tokens.css` | Design tokens CSS (~150行) |
| Modify | `packages/core/src/gateway/routes/page.ts` | 新增 `/api/page/_sdk/v1/*` 路由 |
| Modify | `apps/desktop/src/pages/apps/components/static-page-preview.tsx` | postMessage 通信 |
| Rewrite | `.claude/skills/create-page/SKILL.md` | 核心流程 + 决策树 |
| Create | `.claude/skills/create-page/references/design-system.md` | CSS tokens 文档 |
| Create | `.claude/skills/create-page/references/patterns.md` | 布局模式文档 |
| Create | `.claude/skills/create-page/references/interactions.md` | 动效 + a11y 文档 |
| Create | `.claude/skills/create-page/references/libraries.md` | CDN 库清单 |

---

## Task 1: Create viben-page-sdk.js

**Files:**
- Create: `packages/core/assets/viben-page-sdk.js`

- [ ] **Step 1: Create the assets directory and SDK file**

```bash
mkdir -p packages/core/assets
```

Write `packages/core/assets/viben-page-sdk.js`:

```javascript
(function () {
  "use strict";

  var VP = { version: "1" };
  var listeners = [];
  var doc = document.documentElement;

  // 1. 防 FOUC：立即从 URL 读取主题
  var params = new URLSearchParams(location.search);
  var initialTheme = params.get("theme");
  if (initialTheme === "dark") {
    doc.classList.add("dark");
  } else if (initialTheme === "light") {
    doc.classList.remove("dark");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      doc.classList.add("dark");
    }
  }
  VP.theme = doc.classList.contains("dark") ? "dark" : "light";

  // 2. 应用主题
  function applyTheme(theme) {
    var prev = VP.theme;
    VP.theme = theme;
    doc.classList.toggle("dark", theme === "dark");
    if (prev !== theme) {
      doc.classList.add("vp-transitioning");
      setTimeout(function () {
        doc.classList.remove("vp-transitioning");
      }, 300);
      listeners.forEach(function (fn) {
        fn(theme);
      });
    }
  }

  // 3. 监听父 App 消息（带 origin 校验）
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin) return;

    var data = e.data;
    if (!data || typeof data.type !== "string") return;
    if (data.type === "viben-page-init") {
      applyTheme(data.theme);
      VP.workspacePath = data.workspace_path || null;
    } else if (data.type === "viben-page-theme") {
      applyTheme(data.theme);
    }
  });

  // 4. 系统偏好 fallback
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", function (e) {
    if (!VP.workspacePath) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });

  // 5. 通知父 App 已就绪（仅在 iframe 中）
  if (window.parent !== window) {
    window.parent.postMessage({ type: "viben-page-ready" }, location.origin);
  }

  // 6. 公开 API
  VP.onThemeChange = function (fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  };
  VP.workspacePath = null;
  VP.fetch = function (path, options) {
    return fetch(location.origin + path, options);
  };

  window.VibenPage = VP;
})();
```

- [ ] **Step 2: Verify file**

Run: `wc -l packages/core/assets/viben-page-sdk.js`
Expected: ~75 lines

- [ ] **Step 3: Commit**

```bash
git add packages/core/assets/viben-page-sdk.js
git commit -m "feat(page): add viben-page-sdk.js for iframe theme communication"
```

---

## Task 2: Create viben-page-tokens.css

**Files:**
- Create: `packages/core/assets/viben-page-tokens.css`

- [ ] **Step 1: Write the tokens CSS file**

Write `packages/core/assets/viben-page-tokens.css`:

```css
/*
 * Viben Page Design Tokens v1
 * oklch format - aligned with Desktop App Tailwind v4
 * DO NOT use hsl() to wrap these variables
 */

:root {
  color-scheme: light dark;

  /* Brand */
  --brand-amber-400: oklch(0.78 0.16 75);
  --brand-amber-500: oklch(0.70 0.18 75);
  --brand-amber-600: oklch(0.62 0.18 75);
  --brand-amber-700: oklch(0.52 0.16 75);
  --brand-teal-500: oklch(0.65 0.14 195);

  /* Neutral (warm hue=75) */
  --neutral-50: oklch(0.985 0.002 75);
  --neutral-100: oklch(0.97 0.002 75);
  --neutral-200: oklch(0.92 0.004 75);
  --neutral-300: oklch(0.85 0.004 75);
  --neutral-400: oklch(0.70 0.004 75);
  --neutral-500: oklch(0.56 0.004 75);
  --neutral-600: oklch(0.44 0.004 75);
  --neutral-700: oklch(0.32 0.004 75);
  --neutral-800: oklch(0.22 0.004 75);
  --neutral-900: oklch(0.15 0.004 75);

  /* Light Theme Semantic */
  --background: var(--neutral-50);
  --foreground: var(--neutral-900);
  --surface: oklch(1 0 0);
  --surface-elevated: var(--neutral-100);
  --foreground-secondary: var(--neutral-600);
  --foreground-tertiary: var(--neutral-500);
  --primary: var(--brand-amber-600);
  --primary-hover: var(--brand-amber-700);
  --primary-foreground: oklch(1 0 0);
  --secondary: var(--neutral-100);
  --secondary-foreground: var(--neutral-900);
  --accent: var(--neutral-100);
  --accent-foreground: var(--neutral-900);
  --destructive: oklch(0.58 0.22 25);
  --destructive-foreground: oklch(1 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: var(--neutral-900);
  --border: var(--neutral-200);
  --border-strong: var(--neutral-300);
  --input: var(--neutral-200);
  --ring: var(--brand-amber-500);
  --card: oklch(1 0 0);
  --card-foreground: var(--neutral-900);
  --muted: var(--neutral-100);
  --muted-foreground: var(--neutral-600);

  /* Status (oklch only) */
  --success: oklch(0.65 0.18 145);
  --warning: oklch(0.70 0.18 75);
  --error: oklch(0.58 0.22 25);
  --info: oklch(0.62 0.18 240);

  /* Chart palette */
  --chart-1: var(--brand-amber-500);
  --chart-2: var(--brand-teal-500);
  --chart-3: oklch(0.65 0.18 145);
  --chart-4: oklch(0.62 0.18 240);
  --chart-5: oklch(0.68 0.16 55);
  --chart-6: oklch(0.58 0.14 310);

  /* Typography */
  --font-serif: 'Crimson Pro', 'Georgia', serif;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Spacing (4px base) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Radius */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-2xl: 2rem;

  /* Shadows */
  --shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.1), 0 1px 2px -1px oklch(0 0 0 / 0.1);
  --shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1);
  --shadow-primary: 0 8px 16px -4px oklch(0.70 0.18 75 / 0.3);

  /* Animation */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
}

.dark {
  --background: var(--neutral-900);
  --foreground: var(--neutral-50);
  --surface: var(--neutral-800);
  --surface-elevated: var(--neutral-700);
  --foreground-secondary: var(--neutral-400);
  --foreground-tertiary: var(--neutral-500);
  --primary: var(--brand-amber-400);
  --primary-hover: var(--brand-amber-500);
  --primary-foreground: var(--neutral-900);
  --secondary: var(--neutral-800);
  --secondary-foreground: var(--neutral-50);
  --accent: var(--neutral-800);
  --accent-foreground: var(--neutral-50);
  --destructive: oklch(0.65 0.22 25);
  --destructive-foreground: oklch(1 0 0);
  --popover: var(--neutral-800);
  --popover-foreground: var(--neutral-50);
  --border: var(--neutral-700);
  --border-strong: var(--neutral-600);
  --input: var(--neutral-700);
  --ring: var(--brand-amber-400);
  --card: var(--neutral-800);
  --card-foreground: var(--neutral-50);
  --muted: var(--neutral-800);
  --muted-foreground: var(--neutral-400);
  --shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.4);
  --shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.5);
}

@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --background: var(--neutral-900);
    --foreground: var(--neutral-50);
    --surface: var(--neutral-800);
    --surface-elevated: var(--neutral-700);
    --foreground-secondary: var(--neutral-400);
    --foreground-tertiary: var(--neutral-500);
    --primary: var(--brand-amber-400);
    --primary-hover: var(--brand-amber-500);
    --primary-foreground: var(--neutral-900);
    --secondary: var(--neutral-800);
    --secondary-foreground: var(--neutral-50);
    --accent: var(--neutral-800);
    --accent-foreground: var(--neutral-50);
    --destructive: oklch(0.65 0.22 25);
    --destructive-foreground: oklch(1 0 0);
    --popover: var(--neutral-800);
    --popover-foreground: var(--neutral-50);
    --border: var(--neutral-700);
    --border-strong: var(--neutral-600);
    --input: var(--neutral-700);
    --ring: var(--brand-amber-400);
    --card: var(--neutral-800);
    --card-foreground: var(--neutral-50);
    --muted: var(--neutral-800);
    --muted-foreground: var(--neutral-400);
    --shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.3);
    --shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.4);
    --shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.5);
  }
}

/* Theme transition (triggered by SDK) */
html.vp-transitioning * {
  transition: background-color 0.3s ease, color 0.2s ease, border-color 0.3s ease !important;
}
```

- [ ] **Step 2: Verify file**

Run: `wc -l packages/core/assets/viben-page-tokens.css`
Expected: ~145 lines

- [ ] **Step 3: Commit**

```bash
git add packages/core/assets/viben-page-tokens.css
git commit -m "feat(page): add viben-page-tokens.css design system tokens"
```

---

## Task 3: Add Gateway SDK routes

**Files:**
- Modify: `packages/core/src/gateway/routes/page.ts` (append before closing `}` of `registerPageRoutes`)

- [ ] **Step 1: Add path and fs imports at top of file**

At the top of `packages/core/src/gateway/routes/page.ts`, after existing imports, add:

```typescript
import { join } from "node:path";
import { readFileSync } from "node:fs";
```

- [ ] **Step 2: Add SDK routes inside registerPageRoutes function**

Append before the closing `}` of the `registerPageRoutes` function (after the `/api/page/asset/upload` route, around line 899):

```typescript
  // ============================================================================
  // GET /api/page/_sdk/v1/viben-page-sdk.js - Serve page SDK
  // ============================================================================
  fastify.get("/api/page/_sdk/v1/viben-page-sdk.js", {
    schema: {
      description: "Serve viben-page-sdk.js",
      tags: ["page"],
      response: {
        200: { type: "string" },
      },
    },
  }, async (_request, reply) => {
    const sdkPath = join(__dirname, "../../../assets/viben-page-sdk.js");
    const content = readFileSync(sdkPath, "utf-8");
    reply.type("application/javascript; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send(content);
  });

  // ============================================================================
  // GET /api/page/_sdk/v1/viben-page-tokens.css - Serve page tokens CSS
  // ============================================================================
  fastify.get("/api/page/_sdk/v1/viben-page-tokens.css", {
    schema: {
      description: "Serve viben-page-tokens.css",
      tags: ["page"],
      response: {
        200: { type: "string" },
      },
    },
  }, async (_request, reply) => {
    const cssPath = join(__dirname, "../../../assets/viben-page-tokens.css");
    const content = readFileSync(cssPath, "utf-8");
    reply.type("text/css; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send(content);
  });
```

- [ ] **Step 3: Verify the path resolves correctly**

The `__dirname` at runtime will be `packages/core/dist/gateway/routes/` (compiled), so `../../../assets/` resolves to `packages/core/assets/`. Verify build includes assets:

Check `packages/core/tsup.config.ts` or `package.json` for asset copy configuration. If assets are not copied during build, add a `postbuild` script or use `copyFiles` in the build config. Alternatively, resolve from the package root:

```typescript
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
// If needed, compute package root relative to compiled output
```

**Fallback approach:** If `__dirname` path resolution is unreliable across build modes, use the `require.resolve` pattern or embed the path relative to `packages/core/`:

```typescript
const ASSETS_DIR = join(__dirname, "..", "..", "..", "assets");
```

Verify by running: `pnpm --filter @viben/core build && node -e "const p = require('path'); console.log(p.resolve(__dirname, 'packages/core/dist/gateway/routes', '../../../assets'))"`

- [ ] **Step 4: Build and verify**

Run: `pnpm --filter @viben/core build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gateway/routes/page.ts
git commit -m "feat(page): add /api/page/_sdk/v1/* routes for SDK and tokens"
```

---

## Task 4: Add postMessage communication to StaticPagePreview

**Files:**
- Modify: `apps/desktop/src/pages/apps/components/static-page-preview.tsx`

- [ ] **Step 1: Add useRef and useTheme imports**

At the top of the file, update the React import and add useTheme:

```typescript
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
```

Add after other imports:

```typescript
import { useTheme } from "@/hooks/use-theme";
```

- [ ] **Step 2: Update gatewayServeUrl to include theme param**

Inside the `StaticPagePreview` component, after the existing `gatewayServeUrl` memo, replace it with:

```typescript
  const { resolvedTheme } = useTheme();

  // Construct gateway serve URL for iframe-based preview (with theme)
  const gatewayServeUrl = useMemo(() => {
    const baseUrl = getGatewayUrl();
    const params = new URLSearchParams({
      workspace_path: workspacePath,
      slug: page.slug,
      theme: resolvedTheme,
    });
    return `${baseUrl}/api/page/serve?${params.toString()}`;
  }, [workspacePath, page.slug, resolvedTheme]);
```

- [ ] **Step 3: Add iframe ref and postMessage logic**

Add after the `gatewayServeUrl` memo:

```typescript
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const gatewayOrigin = useMemo(() => {
    try {
      return new URL(getGatewayUrl()).origin;
    } catch {
      return "";
    }
  }, []);

  // Listen for viben-page-ready and send init
  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (e.origin !== gatewayOrigin) return;
      if (e.data?.type === "viben-page-ready") {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "viben-page-init",
            theme: resolvedTheme,
            workspace_path: workspacePath,
          },
          gatewayOrigin
        );
      }
    },
    [resolvedTheme, workspacePath, gatewayOrigin]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Send theme updates when resolvedTheme changes
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "viben-page-theme", theme: resolvedTheme },
      gatewayOrigin
    );
  }, [resolvedTheme, gatewayOrigin]);
```

- [ ] **Step 4: Add ref and onLoad to iframe element**

Update the iframe JSX (in the `filePreviewType === "html"` branch) to include ref and onLoad:

```tsx
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={gatewayServeUrl}
          className="h-full w-full border-0"
          title={page.name}
          onLoad={(e) => {
            // Re-bind ref after iframeKey remount
            iframeRef.current = e.currentTarget;
          }}
        />
```

- [ ] **Step 5: Build and verify**

Run: `pnpm --filter viben-desktop build` (or `pnpm typecheck`)
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/pages/apps/components/static-page-preview.tsx
git commit -m "feat(page): add postMessage theme sync to StaticPagePreview"
```

---

## Task 5: Rewrite .claude/skills/create-page/SKILL.md

**Files:**
- Rewrite: `.claude/skills/create-page/SKILL.md`

- [ ] **Step 1: Write the new SKILL.md**

Replace entire content of `.claude/skills/create-page/SKILL.md`:

````markdown
---
name: create-page
description: "Create Viben workspace pages (static HTML apps, markdown docs, dev server pages, proxy pages). Use when user asks to create a page, build a page, add a new page to the workspace, or mentions 'viben page create'. Triggers: 'create page', 'new page', 'add page', 'build a page', 'make a page', 'viben page'."
---

# Create Page

在 Viben 工作区的 `pages/` 目录下创建新页面。

## 快速流程

1. 确定页面类型和参数
2. 创建目录 `pages/<slug>/`
3. 写入 `SKILL.md` frontmatter
4. 创建入口文件（引入 SDK + tokens）
5. 编写页面内容

## 页面类型

| 类型 | 适用场景 | 关键文件 |
|------|---------|---------|
| `static` | 单文件 HTML 应用（默认） | `index.html` |
| `markdown` | 文档/笔记 | SKILL.md body |
| `server` | 需要 dev server 的项目 | 项目目录 |
| `proxy` | 嵌入外部服务 | 无 |

## 场景决策树

根据用户需求选择对应的 reference 文件：

| 用户需求 | 参考文件 |
|---------|---------|
| 仪表盘、卡片布局、数据展示 | `references/patterns.md` → Dashboard 节 |
| 表单、输入验证、步骤表单 | `references/patterns.md` → Form 节 |
| 产品介绍页、Landing page | `references/patterns.md` → Landing 节 |
| 数据表格、排序筛选 | `references/patterns.md` → Table 节 |
| 色彩、字体、间距问题 | `references/design-system.md` |
| 动画、过渡、加载状态 | `references/interactions.md` |
| 引入第三方库（图表/图标等） | `references/libraries.md` |

## 基础 HTML 模板（Static 类型）

所有静态页面**必须**使用此模板结构：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}}</title>
  <!-- 防 FOUC -->
  <script>
  (function(){
    var t = new URLSearchParams(location.search).get('theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
  })();
  </script>
  <!-- Design Tokens -->
  <link rel="stylesheet" href="/api/page/_sdk/v1/viben-page-tokens.css">
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: auto; }
    body {
      font-family: var(--font-sans);
      background: var(--background);
      color: var(--foreground);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <!-- SDK (placed at end for non-blocking) -->
  <script src="/api/page/_sdk/v1/viben-page-sdk.js"></script>
  <script>
    // App code here
  </script>
</body>
</html>
```

## SKILL.md Frontmatter 格式

### Static（默认）

```yaml
---
page:
  type: static
  file: index.html
  permission: [read, write]
name: "页面名称"
description: "页面描述"
icon:
  type: lucide
  value: app-window
---
```

### Markdown

```yaml
---
page:
  type: markdown
  permission: [read, write]
name: "文档名称"
icon:
  type: lucide
  value: book-open
---
```

### Server

```yaml
---
page:
  type: server
  command: "pnpm dev"
  port: 5173
  ready_pattern: "ready in"
  timeout: 30000
  permission: [read, write]
name: "应用名称"
icon:
  type: lucide
  value: server
---
```

### Proxy

```yaml
---
page:
  type: proxy
  url: "http://localhost:3000"
  permission: [read]
name: "服务名称"
icon:
  type: lucide
  value: monitor
---
```

## CLI 命令

```bash
viben page create <slug> --name "名称" --type static
viben page create <slug> --name "名称" --type markdown
viben page create <slug> --name "名称" --type server --command "pnpm dev" --port 5173
viben page create <slug> --name "名称" --type proxy --url "http://localhost:3000"
```

## 核心规则

1. **必须引入 SDK**：所有 static 页面必须包含 `viben-page-sdk.js` 和 `viben-page-tokens.css`
2. **禁止硬编码颜色**：使用 CSS 变量（`var(--background)` 等），不允许 `#hex` 或 `rgb()`
3. **字体规则**：标题用 `var(--font-serif)`，正文用 `var(--font-sans)`，数值/代码用 `var(--font-mono)`
4. **滚动页面**：使用 `overflow: auto`（不是 `hidden`）
5. **动画尊重**：添加 `@media (prefers-reduced-motion: reduce)` 降级
6. **对比度**：文字与背景最小对比度 4.5:1
7. **禁止 hsl 包裹**：不要写 `hsl(var(--background))`，变量已是 oklch 格式

## 图标参考

常用 lucide 图标：`app-window`、`book-open`、`server`、`monitor`、`phone`、`file-text`、`layout`、`palette`、`globe`、`chart-bar`

也可用 emoji：`icon: { type: emoji, value: "🚀" }`
````

- [ ] **Step 2: Verify file**

Run: `wc -l .claude/skills/create-page/SKILL.md`
Expected: ~170-180 lines

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/create-page/SKILL.md
git commit -m "feat(skill): rewrite create-page SKILL.md with SDK integration and decision tree"
```

---

## Task 6: Create references/design-system.md

**Files:**
- Create: `.claude/skills/create-page/references/design-system.md`

- [ ] **Step 1: Create references directory**

```bash
mkdir -p .claude/skills/create-page/references
```

- [ ] **Step 2: Write design-system.md**

Write `.claude/skills/create-page/references/design-system.md`:

````markdown
# Design System Reference

页面端 CSS Token 完整参考。所有颜色使用 oklch 格式，与 Desktop App 保持一致。

## 色彩变量速查

### 品牌色

| 变量 | 值 | 用途 |
|------|------|------|
| `--brand-amber-400` | `oklch(0.78 0.16 75)` | dark 主题主色 |
| `--brand-amber-500` | `oklch(0.70 0.18 75)` | ring/强调 |
| `--brand-amber-600` | `oklch(0.62 0.18 75)` | light 主题主色 |
| `--brand-amber-700` | `oklch(0.52 0.16 75)` | hover 状态 |
| `--brand-teal-500` | `oklch(0.65 0.14 195)` | 图表对比色 |

### 语义色（自动随主题切换）

| 变量 | Light | Dark |
|------|-------|------|
| `--background` | neutral-50 | neutral-900 |
| `--foreground` | neutral-900 | neutral-50 |
| `--surface` | white | neutral-800 |
| `--primary` | amber-600 | amber-400 |
| `--card` | white | neutral-800 |
| `--border` | neutral-200 | neutral-700 |
| `--muted` | neutral-100 | neutral-800 |

### 状态色

```css
--success: oklch(0.65 0.18 145);  /* 绿色 */
--warning: oklch(0.70 0.18 75);   /* 琥珀色 */
--error: oklch(0.58 0.22 25);     /* 红色 */
--info: oklch(0.62 0.18 240);     /* 蓝色 */
```

## 字体系统

| 变量 | 字体栈 | 用途 |
|------|--------|------|
| `--font-serif` | Crimson Pro, Georgia | 标题、大字 |
| `--font-sans` | Inter, system-ui | 正文、UI |
| `--font-mono` | JetBrains Mono, Fira Code | 代码、数值 |

### 字号建议

```css
/* 标题 */
h1 { font: 700 2.5rem/1.2 var(--font-serif); }
h2 { font: 600 2rem/1.25 var(--font-serif); }
h3 { font: 600 1.5rem/1.3 var(--font-sans); }

/* 正文 */
body { font: 400 1rem/1.6 var(--font-sans); }
.small { font-size: 0.875rem; }

/* 数值 */
.metric { font: 500 2rem/1 var(--font-mono); }
```

## 间距

基于 4px 网格：

```css
--space-1: 0.25rem;   /* 4px - 图标间距 */
--space-2: 0.5rem;    /* 8px - 元素内间距 */
--space-3: 0.75rem;   /* 12px - 紧凑间距 */
--space-4: 1rem;      /* 16px - 标准间距 */
--space-6: 1.5rem;    /* 24px - 段落间距 */
--space-8: 2rem;      /* 32px - 区块间距 */
--space-12: 3rem;     /* 48px - 大区块 */
--space-16: 4rem;     /* 64px - 页面级间距 */
```

## 圆角

```css
--radius-sm: 0.5rem;   /* 按钮、输入框 */
--radius-md: 0.75rem;  /* 卡片 */
--radius-lg: 1rem;     /* 模态框 */
--radius-xl: 1.5rem;   /* 大卡片 */
--radius-2xl: 2rem;    /* 特殊容器 */
```

## 阴影

```css
--shadow-sm: ...;      /* 微浮起 - 按钮 */
--shadow-md: ...;      /* 卡片默认 */
--shadow-lg: ...;      /* 下拉菜单、弹出层 */
--shadow-primary: ...; /* 主色按钮发光 */
```

## 反模式

| ❌ 不要 | ✅ 应该 |
|---------|---------|
| `color: #333` | `color: var(--foreground)` |
| `background: white` | `background: var(--surface)` |
| `hsl(var(--background))` | `var(--background)` |
| `border: 1px solid gray` | `border: 1px solid var(--border)` |
| `font-family: Arial` | `font-family: var(--font-sans)` |
| 冷灰色 `hue: 0/220` | 暖灰色 `hue: 75`（已内置） |

## 图表配色

6 色循环调色板，amber 和 teal 为主对比：

```css
--chart-1  /* amber - 主数据 */
--chart-2  /* teal - 对比数据 */
--chart-3  /* green - 第三系列 */
--chart-4  /* blue - 第四系列 */
--chart-5  /* warm-yellow - 第五系列 */
--chart-6  /* purple - 第六系列 */
```

ECharts/Chart.js 中使用：
```javascript
const colors = [
  getComputedStyle(document.documentElement).getPropertyValue('--chart-1').trim(),
  getComputedStyle(document.documentElement).getPropertyValue('--chart-2').trim(),
  // ...
];
```
````

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/create-page/references/design-system.md
git commit -m "feat(skill): add design-system reference for create-page"
```

---

## Task 7: Create references/patterns.md

**Files:**
- Create: `.claude/skills/create-page/references/patterns.md`

- [ ] **Step 1: Write patterns.md**

Write `.claude/skills/create-page/references/patterns.md`:

````markdown
# Layout Patterns Reference

常见页面布局模式的完整代码示例。

## 目录

1. [Dashboard（仪表盘）](#dashboard)
2. [Form（表单）](#form)
3. [Landing（产品介绍页）](#landing)
4. [Table（数据表格）](#table)

---

## Dashboard

### 结构：Bento Grid

```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-6);
  padding: var(--space-8);
}

.card {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.card:hover {
  box-shadow: var(--shadow-md);
  transition: box-shadow var(--duration-fast) var(--ease-out-expo);
}

/* 大卡片横跨两列 */
.card--wide {
  grid-column: span 2;
}

/* KPI 数值 */
.card__metric {
  font: 500 2.5rem/1 var(--font-mono);
  color: var(--foreground);
}

.card__label {
  font: 400 0.875rem/1.4 var(--font-sans);
  color: var(--foreground-secondary);
  margin-top: var(--space-1);
}

.card__trend--up { color: var(--success); }
.card__trend--down { color: var(--error); }
```

### 响应式

```css
@media (max-width: 768px) {
  .dashboard {
    grid-template-columns: 1fr;
    padding: var(--space-4);
  }
  .card--wide {
    grid-column: span 1;
  }
}
```

### 页面头部

```css
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) var(--space-8);
  border-bottom: 1px solid var(--border);
}

.page-title {
  font: 700 1.75rem/1.2 var(--font-serif);
  color: var(--foreground);
}
```

---

## Form

### 基础表单布局

```css
.form {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-8);
}

.form-group {
  margin-bottom: var(--space-6);
}

.form-label {
  display: block;
  font: 500 0.875rem/1.4 var(--font-sans);
  color: var(--foreground);
  margin-bottom: var(--space-2);
}

.form-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font: 400 1rem/1.5 var(--font-sans);
  color: var(--foreground);
  background: var(--surface);
  border: 1px solid var(--input);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color var(--duration-fast) ease,
              box-shadow var(--duration-fast) ease;
}

.form-input:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 25%, transparent);
}

.form-input--error {
  border-color: var(--error);
}

.form-error {
  font-size: 0.8125rem;
  color: var(--error);
  margin-top: var(--space-1);
}
```

### 按钮

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font: 500 0.875rem/1 var(--font-sans);
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out-expo);
}

.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
}

.btn-primary:hover {
  background: var(--primary-hover);
  box-shadow: var(--shadow-primary);
}

.btn-secondary {
  background: var(--secondary);
  color: var(--secondary-foreground);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--accent);
}
```

### 步骤表单

```css
.stepper {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-8);
}

.step {
  flex: 1;
  height: 4px;
  background: var(--muted);
  border-radius: 2px;
  transition: background var(--duration-normal) var(--ease-out-expo);
}

.step--active { background: var(--primary); }
.step--completed { background: var(--success); }
```

---

## Landing

### Hero 区域

```css
.hero {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: var(--space-16) var(--space-8);
}

.hero__title {
  font: 700 clamp(2.5rem, 6vw, 4.5rem)/1.1 var(--font-serif);
  color: var(--foreground);
  max-width: 800px;
}

.hero__subtitle {
  font: 400 clamp(1.125rem, 2vw, 1.375rem)/1.6 var(--font-sans);
  color: var(--foreground-secondary);
  max-width: 600px;
  margin-top: var(--space-6);
}

.hero__cta {
  margin-top: var(--space-8);
  display: flex;
  gap: var(--space-4);
}
```

### Feature Grid

```css
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-8);
  padding: var(--space-16) var(--space-8);
  max-width: 1200px;
  margin: 0 auto;
}

.feature-card {
  padding: var(--space-6);
}

.feature-card__icon {
  width: 48px;
  height: 48px;
  background: color-mix(in oklch, var(--primary) 15%, transparent);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  margin-bottom: var(--space-4);
}

.feature-card__title {
  font: 600 1.25rem/1.3 var(--font-sans);
  color: var(--foreground);
  margin-bottom: var(--space-2);
}

.feature-card__desc {
  font: 400 1rem/1.6 var(--font-sans);
  color: var(--foreground-secondary);
}
```

### 滚动渐现动画

```css
.fade-up {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity var(--duration-slow) var(--ease-out-expo),
              transform var(--duration-slow) var(--ease-out-expo);
}

.fade-up.visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .fade-up {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

IntersectionObserver JS:
```javascript
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  },
  { threshold: 0.1 }
);
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
```

---

## Table

### 数据表格

```css
.table-container {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font: 400 0.875rem/1.5 var(--font-sans);
}

.data-table th {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  font-weight: 500;
  color: var(--foreground-secondary);
  background: var(--muted);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.data-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
}

.data-table tr:last-child td {
  border-bottom: none;
}

.data-table tr:hover td {
  background: var(--muted);
}
```

### 排序指示器

```css
.sort-header {
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.sort-header::after {
  content: '↕';
  opacity: 0.3;
  font-size: 0.75rem;
}

.sort-header[data-sort="asc"]::after { content: '↑'; opacity: 1; }
.sort-header[data-sort="desc"]::after { content: '↓'; opacity: 1; }
```

### 筛选栏

```css
.table-toolbar {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--border);
}

.search-input {
  flex: 1;
  max-width: 320px;
  padding: var(--space-2) var(--space-3);
  background: var(--surface);
  border: 1px solid var(--input);
  border-radius: var(--radius-sm);
  font: 400 0.875rem/1.5 var(--font-sans);
  color: var(--foreground);
}
```
````

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/create-page/references/patterns.md
git commit -m "feat(skill): add layout patterns reference for create-page"
```

---

## Task 8: Create references/interactions.md

**Files:**
- Create: `.claude/skills/create-page/references/interactions.md`

- [ ] **Step 1: Write interactions.md**

Write `.claude/skills/create-page/references/interactions.md`:

````markdown
# Interactions Reference

动效、状态 UI、无障碍指南。

## 动效变量

```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);   /* 快速弹出 */
--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1); /* 回弹 */
--duration-fast: 200ms;    /* hover、focus */
--duration-normal: 300ms;  /* 展开、折叠 */
--duration-slow: 500ms;    /* 页面级过渡 */
```

## 常用过渡

### Hover 反馈

```css
.interactive {
  transition: transform var(--duration-fast) var(--ease-out-expo),
              box-shadow var(--duration-fast) var(--ease-out-expo);
}

.interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.interactive:active {
  transform: translateY(0);
  transition-duration: 100ms;
}
```

### 进入动画

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation: fade-in var(--duration-normal) var(--ease-out-expo) both;
}

/* 交错动画 */
.stagger > :nth-child(1) { animation-delay: 0ms; }
.stagger > :nth-child(2) { animation-delay: 50ms; }
.stagger > :nth-child(3) { animation-delay: 100ms; }
.stagger > :nth-child(4) { animation-delay: 150ms; }
```

### 数值跳动

```javascript
function animateNumber(el, target, duration = 1000) {
  const start = performance.now();
  const initial = parseFloat(el.textContent) || 0;

  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    el.textContent = Math.round(initial + (target - initial) * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}
```

## 状态 UI

### 加载态

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--muted) 25%,
    var(--surface-elevated) 50%,
    var(--muted) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 空状态

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
}

.empty-state__icon {
  width: 64px;
  height: 64px;
  color: var(--foreground-tertiary);
  margin-bottom: var(--space-4);
}

.empty-state__title {
  font: 600 1.25rem/1.3 var(--font-sans);
  color: var(--foreground);
}

.empty-state__desc {
  font: 400 0.875rem/1.5 var(--font-sans);
  color: var(--foreground-secondary);
  margin-top: var(--space-2);
  max-width: 360px;
}
```

### Toast 通知

```css
.toast {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  padding: var(--space-3) var(--space-4);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font: 400 0.875rem/1.4 var(--font-sans);
  animation: slide-up var(--duration-normal) var(--ease-out-back);
}

@keyframes slide-up {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

## 主题过渡

SDK 自动管理 `.vp-transitioning` class，但你也可以手动监听：

```javascript
VibenPage.onThemeChange(function(theme) {
  // 重新初始化图表颜色等
  updateChartColors(theme);
});
```

## 无障碍 (a11y)

### 必须做

1. **焦点可见**：所有交互元素在 `:focus-visible` 时显示 ring
2. **对比度**：正文 ≥ 4.5:1，大字 ≥ 3:1
3. **键盘导航**：Tab 可达所有交互元素
4. **ARIA 标签**：图标按钮必须有 `aria-label`
5. **减少动画**：尊重 `prefers-reduced-motion`

### Focus Ring

```css
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
````

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/create-page/references/interactions.md
git commit -m "feat(skill): add interactions reference for create-page"
```

---

## Task 9: Create references/libraries.md

**Files:**
- Create: `.claude/skills/create-page/references/libraries.md`

- [ ] **Step 1: Write libraries.md**

Write `.claude/skills/create-page/references/libraries.md`:

````markdown
# CDN Libraries Reference

推荐的 CDN 库及暗色主题配置。所有页面通过 `<script>` / `<link>` 引入，无需构建工具。

## 图表

### ECharts

```html
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
```

暗色主题适配：

```javascript
// 读取 CSS 变量作为 ECharts 颜色
function getTokenColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const chart = echarts.init(el, VibenPage.theme === 'dark' ? 'dark' : null);

// 主题切换时重新渲染
VibenPage.onThemeChange(function(theme) {
  chart.dispose();
  const newChart = echarts.init(el, theme === 'dark' ? 'dark' : null);
  newChart.setOption(option);
});

// 使用 token 颜色
const option = {
  color: [
    getTokenColor('--chart-1'),
    getTokenColor('--chart-2'),
    getTokenColor('--chart-3'),
    getTokenColor('--chart-4'),
  ],
  backgroundColor: 'transparent',
};
```

### Chart.js

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
```

```javascript
Chart.defaults.color = getTokenColor('--foreground-secondary');
Chart.defaults.borderColor = getTokenColor('--border');

new Chart(ctx, {
  type: 'line',
  data: {
    datasets: [{
      borderColor: getTokenColor('--chart-1'),
      backgroundColor: getTokenColor('--chart-1') + '33', // 20% alpha hack
    }]
  },
  options: {
    plugins: { legend: { labels: { color: getTokenColor('--foreground') } } },
    scales: {
      x: { ticks: { color: getTokenColor('--foreground-secondary') }, grid: { color: getTokenColor('--border') } },
      y: { ticks: { color: getTokenColor('--foreground-secondary') }, grid: { color: getTokenColor('--border') } },
    }
  }
});
```

## 图标

### Lucide Icons

```html
<script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js"></script>
```

```javascript
lucide.createIcons(); // 自动渲染 <i data-lucide="icon-name"></i>
```

```html
<i data-lucide="trending-up" style="color: var(--success)"></i>
<i data-lucide="trending-down" style="color: var(--error)"></i>
```

## 动画

### GSAP (ScrollTrigger)

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
```

```javascript
gsap.registerPlugin(ScrollTrigger);

gsap.from('.feature-card', {
  y: 40,
  opacity: 0,
  duration: 0.6,
  stagger: 0.1,
  ease: 'expo.out',
  scrollTrigger: {
    trigger: '.features',
    start: 'top 80%',
  }
});
```

**注意**：检查 `prefers-reduced-motion`：
```javascript
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  gsap.globalTimeline.timeScale(100); // 跳过动画
}
```

## 工具

### Day.js (日期)

```html
<script src="https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dayjs@1/locale/zh-cn.js"></script>
```

```javascript
dayjs.locale('zh-cn');
dayjs().format('YYYY-MM-DD HH:mm');
```

### Alpine.js (轻量响应式)

```html
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>
```

```html
<div x-data="{ open: false }">
  <button @click="open = !open" class="btn btn-primary">Toggle</button>
  <div x-show="open" x-transition class="card">Content</div>
</div>
```

## 注意事项

1. 所有 CDN 库都应使用特定版本号（不用 `@latest`），除非页面是临时性质
2. 图表库初始化时设 `backgroundColor: 'transparent'`，让 CSS 变量控制背景
3. 主题切换时需要重新初始化图表实例（ECharts 的 theme 参数在 init 时确定）
4. 使用 Lucide 图标时，颜色直接用 `currentColor` 继承父元素
````

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/create-page/references/libraries.md
git commit -m "feat(skill): add CDN libraries reference for create-page"
```

---

## Task 10: Verification — Create test page

**Files:**
- Create: `pages/sdk-test/SKILL.md` (temp, delete after verification)
- Create: `pages/sdk-test/index.html` (temp, delete after verification)

- [ ] **Step 1: Create test page SKILL.md**

Write `pages/sdk-test/SKILL.md`:

```yaml
---
page:
  type: static
  file: index.html
  permission: [read, write]
name: "SDK Test"
description: "验证 SDK 主题同步"
icon:
  type: emoji
  value: "🧪"
---

# SDK Test

临时测试页面，验证主题同步是否生效。验证后删除。
```

- [ ] **Step 2: Create test page index.html**

Write `pages/sdk-test/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SDK Test</title>
  <script>
  (function(){
    var t = new URLSearchParams(location.search).get('theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
  })();
  </script>
  <link rel="stylesheet" href="/api/page/_sdk/v1/viben-page-tokens.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--font-sans);
      background: var(--background);
      color: var(--foreground);
      padding: var(--space-8);
      min-height: 100vh;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: var(--space-6);
      margin-bottom: var(--space-4);
    }
    .primary-btn {
      background: var(--primary);
      color: var(--primary-foreground);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-sm);
      border: none;
      cursor: pointer;
    }
    .status { font-family: var(--font-mono); color: var(--success); }
    h1 { font-family: var(--font-serif); margin-bottom: var(--space-4); }
  </style>
</head>
<body>
  <h1>SDK Theme Test</h1>
  <div class="card">
    <p>Current theme: <span class="status" id="theme-display">-</span></p>
    <p>Workspace: <span class="status" id="ws-display">-</span></p>
    <p>SDK version: <span class="status" id="ver-display">-</span></p>
  </div>
  <div class="card">
    <button class="primary-btn" onclick="alert('Button works!')">Primary Button</button>
  </div>
  <script src="/api/page/_sdk/v1/viben-page-sdk.js"></script>
  <script>
    document.getElementById('theme-display').textContent = VibenPage.theme;
    document.getElementById('ws-display').textContent = VibenPage.workspacePath || '(standalone)';
    document.getElementById('ver-display').textContent = VibenPage.version;

    VibenPage.onThemeChange(function(theme) {
      document.getElementById('theme-display').textContent = theme;
    });
  </script>
</body>
</html>
```

- [ ] **Step 3: Start Gateway and verify SDK routes**

```bash
# Restart gateway to pick up new routes
pnpm gateway:restart

# Test SDK route
curl -s http://127.0.0.1:18790/api/page/_sdk/v1/viben-page-sdk.js | head -5
# Expected: first 5 lines of SDK

curl -s http://127.0.0.1:18790/api/page/_sdk/v1/viben-page-tokens.css | head -5
# Expected: first 5 lines of CSS tokens
```

- [ ] **Step 4: Open test page in Desktop App**

1. Open Desktop App
2. Navigate to workspace pages
3. Find "SDK Test" page
4. Verify: page displays with correct theme (light/dark)
5. Toggle theme in app settings
6. Verify: page transitions smoothly to new theme

- [ ] **Step 5: Verify standalone mode**

Open directly in browser: `http://127.0.0.1:18790/api/page/serve?workspace_path=<your-workspace>&slug=sdk-test`

Verify:
- Page renders correctly
- Theme follows `?theme=dark` param
- No console errors about postMessage

- [ ] **Step 6: Clean up test page**

```bash
rm -rf pages/sdk-test
```

- [ ] **Step 7: Final commit (all remaining files)**

```bash
git add -A
git commit -m "feat(page): complete create-page skill enhancement

- SDK + CSS tokens (packages/core/assets/)
- Gateway /api/page/_sdk/v1/* routes
- StaticPagePreview postMessage theme sync
- Rewritten create-page skill with references"
```
