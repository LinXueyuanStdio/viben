"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils/index"
import { cva, type VariantProps } from "class-variance-authority"

const { useRef, useState, useEffect, useLayoutEffect, useImperativeHandle } = React

// ===== VibenTabsList =====

const tabsListVariants = cva("inline-flex items-center", {
  variants: {
    variant: {
      default: "h-9 gap-1 rounded-lg bg-muted p-1 text-muted-foreground",
      pill: "gap-1 rounded-full border border-border bg-surface p-1 shadow-sm",
      drawer: "gap-1 rounded-full border border-border bg-surface p-1",
      underline: "flex gap-2 relative items-stretch",
    },
  },
  defaultVariants: { variant: "default" },
})

interface VibenTabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const VibenTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  VibenTabsListProps
>(({ className, variant, children, ...props }, ref) => {
  const innerRef = useRef<HTMLDivElement>(null);
  const prevStyleRef = useRef<{ left: number; width: number } | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

  useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);

  // 使用 useEffect（异步）避免与 ResizeObserver 回调中的 setState 冲突导致死循环
  useEffect(() => {
    if (variant !== "underline" || !innerRef.current) return;

    const listEl = innerRef.current;

    const measure = () => {
      const active = listEl.querySelector<HTMLElement>('[data-state="active"]');
      if (!active) return;
      const EXTRA = 8; // gap-2=8px 时相邻下划线首尾相连
      const left = active.offsetLeft - EXTRA / 2;
      const width = active.offsetWidth + EXTRA;

      // 值没变就不更新 state，防止死循环
      const prev = prevStyleRef.current;
      if (prev && prev.left === left && prev.width === width) return;
      prevStyleRef.current = { left, width };

      setIndicatorStyle({ left, width });
      setMounted((m) => m || true);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(listEl);
    return () => observer.disconnect();
  }, [variant]);

  return (
    <TabsPrimitive.List
      ref={innerRef}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {variant === "underline" && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute -bottom-[2px] h-[2px] bg-primary rounded-full",
            mounted && "transition-[left,width] duration-300 ease-out"
          )}
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />
      )}
      {children}
    </TabsPrimitive.List>
  );
})
VibenTabsList.displayName = "VibenTabsList"

// ===== VibenTabsTrigger =====

// Active-state styles are defined in viben-tabs.css via [data-state="active"] selectors
// (Tailwind v4's data-[state=active]: variant is unreliable inside CVA — see CLAUDE.md)
const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-muted-foreground hover:text-foreground",
  {
    variants: {
      variant: {
        default: "viben-trigger-default rounded-md px-3 py-1 text-sm min-h-9",
        pill: "viben-trigger-pill rounded-full px-4 py-1.5 text-sm min-w-[92px]",
        drawer: "viben-trigger-drawer rounded-full px-3 py-1 text-xs min-w-[78px] min-h-[34px]",
        underline: "viben-trigger-underline font-medium rounded-md px-3 py-2 text-sm hover:bg-surface-secondary",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

interface VibenTabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

const VibenTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  VibenTabsTriggerProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  />
))
VibenTabsTrigger.displayName = "VibenTabsTrigger"

// ===== VibenTabsContent =====

const VibenTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
VibenTabsContent.displayName = "VibenTabsContent"

// ===== Root =====
const VibenTabs = TabsPrimitive.Root

export { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent }
