import type { ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const pillVariants = cva(
  "inline-flex items-center rounded-full font-bold text-[12.5px] min-h-[26px] px-2.5 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        kind: "bg-surface-secondary text-muted-foreground",
        source: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        rank: "font-['Lexend'] text-lg text-primary bg-transparent px-0",
        tag: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[12.5px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface PillProps extends VariantProps<typeof pillVariants> {
  children: ReactNode
  className?: string
}

export function Pill({ children, variant, className }: PillProps) {
  return <span className={cn(pillVariants({ variant }), className)}>{children}</span>
}
