"use client"

import * as React from "react"
import { ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils/index"

interface SwitcherChevronProps extends React.ComponentPropsWithoutRef<"button"> {
  /** 外部 hover（同组其他元素 hover 时的浅色状态） */
  groupHovered?: boolean
  /** 自身 hover（深色状态） */
  selfHovered?: boolean
}

/**
 * 面包屑段旁边的切换按钮（chevron），hover 展开 popover。
 * PageSwitcher / ProjectSwitcher / TeamSwitcher 共用。
 *
 * 使用 forwardRef：Radix PopoverTrigger asChild 需要子组件能接收 ref，
 * 否则 onClick/aria-expanded/data-state 等 props 无法绑定到按钮上，popover 不弹出。
 */
export const SwitcherChevron = React.forwardRef<HTMLButtonElement, SwitcherChevronProps>(
  function SwitcherChevron({ groupHovered = false, selfHovered = false, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center justify-center w-6 h-8 rounded-r-lg transition-colors",
          groupHovered && !selfHovered && "bg-surface-secondary text-foreground",
          selfHovered && "bg-accent text-accent-foreground",
          "[&_svg]:pointer-events-none [&_svg]:shrink-0",
          className
        )}
        {...props}
      >
        <ChevronsUpDown className="h-3.5 w-3.5" />
      </button>
    )
  }
)
