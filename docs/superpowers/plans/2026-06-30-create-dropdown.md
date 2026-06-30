# 顶部导航「+」创建下拉菜单 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 apps/web Topbar 右上角添加「+」下拉菜单，提供发布动态、创建页面、发布 MCP、创建 Skill 四个导航入口。

**Architecture:** 新增 `CreateDropdown` 客户端组件，使用 shadcn `DropdownMenu` + lucide `Plus` 图标。组件嵌入 `Topbar` 右侧区域 `LanguageSwitcher` 之前，仅对已登录用户显示。菜单项通过 `router.push()` 导航到对应页面。

**Tech Stack:** Next.js App Router, React, shadcn/ui (DropdownMenu), lucide-react, react-i18next

## Global Constraints

- 所有 API 查询参数和文件存储使用 **snake_case** 命名
- 禁止 `import("path").TypeName` 内联 import type 语法
- 禁止动态 import (`await import()`)
- Tailwind v4：`data-[state=active]:` 变体在 CVA 中不可靠；不要用 `hsl()` 包裹 oklch CSS 变量
- 编辑文件时使用绝对路径
- 仅对登录用户显示创建入口

---

### Task 1: 添加 i18n 翻译键

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\i18n\locales\zh-CN.json`
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\i18n\locales\en.json`

**Interfaces:**
- Produces: `nav.create`, `nav.postMoment`, `nav.createPage`, `nav.publishMcp`, `nav.createSkill` translation keys

- [ ] **Step 1: 在 zh-CN.json 的 `nav` 区块添加翻译**

在 `"nav"` 对象（约第 54 行）的 `"publish"` 之后添加以下键：

```json
"create": "创建",
"postMoment": "发布动态",
"createPage": "创建页面",
"publishMcp": "发布 MCP",
"createSkill": "创建 Skill"
```

- [ ] **Step 2: 在 en.json 的 `nav` 区块添加翻译**

在 `"nav"` 对象中 `"publish"` 之后添加：

```json
"create": "Create",
"postMoment": "Post Moment",
"createPage": "Create Page",
"publishMcp": "Publish MCP",
"createSkill": "Create Skill"
```

- [ ] **Step 3: 验证 JSON 语法有效**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben && node -e "JSON.parse(require('fs').readFileSync('apps/web/lib/i18n/locales/zh-CN.json','utf8'));console.log('zh-CN OK')" && node -e "JSON.parse(require('fs').readFileSync('apps/web/lib/i18n/locales/en.json','utf8'));console.log('en OK')"
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/i18n/locales/zh-CN.json apps/web/lib/i18n/locales/en.json
git commit -m "feat(i18n): add create dropdown navigation keys"
```

---

### Task 2: 创建 CreateDropdown 组件

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\layout\create-dropdown.tsx`

**Interfaces:**
- Produces: `CreateDropdown` 组件（无 props，纯客户端组件）

- [ ] **Step 1: 创建组件文件**

```tsx
"use client"

import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { FilePlus2, MessageSquareText, Package, Plus, Wand } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function CreateDropdown() {
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title={t("nav.create")}>
          <Plus className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t("nav.create")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => router.push("/moment")}>
          <MessageSquareText className="mr-2 h-4 w-4" />
          {t("nav.postMoment")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/pages/new")}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          {t("nav.createPage")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/publish?type=mcp")}>
          <Package className="mr-2 h-4 w-4" />
          {t("nav.publishMcp")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/publish?type=skill")}>
          <Wand className="mr-2 h-4 w-4" />
          {t("nav.createSkill")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/create-dropdown.tsx
git commit -m "feat: add CreateDropdown component with four quick-navigation items"
```

---

### Task 3: 在 Topbar 中集成 CreateDropdown

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\layout\topbar.tsx`

**Interfaces:**
- Consumes: `CreateDropdown` from `./create-dropdown`
- Produces: 已登录用户的 Topbar 中显示创建按钮

- [ ] **Step 1: 导入 CreateDropdown**

在 topbar.tsx 顶部 import 区域（约第 15 行 `import { UserMenu }` 之后）添加：

```tsx
import { CreateDropdown } from "./create-dropdown"
```

- [ ] **Step 2: 在 default 模式的右侧区域插入 CreateDropdown**

在约第 188 行 `<LanguageSwitcher />` 之前插入 `<CreateDropdown />`。只需在 `session` 存在的分支中渲染：

修改如下（在 `<LanguageSwitcher />` 前插入）：

```tsx
{/* 默认模式操作 */}
{session && <CreateDropdown />}
<LanguageSwitcher />
```

即在第 186 行 `<>` 之后、第 188 行 `<LanguageSwitcher />` 之前，添加：

```tsx
{session && <CreateDropdown />}
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/topbar.tsx
git commit -m "feat: integrate CreateDropdown into topbar for authenticated users"
```

---

### Task 4: 创建 /pages/new 占位页面

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(dashboard)\pages\new\page.tsx`

**Interfaces:**
- Produces: `/pages/new` 路由，显示占位页面，提示用户即将推出完整页面编辑器

- [ ] **Step 1: 创建占位页面**

```tsx
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { T } from "@/components/content/i18n-text"

export const dynamic = "force-dynamic"

export default async function NewPagePage() {
  const session = await getSession()

  if (!session?.userId) {
    redirect("/login")
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          <T tKey="nav.createPage" fallback="创建页面" />
        </h1>
        <p className="text-muted-foreground">
          页面编辑器即将推出，敬请期待。
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">
          完整页面编辑器正在开发中。您将能够创建静态 HTML 页面、Markdown 文档、代理页面等。
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/pages/new/page.tsx
git commit -m "feat: add placeholder /pages/new route for upcoming page editor"
```

---

### Task 5: 最终验证

- [ ] **Step 1: 再次确认 TypeScript 编译通过**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

Expected: No errors.

- [ ] **Step 2: 手动验证清单**

启动开发服务器后验证：
1. ✅ 已登录用户可在 Topbar 右上角看到 `+` 按钮（LanguageSwitcher 左侧）
2. ✅ 点击 `+` 按钮弹出下拉菜单，显示四个选项
3. ✅ 点击「发布动态」跳转到 `/moment`
4. ✅ 点击「创建页面」跳转到 `/pages/new` 占位页
5. ✅ 点击「发布 MCP」跳转到 `/publish?type=mcp`
6. ✅ 点击「创建 Skill」跳转到 `/publish?type=skill`
7. ✅ 未登录用户看不到 `+` 按钮
8. ✅ 阅读模式下不显示 `+` 按钮（因 `isRead` 分支走不同的渲染路径）
