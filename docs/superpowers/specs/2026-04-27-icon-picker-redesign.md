# Icon Picker Redesign — Notion-like

**日期**: 2026-04-27
**状态**: approved
**方案**: emoji-mart + 动态 Lucide（方案 A）

---

## 目标

将现有 icon picker 从简陋的分类浏览升级为 Notion 级别的体验：完整 emoji 集、全量 Lucide 图标、关键词搜索、随机推荐、移除图标、肤色选择。

## 非目标

- 不改变 `IconData` 数据格式和后端存储
- 不改变 `IconDisplay` 渲染组件的公共 API
- 不新增 icon 类型（仍为 lucide / emoji / image 三种）
- 不改变触发方式（仍通过 Popover，调用方决定 trigger）
- 不做键盘导航 / 无障碍访问优化（留给后续迭代）

---

## 架构

### 整体布局

Popover 宽度从 300px 扩大到 **352px**（对齐 emoji-mart 默认宽度）。

```
┌───────────────────────────────────────┐
│ [Emoji] [Icons] [Image]    [🎲] [✕]  │  tab bar + 工具按钮
├───────────────────────────────────────┤
│  (tab content: 搜索 + 内容)            │  280px 高
└───────────────────────────────────────┘
```

- **默认 tab**: 根据当前值自动选择（emoji→Emoji, lucide→Icons, image→Image, 无值→Emoji）
- **随机按钮** 🎲: Emoji/Icons tab 可见，Image tab 隐藏。点击随机选一个当前类型的图标并应用（不关闭 popover）。按钮有旋转动画反馈。随机范围：Emoji 从 `@emoji-mart/data` 完整列表随机，Icons 从 `Object.keys(dynamicIconImports)` 全量随机。
- **移除按钮** ✕: 仅当 value 非空时显示。调用 `onChange(null)` 并关闭 popover。可通过 `allowRemove` prop 控制。

### Tab Bar 布局

```
[左对齐 tabs] ··············· [🎲] [✕] 右对齐
```

---

## Emoji Tab

### 方案

直接嵌入 `@emoji-mart/react` 的 `<Picker>` 组件。

**React 19 兼容性风险**：`@emoji-mart/react@1.x` 的 peerDependency 声明为 `react: ^16.8 || ^17 || ^18`，项目使用 React 19。由于 `@emoji-mart/react` 只是 `emoji-mart` v5 的薄 wrapper（底层为框架无关的 Web Component），实际兼容可能性高，但需在实现前先做 spike 验证。如果 wrapper 层有问题，备选方案：直接使用 `emoji-mart` v5 的原生 Web Component `<em-emoji-picker>`。

### 配置

| 参数 | 值 | 说明 |
|------|----|------|
| `data` | `@emoji-mart/data` | 完整 emoji 数据集 |
| `theme` | 跟随应用主题 | `"light"` / `"dark"` |
| `set` | `"native"` | 使用系统原生 emoji，不加载图片 |
| `locale` | 跟随 i18n | `"zh"` / `"en"` |
| `perLine` | `9` | 每行 9 个，适配 352px |
| `previewPosition` | `"none"` | 不显示底部预览 |
| `skinTonePosition` | `"search"` | 肤色选择器在搜索栏旁 |
| `maxFrequentRows` | `2` | 最多 2 行常用 emoji |
| `navPosition` | `"bottom"` | 分类导航在底部 |
| `onEmojiSelect` | callback | 选中后 `onChange({ type: "emoji", value: emoji.native })`，关闭 popover |

### 样式适配

通过 CSS 变量覆盖 emoji-mart 默认样式，映射到 shadcn/tailwind CSS 变量。

**注意**：emoji-mart 的 `--em-rgb-*` 变量期望 **RGB 数值格式**（如 `255, 255, 255`），而 shadcn CSS 变量通常为 HSL/oklch 格式。不能直接 `var()` 引用，需要为 light/dark 主题分别硬编码 RGB 值：

```css
/* Light theme */
[data-theme="light"] em-emoji-picker {
  --em-rgb-background: 255, 255, 255;       /* popover bg */
  --em-rgb-input: 240, 240, 240;            /* search input bg */
  --em-rgb-color: 28, 28, 28;              /* text color */
  --em-color-border: hsl(var(--border));
  --em-color-border-over: hsl(var(--primary));
}

/* Dark theme */
[data-theme="dark"] em-emoji-picker {
  --em-rgb-background: 30, 30, 30;
  --em-rgb-input: 45, 45, 45;
  --em-rgb-color: 230, 230, 230;
  --em-color-border: hsl(var(--border));
  --em-color-border-over: hsl(var(--primary));
}
```

