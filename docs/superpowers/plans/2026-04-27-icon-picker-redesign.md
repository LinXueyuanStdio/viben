# Icon Picker Redesign — Notion-like 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 icon picker 从简陋的分类浏览升级为 Notion 级别体验：emoji-mart 完整 emoji 集 + 全量 1500+ Lucide 异步加载 + 搜索 + 随机推荐 + 移除图标

**Architecture:** Emoji tab 用 `@emoji-mart/react` 替代手写数据；Lucide tab 用 `dynamicIconImports` 异步加载全量图标 + `@tanstack/react-virtual` 虚拟滚动；主组件扩展随机/移除按钮和智能默认 tab；`IconDisplay` 新增动态 fallback 渲染非静态图标。

**Tech Stack:** React 19, lucide-react 1.8, @emoji-mart/react, @emoji-mart/data, @tanstack/react-virtual, Tailwind CSS 4, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-27-icon-picker-redesign.md`

---

## 文件结构总览

| 操作 | 文件路径 | 职责 |
|------|---------|------|
| 改 | `apps/desktop/package.json` | 新增 3 个依赖 |
| 新增 | `apps/desktop/src/components/ui/icon-picker/icon-cache.ts` | 模块级图标缓存 + 动态加载函数 |
| 新增 | `apps/desktop/src/components/ui/icon-picker/dynamic-lucide-icon.tsx` | 按需渲染单个 Lucide 图标 |
| 新增 | `apps/desktop/src/components/ui/icon-picker/hooks/use-lucide-icons.ts` | 全量图标搜索 + 分类 + 批量加载 |
| 新增 | `apps/desktop/src/components/ui/icon-picker/emoji-mart.css` | emoji-mart 主题适配样式 |
| 改 | `apps/desktop/src/components/ui/icon-picker/types.ts` | 新增 VirtualRow 等类型 |
| 改 | `apps/desktop/src/components/ui/icon-picker/constants.ts` | 重命名分类 + Other 兜底 |
| 重写 | `apps/desktop/src/components/ui/icon-picker/tabs/emoji-tab.tsx` | emoji-mart 集成 |
| 重写 | `apps/desktop/src/components/ui/icon-picker/tabs/lucide-tab.tsx` | 全量异步 + 搜索 + 虚拟滚动 |
| 改 | `apps/desktop/src/components/ui/icon-picker/tabs/image-tab.tsx` | 去正方形限制 + 预览 |
| 改 | `apps/desktop/src/components/ui/icon-picker/hooks/use-image-upload.ts` | 跳过 validateImageDimensions |
| 改 | `apps/desktop/src/components/ui/icon-picker/icon-display.tsx` | DynamicLucideIcon fallback |
| 改 | `apps/desktop/src/components/ui/icon-picker/icon-picker.tsx` | 新布局 + 随机/移除 + 智能tab |
| 改 | `apps/desktop/src/components/ui/icon-picker/index.ts` | 更新导出 |

---

### Task 1: 安装依赖 + Spike 验证

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: 安装新依赖**

```bash
cd apps/desktop && pnpm add @emoji-mart/react @emoji-mart/data @tanstack/react-virtual
```

- [ ] **Step 2: 验证 emoji-mart 在 React 19 下能正常 import**

在终端运行：

```bash
cd apps/desktop && node -e "
  import('@emoji-mart/react').then(m => console.log('emoji-mart/react OK:', Object.keys(m))).catch(e => console.error('FAIL:', e.message));
  import('@emoji-mart/data').then(m => console.log('emoji-mart/data OK:', typeof m.default)).catch(e => console.error('FAIL:', e.message));
"
```

Expected: 两行 OK 输出，无报错。如果 `@emoji-mart/react` 有 peerDependency 警告，在 `package.json` 中添加：

```json
"pnpm": {
  "peerDependencyRules": {
    "allowedVersions": {
      "@emoji-mart/react>react": ">=19"
    }
  }
}
```

- [ ] **Step 3: 验证 dynamicIconImports 可用**

```bash
cd apps/desktop && node -e "
  import('lucide-react/dynamicIconImports').then(m => {
    const names = Object.keys(m.default);
    console.log('dynamicIconImports OK:', names.length, 'icons');
    console.log('Sample:', names.slice(0, 5));
  }).catch(e => console.error('FAIL:', e.message));
"
```

Expected: `dynamicIconImports OK: 1500+ icons` 和 5 个示例名称。

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml
git commit -m "chore(desktop): add emoji-mart and tanstack virtual dependencies"
```

---

### Task 2: 更新 types.ts 和 constants.ts

**Files:**
- Modify: `apps/desktop/src/components/ui/icon-picker/types.ts`
- Modify: `apps/desktop/src/components/ui/icon-picker/constants.ts`

- [ ] **Step 1: 扩展 types.ts — 新增 VirtualRow 和分类类型**

在 `types.ts` 末尾追加：

```typescript
/**
 * Virtual scroll row types for Lucide tab
 */
export type VirtualRow =
  | { type: "header"; categoryId: string; label: string }
  | { type: "icons"; names: string[] };

/**
 * Category group for organized icon display
 */
export interface CategoryGroup {
  id: string;
  labelKey: string;
  label: string;
  icons: string[];
}
```

- [ ] **Step 2: 更新 constants.ts — 重命名分类 + 新增 Other 兜底**

