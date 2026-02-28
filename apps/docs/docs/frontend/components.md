---
sidebar_position: 3
title: 组件指南
description: Viben 桌面应用中的 React 组件约定与模式
---

# 前端组件指南

> Viben 桌面应用中 React 组件的约定与模式。

---

## 目录

1. [目录结构](#目录结构)
2. [组件分类](#组件分类)
3. [核心模式](#核心模式)
4. [UI 组件（原语）](#ui-组件原语)
5. [布局组件](#布局组件)
6. [功能组件](#功能组件)
7. [创建新组件](#创建新组件)
8. [禁止模式](#禁止模式)

---

## 目录结构

```
apps/desktop/src/components/
├── ui/              # 原语 UI 组件 (shadcn/ui 风格)
│   ├── button.tsx
│   ├── card.tsx
│   ├── skeleton.tsx
│   ├── scroll-area.tsx
│   ├── separator.tsx
│   └── tooltip.tsx
├── layout/          # 应用布局组件
│   ├── app-layout.tsx
│   ├── sidebar.tsx
│   ├── bento-grid.tsx
│   └── page-wrapper.tsx
├── workspace/       # 工作空间相关组件
│   ├── workspace-breadcrumb.tsx
│   ├── workspace-header.tsx
│   └── index.ts
└── settings/        # 功能特定组件
    └── theme-switcher.tsx
```

**组织规则**:
- `ui/` - 带变体的可复用原语（按钮、卡片、输入框）
- `layout/` - 应用级结构组件
- `{feature}/` - 功能特定组件（设置、搜索等）

---

## 组件分类

| 分类 | 位置 | 示例 | 复杂度 |
|------|------|------|--------|
| **原语** | `ui/` | Button, Card, Skeleton | 低 - 单一职责 |
| **布局** | `layout/` | BentoGrid, PageWrapper, Sidebar | 中 - 组合 |
| **功能** | `{feature}/` | ThemeSwitcher, SearchForm | 高 - 业务逻辑 |
| **页面** | `pages/` | Dashboard, Settings | 最高 - 完整页面 |

---

## 核心模式

### 1. CVA 变体模式

所有具有多种视觉变体的组件使用 `class-variance-authority`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  // 基础样式（始终应用）
  [
    "inline-flex items-center justify-center",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4 text-sm",
        lg: "h-10 px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// 导出供外部使用
export { buttonVariants };
```

### 2. Props 接口模式

扩展 HTML 属性 + 添加变体 props:

```tsx
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;  // 可选：多态支持
}
```

### 3. forwardRef 模式

所有原语组件必须使用 forwardRef:

```tsx
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
```

### 4. cn() 工具函数

始终使用 `cn()` 合并类名:

```tsx
import { cn } from "@/lib/utils";

// 正确: cn() 合并并去重类名
<div className={cn(baseClasses, conditionalClass && "active", className)} />

// 错误: 字符串拼接
<div className={`${baseClasses} ${className}`} />
```

### 5. 复合组件模式

对于复杂组件，导出多个相关部分:

```tsx
// card.tsx
const Card = React.forwardRef<...>(...)
const CardHeader = React.forwardRef<...>(...)
const CardTitle = React.forwardRef<...>(...)
const CardDescription = React.forwardRef<...>(...)
const CardContent = React.forwardRef<...>(...)
const CardFooter = React.forwardRef<...>(...)

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,  // 导出变体供外部使用
};
```

使用方式:
```tsx
<Card size="medium" interactive>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述</CardDescription>
  </CardHeader>
  <CardContent>内容</CardContent>
  <CardFooter>操作</CardFooter>
</Card>
```

---

## UI 组件（原语）

### Button 按钮

**文件**: `components/ui/button.tsx`

| 变体 | 用途 |
|------|------|
| `default` | 主要操作（琥珀色带悬停抬升） |
| `secondary` | 次要操作 |
| `destructive` | 危险操作（删除、移除） |
| `outline` | 边框按钮 |
| `ghost` | 最小视觉权重 |
| `link` | 文本链接外观 |

| 尺寸 | 尺寸值 |
|------|--------|
| `sm` | h-8 px-3 text-xs |
| `default` | h-9 px-4 text-sm |
| `lg` | h-10 px-8 |
| `icon` | h-9 w-9 (正方形) |

**多态性** 使用 `asChild`:
```tsx
// 渲染为 Link 而非 button
<Button asChild>
  <Link to="/settings">设置</Link>
</Button>
```

### Card 卡片

**文件**: `components/ui/card.tsx`

| 尺寸 | 网格跨度 | 用途 |
|------|----------|------|
| `small` | 3 列 | 统计、快捷操作 |
| `medium` | 6 列 | 图表、列表 |
| `large` | 9 列 | 主要内容 |
| `full` | 12 列 | 英雄区块 |

| 高度 | 最小高度 | 用途 |
|------|----------|------|
| `short` | 200px | 统计 |
| `default` | auto | 标准 |
| `tall` | 400px | 图表、数据可视化 |

| 标志 | 效果 |
|------|------|
| `gradient` | 添加微妙的琥珀渐变叠加 |
| `interactive` | 添加悬停效果（抬升 + 边框发光） |

### Skeleton 骨架屏

**文件**: `components/ui/skeleton.tsx`

预置骨架变体:
- `SkeletonText` - 文本行占位符
- `SkeletonCard` - 完整卡片骨架
- `SkeletonChart` - 图表区域骨架
- `SkeletonHeatmap` - 热力图网格骨架

```tsx
// 加载状态
{isLoading ? <SkeletonCard /> : <ActualCard />}
```

### Tooltip 提示

**文件**: `components/ui/tooltip.tsx`

基于 Radix 的提示，带设计系统样式:

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="icon"><Settings /></Button>
    </TooltipTrigger>
    <TooltipContent>
      设置
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## 布局组件

### BentoGrid

**文件**: `components/layout/bento-grid.tsx`

用于仪表盘布局的 12 列网格容器:

```tsx
<BentoGrid gap="md">
  <BentoCard size="small" height="short">
    <StatCard />
  </BentoCard>
  <BentoCard size="large" height="tall">
    <ChartCard />
  </BentoCard>
  <BentoCard size="full">
    <HeatmapCard />
  </BentoCard>
</BentoGrid>
```

| 间距 | 值 |
|------|-----|
| `sm` | 16px |
| `md` | 24px (默认) |
| `lg` | 32px |
| `xl` | 48px |

### PageWrapper

**文件**: `components/layout/page-wrapper.tsx`

提供 Framer Motion 页面过渡:

```tsx
<PageWrapper>
  <h1>页面标题</h1>
  {/* 页面内容 */}
</PageWrapper>
```

同时导出:
- `StaggerContainer` - 用于子元素交错动画的容器
- `StaggerItem` - 带交错入场的项
- `AnimatedCard` - 带缩放+淡入入场的卡片

```tsx
<StaggerContainer delay={0.1}>
  <StaggerItem><Card>1</Card></StaggerItem>
  <StaggerItem><Card>2</Card></StaggerItem>
  <StaggerItem><Card>3</Card></StaggerItem>
</StaggerContainer>
```

### Sidebar

**文件**: `components/layout/sidebar.tsx`

导航侧边栏，包含:
- 基于图标的导航
- 提示标签
- 设置状态指示器
- 折叠支持

---

## 功能组件

### ThemeSwitcher

**文件**: `components/settings/theme-switcher.tsx`

用于主题选择的单选组，包含:
- 完整键盘导航（方向键）
- ARIA 可访问性
- 视觉预览卡片
- 平滑过渡

主题: `light`, `dark`, `system`

---

## 创建新组件

### 检查清单

创建新组件前:

- [ ] 检查现有组件是否可以通过变体扩展
- [ ] 确定分类: `ui/`, `layout/`, 或 `{feature}/`
- [ ] 规划变体（如有 2+ 视觉变体则使用 CVA）
- [ ] 考虑复杂组件使用复合模式

### 模板: 原语组件

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const componentVariants = cva(
  // 基础样式
  ["base-class"],
  {
    variants: {
      variant: {
        default: "default-styles",
      },
      size: {
        default: "size-styles",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {}

const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(componentVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Component.displayName = "Component";

export { Component, componentVariants };
```

### 模板: 功能组件

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";

interface FeatureComponentProps {
  // Props 定义
}

export function FeatureComponent({ ...props }: FeatureComponentProps) {
  // 如需访问 store
  const { someState, setSomeState } = useAppStore();

  // 本地状态
  const [localState, setLocalState] = React.useState(false);

  return (
    <div>
      {/* 组件 JSX */}
    </div>
  );
}
```

---

## 禁止模式

### 不要：硬编码颜色

```tsx
// 错误
<div className="bg-[#f59e0b]">

// 正确
<div className="bg-primary">
```

### 不要：原语组件跳过 forwardRef

```tsx
// 错误 - 破坏组合
function Button({ className, ...props }) {
  return <button className={className} {...props} />;
}

// 正确
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return <button ref={ref} className={className} {...props} />;
  }
);
```

### 不要：内联样式处理动画

```tsx
// 错误
<div style={{ animation: 'fadeIn 300ms' }}>

// 正确 - 使用 CSS 类或 Framer Motion
<div className="animate-fade-in">
// 或
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
```

### 不要：字符串拼接类名

```tsx
// 错误
<div className={`base-class ${isActive ? 'active' : ''}`}>

// 正确
<div className={cn("base-class", isActive && "active")}>
```

### 不要：不使用 CVA 创建变体

```tsx
// 错误 - 手动处理变体
const getButtonClass = (variant) => {
  if (variant === 'primary') return 'bg-primary';
  if (variant === 'secondary') return 'bg-secondary';
  return 'bg-primary';
};

// 正确 - 使用 CVA
const buttonVariants = cva([...], {
  variants: {
    variant: {
      primary: 'bg-primary',
      secondary: 'bg-secondary',
    },
  },
});
```

### 不要：忘记 displayName

```tsx
// 错误 - 没有 displayName
const Button = React.forwardRef<...>(...);
export { Button };

// 正确
const Button = React.forwardRef<...>(...);
Button.displayName = "Button";
export { Button };
```

---

## 状态访问模式

### 本地状态

使用 `useState` 处理仅 UI 状态:

```tsx
const [isOpen, setIsOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
```

### 全局状态 (Zustand)

通过 `useAppStore` hook 访问:

```tsx
import { useAppStore } from "@/stores";

function MyComponent() {
  const { theme, setTheme } = useAppStore();
  // ...
}
```

### 自定义 Hooks

对于复杂逻辑，在 `hooks/` 中创建自定义 hooks:

```tsx
// hooks/use-feature.ts
export function useFeature() {
  const store = useAppStore();
  const [localState, setLocalState] = useState();

  // 复杂逻辑

  return {
    value,
    setValue,
    isLoading,
    error,
  };
}
```

---

## 工作空间组件

### WorkspaceBreadcrumb

**文件**: `components/workspace/workspace-breadcrumb.tsx`

工作空间页面的面包屑导航，带悬停预览卡片。

**功能**:
- 根段 = 工作空间名称 + 图标 (Folder/Globe)
- 悬停显示完整路径提示 + 复制按钮
- 子页面的额外段
- 当前页面高亮，不可点击

```tsx
import { WorkspaceBreadcrumb } from "@/components/workspace";

// 根页面（无段）
<WorkspaceBreadcrumb workspace={workspace} />

// 带段的子页面
<WorkspaceBreadcrumb
  workspace={workspace}
  segments={[
    { label: "对话", href: `/workspace/${workspaceId}/chat` },
  ]}
/>
```

**层级结构**:
```
层级结构:
  Workspace名                           → 工作空间根页面
    ├─ 对话                             → Chat 页面
    ├─ 任务看板                          → Kanban 页面
    └─ {Agent名}                        → Agent 详情页
         └─ {Skill名}                   → Skill 详情页

示例:
- Viben                                 (根页面，显示对话/看板入口+智能体列表)
- Viben > 对话                          (Chat 页面)
- Viben > 任务看板                       (Kanban 页面)
- Viben > Claude Code                   (Agent 详情页，显示 MCP/Skills/Agents/Commands)
- Viben > Claude Code > PDF Tools       (Skill 详情页，文件浏览器)
```

**路由映射**:
| 路由 | 面包屑 |
|------|--------|
| `/workspace/:id` | `{Workspace}` |
| `/workspace/:id/chat` | `{Workspace} > 对话` |
| `/workspace/:id/kanban` | `{Workspace} > 任务看板` |
| `/workspace/:id/agent/:agentId` | `{Workspace} > {Agent}` |
| `/workspace/:id/agent/:agentId/skill/:skillId` | `{Workspace} > {Agent} > {Skill}` |

### WorkspaceHeader

**文件**: `components/workspace/workspace-header.tsx`

所有工作空间页面的统一头部，包含面包屑 + 操作。

**Props**:
| Prop | 类型 | 描述 |
|------|------|------|
| `workspace` | `Workspace` | 当前工作空间 |
| `segments` | `BreadcrumbSegment[]` | 面包屑路径段 |
| `onRefresh` | `() => void` | 刷新回调 |
| `onRemove` | `() => Promise<void>` | 移除工作空间回调 |
| `isRefreshing` | `boolean` | 显示加载旋转器 |
| `showRefresh` | `boolean` | 显示刷新按钮 |
| `showRemove` | `boolean` | 显示移除按钮 |
| `rightContent` | `ReactNode` | 额外的右侧内容 |

```tsx
<WorkspaceHeader
  workspace={workspace}
  segments={[{ label: t("workspace.kanban"), href: "..." }]}
  onRefresh={loadAgents}
  onRemove={handleRemove}
  isRefreshing={isLoading}
  rightContent={
    <Button onClick={handleAdd}>添加任务</Button>
  }
/>
```

**设计原则**:
1. **常驻显示** - 始终可见（子页面失败时的后备）
2. **无返回按钮** - 使用面包屑导航，无返回按钮
3. **根页面无图标** - 根面包屑仅显示工作空间图标+名称
4. **悬停预览** - 悬停工作空间名称显示完整路径 + 复制

### AddWorkspaceModal（向导）

**文件**: `components/workspace/add-workspace-modal.tsx`

创建工作空间的多步骤向导。使用居中 Dialog（约 480px）。

**向导步骤**:
| 步骤 | 组件 | 目的 |
|------|------|------|
| 1 | `step-choose-method.tsx` | 选择：打开现有文件夹 / 创建新文件夹 |
| 2 | `step-configure.tsx` | 名称、位置、Git/Viben 初始化选项 |
| 3 | `step-complete.tsx` | 成功摘要 + "前往工作空间" / "继续添加" |

**状态管理**:
```typescript
type CreationMethod = 'open-existing' | 'create-new';
type WizardStep = 'choose' | 'configure' | 'complete';

interface WizardState {
  step: WizardStep;
  method: CreationMethod | null;
  selectedPath: string | null;
  folderStatus: FolderStatus | null;  // 智能检测结果
}

interface FolderStatus {
  hasGit: boolean;
  hasViben: boolean;
  folderName: string;
}
```

**智能检测逻辑**:
- 如果 `.git` 存在 → 隐藏 "初始化 Git" 选项
- 如果 `.viben` 存在 → 显示警告 + "重新初始化（覆盖）" 复选框

**高级选项**（可折叠）:
- 开发者名称（用于 `viben team init`）
- 项目类型：fullstack / frontend / backend
- 包含 Cursor 配置

**API 集成**:
- `GET /api/workspaces/detect?path=xxx` - 检测文件夹状态
- `POST /api/workspaces/create` - 使用选项创建工作空间

---

## 待添加组件

以下组件常用但尚未在 `ui/` 中:

| 组件 | 优先级 | 备注 |
|------|--------|------|
| Input | 高 | 带变体的文本输入 |
| Select | 高 | 下拉选择 |
| ~~Breadcrumb~~ | ~~高~~ | ✅ 已在 `workspace/` 中实现 |
| Dialog/Modal | 中 | Radix Dialog |
| Toast | 中 | 通知 |
| Dropdown | 中 | Radix DropdownMenu |
| Checkbox | 低 | 表单控件 |
| Switch | 低 | 开关切换 |
| Tabs | 低 | Radix Tabs |

添加这些时，遵循 shadcn/ui 模式并确保:
- CVA 变体
- forwardRef
- 设计系统颜色
- 键盘可访问性

---

**最后更新**: 2026-02-28
**版本**: 1.1.0
**状态**: 完成 - 可供使用
