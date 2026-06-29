import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface CoverProps {
  src: string
  aspectRatio?: "16/9" | "16/10"
  overlay?: boolean
  children?: ReactNode
  className?: string
}

export function Cover({ src, aspectRatio = "16/9", overlay = false, children, className }: CoverProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[9px] dark:brightness-75 dark:contrast-125",
        aspectRatio === "16/9" ? "aspect-video" : "aspect-[16/10]",
        className
      )}
      style={{ background: src }}
    >
      {overlay && (
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      )}
      {children && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 p-2">
          {children}
        </div>
      )}
    </div>
  )
}
