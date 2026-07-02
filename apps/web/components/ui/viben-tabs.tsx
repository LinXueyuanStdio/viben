"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils/index"
import { cva, type VariantProps } from "class-variance-authority"

// ===== VibenTabsList =====

const tabsListVariants = cva("inline-flex items-center", {
  variants: {
    variant: {
      default: "h-9 gap-1 rounded-lg bg-muted p-1 text-muted-foreground",
      pill: "gap-1 rounded-full border border-border bg-surface p-1 shadow-sm",
      drawer: "gap-1 rounded-full border border-border bg-surface p-1",
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
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
))
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