在 `constants.ts` 中，将 `ICON_CATEGORIES` 重命名为 `LUCIDE_CATEGORIES`（全局替换）。在数组末尾新增 Other 分类：

```typescript
// 在现有分类数组末尾添加（闭合 ] 之前）
  {
    id: "other",
    labelKey: "iconPicker.category.other",
    icons: [], // 运行时动态填充
  },
```

同时新增导出，用于收集已分类的图标名集合：

```typescript
/**
 * Set of icon names that have been manually categorized.
 * Used to determine which icons go into the "Other" category.
 */
export const CATEGORIZED_ICON_NAMES = new Set(
  LUCIDE_CATEGORIES.filter((c) => c.id !== "other")
    .flatMap((c) => c.icons)
);
```

- [ ] **Step 3: 更新 constants.ts 的导出名**

在 `index.ts` 中将 `ICON_CATEGORIES` 更新为 `LUCIDE_CATEGORIES`：

```typescript
export {
  LUCIDE_ICON_MAP,
  LUCIDE_CATEGORIES,  // was ICON_CATEGORIES
  CATEGORIZED_ICON_NAMES,
  ICON_SIZE_MAP,
  DEFAULT_ICON_NAME,
} from "./constants";
```

在 `tabs/lucide-tab.tsx` 中也更新引用（后面 Task 5 会重写此文件，此处可跳过）。

- [ ] **Step 4: 验证 TypeScript 编译**

```bash
cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: 可能有 `lucide-tab.tsx` 因引用旧名报错，这是预期的（Task 5 会重写）。其他文件不应有新错误。

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/ui/icon-picker/types.ts apps/desktop/src/components/ui/icon-picker/constants.ts apps/desktop/src/components/ui/icon-picker/index.ts
git commit -m "refactor(icon-picker): update types and rename categories for full Lucide support"
```

---

### Task 3: 图标缓存层 + DynamicLucideIcon 组件

**Files:**
- Create: `apps/desktop/src/components/ui/icon-picker/icon-cache.ts`
- Create: `apps/desktop/src/components/ui/icon-picker/dynamic-lucide-icon.tsx`

- [ ] **Step 1: 创建 icon-cache.ts — 模块级缓存 + 加载函数**

```typescript
/**
 * Icon Cache
 *
 * Module-level cache for dynamically loaded Lucide icons.
 * Shared between DynamicLucideIcon, use-lucide-icons hook, and IconDisplay.
 */

import dynamicIconImports from "lucide-react/dynamicIconImports";
import type { LucideIcon } from "lucide-react";
import { LUCIDE_ICON_MAP } from "./constants";

/** All available icon names (synchronously available) */
export const ALL_ICON_NAMES: string[] = Object.keys(dynamicIconImports);

/** Module-level cache: icon name -> loaded component */
const iconCache = new Map<string, LucideIcon>();

/** In-flight promises to avoid duplicate loads */
const loadingPromises = new Map<string, Promise<LucideIcon | null>>();

/**
 * Get a cached icon component. Returns null if not yet loaded.
 * Checks static LUCIDE_ICON_MAP first (zero-latency), then dynamic cache.
 */
export function getCachedIcon(name: string): LucideIcon | null {
  // Static fast path
  const staticIcon = LUCIDE_ICON_MAP[name];
  if (staticIcon) return staticIcon;

  // Dynamic cache
  return iconCache.get(name) ?? null;
}

/**
 * Load a single icon by name. Returns the component or null on failure.
 * Results are cached — subsequent calls return immediately from cache.
 */
export async function loadIcon(name: string): Promise<LucideIcon | null> {
  // Already cached
  const cached = getCachedIcon(name);
  if (cached) return cached;

  // Already loading
  const existing = loadingPromises.get(name);
  if (existing) return existing;

  // Not a valid icon name
  const importFn = dynamicIconImports[name as keyof typeof dynamicIconImports];
  if (!importFn) return null;

  const promise = importFn()
    .then((mod) => {
      const icon = mod.default;
      iconCache.set(name, icon);
      loadingPromises.delete(name);
      return icon;
    })
    .catch(() => {
      loadingPromises.delete(name);
      return null;
    });

  loadingPromises.set(name, promise);
  return promise;
}

/**
 * Load a batch of icons. Returns when all are loaded or failed.
 * Used by virtual scroll to preload visible rows.
 */
export async function loadIcons(names: string[]): Promise<void> {
  await Promise.all(names.map(loadIcon));
}

/**
 * Get the number of cached icons (for debugging).
 */
export function getCacheSize(): number {
  return iconCache.size;
}
```

- [ ] **Step 2: 创建 dynamic-lucide-icon.tsx — 按需渲染组件**

```tsx
/**
 * DynamicLucideIcon
 *
 * Renders a Lucide icon by name with async loading.
 * Shows skeleton while loading, falls back to FileText on error.
 */

import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCachedIcon, loadIcon } from "./icon-cache";

interface DynamicLucideIconProps {
  name: string;
  size?: number;
  className?: string;
}

export function DynamicLucideIcon({ name, size = 16, className }: DynamicLucideIconProps) {
  const [Icon, setIcon] = useState<LucideIcon | null>(() => getCachedIcon(name));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Check cache first (may have loaded since initial render)
    const cached = getCachedIcon(name);
    if (cached) {
      setIcon(cached);
      setFailed(false);
      return;
    }

    // Load dynamically
    let cancelled = false;
    setFailed(false);

    loadIcon(name).then((loaded) => {
      if (cancelled) return;
      if (loaded) {
        setIcon(loaded);
      } else {
        setFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [name]);

  // Error fallback
  if (failed) {
    return <FileText className={className} style={{ width: size, height: size }} />;
  }

  // Loading skeleton
  if (!Icon) {
    return (
      <span
        className={cn("animate-pulse rounded bg-muted inline-block", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  // Render loaded icon
  return <Icon className={className} style={{ width: size, height: size }} />;
}
```