实际 RGB 值需在实现时从项目主题变量中提取。去掉 emoji-mart 自带的外边框和圆角（嵌在 popover 内部）。

### 搜索

emoji-mart 自带搜索，支持多语言。无需额外实现。

---

## Icons Tab（Lucide）

### 全量图标加载 — 异步动态导入

**不使用** `import * as icons from "lucide-react"`（避免 200KB+ 同步加载阻塞）。

使用 `lucide-react` 的 `dynamicIconImports`：

```typescript
import dynamicIconImports from "lucide-react/dynamicIconImports";

// dynamicIconImports: Record<string, () => Promise<{ default: LucideIcon }>>
// 约 1500+ 条目，每条是一个 lazy import 函数
```

**加载策略**：

1. **图标名称列表**：`Object.keys(dynamicIconImports)` 同步可用（只是字符串数组，零成本）
2. **图标组件渲染**：仅可见区域的图标触发 `dynamicIconImports[name]()` 加载
3. **缓存**：统一使用一个模块级 `Map<string, LucideIcon>` 缓存（在 `dynamic-lucide-icon.tsx` 中），hook 和 display 组件共享同一份缓存，不重复加载
4. **占位**：未加载的图标显示 skeleton 方块（同尺寸灰色占位）
5. **静态快速路径**：保留现有 `LUCIDE_ICON_MAP`（85 个常用图标）静态导入，这些图标零延迟渲染

### `use-lucide-icons.ts` Hook

```typescript
interface UseLucideIconsReturn {
  /** 全部图标名（同步可用） */
  allIconNames: string[];
  /** 按分类组织的图标 */
  categorizedIcons: CategoryGroup[];
  /** 搜索过滤后的图标名 */
  filteredIcons: string[];
  /** 获取图标组件（可能为 null 表示还在加载） */
  getIcon: (name: string) => LucideIcon | null;
  /** 触发加载一批图标 */
  loadIcons: (names: string[]) => void;
  /** 搜索关键词 */
  search: string;
  setSearch: (q: string) => void;
}
```

### 搜索

- 纯前端过滤：对 icon name 做 fuzzy match / includes 匹配
- 使用 `useDeferredValue` 避免输入时卡顿
- 搜索时：隐藏分类标题，平铺展示匹配结果
- 空搜索：回到分类浏览模式

### 分类

保留现有 15 个分类（重命名为 `LUCIDE_CATEGORIES`）。新增 `"other"` 兜底分类，收纳未被任何分类覆盖的全部图标。分类数据策略：现有 85 个图标保持手动分类，其余 1400+ 图标归入 "Other"。（如后续需更精细分类，可引入 `@lucide/core` 的 categories metadata。）

分类快捷跳转栏（横向滚动）：每个分类一个 icon 按钮，点击 `scrollIntoView` 到对应分类。

### 虚拟滚动

使用 `@tanstack/react-virtual`：

- 行高：分类标题行 28px，图标行 36px（每行 8 个图标）
- 可视区高度 280px
- 每行渲染时触发 `loadIcons()` 预加载该行的图标
- overscan: 2 行（提前加载上下各 2 行）
- 快速滚动时对 `loadIcons()` 做 debounce（~100ms），避免短时间内触发数百个 `import()` 并发请求

虚拟滚动行数据结构（flatten 分类 + 图标行）：

```typescript
type VirtualRow =
  | { type: "header"; categoryId: string; label: string }
  | { type: "icons"; names: string[] }; // 每行最多 8 个
```

搜索模式下仅生成 `"icons"` 行（无分类标题），分类模式下交替生成 `"header"` + `"icons"` 行。

### 布局

```
┌─────────────────────────────────┐
│  🔍 搜索图标...                   │  搜索输入框
├─────────────────────────────────┤
│  📁  💻  🏠  ⭐  🎨  ✉️  ...     │  分类快捷跳转（横向滚动）
├─────────────────────────────────┤
│  Documents                       │  分类标题
│  [▪][▪][▪][▪][▪][▪][▪][▪]      │  8列图标网格
│  Code & Dev                      │
│  [▪][▪][▪][▪][▪][▪][▪][▪]      │  虚拟滚动
│  ...                             │
└─────────────────────────────────┘
```

---

## Image Tab

### 变化

