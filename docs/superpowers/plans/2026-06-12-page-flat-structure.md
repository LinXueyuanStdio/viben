# Page 模块扁平化重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 page 模块从嵌套目录结构改为 index.json + pages/{uid}/PAGE.md 扁平结构

**Architecture:** 嵌套关系由 index.json 邻接表管理，uid 格式为 mmdd-slug，URL 从 /pages/:slug 改为 /page/:uid

**Tech Stack:** TypeScript, gray-matter, nanoid

---

## Task 1: 更新 packages/core 类型定义

**Files:**
- Modify: `packages/core/src/page/ops/types.ts`

- [ ] **Step 1: 添加 PageIndex 类型，修改 PageConfigBase**

```typescript
// 新增 PageIndex 类型
export interface PageIndex {
  [parentKey: string]: string[];  // "root" | uid -> uid[]
}

// PageConfigBase: slug -> uid
interface PageConfigBase {
  uid: string;           // 新增
  // slug: string;       // 删除此行
  name: string;
  // ... 其他字段不变
}
```

- [ ] **Step 2: 修改 ListPagesResult**

```typescript
export interface ListPagesResult extends PageResult {
  pages: PageConfig[];
  count: number;
  index: PageIndex;      // 替代 page_order
  // page_order?: PageOrderData;  // 删除此行
}
```

- [ ] **Step 3: 删除 PageOrderData 类型和相关 Reorder 类型中的 slug 引用**

将 `ReorderPagesOptions` 中的 `parent_slug` 和 `ordered_slugs` 改为 `parent_uid` 和 `ordered_uids`。

- [ ] **Step 4: 更新 index.ts 导出**

从 `packages/core/src/page/ops/index.ts` 导出 `PageIndex`，移除 `PageOrderData` 导出。

---

## Task 2: 重写 discovery.ts

**Files:**
- Modify: `packages/core/src/page/ops/discovery.ts`

- [ ] **Step 1: 新增常量和辅助函数**

```typescript
const PAGE_FILE = "PAGE.md";  // 替代 SKILL_FILE
const INDEX_FILE = "index.json";

// 读取 index.json
function readPageIndex(workspacePath: string): PageIndex {
  const indexPath = join(workspacePath, PAGES_DIR, INDEX_FILE);
  if (!existsSync(indexPath)) {
    return { root: [] };
  }
  return JSON.parse(readFileSync(indexPath, "utf-8"));
}
```

- [ ] **Step 2: 重写 parseSkillMd 为 parsePageMd**

```typescript
export async function parsePageMd(
  pageMdPath: string,
  uid: string
): Promise<PageConfig | null> {
  // 读取 PAGE.md，解析 frontmatter
  // 返回 PageConfig，uid 从参数传入而非从路径推导
}
```

- [ ] **Step 3: 重写 listPagesInWorkspace**

```typescript
export async function listPagesInWorkspace(workspacePath: string): Promise<{
  pages: PageConfig[];
  index: PageIndex;
}> {
  const index = readPageIndex(workspacePath);
  const pagesDir = join(workspacePath, PAGES_DIR);
  const pages: PageConfig[] = [];
  
  // 扫描 pages/ 下所有目录，读取 PAGE.md
  if (existsSync(pagesDir)) {
    for (const entry of readdirSync(pagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const uid = entry.name;
      const pageMdPath = join(pagesDir, uid, PAGE_FILE);
      const page = await parsePageMd(pageMdPath, uid);
      if (page) pages.push(page);
    }
  }
  
  return { pages, index };
}
```

- [ ] **Step 4: 重写 getPageBySlug 为 getPageByUid**

```typescript
export async function getPageByUid(
  workspacePath: string,
  uid: string
): Promise<PageConfig | null> {
  const pageMdPath = join(workspacePath, PAGES_DIR, uid, PAGE_FILE);
  return parsePageMd(pageMdPath, uid);
}
```

- [ ] **Step 5: 删除旧函数 discoverPages**

递归扫描已不再需要，删除 `discoverPages` 函数。

---

## Task 3: 重写 crud.ts