- [ ] **Step 3: 验证编译**

```bash
cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: 新文件无编译错误。

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/ui/icon-picker/icon-cache.ts apps/desktop/src/components/ui/icon-picker/dynamic-lucide-icon.tsx
git commit -m "feat(icon-picker): add icon cache and DynamicLucideIcon component"
```

---

### Task 4: use-lucide-icons Hook

**Files:**
- Create: `apps/desktop/src/components/ui/icon-picker/hooks/use-lucide-icons.ts`

- [ ] **Step 1: 创建 use-lucide-icons.ts**

```typescript
/**
 * useLucideIcons Hook
 *
 * Provides full Lucide icon set with:
 * - Search filtering (debounced via useDeferredValue)
 * - Category grouping with "Other" fallback
 * - Async batch loading for virtual scroll
 * - Module-level cache integration
 */

import { useState, useMemo, useDeferredValue, useCallback, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { ALL_ICON_NAMES, getCachedIcon, loadIcons as batchLoadIcons } from "../icon-cache";
import { LUCIDE_CATEGORIES, CATEGORIZED_ICON_NAMES } from "../constants";
import type { VirtualRow, CategoryGroup } from "../types";

const ICONS_PER_ROW = 8;
const LOAD_DEBOUNCE_MS = 100;

/**
 * Build category groups including the dynamic "Other" category.
 */
function buildCategoryGroups(): CategoryGroup[] {
  const groups: CategoryGroup[] = LUCIDE_CATEGORIES
    .filter((c) => c.id !== "other")
    .map((c) => ({
      id: c.id,
      labelKey: c.labelKey,
      label: c.id, // fallback label, i18n resolved in component
      icons: c.icons,
    }));

  // Collect uncategorized icons into "Other"
  const otherIcons = ALL_ICON_NAMES.filter((name) => !CATEGORIZED_ICON_NAMES.has(name));
  if (otherIcons.length > 0) {
    groups.push({
      id: "other",
      labelKey: "iconPicker.category.other",
      label: "Other",
      icons: otherIcons,
    });
  }

  return groups;
}

/** Cached category groups (computed once) */
let categoryGroupsCache: CategoryGroup[] | null = null;
function getCategoryGroups(): CategoryGroup[] {
  if (!categoryGroupsCache) {
    categoryGroupsCache = buildCategoryGroups();
  }
  return categoryGroupsCache;
}

/**
 * Build flat virtual rows from category groups.
 */
function buildCategoryRows(groups: CategoryGroup[]): VirtualRow[] {
  const rows: VirtualRow[] = [];
  for (const group of groups) {
    rows.push({ type: "header", categoryId: group.id, label: group.labelKey });
    for (let i = 0; i < group.icons.length; i += ICONS_PER_ROW) {
      rows.push({ type: "icons", names: group.icons.slice(i, i + ICONS_PER_ROW) });
    }
  }
  return rows;
}

/**
 * Build flat virtual rows from a filtered icon name list (search mode, no headers).
 */
function buildSearchRows(names: string[]): VirtualRow[] {
  const rows: VirtualRow[] = [];
  for (let i = 0; i < names.length; i += ICONS_PER_ROW) {
    rows.push({ type: "icons", names: names.slice(i, i + ICONS_PER_ROW) });
  }
  return rows;
}

export interface UseLucideIconsReturn {
  /** All icon names (sync) */
  allIconNames: string[];
  /** Category groups */
  categoryGroups: CategoryGroup[];
  /** Flat virtual rows for rendering */
  virtualRows: VirtualRow[];
  /** Whether in search mode */
  isSearching: boolean;
  /** Get a cached icon component (null if not loaded yet) */
  getIcon: (name: string) => LucideIcon | null;
  /** Trigger batch load for a set of icon names (debounced) */
  requestLoad: (names: string[]) => void;
  /** Search query */
  search: string;
  /** Set search query */
  setSearch: (q: string) => void;
  /** Category ID -> row index mapping for scroll-to-category */
  categoryRowIndex: Map<string, number>;
}

export function useLucideIcons(): UseLucideIconsReturn {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [, forceUpdate] = useState(0);

  // Debounce timer ref for batch loading
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLoadRef = useRef<Set<string>>(new Set());

  const categoryGroups = useMemo(() => getCategoryGroups(), []);

  // Filter icons by search query
  const filteredNames = useMemo(() => {
    if (!deferredSearch.trim()) return null; // null = not searching
    const q = deferredSearch.trim().toLowerCase();
    return ALL_ICON_NAMES.filter((name) => name.includes(q));
  }, [deferredSearch]);

  const isSearching = filteredNames !== null;

  // Build virtual rows
  const virtualRows = useMemo(() => {
    if (filteredNames) {
      return buildSearchRows(filteredNames);
    }
    return buildCategoryRows(categoryGroups);
  }, [filteredNames, categoryGroups]);

  // Category ID -> row index mapping
  const categoryRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    virtualRows.forEach((row, index) => {
      if (row.type === "header") {
        map.set(row.categoryId, index);
      }
    });
    return map;
  }, [virtualRows]);

  // Get cached icon
  const getIcon = useCallback((name: string): LucideIcon | null => {
    return getCachedIcon(name);
  }, []);

  // Debounced batch load
  const requestLoad = useCallback((names: string[]) => {
    for (const name of names) {
      if (!getCachedIcon(name)) {
        pendingLoadRef.current.add(name);
      }
    }

    if (pendingLoadRef.current.size === 0) return;

    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
    }

    loadTimerRef.current = setTimeout(() => {
      const toLoad = Array.from(pendingLoadRef.current);
      pendingLoadRef.current.clear();
      loadTimerRef.current = null;

      if (toLoad.length > 0) {
        batchLoadIcons(toLoad).then(() => {
          // Force re-render so icons appear
          forceUpdate((n) => n + 1);
        });
      }
    }, LOAD_DEBOUNCE_MS);
  }, []);

  return {
    allIconNames: ALL_ICON_NAMES,
    categoryGroups,
    virtualRows,
    isSearching,
    getIcon,
    requestLoad,
    search,
    setSearch,
    categoryRowIndex,
  };
}
```

