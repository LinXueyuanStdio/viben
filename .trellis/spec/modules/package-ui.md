# @viben/ui - 共享 UI 组件库规格

> 从 desktop 应用中提取可复用的 UI 原语，供所有应用共享。

---

## Overview

| Attribute | Value |
|-----------|-------|
| Package Name | `@viben/ui` |
| Priority | P0 (基础依赖) |
| Dependencies | Radix UI, Tailwind CSS, CVA |
| Status | 📝 Specification |

---

## 目标

1. 提取 desktop 应用中的通用 UI 组件
2. 建立跨应用共享的组件库
3. 统一设计系统实现
4. 减少代码重复

---

## 目录结构

```
packages/ui/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── tailwind.config.ts
├── src/
│   ├── index.ts                 # 主导出
│   ├── lib/
│   │   └── utils.ts             # cn() 工具
│   ├── styles/
│   │   └── globals.css          # CSS 变量 + Tailwind 基础
│   └── components/
│       ├── index.ts             # 组件桶导出
│       ├── breadcrumb.tsx       # 面包屑 ⭐ 新增
│       ├── button.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── skeleton.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── tooltip.tsx
│       ├── scroll-area.tsx
│       ├── separator.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── switch.tsx
│       ├── tabs.tsx
│       └── textarea.tsx
└── README.md
```

---

## 组件清单

### 已有组件 (从 desktop 迁移)

| 组件 | 来源文件 | Radix 依赖 | 优先级 |
|------|---------|-----------|--------|
| `Button` | `apps/desktop/src/components/ui/button.tsx` | Slot | P0 |
| `Card` | `apps/desktop/src/components/ui/card.tsx` | - | P0 |
| `Badge` | `apps/desktop/src/components/ui/badge.tsx` | - | P0 |
| `Skeleton` | `apps/desktop/src/components/ui/skeleton.tsx` | - | P0 |
| `Dialog` | `apps/desktop/src/components/ui/dialog.tsx` | Dialog | P0 |
| `DropdownMenu` | `apps/desktop/src/components/ui/dropdown-menu.tsx` | DropdownMenu | P0 |
| `Tooltip` | `apps/desktop/src/components/ui/tooltip.tsx` | Tooltip | P0 |
| `ScrollArea` | `apps/desktop/src/components/ui/scroll-area.tsx` | ScrollArea | P0 |
| `Separator` | `apps/desktop/src/components/ui/separator.tsx` | Separator | P0 |
| `Input` | - | - | P1 |
| `Label` | - | Label | P1 |
| `Select` | - | Select | P1 |
| `Switch` | - | Switch | P1 |
| `Tabs` | - | Tabs | P1 |
| `Textarea` | - | - | P1 |

### 新增组件

| 组件 | 描述 | 优先级 |
|------|------|--------|
| `Breadcrumb` | Notion 风格面包屑导航 | P0 |

---

## 组件规格

### Breadcrumb (新增)

**用途**: 层级导航，显示当前位置的路径

**设计参考**: Notion

**API**:

```tsx
interface BreadcrumbItem {
  /** 显示文本 */
  label: string;
  /** 链接地址 (最后一项无链接) */
  href?: string;
  /** 可选图标 */
  icon?: React.ComponentType<{ className?: string }>;
}

interface BreadcrumbProps {
  /** 导航项列表 */
  items: BreadcrumbItem[];
  /** 分隔符 (默认 ChevronRight) */
  separator?: React.ReactNode;
  /** 折叠阈值 (超过此数量折叠中间项) */
  maxItems?: number;
  /** 自定义类名 */
  className?: string;
}
```

**实现**:

```tsx
import * as React from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "../lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  maxItems?: number;
  className?: string;
  /** 链接渲染器 (支持不同路由库) */
  renderLink?: (props: { href: string; children: React.ReactNode; className?: string }) => React.ReactNode;
}

const defaultRenderLink = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
  <a href={href} className={className}>{children}</a>
);

export function Breadcrumb({
  items,
  separator,
  maxItems = 4,
  className,
  renderLink = defaultRenderLink,
}: BreadcrumbProps) {
  const separatorElement = separator ?? (
    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
  );

  const displayItems = React.useMemo(() => {
    if (items.length <= maxItems) return items;

    const first = items[0];
    const lastTwo = items.slice(-2);
    return [
      first,
      { label: "...", href: undefined, icon: MoreHorizontal } as BreadcrumbItem,
      ...lastTwo,
    ];
  }, [items, maxItems]);

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-sm", className)}
    >
      <ol className="flex items-center gap-1.5">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const Icon = item.icon;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && separatorElement}
              {item.href && !isLast ? (
                renderLink({
                  href: item.href,
                  className: cn(
                    "flex items-center gap-1.5 text-muted-foreground",
                    "hover:text-foreground transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  ),
                  children: (
                    <>
                      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                      <span className="truncate max-w-[150px]">{item.label}</span>
                    </>
                  ),
                })
              ) : (
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    isLast
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate max-w-[200px]">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

Breadcrumb.displayName = "Breadcrumb";
```

**使用示例**:

```tsx
import { Breadcrumb } from "@viben/ui";
import { Link } from "react-router-dom";
import { Home, Folder, KanbanSquare } from "lucide-react";

function WorkspaceKanbanPage() {
  return (
    <Breadcrumb
      items={[
        { label: "首页", href: "/", icon: Home },
        { label: "我的工作空间", href: "/workspaces/123", icon: Folder },
        { label: "任务看板", icon: KanbanSquare },
      ]}
      renderLink={({ href, children, className }) => (
        <Link to={href} className={className}>{children}</Link>
      )}
    />
  );
}
```

---

### Button (迁移)