**Files:**
- Modify: `packages/core/src/page/ops/crud.ts`

- [ ] **Step 1: 添加 uid 生成函数和 index 操作函数**

```typescript
import { nanoid } from "nanoid";

const PAGE_FILE = "PAGE.md";
const INDEX_FILE = "index.json";

function generatePageUid(slug?: string): string {
  const mmdd = new Date().toISOString().slice(5, 10).replace("-", "");
  return slug ? `${mmdd}-${slug}` : `${mmdd}-${nanoid(6)}`;
}

function readPageIndex(workspacePath: string): PageIndex {
  const indexPath = join(workspacePath, PAGES_DIR, INDEX_FILE);
  if (!existsSync(indexPath)) return { root: [] };
  return JSON.parse(readFileSync(indexPath, "utf-8"));
}

function writePageIndex(workspacePath: string, index: PageIndex): void {
  const indexPath = join(workspacePath, PAGES_DIR, INDEX_FILE);
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n", "utf-8");
}
```

- [ ] **Step 2: 修改 listPages 返回 index**

```typescript
export async function listPages(options: ListPagesOptions): Promise<ListPagesResult> {
  const { workspace_path } = options;
  const { pages, index } = await listPagesInWorkspace(workspace_path);
  return { success: true, pages, count: pages.length, index };
}
```

- [ ] **Step 3: 修改 createPage 使用 uid**

```typescript
export interface CreatePageOptions {
  workspace_path: string;
  slug?: string;  // 可选，用于生成 uid
  name: string;
  parent_uid?: string;  // 新增：父页面 uid
  // ... 其他字段
}

export async function createPage(options: CreatePageOptions): Promise<CreatePageResult> {
  const uid = generatePageUid(options.slug);
  const pageDir = join(options.workspace_path, PAGES_DIR, uid);
  const pageMdPath = join(pageDir, PAGE_FILE);
  
  mkdirSync(pageDir, { recursive: true });
  // 写入 PAGE.md
  
  // 更新 index.json
  const index = readPageIndex(options.workspace_path);
  const parentKey = options.parent_uid ?? "root";
  index[parentKey] = index[parentKey] ?? [];
  index[parentKey].push(uid);
  writePageIndex(options.workspace_path, index);
  
  return { success: true, page: await getPageByUid(options.workspace_path, uid) };
}
```

- [ ] **Step 4: 修改 viewPage 和 deletePage 使用 uid**

```typescript
export interface ViewPageOptions {
  workspace_path: string;
  uid: string;  // slug -> uid
}

export interface DeletePageOptions {
  workspace_path: string;
  uid: string;  // slug -> uid
}

export async function deletePage(options: DeletePageOptions): Promise<DeletePageResult> {
  const { workspace_path, uid } = options;
  // 删除目录
  // 从 index.json 中移除（遍历所有 key，删除 uid）
  // 同时删除其子页面的引用 (index[uid])
}
```

- [ ] **Step 5: 修改 updatePageContent 和 updatePageConfig 使用 uid**

将参数中的 `slug` 改为 `uid`，路径从 `pages/{slug}/SKILL.md` 改为 `pages/{uid}/PAGE.md`。

- [ ] **Step 6: 修改 duplicatePage 使用 uid**

```typescript
export interface DuplicatePageOptions {
  workspace_path: string;
  uid: string;  // slug -> uid
}
// 生成新 uid，复制目录，更新 index.json
```

- [ ] **Step 7: 修改 reorderPages 直接操作 index.json**

```typescript
export interface ReorderPagesOptions {
  workspace_path: string;
  parent_uid: string | null;  // parent_slug -> parent_uid
  ordered_uids: string[];     // ordered_slugs -> ordered_uids
}
// 直接修改 index[parent_uid ?? "root"] = ordered_uids
```

- [ ] **Step 8: 删除 getPageOrder 函数**

嵌套关系已在 listPages 返回的 index 中，不再需要单独的 getPageOrder。

---

## Task 4: 更新 desktop gateway 类型

