# Create-Page Skill Enhancement Design

> 增强 `create-page` skill，提供完整 Design System、iframe 通信协议、交互模式指南。

---

## 目标

当前 `create-page` skill 只有文件结构指引，缺失页面内容设计的一切指导。增强后，AI 能够为以下场景生成高质量页面：

- 数据仪表盘（卡片 + 图表 + 主题切换）
- 表单页面（输入 + 验证 + 动效）
- 产品介绍页（Hero + 滚动动画 + 响应式）
- 数据表格（排序 + 筛选 + API 通信）

同时实现 iframe 页面与 Desktop App 的主题联动。

---

## 架构概览

```
.claude/skills/create-page/
├── SKILL.md                    # 核心流程 + 场景决策树（~180行）
├── references/
│   ├── design-system.md        # CSS tokens、主题、字体、色彩规则
│   ├── patterns.md             # 布局模式（dashboard/form/landing/table）
│   ├── interactions.md         # 动效、状态 UI、a11y
│   └── libraries.md            # CDN 库清单 + 用法片段
└── assets/
    └── viben-page-sdk.js       # 页面端通信 SDK（可直接引用）

packages/core/
├── assets/
│   ├── viben-page-sdk.js       # SDK 源文件（Gateway serve）
│   └── viben-page-tokens.css   # Design tokens CSS
└── src/gateway/routes/page.ts  # 新增 /_sdk/* 路由

apps/desktop/
└── src/pages/apps/components/static-page-preview.tsx  # postMessage 通信
```

---

## 1. Design System（页面端 Token 体系）

### 设计决策

- **直接使用 App 同名语义变量**：`--background`、`--foreground`、`--primary` 等
- **oklch 格式**：与 Tailwind v4 + Desktop App 保持一致
- **SDK 可覆盖**：父 App 可通过 postMessage 传递自定义值
- **自包含 fallback**：无 SDK 时用 `@media (prefers-color-scheme)` 降级

### CSS Tokens

```css
:root {
  color-scheme: light dark;

  /* Brand */
  --brand-amber-500: oklch(0.70 0.18 75);
  --brand-amber-600: oklch(0.62 0.18 75);
  --brand-amber-700: oklch(0.52 0.16 75);
  --brand-teal-500: oklch(0.65 0.14 195);

  /* Neutral (warm) */
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
  --border: var(--neutral-200);
  --border-strong: var(--neutral-300);
  --ring: var(--brand-amber-500);
  --card: oklch(1 0 0);
  --card-foreground: var(--neutral-900);
  --muted: var(--neutral-100);
  --muted-foreground: var(--neutral-600);

  /* Semantic */
  --success: oklch(0.65 0.18 145);
  --warning: oklch(0.70 0.18 75);
  --error: oklch(0.58 0.22 25);
  --info: oklch(0.62 0.18 240);

  /* Chart palette (amber→teal contrast) */
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
  --primary: var(--brand-amber-500);
  --primary-hover: oklch(0.78 0.16 75);
  --primary-foreground: var(--neutral-900);
  --border: var(--neutral-700);
  --border-strong: var(--neutral-600);
  --ring: oklch(0.78 0.16 75);
  --card: var(--neutral-800);
  --card-foreground: var(--neutral-50);
  --muted: var(--neutral-800);
  --muted-foreground: var(--neutral-400);
  --shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.4);
  --shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.5);
}

@media (prefers-color-scheme: dark) {
  :root:not(.light) { /* same as .dark */ }
}
```

### Google Fonts CDN

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### 色彩使用规则

1. **DO**: amber 作为主强调色（按钮、链接、高亮）
2. **DO**: teal 作为图表对比色（与 amber 区分数据系列）
3. **DO**: neutral-50（非纯白）作为亮色背景保持温暖感
4. **DON'T**: 使用冷灰色 — 所有灰色带暖色调（hue=75）
5. **DON'T**: 过度使用色彩 — amber 为主角，大面积用 neutral
6. **DON'T**: `hsl()` 包裹 oklch 变量

---

## 2. iframe 通信协议（postMessage）

### 消息类型定义

```typescript
// Parent (Desktop App) → iframe (Page)
type ParentToPageMessage =
  | { type: "viben-page-theme"; theme: "light" | "dark" }
  | { type: "viben-page-accent"; colors: Record<string, string> }
  | { type: "viben-page-init"; theme: "light" | "dark"; workspace_path: string }

// iframe (Page) → Parent (Desktop App)
type PageToParentMessage =
  | { type: "viben-page-ready" }
  | { type: "viben-page-resize"; height: number }
```

### 通信时序

```
Desktop App                         iframe Page
    |                                    |
    |  iframe src=".../serve?slug=x&theme=dark"
    |------------------------------------→|
    |                                    |  (HTML 加载, SDK 读取 URL ?theme)
    |                                    |  (立即应用主题, 防 FOUC)
    |                                    |
    |       { type: "viben-page-ready" } |
    |←------------------------------------|
    |                                    |
    |  { type: "viben-page-init",        |
    |    theme: "dark",                  |
    |    workspace_path: "/path/..." }   |
    |------------------------------------→|
    |                                    |
    |  ... 用户切换主题 ...               |
    |                                    |
    |  { type: "viben-page-theme",       |
    |    theme: "light" }                |
    |------------------------------------→|
    |                                    |  (平滑过渡 .dark → :root)
```

### 防 FOUC 策略（三层）