**当前位置**: `apps/desktop/src/components/ui/button.tsx`

**迁移改动**: 无 - 直接复制

**Variants**:

| Variant | 描述 |
|---------|------|
| `default` | 主按钮 (琥珀色) |
| `secondary` | 次要按钮 |
| `destructive` | 危险操作 |
| `outline` | 边框按钮 |
| `ghost` | 透明按钮 |
| `link` | 链接样式 |

**Sizes**: `sm`, `default`, `lg`, `icon`

---

### Card (迁移)

**当前位置**: `apps/desktop/src/components/ui/card.tsx`

**迁移改动**:
- 添加 `interactive` variant
- 添加 bento grid size variants

**组成部分**:
- `Card`
- `CardHeader`
- `CardTitle`
- `CardDescription`
- `CardContent`
- `CardFooter`

---

## 配置文件

### package.json

```json
{
  "name": "@viben/ui",
  "version": "1.0.0",
  "description": "Viben shared UI component library",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css"
  },
  "sideEffects": ["*.css"],
  "files": ["dist"],
  "scripts": {
    "build": "tsup && pnpm build:css",
    "build:css": "tailwindcss -i src/styles/globals.css -o dist/styles.css --minify",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-dropdown-menu": "^2.1.4",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-scroll-area": "^1.2.2",
    "@radix-ui/react-select": "^2.1.4",
    "@radix-ui/react-separator": "^1.1.1",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-switch": "^1.1.2",
    "@radix-ui/react-tabs": "^1.1.2",
    "@radix-ui/react-tooltip": "^1.1.6",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0"
  },
  "peerDependencies": {
    "lucide-react": ">=0.400.0",
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "tsup": "^8.3.5",
    "typescript": "^5.7.0"
  }
}
```

### tsup.config.ts

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "lucide-react"],
  treeshake: true,
});
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### tailwind.config.ts

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
```

### src/styles/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 20 14.3% 4.1%;
    --card: 0 0% 100%;
    --card-foreground: 20 14.3% 4.1%;
    --popover: 0 0% 100%;
    --popover-foreground: 20 14.3% 4.1%;
    --primary: 24.6 95% 53.1%;
    --primary-foreground: 60 9.1% 97.8%;
    --secondary: 60 4.8% 95.9%;
    --secondary-foreground: 24 9.8% 10%;
    --muted: 60 4.8% 95.9%;
    --muted-foreground: 25 5.3% 44.7%;
    --accent: 60 4.8% 95.9%;
    --accent-foreground: 24 9.8% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 20 5.9% 90%;
    --input: 20 5.9% 90%;
    --ring: 24.6 95% 53.1%;
    --radius: 0.75rem;
  }

  .dark {
    --background: 20 14.3% 4.1%;
    --foreground: 60 9.1% 97.8%;
    --card: 20 14.3% 4.1%;
    --card-foreground: 60 9.1% 97.8%;
    --popover: 20 14.3% 4.1%;
    --popover-foreground: 60 9.1% 97.8%;
    --primary: 20.5 90.2% 48.2%;
    --primary-foreground: 60 9.1% 97.8%;
    --secondary: 12 6.5% 15.1%;
    --secondary-foreground: 60 9.1% 97.8%;
    --muted: 12 6.5% 15.1%;
    --muted-foreground: 24 5.4% 63.9%;
    --accent: 12 6.5% 15.1%;
    --accent-foreground: 60 9.1% 97.8%;
    --destructive: 0 72.2% 50.6%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 12 6.5% 15.1%;
    --input: 12 6.5% 15.1%;
    --ring: 20.5 90.2% 48.2%;
  }
}
```

### src/lib/utils.ts

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### src/index.ts

```ts
// Utils
export { cn } from "./lib/utils";

// Components
export * from "./components";
```

### src/components/index.ts

```ts
export { Breadcrumb, type BreadcrumbItem, type BreadcrumbProps } from "./breadcrumb";
export { Button, buttonVariants, type ButtonProps } from "./button";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card";
export { Badge, badgeVariants, type BadgeProps } from "./badge";
export { Skeleton } from "./skeleton";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./dropdown-menu";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./tooltip";
export { ScrollArea, ScrollBar } from "./scroll-area";
export { Separator } from "./separator";
```

---

## 迁移步骤

### Step 1: 创建包目录

```bash
mkdir -p packages/ui/src/{components,lib,styles}
```

### Step 2: 复制配置文件

创建 `package.json`, `tsconfig.json`, `tsup.config.ts`, `tailwind.config.ts`

### Step 3: 复制工具函数

```bash
cp apps/desktop/src/lib/utils.ts packages/ui/src/lib/
```

### Step 4: 复制组件

```bash
# 复制现有组件
cp apps/desktop/src/components/ui/button.tsx packages/ui/src/components/
cp apps/desktop/src/components/ui/card.tsx packages/ui/src/components/
# ... 其他组件
```

### Step 5: 创建新组件

创建 `breadcrumb.tsx`

### Step 6: 更新导入路径

将 `@/lib/utils` 改为 `../lib/utils`

### Step 7: 更新 desktop 应用

将 `@/components/ui/...` 改为 `@viben/ui`

---

## 验收标准

- [ ] 所有组件正确导出
- [ ] TypeScript 类型完整
- [ ] 支持 Tree-shaking
- [ ] CSS 变量正确定义
- [ ] 深色/浅色主题切换正常
- [ ] desktop 应用成功导入使用
- [ ] 构建产物体积合理 (< 50KB gzipped)

---

## 参考资源

- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Viben Design System](../frontend/design-system.md)

---

**Last Updated**: 2026-02-06
**Version**: 1.0.0
**Status**: 📝 Specification
