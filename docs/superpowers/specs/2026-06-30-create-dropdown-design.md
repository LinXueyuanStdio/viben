# 顶部导航「+」创建下拉菜单

**日期**: 2026-06-30  
**状态**: 设计中  
**范围**: `apps/web`

## 概述

在 apps/web 的 Topbar 右上角添加一个「+」下拉菜单按钮，允许用户从任意页面快速导航到创建入口：发布动态、创建页面、发布 MCP、创建 Skill。

## 交互设计

- 使用 shadcn `DropdownMenu` + `IconButton`（`Plus` 图标）
- 点击触发（非 hover），符合无障碍标准
- 每个菜单项点击后通过 `router.push()` 导航到对应页面
- 仅对已登录用户显示

## 位置

Topbar 右侧区域，`LanguageSwitcher` 之前：

```
[LanguageSwitcher] [ThemeToggle] [Bell] [Clock] [UserMenu]           ← 当前
[+ Create] [LanguageSwitcher] [ThemeToggle] [Bell] [Clock] [UserMenu] ← 目标
```

## 组件结构

```
CreateDropdown (新组件: components/layout/create-dropdown.tsx)
├── DropdownMenu (shadcn)
│   ├── DropdownMenuTrigger → IconButton(size="compact") + Plus icon
│   └── DropdownMenuContent (align="end")
│       ├── DropdownMenuItem → 发布动态   → /moment
│       ├── DropdownMenuItem → 创建页面   → /pages/new
│       ├── DropdownMenuSeparator
│       ├── DropdownMenuItem → 发布 MCP   → /publish?type=mcp
│       └── DropdownMenuItem → 创建 Skill → /publish?type=skill
```

## 菜单项定义

| 菜单项 | 图标 (lucide-react) | 导航目标 | 目标页面状态 |
|--------|--------------------|---------|------------|
| 发布动态 | `MessageSquareText` | `/moment` | ✅ 已存在（顶部有 Composer） |
| 创建页面 | `FilePlus2` | `/pages/new` | 🆕 需新建（本次创建占位页） |
| 发布 MCP | `Package` | `/publish?type=mcp` | ✅ 已存在（PublishWizard） |
| 创建 Skill | `Wand` | `/publish?type=skill` | ✅ 已存在（PublishWizard） |

## 文件变更

### 修改
- `apps/web/components/layout/topbar.tsx` — 在 `<LanguageSwitcher />` 前插入 `<CreateDropdown />`（仅 session 存在时渲染）
- `apps/web/lib/i18n/locales/zh-CN.json` — 添加 `nav.create`, `nav.postMoment`, `nav.createPage`, `nav.publishMcp`, `nav.createSkill`
- `apps/web/lib/i18n/locales/en.json` — 同上英文翻译

### 新增
- `apps/web/components/layout/create-dropdown.tsx` — CreateDropdown 客户端组件

### 不在本次范围内（后续迭代）
- 「创建页面」完整编辑器 — `/pages/new` 先放一个占位页，后续单独实现

## i18n

```json
// zh-CN 新增
{
  "nav": {
    "create": "创建",
    "postMoment": "发布动态",
    "createPage": "创建页面",
    "publishMcp": "发布 MCP",
    "createSkill": "创建 Skill"
  }
}

// en 新增
{
  "nav": {
    "create": "Create",
    "postMoment": "Post Moment",
    "createPage": "Create Page",
    "publishMcp": "Publish MCP",
    "createSkill": "Create Skill"
  }
}
```

## 与现有模式的兼容

- `IconButton` 已在 topbar 大量使用（`size="compact"`）
- `DropdownMenu` 已被 `UserMenu`、`ThemeToggle`、`LanguageSwitcher` 使用
- 仅对已登录用户显示（与 `NavPopover`、`UserMenu` 一致）
- 阅读模式（`isRead`）下不显示，因阅读模式有独立的 `ReadMoreMenu`
