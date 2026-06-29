"use client"

import * as React from "react"
import { cn } from "@/lib/utils/index"
import { cva, type VariantProps } from "class-variance-authority"

const iconButtonVariants = cva(
  "inline-grid place-items-center border transition-all duration-180 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      size: {
        default: "w-[44px] h-[44px] rounded-[10px]",
        compact: "w-[36px] h-[36px] rounded-[8px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

// 注意：边框和背景使用 currentColor 实现半透明效果
// Tailwind 的 border-current/22 和 bg-current/8 需用 style 或自定义类

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  label: string; // 必填 aria-label
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size, label, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        className={cn(
          iconButtonVariants({ size }),
          // 半透明边框和背景用 inline style（currentColor 支持）
          className
        )}
        style={{
          border: "1px solid color-mix(in oklch, currentColor 22%, transparent)",
          background: "color-mix(in oklch, currentColor 8%, transparent)",
          ...props.style,
        }}
        {...props}
      >
        {children}
      </button>
    )
  }
)
IconButton.displayName = "IconButton"

export { IconButton, iconButtonVariants }
export type { IconButtonProps }
