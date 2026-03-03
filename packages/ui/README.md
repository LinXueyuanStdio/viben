# @viben/ui

Viben 共享 UI 组件库，基于 Radix UI 和 Tailwind CSS 构建。

## 安装

```bash
pnpm add @viben/ui
```

## 引入样式

```tsx
import "@viben/ui/styles.css";
```

## 主要组件

### 基础组件

| 组件 | 描述 |
|------|------|
| `Button` | 按钮组件，支持多种变体和尺寸 |
| `Input` | 输入框组件 |
| `Textarea` | 多行文本输入组件 |
| `Label` | 表单标签组件 |
| `Badge` | 徽章组件 |
| `Avatar` | 头像组件 |
| `Skeleton` | 骨架屏组件 |
| `Separator` | 分隔线组件 |

### 布局组件

| 组件 | 描述 |
|------|------|
| `Card` | 卡片容器组件 |
| `ScrollArea` | 自定义滚动区域 |
| `Tabs` | 标签页组件 |
| `Breadcrumb` | 面包屑导航 |

### 交互组件

| 组件 | 描述 |
|------|------|
| `Dialog` | 对话框/模态框 |
| `DropdownMenu` | 下拉菜单 |
| `Select` | 选择器组件 |
| `Popover` | 弹出层组件 |
| `Tooltip` | 工具提示组件 |
| `Switch` | 开关组件 |

## 基本使用

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Label } from "@viben/ui";

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>登录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input id="email" type="email" placeholder="请输入邮箱" />
        </div>
        <Button className="w-full">登录</Button>
      </CardContent>
    </Card>
  );
}
```

### 使用工具函数

```tsx
import { cn } from "@viben/ui";

// cn 用于合并 className
<div className={cn("base-class", isActive && "active-class")} />
```

### 使用组件变体

```tsx
import { Button, buttonVariants } from "@viben/ui";

// 直接使用组件
<Button variant="outline" size="sm">点击</Button>

// 使用 buttonVariants 生成 className
<a className={buttonVariants({ variant: "ghost" })}>链接按钮</a>
```

## 依赖

### Peer Dependencies

- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0
- `lucide-react` >=0.400.0

### 核心依赖

- `@radix-ui/react-*` - 无障碍 UI 原语
- `class-variance-authority` - 组件变体管理
- `tailwind-merge` - Tailwind 类名合并
- `clsx` - 条件类名工具