1. **URL query param**：`&theme=dark` — SDK 立即从 `location.search` 读取
2. **内联 script**（`<head>` 最前）：
   ```html
   <script>
   (function(){
     var t = new URLSearchParams(location.search).get('theme');
     if (t === 'dark') document.documentElement.classList.add('dark');
   })();
   </script>
   ```
3. **`prefers-color-scheme`**：无 SDK 时降级到系统偏好

### 安全约束

- 父 App 仅向同源 iframe 发送消息
- Page SDK 校验 `event.origin`
- 不传递 token/credential，只传 theme + workspace 元信息

---

## 3. viben-page-sdk.js

### API

```javascript
window.VibenPage = {
  theme: "dark" | "light",
  onThemeChange(callback): unsubscribe,
  workspacePath: string | null,
  async fetch(path, options): Response,
};
```

### 实现

```javascript
(function () {
  "use strict";

  var VP = {};
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
      // 平滑过渡
      doc.classList.add("vp-transitioning");
      setTimeout(function() { doc.classList.remove("vp-transitioning"); }, 300);
      listeners.forEach(function (fn) { fn(theme); });
    }
  }

  // 3. 监听父 App 消息
  window.addEventListener("message", function (e) {
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

  // 5. 通知父 App 已就绪
  if (window.parent !== window) {
    window.parent.postMessage({ type: "viben-page-ready" }, "*");
  }

  // 6. 公开 API
  VP.onThemeChange = function (fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  };
  VP.workspacePath = null;
  VP.fetch = function (path, options) {
    return fetch(location.origin + path, options);
  };

  window.VibenPage = VP;
})();
```

### 主题过渡 CSS（内嵌在 tokens.css 末尾）

```css
html.vp-transitioning * {
  transition: background-color 0.3s ease, color 0.2s ease, border-color 0.3s ease !important;
}
```

### 分发

- `GET /_sdk/viben-page-sdk.js` — Gateway 路由
- `GET /_sdk/viben-page-tokens.css` — Gateway 路由

---

## 4. SKILL.md 内容结构

### 角色

决策入口（~180 行）。根据场景引导 AI 选择加载哪些 references。

### 大纲

1. **快速流程**：确定类型 → 创建目录 → 引入 SDK → 构建内容
2. **页面类型表**：static / markdown / server / proxy
3. **场景决策树**：需求 → 对应 reference 文件节
4. **基础 HTML 模板**：包含 SDK + tokens + 结构
5. **SKILL.md frontmatter 格式**：四种类型示例
6. **CLI 命令**：`viben page create`
7. **核心规则**：
   - 必须引入 SDK
   - 使用 CSS 变量，禁止硬编码颜色
   - 标题 serif / 正文 sans / 数值 mono
   - `overflow: auto` 用于可滚动页面
   - `prefers-reduced-motion` 尊重
   - 最小对比度 4.5:1

### References 分配

| 文件 | 内容 | 行数 |
|------|------|------|
| `references/design-system.md` | 完整 CSS tokens + 色彩规则 + 字体 + 反模式 | ~150 |
| `references/patterns.md` | Dashboard / Form / Landing / Table 布局模式 | ~250 |
| `references/interactions.md` | 动效 + 状态 UI + a11y + 主题过渡 | ~150 |
| `references/libraries.md` | CDN 库清单 + 暗色主题配置片段 | ~100 |

---

## 5. Desktop App 代码改动

### StaticPagePreview

**文件**：`apps/desktop/src/pages/apps/components/static-page-preview.tsx`

- iframe src 追加 `&theme=${resolvedTheme}`
- 添加 `useRef` + `useTheme` + `useEffect` 监听
- 监听 `viben-page-ready` → 回复 `viben-page-init`
- 监听 `resolvedTheme` 变化 → 发送 `viben-page-theme`

### Gateway SDK 路由

**文件**：`packages/core/src/gateway/routes/page.ts`

追加：
```typescript
GET /_sdk/viben-page-sdk.js  → serve packages/core/assets/viben-page-sdk.js
GET /_sdk/viben-page-tokens.css → serve packages/core/assets/viben-page-tokens.css
```

### 新建文件

| 路径 | 内容 |
|------|------|
| `packages/core/assets/viben-page-sdk.js` | SDK（~60 行） |
| `packages/core/assets/viben-page-tokens.css` | Design tokens（~120 行） |

---

## 6. 改动范围汇总

| 文件 | 类型 | 行数 |
|------|------|------|
| `apps/desktop/.../static-page-preview.tsx` | 修改 | +30 |
| `packages/core/src/gateway/routes/page.ts` | 追加 | +20 |
| `packages/core/assets/viben-page-sdk.js` | 新建 | ~60 |
| `packages/core/assets/viben-page-tokens.css` | 新建 | ~120 |
| `.claude/skills/create-page/SKILL.md` | 重写 | ~180 |
| `.claude/skills/create-page/references/design-system.md` | 新建 | ~150 |
| `.claude/skills/create-page/references/patterns.md` | 新建 | ~250 |
| `.claude/skills/create-page/references/interactions.md` | 新建 | ~150 |
| `.claude/skills/create-page/references/libraries.md` | 新建 | ~100 |

**总计**：~1060 行新增/修改

---

## 7. 实现顺序

1. **Phase 1**：创建 `packages/core/assets/` 下的 SDK + CSS tokens
2. **Phase 2**：Gateway 新增 `/_sdk/*` 路由
3. **Phase 3**：修改 `StaticPagePreview` 组件（postMessage 通信）
4. **Phase 4**：重写 `.claude/skills/create-page/` 全部文件
5. **Phase 5**：验证 — 创建测试页面确认主题同步生效