- [ ] **Step 2: 验证编译**

```bash
cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: 新文件无编译错误。

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/ui/icon-picker/hooks/use-lucide-icons.ts
git commit -m "feat(icon-picker): add use-lucide-icons hook with search and virtual rows"
```

---

### Task 5: 重写 Lucide Tab — 全量异步 + 搜索 + 虚拟滚动

**Files:**
- Rewrite: `apps/desktop/src/components/ui/icon-picker/tabs/lucide-tab.tsx`

- [ ] **Step 1: 重写 lucide-tab.tsx**

```tsx
/**
 * LucideTab — Full Lucide icon browser
 *
 * Features:
 * - 1500+ icons via async dynamic imports
 * - Keyword search with debounced filtering
 * - Category grouping with quick-jump navigation
 * - Virtual scrolling via @tanstack/react-virtual
 */

import { useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLucideIcons } from "../hooks/use-lucide-icons";
import { LUCIDE_ICON_MAP } from "../constants";
import { DynamicLucideIcon } from "../dynamic-lucide-icon";
import type { VirtualRow } from "../types";

const HEADER_HEIGHT = 28;
const ROW_HEIGHT = 36;

export interface LucideTabProps {
  value?: string;
  onSelect: (iconName: string) => void;
}

export function LucideTab({ value, onSelect }: LucideTabProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    virtualRows,
    isSearching,
    getIcon,
    requestLoad,
    search,
    setSearch,
    categoryGroups,
    categoryRowIndex,
  } = useLucideIcons();

  // Virtual scroll setup
  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      virtualRows[index].type === "header" ? HEADER_HEIGHT : ROW_HEIGHT,
    overscan: 2,
  });

  // Preload icons for visible rows
  const visibleItems = virtualizer.getVirtualItems();
  useEffect(() => {
    const names: string[] = [];
    for (const item of visibleItems) {
      const row = virtualRows[item.index];
      if (row.type === "icons") {
        names.push(...row.names);
      }
    }
    if (names.length > 0) {
      requestLoad(names);
    }
  }, [visibleItems, virtualRows, requestLoad]);

  // Scroll to category
  const scrollToCategory = useCallback(
    (categoryId: string) => {
      const rowIndex = categoryRowIndex.get(categoryId);
      if (rowIndex !== undefined) {
        virtualizer.scrollToIndex(rowIndex, { align: "start" });
      }
    },
    [categoryRowIndex, virtualizer]
  );

  // Render a single icon cell
  const renderIcon = (iconName: string) => {
    const isSelected = value === iconName;
    const StaticIcon = LUCIDE_ICON_MAP[iconName];

    return (
      <button
        key={iconName}
        type="button"
        onClick={() => onSelect(iconName)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isSelected && "bg-primary/10 text-primary ring-1 ring-primary/30"
        )}
        title={iconName}
      >
        {StaticIcon ? (
          <StaticIcon className="h-4 w-4" />
        ) : (
          <DynamicLucideIcon name={iconName} size={16} />
        )}
      </button>
    );
  };

  // Render a virtual row
  const renderRow = (row: VirtualRow) => {
    if (row.type === "header") {
      return (
        <div className="flex items-center h-7 px-2 text-xs font-medium text-muted-foreground">
          {t(row.label, row.categoryId)}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-8 gap-0.5 px-2">
        {row.names.map(renderIcon)}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="relative px-2 pt-2 pb-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground mt-0.5" />
        <Input
          placeholder={t("iconPicker.searchIcons", "Search icons...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Category quick-jump bar (hidden during search) */}
      {!isSearching && (
        <div className="flex gap-0.5 px-2 py-1 overflow-x-auto border-b border-border">
          {categoryGroups.map((group) => {
            const firstIconName = group.icons[0];
            const FirstIcon = LUCIDE_ICON_MAP[firstIconName];
            return (
              <button
                key={group.id}
                type="button"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => scrollToCategory(group.id)}
                title={t(group.labelKey, group.id)}
              >
                {FirstIcon ? (
                  <FirstIcon className="h-3.5 w-3.5" />
                ) : (
                  <DynamicLucideIcon name={firstIconName} size={14} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Virtual scroll area */}
      <div ref={scrollRef} className="h-[280px] overflow-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderRow(virtualRows[virtualItem.index])}
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {isSearching && virtualRows.length === 0 && (
        <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
          {t("iconPicker.noResults", "No icons found")}
        </div>
      )}
    </div>
  );
}

export default LucideTab;
```

