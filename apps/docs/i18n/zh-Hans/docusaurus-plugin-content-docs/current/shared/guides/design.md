# Design Guide

> UI design specifications and user interface guidelines for the Viben platform.

## Design Principles

1. **Consistency**: Use shared `@viben/ui` components built on Radix primitives
2. **Accessibility**: All components must meet WCAG 2.1 AA standards
3. **Dark Mode First**: All UI supports light/dark/system themes via Tailwind v4
4. **Responsive**: Components adapt to desktop, web, and mobile viewports

## Component Library

All UI components are in `packages/ui/src/components/ui/`:

| Category | Components |
|----------|------------|
| **Layout** | ScrollArea, Separator, Tabs |
| **Input** | Input, Textarea, Select, Switch |
| **Display** | Avatar, Badge, Card, Skeleton |
| **Actions** | Button, DropdownMenu |
| **Overlay** | Dialog, Tooltip |
| **Navigation** | Breadcrumb |

## Styling

- **Tailwind v4** with oklch color variables
- Never wrap oklch variables in `hsl()` (invalid CSS)
- Use `cn()` (tailwind-merge + clsx) for className composition
- CVA for variant-based components

## Color System

```css
/* Semantic colors (oklch) */
--background, --foreground, --card, --popover
--primary, --secondary, --muted, --accent
--destructive, --border, --input, --ring
--sidebar, --surface
```

## Component Development

```tsx
import { cn } from "@viben/ui";

interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline";
}

function MyComponent({ className, variant = "default", ...props }: MyComponentProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-2",
        variant === "outline" && "border-border bg-transparent",
        className
      )}
      {...props}
    />
  );
}
```

## References

- [Components Guide](/frontend/components) — Frontend component development
- [Design System](/frontend/design-system) — Frontend design system
- [Tailwind v4 Setup](/frontend/tailwind-v4-setup) — Styling configuration