**Files:**
- Modify: `apps/desktop/src/lib/gateway/types/page.ts`
- Modify: `apps/desktop/src/lib/gateway/types/index.ts`
- Modify: `apps/desktop/src/lib/gateway/modules/pages.ts`

- [ ] **Step 1: 更新 page.ts 类型定义**

```typescript
// 新增
export interface PageIndex {
  [parentKey: string]: string[];
}

// PageConfigBase: slug -> uid
interface PageConfigBase {
  uid: string;  // 替代 slug
  name: string;
  // ...
}

// ListPagesResult
export interface ListPagesResult extends PageResult {
  pages: PageConfig[];
  count: number;
  index: PageIndex;  // 替代 page_order
}

// 删除 PageOrderData
// 更新 CreatePageParams, UpdatePageConfigParams 等中的 slug -> uid
```

- [ ] **Step 2: 更新 index.ts 导出**

导出 `PageIndex`，移除 `PageOrderData`。

- [ ] **Step 3: 更新 pages.ts API 函数参数**

```typescript
// viewPage: slug -> uid
export async function viewPage(baseUrl: string, workspacePath: string, uid: string)

// deletePage: slug -> uid
export async function deletePage(baseUrl: string, workspacePath: string, uid: string)

// updatePageContent: slug -> uid
export async function updatePageContent(baseUrl: string, workspacePath: string, uid: string, content: string)

// getPageServeUrl: slug -> uid
export function getPageServeUrl(baseUrl: string, workspacePath: string, uid: string, path?: string)
```

---

## Task 5: 更新 page-tree.ts

**Files:**
- Modify: `apps/desktop/src/pages/apps/utils/page-tree.ts`
- Modify: `apps/desktop/src/pages/apps/utils/index.ts`

- [ ] **Step 1: 重写 buildPageTree 函数**

```typescript
import type { PageConfig, PageIndex } from "@/lib/gateway/types/page";

export interface PageTreeNode {
  page: PageConfig;
  children: PageTreeNode[];
}

export function buildPageTree(pages: PageConfig[], index: PageIndex): PageTreeNode[] {
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
          children: buildNodes(index[uid] ?? []),
        };
      })
      .filter((n): n is PageTreeNode => n !== null);
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

- [ ] **Step 2: 删除 PageOrderMap 类型和 sortNodes 函数**

不再需要单独的排序逻辑，顺序由 index 数组顺序决定。

- [ ] **Step 3: 更新 index.ts 导出**

移除 `PageOrderMap` 导出。

---

## Task 6: 更新路由和 hooks

**Files:**
- Modify: `apps/desktop/src/navigation/route-registry.ts`
- Modify: `apps/desktop/src/pages/apps/utils/page-href.ts`
- Modify: `apps/desktop/src/hooks/use-pages.ts`
- Modify: `apps/desktop/src/hooks/use-desktop-routing.ts`

- [ ] **Step 1: 更新 route-registry.ts 路由模式**

```typescript
// 旧
{ pattern: "/workspace/:workspaceId/pages/:pageSlug+", ... }

// 新
{ pattern: "/workspace/:workspaceId/page/:uid", icon: { type: "lucide", value: "file-text" }, title: (p) => p.uid, dropdownCategory: "page" },
```

- [ ] **Step 2: 更新 page-href.ts**

```typescript
export function getPageHref(workspaceId: string, uid: string): string {
  return `/workspace/${encodeURIComponent(workspaceId)}/page/${encodeURIComponent(uid)}`;
}
```

- [ ] **Step 3: 更新 use-pages.ts**

```typescript
// 删除 usePageOrder hook

// 修改 usePages 返回 index
export function usePages(workspacePath: string | undefined) {
  return useQuery({
    queryKey: pageKeys.list(workspacePath ?? ""),
    queryFn: () => listPagesApi(getGatewayUrl(), workspacePath!),
    enabled: !!workspacePath,
  });
  // 不再 select: data.pages，返回完整 { pages, index, count }
}

// 新增 usePagesWithIndex hook 方便使用
export function usePagesWithIndex(workspacePath: string | undefined) {
  const query = usePages(workspacePath);
  return {
    ...query,
    pages: query.data?.pages,
    index: query.data?.index,
  };
}