- [ ] **Step 2: 验证编译**

```bash
cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: 无编译错误。

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/ui/icon-picker/tabs/lucide-tab.tsx
git commit -m "feat(icon-picker): rewrite Lucide tab with full async icons, search, and virtual scroll"
```

---

### Task 6: 重写 Emoji Tab + emoji-mart CSS

**Files:**
- Create: `apps/desktop/src/components/ui/icon-picker/emoji-mart.css`
- Rewrite: `apps/desktop/src/components/ui/icon-picker/tabs/emoji-tab.tsx`

- [ ] **Step 1: 创建 emoji-mart.css — 主题适配**

```css
/**
 * emoji-mart theme overrides
 * Maps emoji-mart CSS variables to the app's design tokens.
 * emoji-mart uses --em-rgb-* (expects R, G, B numbers) and --em-color-* (expects full color values).
 */

/* Remove default border and border-radius (embedded inside our Popover) */
em-emoji-picker {
  --em-color-border: transparent;
  border: none !important;
  border-radius: 0 !important;
}

/* Light theme */
:root:not(.dark) em-emoji-picker {
  --em-rgb-background: 255, 255, 255;
  --em-rgb-input: 245, 245, 245;
  --em-rgb-color: 23, 23, 23;
  --em-color-border-over: hsl(var(--primary));
}

/* Dark theme */
.dark em-emoji-picker {
  --em-rgb-background: 23, 23, 23;
  --em-rgb-input: 38, 38, 38;
  --em-rgb-color: 245, 245, 245;
  --em-color-border-over: hsl(var(--primary));
}
```

注意：实际 RGB 值可能需要微调以匹配项目的 `--background` / `--foreground` 变量。这里使用了 neutral 色系近似值。

- [ ] **Step 2: 重写 emoji-tab.tsx**

```tsx
/**
 * EmojiTab — emoji-mart integration
 *
 * Wraps @emoji-mart/react Picker with app theme and i18n support.
 */

import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/use-theme";
import "../emoji-mart.css";

export interface EmojiTabProps {
  onSelect: (emoji: string) => void;
}

interface EmojiMartEmoji {
  id: string;
  native: string;
  shortcodes: string;
  unified: string;
}

export function EmojiTab({ onSelect }: EmojiTabProps) {
  const { i18n } = useTranslation();
  const { resolvedTheme } = useTheme();

  const handleSelect = (emoji: EmojiMartEmoji) => {
    onSelect(emoji.native);
  };

  // Map i18n language to emoji-mart locale
  const locale = i18n.language?.startsWith("zh") ? "zh" : "en";

  return (
    <Picker
      data={data}
      onEmojiSelect={handleSelect}
      theme={resolvedTheme}
      set="native"
      locale={locale}
      perLine={9}
      previewPosition="none"
      skinTonePosition="search"
      maxFrequentRows={2}
      navPosition="bottom"
      dynamicWidth={false}
      emojiButtonSize={36}
      emojiSize={22}
    />
  );
}

export default EmojiTab;
```

**注意**: 如果 `@emoji-mart/react` 因 React 19 peer dependency 报错，替换为 Web Component 方案：

```tsx
// 备选方案：直接用 Web Component
import { init } from "emoji-mart";
import data from "@emoji-mart/data";
import { useEffect, useRef } from "react";

init({ data });

export function EmojiTab({ onSelect }: EmojiTabProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const picker = document.createElement("em-emoji-picker");
    picker.setAttribute("set", "native");
    // ... configure attributes
    el.appendChild(picker);
    return () => { el.innerHTML = ""; };
  }, []);

  return <div ref={ref} />;
}
```

这个备选方案仅在 spike 验证失败时使用。

- [ ] **Step 3: 验证编译**

```bash
cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: 可能需要 `@emoji-mart/react` 和 `@emoji-mart/data` 的类型声明。如果报缺少类型，在 `apps/desktop/src` 下创建 `emoji-mart.d.ts`：

```typescript
declare module "@emoji-mart/react" {
  import type { ComponentType } from "react";
  interface PickerProps {
    data: unknown;
    onEmojiSelect: (emoji: { native: string; id: string; shortcodes: string; unified: string }) => void;
    theme?: "light" | "dark" | "auto";
    set?: "native" | "apple" | "google" | "twitter" | "facebook";
    locale?: string;
    perLine?: number;
    previewPosition?: "none" | "top" | "bottom";
    skinTonePosition?: "none" | "search" | "preview";
    maxFrequentRows?: number;
    navPosition?: "top" | "bottom" | "none";
    dynamicWidth?: boolean;
    emojiButtonSize?: number;
    emojiSize?: number;
  }
  const Picker: ComponentType<PickerProps>;
  export default Picker;
}

