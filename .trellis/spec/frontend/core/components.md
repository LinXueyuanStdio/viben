# Frontend Component Guidelines

> Conventions and patterns for React components in Viben desktop application.

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Component Categories](#component-categories)
3. [Core Patterns](#core-patterns)
4. [UI Components (Primitives)](#ui-components-primitives)
5. [Layout Components](#layout-components)
6. [Feature Components](#feature-components)
7. [Creating New Components](#creating-new-components)
8. [Forbidden Patterns](#forbidden-patterns)

---

## Directory Structure

```
apps/desktop/src/components/
├── ui/              # Primitive UI components (shadcn/ui style)
│   ├── button.tsx
│   ├── card.tsx
│   ├── skeleton.tsx
│   ├── scroll-area.tsx
│   ├── separator.tsx
│   └── tooltip.tsx
├── layout/          # Application layout components
│   ├── app-layout.tsx
│   ├── sidebar.tsx
│   ├── bento-grid.tsx
│   └── page-wrapper.tsx
├── workspace/       # Workspace-related components
│   ├── workspace-breadcrumb.tsx
│   ├── workspace-header.tsx
│   └── index.ts
└── settings/        # Feature-specific components
    └── theme-switcher.tsx
```

**Organization Rules**:
- `ui/` - Reusable primitives with variants (buttons, cards, inputs)
- `layout/` - Application-wide structural components
- `{feature}/` - Feature-specific components (settings, search, etc.)

---

## Component Categories

| Category | Location | Examples | Complexity |
|----------|----------|----------|------------|
| **Primitives** | `ui/` | Button, Card, Skeleton | Low - single concern |
| **Layout** | `layout/` | BentoGrid, PageWrapper, Sidebar | Medium - composition |
| **Feature** | `{feature}/` | ThemeSwitcher, SearchForm | High - business logic |
| **Page** | `pages/` | Dashboard, Settings | Highest - full pages |

---

## Core Patterns

### 1. CVA for Variants

All components with multiple visual variants use `class-variance-authority`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  // Base styles (always applied)
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

// Export for external use
export { buttonVariants };
```

### 2. Props Interface Pattern

Extend HTML attributes + add variant props:

```tsx
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;  // Optional: polymorphism support
}
```

### 3. forwardRef Pattern

All primitive components must use forwardRef:

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

### 4. cn() Utility

Always use `cn()` for class merging:

```tsx
import { cn } from "@/lib/utils";

// Correct: cn() merges and deduplicates classes
<div className={cn(baseClasses, conditionalClass && "active", className)} />

// Wrong: string concatenation
<div className={`${baseClasses} ${className}`} />
```

### 5. Compound Components Pattern

For complex components, export multiple related parts:

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
  cardVariants,  // Export variants for external use
};
```

Usage:
```tsx
<Card size="medium" interactive>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
  <CardFooter>Actions</CardFooter>
</Card>
```

---

## UI Components (Primitives)

### Button

**File**: `components/ui/button.tsx`

| Variant | Use Case |
|---------|----------|
| `default` | Primary actions (amber with hover lift) |
| `secondary` | Secondary actions |
| `destructive` | Dangerous actions (delete, remove) |
| `outline` | Bordered button |
| `ghost` | Minimal visual weight |
| `link` | Text-link appearance |

| Size | Dimensions |
|------|------------|
| `sm` | h-8 px-3 text-xs |
| `default` | h-9 px-4 text-sm |
| `lg` | h-10 px-8 |
| `icon` | h-9 w-9 (square) |

**Polymorphism** with `asChild`:
```tsx
// Render as Link instead of button
<Button asChild>
  <Link to="/settings">Settings</Link>
</Button>
```

### Card

**File**: `components/ui/card.tsx`

| Size | Grid Span | Use |
|------|-----------|-----|
| `small` | 3 cols | Stats, quick actions |
| `medium` | 6 cols | Charts, lists |
| `large` | 9 cols | Main content |
| `full` | 12 cols | Hero sections |

| Height | Min Height | Use |
|--------|------------|-----|
| `short` | 200px | Stats |
| `default` | auto | Standard |
| `tall` | 400px | Charts, data viz |

| Flag | Effect |
|------|--------|
| `gradient` | Adds subtle amber gradient overlay |
| `interactive` | Adds hover effects (lift + border glow) |

### Skeleton

**File**: `components/ui/skeleton.tsx`

Pre-built skeleton variants:
- `SkeletonText` - Text line placeholder
- `SkeletonCard` - Full card skeleton
- `SkeletonChart` - Chart area skeleton
- `SkeletonHeatmap` - Heatmap grid skeleton

```tsx
// Loading state
{isLoading ? <SkeletonCard /> : <ActualCard />}
```

### Tooltip

**File**: `components/ui/tooltip.tsx`

Radix-based tooltip with design system styling:

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="icon"><Settings /></Button>
    </TooltipTrigger>
    <TooltipContent>
      Settings
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## Layout Components

### BentoGrid

**File**: `components/layout/bento-grid.tsx`

12-column grid container for dashboard layouts:

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

| Gap | Value |
|-----|-------|
| `sm` | 16px |
| `md` | 24px (default) |
| `lg` | 32px |
| `xl` | 48px |

### PageWrapper

**File**: `components/layout/page-wrapper.tsx`

Provides Framer Motion page transitions:

```tsx
<PageWrapper>
  <h1>Page Title</h1>
  {/* Page content */}
</PageWrapper>
```

Also exports:
- `StaggerContainer` - Container for staggered child animations
- `StaggerItem` - Item with stagger entrance
- `AnimatedCard` - Card with scale+fade entrance

```tsx
<StaggerContainer delay={0.1}>
  <StaggerItem><Card>1</Card></StaggerItem>
  <StaggerItem><Card>2</Card></StaggerItem>
  <StaggerItem><Card>3</Card></StaggerItem>
</StaggerContainer>
```

### Sidebar

**File**: `components/layout/sidebar.tsx`

Navigation sidebar with:
- Icon-based navigation
- Tooltip labels
- Setup status indicator
- Collapse support

---

## Feature Components

### ThemeSwitcher

**File**: `components/settings/theme-switcher.tsx`

Radio group for theme selection with:
- Full keyboard navigation (Arrow keys)
- ARIA accessibility
- Visual preview cards
- Smooth transitions

Themes: `light`, `dark`, `system`

---

## Creating New Components

### Checklist

Before creating a new component:

- [ ] Check if existing component can be extended with variants
- [ ] Determine category: `ui/`, `layout/`, or `{feature}/`
- [ ] Plan variants (use CVA if 2+ visual variants)
- [ ] Consider compound pattern for complex components

### Template: Primitive Component

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const componentVariants = cva(
  // Base styles
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

### Template: Feature Component

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";

interface FeatureComponentProps {
  // Props definition
}

export function FeatureComponent({ ...props }: FeatureComponentProps) {
  // Access store if needed
  const { someState, setSomeState } = useAppStore();

  // Local state
  const [localState, setLocalState] = React.useState(false);

  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

---

## Forbidden Patterns

### Don't: Hardcode Colors

```tsx
// Bad
<div className="bg-[#f59e0b]">

// Good
<div className="bg-primary">
```

### Don't: Skip forwardRef for Primitives

```tsx
// Bad - breaks composition
function Button({ className, ...props }) {
  return <button className={className} {...props} />;
}

// Good
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return <button ref={ref} className={className} {...props} />;
  }
);
```

### Don't: Inline Styles for Animations

```tsx
// Bad
<div style={{ animation: 'fadeIn 300ms' }}>

// Good - use CSS class or Framer Motion
<div className="animate-fade-in">
// or
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
```

### Don't: String Concatenation for Classes

```tsx
// Bad
<div className={`base-class ${isActive ? 'active' : ''}`}>

// Good
<div className={cn("base-class", isActive && "active")}>
```

### Don't: Create Variants Without CVA

```tsx
// Bad - manual variant handling
const getButtonClass = (variant) => {
  if (variant === 'primary') return 'bg-primary';
  if (variant === 'secondary') return 'bg-secondary';
  return 'bg-primary';
};

// Good - use CVA
const buttonVariants = cva([...], {
  variants: {
    variant: {
      primary: 'bg-primary',
      secondary: 'bg-secondary',
    },
  },
});
```

### Don't: Forget displayName

```tsx
// Bad - no displayName
const Button = React.forwardRef<...>(...);
export { Button };

// Good
const Button = React.forwardRef<...>(...);
Button.displayName = "Button";
export { Button };
```

---

## State Access Patterns

### Local State

Use `useState` for UI-only state:

```tsx
const [isOpen, setIsOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
```

### Global State (Zustand)

Access via `useAppStore` hook:

```tsx
import { useAppStore } from "@/stores";

function MyComponent() {
  const { theme, setTheme } = useAppStore();
  // ...
}
```

### Custom Hooks

For complex logic, create custom hooks in `hooks/`:

```tsx
// hooks/use-feature.ts
export function useFeature() {
  const store = useAppStore();
  const [localState, setLocalState] = useState();

  // Complex logic here

  return {
    value,
    setValue,
    isLoading,
    error,
  };
}
```

---

## Workspace Components

### WorkspaceBreadcrumb

**File**: `components/workspace/workspace-breadcrumb.tsx`

Breadcrumb navigation for workspace pages with hover preview card.

**Features**:
- Root segment = workspace name + icon (Folder/Globe)
- Hover shows tooltip with full path + copy button
- Additional segments for sub-pages
- Current page highlighted, not clickable

```tsx
import { WorkspaceBreadcrumb } from "@/components/workspace";

// Root page (no segments)
<WorkspaceBreadcrumb workspace={workspace} />

// Sub-page with segments
<WorkspaceBreadcrumb
  workspace={workspace}
  segments={[
    { label: "对话", href: `/workspace/${workspaceId}/chat` },
  ]}
/>
```

**Hierarchy Structure**:
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

**Route Mapping**:
| Route | Breadcrumb |
|-------|------------|
| `/workspace/:id` | `{Workspace}` |
| `/workspace/:id/chat` | `{Workspace} > 对话` |
| `/workspace/:id/kanban` | `{Workspace} > 任务看板` |
| `/workspace/:id/agent/:agentId` | `{Workspace} > {Agent}` |
| `/workspace/:id/agent/:agentId/skill/:skillId` | `{Workspace} > {Agent} > {Skill}` |

### WorkspaceHeader

**File**: `components/workspace/workspace-header.tsx`

Unified header for all workspace pages with breadcrumb + actions.

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `workspace` | `Workspace` | Current workspace |
| `segments` | `BreadcrumbSegment[]` | Breadcrumb path segments |
| `onRefresh` | `() => void` | Refresh callback |
| `onRemove` | `() => Promise<void>` | Remove workspace callback |
| `isRefreshing` | `boolean` | Show loading spinner |
| `showRefresh` | `boolean` | Show refresh button |
| `showRemove` | `boolean` | Show remove button |
| `rightContent` | `ReactNode` | Additional right-side content |

```tsx
<WorkspaceHeader
  workspace={workspace}
  segments={[{ label: t("workspace.kanban"), href: "..." }]}
  onRefresh={loadAgents}
  onRemove={handleRemove}
  isRefreshing={isLoading}
  rightContent={
    <Button onClick={handleAdd}>Add Task</Button>
  }
/>
```

**Design Principles**:
1. **常驻显示** - Always visible (fallback when sub-page fails)
2. **无返回按钮** - Use breadcrumb for navigation, no back button
3. **根页面无icon** - Root breadcrumb only shows workspace icon+name
4. **悬停预览** - Hover on workspace name shows full path + copy

### AddWorkspaceModal (Wizard)

**File**: `components/workspace/add-workspace-modal.tsx`

Multi-step wizard for creating workspaces. Uses centered Dialog (~480px).

**Wizard Steps**:
| Step | Component | Purpose |
|------|-----------|---------|
| 1 | `step-choose-method.tsx` | Choose: Open existing folder / Create new folder |
| 2 | `step-configure.tsx` | Name, location, Git/Viben initialization options |
| 3 | `step-complete.tsx` | Success summary + "Go to Workspace" / "Continue Adding" |

**State Management**:
```typescript
type CreationMethod = 'open-existing' | 'create-new';
type WizardStep = 'choose' | 'configure' | 'complete';

interface WizardState {
  step: WizardStep;
  method: CreationMethod | null;
  selectedPath: string | null;
  folderStatus: FolderStatus | null;  // Smart detection result
}

interface FolderStatus {
  hasGit: boolean;
  hasViben: boolean;
  folderName: string;
}
```

**Smart Detection Logic**:
- If `.git` exists → Hide "Initialize Git" option
- If `.viben` exists → Show warning + "Reinitialize (overwrite)" checkbox

**Advanced Options** (collapsible):
- Developer name (for `viben team init`)
- Project type: fullstack / frontend / backend
- Include Cursor configuration

**API Integration**:
- `GET /api/workspaces/detect?path=xxx` - Detect folder status
- `POST /api/workspaces/create` - Create workspace with options

**Design Reference**: See `docs/plans/2026-02-28-add-workspace-wizard-design.md`

---

## Missing Components (To Add)

The following components are commonly needed but not yet in `ui/`:

| Component | Priority | Notes |
|-----------|----------|-------|
| Input | High | Text input with variants |
| Select | High | Dropdown select |
| ~~Breadcrumb~~ | ~~High~~ | ✅ Implemented in `workspace/` |
| Dialog/Modal | Medium | Radix Dialog |
| Toast | Medium | Notifications |
| Dropdown | Medium | Radix DropdownMenu |
| Checkbox | Low | Form control |
| Switch | Low | Toggle switch |
| Tabs | Low | Radix Tabs |

When adding these, follow shadcn/ui patterns and ensure:
- CVA variants
- forwardRef
- Design system colors
- Keyboard accessibility

---

**Last Updated**: 2026-02-07
**Version**: 1.1.0
**Status**: Complete - Ready for use