// 更新 usePage 参数: slug -> uid
export function usePage(workspacePath: string | undefined, uid: string | undefined)

// 更新 mutations 中的 slug -> uid
```

- [ ] **Step 4: 更新 use-desktop-routing.ts**

```typescript
// openWorkspacePage 参数: pageSlug -> uid
openWorkspacePage: (workspaceId: string, uid: string, options?) => void;

// pushCurrentPageChild 参数: pageSlug -> uid
pushCurrentPageChild: (uid: string, options?) => void;
```

---

## Task 7: 更新 page-section.tsx 和其他组件

**Files:**
- Modify: `apps/desktop/src/components/layout/page-section.tsx`
- Modify: `apps/desktop/src/pages/apps/components/create-page-dialog.tsx`
- Modify: `apps/desktop/src/pages/apps/components/edit-page-dialog.tsx`
- Modify: `apps/desktop/src/components/navigation/desktop-breadcrumb-bar.tsx`

- [ ] **Step 1: 更新 page-section.tsx 中的 slug 引用为 uid**

```typescript
// 所有 node.page.slug -> node.page.uid
// 所有 page.slug -> page.uid
// onCreateSubpage(node.page.slug) -> onCreateSubpage(node.page.uid)
// useSortable({ id: props.node.page.slug }) -> useSortable({ id: props.node.page.uid })
```

- [ ] **Step 2: 更新 buildPageTree 调用**

```typescript
// 旧
const pageTree = useMemo(() => buildPageTree(pages, effectiveOrder), [...]);