declare module "@emoji-mart/data" {
  const data: unknown;
  export default data;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/ui/icon-picker/emoji-mart.css apps/desktop/src/components/ui/icon-picker/tabs/emoji-tab.tsx
# 如果创建了类型声明文件也要加：
# git add apps/desktop/src/emoji-mart.d.ts
git commit -m "feat(icon-picker): rewrite Emoji tab with emoji-mart integration"
```

---

### Task 7: 更新 Image Tab + use-image-upload

**Files:**
- Modify: `apps/desktop/src/components/ui/icon-picker/hooks/use-image-upload.ts:118-149`
- Modify: `apps/desktop/src/components/ui/icon-picker/tabs/image-tab.tsx`

- [ ] **Step 1: 修改 use-image-upload.ts — 跳过正方形验证**

在 `processAndSave` 函数中（第 118-149 行），将 dimension 验证改为只读取尺寸但不阻止上传：

替换 `processAndSave` 函数体中的验证逻辑：

```typescript
// 原代码 (line 130-135):
//   const validation = await validateImageDimensions(objectUrl);
//   if (!validation.valid) {
//     setError(validation.error ?? "Invalid image dimensions");
//     return null;
//   }

// 新代码：跳过尺寸验证，直接保存
// (validateImageDimensions 函数保留在 utils.ts 中但不再调用)
```

完整替换 `processAndSave`：

```typescript
const processAndSave = useCallback(
  async (imageData: Uint8Array, sourceExtension: string): Promise<string | null> => {
    if (!workspacePath) {
      setError("Workspace path is required");
      return null;
    }

    // Generate filename and save (no dimension validation)
    const filename = generateIconFilename(sourceExtension);
    const relativePath = getIconStoragePath(filename);

    await writeToWorkspace(workspacePath, relativePath, imageData);

    return relativePath;
  },
  [workspacePath]
);
```

同时更新文件顶部的 import，移除 `validateImageDimensions`：

```typescript
// 原:
import { validateImageDimensions, generateIconFilename, getIconStoragePath } from "../utils";
// 新:
import { generateIconFilename, getIconStoragePath } from "../utils";
```

- [ ] **Step 2: 修改 image-tab.tsx — 添加上传预览**

在 `ImageTab` 组件中新增一个 `preview` state，上传/下载成功后显示缩略图：

在文件开头的 state 区域新增：

```typescript
const [preview, setPreview] = React.useState<string | null>(null);
```

修改 `handleFileSelect` 和 `handleUrlDownload`，成功后设置预览：

```typescript
// 在 handleFileSelect 中，onSelect(result) 之前:
if (result) {
  setPreview(result);
  // 延迟 1.2 秒后自动调用 onSelect 关闭
  setTimeout(() => onSelect(result), 1200);
  return; // 不立即 onSelect
}

// handleUrlDownload 同理
```

在 upload/url 区域下方、error 区域上方新增预览 UI：

```tsx
{/* Upload preview */}
{preview && (
  <div className="flex flex-col items-center gap-2 p-3">
    <div className="relative h-16 w-16 rounded-lg overflow-hidden border">
      <img
        src={(() => {
          if (!workspacePath) return preview;
          const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || "http://127.0.0.1:18790";
          return `${gatewayUrl}/api/file/read?workspace_path=${encodeURIComponent(workspacePath)}&file_path=${encodeURIComponent(preview)}`;
        })()}
        alt="Preview"
        className="h-full w-full object-cover"
      />
    </div>
    <span className="text-xs text-muted-foreground">
      {t("iconPicker.uploaded", "Uploaded!")}
    </span>
  </div>
)}
```

同时移除 image-tab.tsx 底部的 "Image must be square" 提示文字（两处 `squareRequired`）。

- [ ] **Step 3: 验证编译**

```bash
cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/ui/icon-picker/hooks/use-image-upload.ts apps/desktop/src/components/ui/icon-picker/tabs/image-tab.tsx
git commit -m "feat(icon-picker): remove square validation and add upload preview"
```

---

### Task 8: 更新 IconDisplay — DynamicLucideIcon fallback

**Files:**
- Modify: `apps/desktop/src/components/ui/icon-picker/icon-display.tsx:162-166`

- [ ] **Step 1: 添加 import**

在 `icon-display.tsx` 顶部添加：

```typescript
import { DynamicLucideIcon } from "./dynamic-lucide-icon";
```

- [ ] **Step 2: 修改 lucide case 分支**

替换 `icon-display.tsx` 第 162-166 行的 lucide case：

```typescript
// 原:
case "lucide": {
  const LucideIcon = LUCIDE_ICON_MAP[iconData.value] ?? FileText;
  return <LucideIcon className={cn(sizeClass, "shrink-0", className)} />;
}

// 新:
case "lucide": {
  const StaticIcon = LUCIDE_ICON_MAP[iconData.value];
  if (StaticIcon) {
    return <StaticIcon className={cn(sizeClass, "shrink-0", className)} />;
  }
  // Fallback: dynamically load icons not in static map
  return (
    <DynamicLucideIcon
      name={iconData.value}
      size={pixelSize}
      className={cn("shrink-0", className)}
    />
  );
}
```

- [ ] **Step 3: 验证编译**

```bash
cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/ui/icon-picker/icon-display.tsx
git commit -m "feat(icon-picker): add DynamicLucideIcon fallback to IconDisplay"
```

---

### Task 9: 重写 IconPicker 主组件 — 新布局 + 随机/移除 + 智能 Tab

**Files:**
- Rewrite: `apps/desktop/src/components/ui/icon-picker/icon-picker.tsx`

- [ ] **Step 1: 重写 icon-picker.tsx**

```tsx
/**
 * IconPicker Component — Notion-like
 *
 * Unified icon picker with:
 * - Emoji tab (emoji-mart)
 * - Icons tab (full Lucide async)
 * - Image tab (upload/URL)
 * - Random icon button
 * - Remove icon button
 * - Smart default tab based on current value
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Dices, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LucideTab } from "./tabs/lucide-tab";
import { EmojiTab } from "./tabs/emoji-tab";
import { ImageTab } from "./tabs/image-tab";
import { IconDisplay } from "./icon-display";
import { createLucideIcon, createEmojiIcon, createImageIcon, parseIconData } from "./utils";
import { ALL_ICON_NAMES } from "./icon-cache";
import type { IconData, IconType } from "./types";

// For random emoji selection
import emojiData from "@emoji-mart/data";

export interface IconPickerProps {
  value?: IconData | string | null;
  onChange?: (icon: IconData | null) => void;
  workspacePath?: string;
  disabled?: boolean;
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  defaultTab?: IconType;
  allowedTypes?: IconType[];
  className?: string;
  iconSize?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  /** Show remove button (default: true) */
  allowRemove?: boolean;
  /** Show random button (default: true) */
  showRandom?: boolean;
}

