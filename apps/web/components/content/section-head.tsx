import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface SectionHeadProps {
  title: string
  actionLabel?: ReactNode
  actionHref?: string
  children?: ReactNode
  className?: string
}

export function SectionHead({ title, actionLabel, actionHref, children, className }: SectionHeadProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2.5 mb-2", className)}>
      <h2 className="font-['Lexend'] text-[17px] font-bold leading-[1.2] text-foreground">
        {title}
      </h2>
      {children ? (
        <div className="flex items-center gap-2">{children}</div>
      ) : actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex items-center text-[14px] font-bold text-primary min-h-[36px] hover:underline"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