// 新
const { pages, index } = usePagesWithIndex(workspacePath);
const pageTree = useMemo(() => buildPageTree(pages ?? [], index ?? {}), [pages, index]);
```

- [ ] **Step 3: 更新 reorder 逻辑**

```typescript
// parent_slug -> parent_uid
// ordered_slugs -> ordered_uids
reorderPages({
  workspace_path: workspacePath,
  parent_uid: parentNode?.page.uid ?? null,
  ordered_uids: newUids,
});
```

- [ ] **Step 4: 更新 create-page-dialog.tsx**

```typescript
// 参数变更
interface CreatePageDialogProps {
  parentUid?: string;  // parentSlug -> parentUid
}
// createPage 调用时传入 parent_uid
```

- [ ] **Step 5: 更新 edit-page-dialog.tsx 和其他使用 slug 的组件**

全局搜索 `.slug` 引用，替换为 `.uid`。

---

## Task 8: 编写迁移脚本

**Files:**
- Create: `scripts/migrate-pages.ts`

- [ ] **Step 1: 创建脚本框架**

```typescript
#!/usr/bin/env tsx
/**
 * 迁移脚本：将旧的嵌套 pages 结构迁移到新的扁平结构
 * 
 * 用法: pnpm tsx scripts/migrate-pages.ts /path/to/workspace
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, renameSync, mkdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";

const PAGES_DIR = "pages";
const OLD_SKILL_FILE = "SKILL.md";
const NEW_PAGE_FILE = "PAGE.md";
const INDEX_FILE = "index.json";
const OLD_ORDER_FILE = ".page-order.json";

interface PageIndex {
  [parentKey: string]: string[];
}

interface OldPage {
  slug: string;
  path: string;
  name: string;
}
```

- [ ] **Step 2: 实现旧结构扫描函数**

```typescript
function discoverOldPages(dir: string, basePath: string): OldPage[] {
  const pages: OldPage[] = [];
  if (!existsSync(dir)) return pages;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    
    const subDir = join(dir, entry.name);
    const skillPath = join(subDir, OLD_SKILL_FILE);
    
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, "utf-8");
      const { data } = matter(content);
      const slug = relative(basePath, subDir).replace(/\\/g, "/");
      pages.push({ slug, path: subDir, name: data.name ?? entry.name });
    }
    
    // 递归扫描子目录
    pages.push(...discoverOldPages(subDir, basePath));
  }
  return pages;
}
```

- [ ] **Step 3: 实现 uid 生成和迁移函数**

```typescript
function generateUid(slug: string): string {
  const mmdd = new Date().toISOString().slice(5, 10).replace("-", "");
  const lastSegment = slug.split("/").pop()!;
  return `${mmdd}-${lastSegment}`;
}

function migrateWorkspace(workspacePath: string): void {
  const pagesDir = join(workspacePath, PAGES_DIR);
  if (!existsSync(pagesDir)) {
    console.log("No pages directory found, skipping.");
    return;
  }

  // 检查是否已迁移
  if (existsSync(join(pagesDir, INDEX_FILE))) {
    console.log("Already migrated (index.json exists), skipping.");
    return;
  }

  const oldPages = discoverOldPages(pagesDir, pagesDir);
  if (oldPages.length === 0) {
    console.log("No pages found to migrate.");
    return;
  }

  console.log(`Found ${oldPages.length} pages to migrate.`);

  // 生成 slug -> uid 映射
  const slugToUid = new Map<string, string>();
  for (const page of oldPages) {
    slugToUid.set(page.slug, generateUid(page.slug));
  }

  // 构建 index.json
  const index: PageIndex = { root: [] };
  for (const page of oldPages) {
    const uid = slugToUid.get(page.slug)!;
    const parts = page.slug.split("/");

    if (parts.length === 1) {
      index.root.push(uid);
    } else {
      const parentSlug = parts.slice(0, -1).join("/");
      const parentUid = slugToUid.get(parentSlug);
      if (parentUid) {
        index[parentUid] = index[parentUid] ?? [];
        index[parentUid].push(uid);
      } else {
        index.root.push(uid);
      }
    }
  }

  // 移动目录并重命名文件
  // 先从深层目录开始，避免路径冲突
  const sortedPages = [...oldPages].sort((a, b) => b.slug.length - a.slug.length);
  
  for (const page of sortedPages) {
    const uid = slugToUid.get(page.slug)!;
    const newDir = join(pagesDir, uid);
    
    // 移动目录
    renameSync(page.path, newDir);
    
    // 重命名 SKILL.md -> PAGE.md
    const oldSkillPath = join(newDir, OLD_SKILL_FILE);
    const newPagePath = join(newDir, NEW_PAGE_FILE);
    if (existsSync(oldSkillPath)) {
      renameSync(oldSkillPath, newPagePath);
    }
    
    console.log(`Migrated: ${page.slug} -> ${uid}`);
  }

  // 写入 index.json
  writeFileSync(join(pagesDir, INDEX_FILE), JSON.stringify(index, null, 2) + "\n");
  console.log("Created index.json");

  // 删除旧的 .page-order.json
  const oldOrderPath = join(pagesDir, OLD_ORDER_FILE);
  if (existsSync(oldOrderPath)) {
    rmSync(oldOrderPath);
    console.log("Removed .page-order.json");
  }

  console.log("Migration complete!");
}
```

- [ ] **Step 4: 添加主函数和错误处理**

```typescript
function main() {
  const workspacePath = process.argv[2];
  
  if (!workspacePath) {
    console.error("Usage: pnpm tsx scripts/migrate-pages.ts <workspace-path>");
    process.exit(1);
  }

  if (!existsSync(workspacePath)) {
    console.error(`Workspace not found: ${workspacePath}`);
    process.exit(1);
  }

  try {
    migrateWorkspace(workspacePath);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 5: 测试迁移脚本**

```bash
# 创建测试 workspace
mkdir -p /tmp/test-workspace/pages/parent/child
echo '---\nname: Parent\npage:\n  type: markdown\n---\n# Parent' > /tmp/test-workspace/pages/parent/SKILL.md
echo '---\nname: Child\npage:\n  type: markdown\n---\n# Child' > /tmp/test-workspace/pages/parent/child/SKILL.md

# 运行迁移
pnpm tsx scripts/migrate-pages.ts /tmp/test-workspace

# 验证结果
ls /tmp/test-workspace/pages/
cat /tmp/test-workspace/pages/index.json
```