1. **去掉正方形强制验证**：`use-image-upload.ts` 中跳过 `validateImageDimensions` 调用，非正方形图片用 `object-cover` 裁剪显示，不报错。`validateImageDimensions` 函数本身保留但不调用。
2. **上传成功后显示预览缩略图**：在关闭 popover 前短暂显示上传的图片（约 1 秒或用户再次点击关闭）
3. 其他逻辑不变

### 保持

- Upload / URL 两种模式
- Tauri 原生文件对话框
- workspace 路径校验
- 图片存储到 `.viben/icons/`

---

## IconDisplay 改动

新增 `DynamicLucideIcon` fallback 分支：

```typescript
// icon-display.tsx
case "lucide": {
  const StaticIcon = LUCIDE_ICON_MAP[iconData.value];
  if (StaticIcon) return <StaticIcon className={...} />;
  return <DynamicLucideIcon name={iconData.value} size={pixelSize} className={...} />;
}
```

### `dynamic-lucide-icon.tsx`

```typescript
/**
 * 按需动态加载单个 Lucide 图标。
 * 用于渲染不在静态 LUCIDE_ICON_MAP 中的图标。
 * 带 Suspense fallback（skeleton）和错误回退（FileText）。
 */
function DynamicLucideIcon({ name, size, className }: {
  name: string;
  size: number;
  className?: string;
}) {
  // React.lazy + Suspense
  // 缓存已加载的组件到模块级 Map
  // 加载失败 fallback 到 FileText
}
```

---

## Props 变更

```typescript
interface IconPickerProps {
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
  // 新增
  allowRemove?: boolean;   // 是否显示移除按钮，默认 true
  showRandom?: boolean;    // 是否显示随机按钮，默认 true
}
```

---

## 新增依赖

| 包 | 版本 | 用途 | 体积 (gzip) |
|----|------|------|-------------|
| `@emoji-mart/react` | ^1.x | Emoji picker 组件（隐含依赖 `emoji-mart@^5.x`） | ~12KB |
| `@emoji-mart/data` | ^1.x | Emoji 数据集 | ~80-100KB |
| `@tanstack/react-virtual` | ^3.x | Lucide tab 虚拟滚动 | ~3KB |

**注意**：`@emoji-mart/data` 包含完整 emoji 元数据（名称、关键词、分类等），raw 约 1.3MB，gzip 后约 80-100KB。对桌面应用打包进 bundle 是合理的。

**lucide-react 多版本**：项目中已有多个版本（被 @yoopta/*, @lobehub/icons 等引入）。`dynamicIconImports` 解析到 desktop 自身的 v1.8.0，但实现时需确认 Vite 的 `resolve.dedupe` 配置是否需要调整。

---

## 文件结构

```
icon-picker/
├── icon-picker.tsx          # 主组件（改）
├── icon-display.tsx         # 渲染组件（改：加 DynamicLucideIcon fallback）
├── dynamic-lucide-icon.tsx  # 新增：按需加载单个图标
├── types.ts                 # 类型（改：新增 props）
├── constants.ts             # 常量（改：重命名分类，保留静态 map）
├── utils.ts                 # 工具函数（不动）
├── index.ts                 # 导出（不动）
├── tabs/
│   ├── emoji-tab.tsx        # 重写：wrap emoji-mart
│   ├── lucide-tab.tsx       # 重写：全量异步 + 搜索 + 虚拟滚动
│   └── image-tab.tsx        # 小改：去掉正方形限制，加预览
└── hooks/
    ├── use-image-upload.ts  # 不动
    └── use-lucide-icons.ts  # 新增：异步加载 + 搜索 + 分类逻辑
```

---

## 兼容性

- `IconData` 格式零变更，后端无感
- `IconDisplay` 公共 API 不变，调用方无需修改
- `IconPicker` 新增 props 全部可选，现有调用方无需改动
- 保留 `LUCIDE_ICON_MAP` 静态 map 作为快速路径
- `parseIconData()` 不变，旧数据照常解析
- Tab 顺序从 `[Icons] [Emoji] [Image]` 变更为 `[Emoji] [Icons] [Image]`（有意设计，对齐 Notion 风格）
- `defaultTab` prop 默认值从 `"lucide"` 变为智能选择逻辑（根据当前值决定）

## 实现前 Spike

在正式实现前，需先验证：
1. `@emoji-mart/react` 在 React 19 下能正常渲染和交互
2. `dynamicIconImports` 在 Vite dev 和 build 模式下均能正确解析
3. 如 emoji-mart React wrapper 不兼容，切换为 Web Component `<em-emoji-picker>` 方案
