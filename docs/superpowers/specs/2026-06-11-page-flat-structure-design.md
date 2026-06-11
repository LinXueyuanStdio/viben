# Page 模块重构：扁平化目录结构

## 概述

将 `packages/core/src/page` 的嵌套目录结构改为扁平结构，嵌套关系由 `index.json` 管理。

## 目标

- 简化目录结构，消除目录嵌套
- 嵌套关系与物理存储解耦
- 保持 API 契约基本不变，前端改动最小

## 目录结构

### 旧结构

```
workspace/pages/
├── parent/
│   ├── SKILL.md
│   └── child/
│       └── SKILL.md
└── .page-order.json
```

### 新结构

```
workspace/pages/
├── index.json              # 嵌套关系 + 排序
├── 0611-parent/
│   ├── PAGE.md
│   └── _assets/
└── 0611-child/
    └── PAGE.md
```

## index.json 格式

邻接表结构，key 为父节点（`root` 表示顶级），value 为子节点 uid 数组：

```json
{
  "root": ["0611-intro", "0611-guide"],
  "0611-intro": ["0611-child"]
}
```

## UID 生成规则

格式：`mmdd-{slug}` 或 `mmdd-{nanoid(6)}`

```typescript
function generatePageUid(slug?: string): string {
  const mmdd = new Date().toISOString().slice(5, 10).replace('-', '');
  if (slug) {
    return `${mmdd}-${slug}`;
  }
  return `${mmdd}-${nanoid(6)}`;
}
```

示例：
- 用户提供 slug `intro` → `0611-intro`
- 用户不提供 slug → `0611-V1StGX`

## URL 路由

| 变更 | 旧 | 新 |
|------|----|----|
| 路由模式 | `/workspace/:workspaceId/pages/:slug+` | `/workspace/:workspaceId/page/:uid` |
| 示例 | `/workspace/abc/pages/parent/child` | `/workspace/abc/page/0611-child` |

## PAGE.md 格式

与原 SKILL.md 格式完全一致，仅文件名变更：

```yaml
---
page:
  type: markdown
  permission: [read, write]
name: "页面名称"
description: "描述"
icon:
  type: lucide
  value: file-text
---

# 页面内容
```

## 核心类型变更

### types.ts

```typescript
// 新增：index.json 结构
export interface PageIndex {
  [parentKey: string]: string[];  // "root" | uid -> uid[]
}

// PageConfigBase 变更
interface PageConfigBase {
  uid: string;           // 新增：目录名
  // slug: string;       // 删除
  name: string;
  description?: string;
  icon?: IconData;
  cover?: string;
  page_width?: PageWidth;
  show_toc?: boolean;
  permission: PagePermission[];
  path: string;
  skill_content?: string;
  updated_at?: string;
}

// ListPagesResult 变更
export interface ListPagesResult extends PageResult {
  pages: PageConfig[];
  count: number;
  index: PageIndex;      // 替代 page_order
  // page_order?: PageOrderData;  // 删除
}
```

## API 变更

### discovery.ts

```typescript
// 旧：递归扫描目录
async function discoverPages(dir, workspacePath): Promise<PageConfig[]>
async function listPagesInWorkspace(workspacePath): Promise<PageConfig[]>

// 新：读取 index.json + 遍历 uid
async function listPagesInWorkspace(workspacePath): Promise<{
  pages: PageConfig[];
  index: PageIndex;
}>
```

### crud.ts

| 函数 | 变更说明 |
|------|----------|
| `createPage` | 生成 uid，创建 `pages/{uid}/PAGE.md`，更新 index.json |
| `deletePage` | 参数从 slug 改为 uid，删除目录，从 index.json 移除 |
| `duplicatePage` | 生成新 uid，复制目录，更新 index.json |
| `viewPage` | 参数从 slug 改为 uid |
| `getPageOrder` | 删除，嵌套关系已在 index.json 中 |
| `reorderPages` | 直接操作 index.json |

## 前端变更

### 路由注册

```typescript
// 旧
"/workspace/:workspaceId/pages/:pageSlug+"

// 新
"/workspace/:workspaceId/page/:uid"
```

### page-tree.ts

```typescript
// 旧：从 slug 路径推导父子关系
export function buildPageTree(pages: PageConfig[], orderMap?: PageOrderMap): PageTreeNode[]

// 新：直接使用 index 构建树
export function buildPageTree(pages: PageConfig[], index: PageIndex): PageTreeNode[]
```

实现逻辑：

```typescript
function buildPageTree(pages: PageConfig[], index: PageIndex): PageTreeNode[] {
  const pageMap = new Map(pages.map(p => [p.uid, p]));
  const usedUids = new Set<string>();
  
  function buildNodes(uids: string[]): PageTreeNode[] {
    return uids
      .map(uid => {
        const page = pageMap.get(uid);
        if (!page) return null;
        usedUids.add(uid);
        return {
          page,
          children: buildNodes(index[uid] ?? [])
        };
      })
      .filter(Boolean);
  }
  
  const tree = buildNodes(index.root ?? []);
  
  // 容错：index 中没有的页面追加到 root 末尾
  for (const page of pages) {
    if (!usedUids.has(page.uid)) {
      tree.push({ page, children: [] });
    }
  }
  
  return tree;
}
```

### hooks/use-pages.ts

- 删除 `usePageOrder` hook（合并到 `usePages` 返回值）
- `usePages` 返回 `{ pages, index }` 而非 `{ pages, page_order }`

## 迁移脚本

位置：`scripts/migrate-pages.ts`

执行方式：
```bash
pnpm tsx scripts/migrate-pages.ts /path/to/workspace
```

迁移步骤：
1. 递归扫描旧结构，找所有 `SKILL.md`
2. 为每个页面生成 uid（取 slug 最后一段）
3. 移动目录到扁平结构，重命名 `SKILL.md` → `PAGE.md`
4. 从嵌套路径推导 `index.json`
5. 写入 `index.json`，删除 `.page-order.json`

注意：`packages/core` 不做旧格式兼容，未迁移的 workspace 返回空页面列表。

## 影响范围

### packages/core/src/page/ops/

- `types.ts` - 类型定义变更
- `discovery.ts` - 页面发现逻辑重写
- `crud.ts` - CRUD 操作适配新结构

### apps/desktop/src/

- `hooks/use-pages.ts` - 删除 usePageOrder，适配新返回值
- `pages/apps/utils/page-tree.ts` - buildPageTree 逻辑简化
- `components/layout/page-section.tsx` - 适配新类型
- 路由配置 - `/pages/:slug+` → `/page/:uid`
- `lib/gateway/` - 类型和 API 适配

### scripts/

- 新增 `migrate-pages.ts`