/**
 * Determine default tab based on current icon value.
 */
function getSmartDefaultTab(
  value: IconData | string | null | undefined,
  allowedTypes: IconType[],
  explicitDefault?: IconType
): IconType {
  if (explicitDefault && allowedTypes.includes(explicitDefault)) {
    return explicitDefault;
  }

  if (value) {
    const parsed = typeof value === "string" ? parseIconData(value) : value;
    if (parsed && allowedTypes.includes(parsed.type)) {
      return parsed.type;
    }
  }

  // Default to emoji (Notion-style)
  return allowedTypes.includes("emoji") ? "emoji" : allowedTypes[0] ?? "lucide";
}

/**
 * Get a random emoji from emoji-mart data.
 */
function getRandomEmoji(): string {
  const emojis = (emojiData as { emojis: Record<string, { skins: { native: string }[] }> }).emojis;
  const keys = Object.keys(emojis);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return emojis[randomKey]?.skins?.[0]?.native ?? "😀";
}

/**
 * Get a random Lucide icon name.
 */
function getRandomLucideIcon(): string {
  return ALL_ICON_NAMES[Math.floor(Math.random() * ALL_ICON_NAMES.length)];
}

export function IconPicker({
  value,
  onChange,
  workspacePath,
  disabled = false,
  trigger,
  align = "start",
  defaultTab,
  allowedTypes = ["lucide", "emoji", "image"],
  className,
  iconSize = "md",
  allowRemove = true,
  showRandom = true,
}: IconPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [randomSpin, setRandomSpin] = React.useState(false);

  // Smart default tab
  const smartDefault = React.useMemo(
    () => getSmartDefaultTab(value, allowedTypes, defaultTab),
    [value, allowedTypes, defaultTab]
  );
  const [activeTab, setActiveTab] = React.useState<IconType>(smartDefault);

  // Reset active tab when popover opens
  React.useEffect(() => {
    if (open) {
      setActiveTab(getSmartDefaultTab(value, allowedTypes, defaultTab));
    }
  }, [open, value, allowedTypes, defaultTab]);

  // Handlers
  const handleLucideSelect = React.useCallback(
    (iconName: string) => {
      onChange?.(createLucideIcon(iconName));
      setOpen(false);
    },
    [onChange]
  );

  const handleEmojiSelect = React.useCallback(
    (emoji: string) => {
      onChange?.(createEmojiIcon(emoji));
      setOpen(false);
    },
    [onChange]
  );

  const handleImageSelect = React.useCallback(
    (imagePath: string) => {
      onChange?.(createImageIcon(imagePath));
      setOpen(false);
    },
    [onChange]
  );

  const handleRemove = React.useCallback(() => {
    onChange?.(null);
    setOpen(false);
  }, [onChange]);

  const handleRandom = React.useCallback(() => {
    // Spin animation
    setRandomSpin(true);
    setTimeout(() => setRandomSpin(false), 500);

    if (activeTab === "emoji") {
      const emoji = getRandomEmoji();
      onChange?.(createEmojiIcon(emoji));
    } else if (activeTab === "lucide") {
      const iconName = getRandomLucideIcon();
      onChange?.(createLucideIcon(iconName));
    }
    // Don't close popover — allow rapid re-rolls
  }, [activeTab, onChange]);

  // Current icon for display
  const currentIconValue = React.useMemo(() => {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    return value;
  }, [value]);

  const hasValue = !!value;

  // Tab visibility
  const showEmoji = allowedTypes.includes("emoji");
  const showLucide = allowedTypes.includes("lucide");
  const showImage = allowedTypes.includes("image");
  const showRandomBtn = showRandom && activeTab !== "image";
  const showRemoveBtn = allowRemove && hasValue;

  // Default trigger
  const defaultTrigger = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex items-center justify-center rounded-md border border-input bg-background p-2",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <IconDisplay icon={currentIconValue} size={iconSize} workspacePath={workspacePath} />
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger ?? defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="w-[352px] p-0" align={align} sideOffset={4}>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as IconType)}
          className="w-full"
        >
          {/* Tab bar with tools */}
          <div className="flex items-center border-b border-border">
            <TabsList className="flex-1 justify-start rounded-none bg-transparent p-0 h-auto">
              {showEmoji && (
                <TabsTrigger
                  value="emoji"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                >
                  {t("iconPicker.emoji", "Emoji")}
                </TabsTrigger>
              )}
              {showLucide && (
                <TabsTrigger
                  value="lucide"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                >
                  {t("iconPicker.icons", "Icons")}
                </TabsTrigger>
              )}
              {showImage && (
                <TabsTrigger
                  value="image"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                >
                  {t("iconPicker.image", "Image")}
                </TabsTrigger>
              )}
            </TabsList>

            {/* Tool buttons */}
            <div className="flex items-center gap-0.5 px-2">
              {showRandomBtn && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 w-7 p-0", randomSpin && "animate-spin")}
                  onClick={handleRandom}
                  title={t("iconPicker.random", "Random")}
                >
                  <Dices className="h-3.5 w-3.5" />
                </Button>
              )}
              {showRemoveBtn && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={handleRemove}
                  title={t("iconPicker.remove", "Remove")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Tab content */}
          {showEmoji && (
            <TabsContent value="emoji" className="m-0">
              <EmojiTab onSelect={handleEmojiSelect} />
            </TabsContent>
          )}

          {showLucide && (
            <TabsContent value="lucide" className="m-0">
              <LucideTab
                value={typeof value === "object" && value?.type === "lucide" ? value.value : undefined}
                onSelect={handleLucideSelect}
              />
            </TabsContent>
          )}

          {showImage && (
            <TabsContent value="image" className="m-0">
              <ImageTab
                workspacePath={workspacePath}
                onSelect={handleImageSelect}
              />
            </TabsContent>
          )}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

export default IconPicker;
```

- [ ] **Step 2: 验证编译**

```bash
cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/ui/icon-picker/icon-picker.tsx
git commit -m "feat(icon-picker): rewrite main component with Notion-like layout, random, and remove"
```

---

### Task 10: 更新 index.ts 导出 + 全量编译验证

**Files:**
- Modify: `apps/desktop/src/components/ui/icon-picker/index.ts`

- [ ] **Step 1: 更新 index.ts**

```typescript
/**
 * Icon Picker Components
 *
 * Unified icon selection and display system supporting:
 * - Lucide icons (1500+ with async loading)
 * - Emoji (full set via emoji-mart)
 * - Custom images (upload or URL)
 */

// Main components
export { IconPicker, type IconPickerProps } from "./icon-picker";
export { IconDisplay, type IconDisplayProps } from "./icon-display";
export { DynamicLucideIcon } from "./dynamic-lucide-icon";

// Tab components (for advanced use cases)
export { LucideTab, type LucideTabProps } from "./tabs/lucide-tab";
export { EmojiTab, type EmojiTabProps } from "./tabs/emoji-tab";
export { ImageTab, type ImageTabProps } from "./tabs/image-tab";

// Hooks
export { useImageUpload, type UseImageUploadOptions, type UseImageUploadResult } from "./hooks/use-image-upload";
export { useLucideIcons, type UseLucideIconsReturn } from "./hooks/use-lucide-icons";

// Icon cache
export { ALL_ICON_NAMES, getCachedIcon, loadIcon, loadIcons } from "./icon-cache";

// Types
export type { IconData, IconType, IconSize, VirtualRow, CategoryGroup } from "./types";

// Utilities
export {
  parseIconData,
  serializeIconData,
  createLucideIcon,
  createEmojiIcon,
  createImageIcon,
  getDefaultIconData,
  isIconEqual,
  isEmoji,
  isImagePath,
  getIconPixelSize,
  getIconSizeClass,
  validateImageDimensions,
  generateIconFilename,
  getIconStorageDir,
  getIconStoragePath,
} from "./utils";

// Constants
export {
  LUCIDE_ICON_MAP,
  LUCIDE_CATEGORIES,
  CATEGORIZED_ICON_NAMES,
  ICON_SIZE_MAP,
  DEFAULT_ICON_NAME,
} from "./constants";
```

- [ ] **Step 2: 修复外部引用 ICON_CATEGORIES 的文件**

搜索项目中所有引用 `ICON_CATEGORIES` 的文件并更新为 `LUCIDE_CATEGORIES`：

```bash
cd apps/desktop && grep -rn "ICON_CATEGORIES" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

对每个找到的文件，将 `ICON_CATEGORIES` 替换为 `LUCIDE_CATEGORIES`。

- [ ] **Step 3: 全量 TypeScript 编译**

```bash
cd apps/desktop && npx tsc --noEmit --pretty
```

Expected: 零错误。如有错误，逐一修复类型不匹配问题。

- [ ] **Step 4: 启动 dev server 验证**

```bash
cd apps/desktop && pnpm dev
```

在浏览器中打开 desktop app，进入 Create Page 或 Edit Page dialog，点击 icon 按钮，验证：

1. Emoji tab 显示 emoji-mart picker，搜索、分类、肤色均可用
2. Icons tab 显示全量 Lucide 图标，搜索过滤正常，分类跳转正常，虚拟滚动流畅
3. Image tab 上传和 URL 下载正常，无正方形限制
4. 随机按钮可用，每次点击切换图标
5. 移除按钮可用，清除图标
6. Tab 顺序为 Emoji → Icons → Image
7. 暗色主题下 emoji-mart 样式正确

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/ui/icon-picker/index.ts
git commit -m "feat(icon-picker): update exports and finalize Notion-like icon picker redesign"
```
