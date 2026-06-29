import { cn } from "@/lib/utils"

interface ProgressMiniProps {
  value: number
  className?: string
}

export function ProgressMini({ value, className }: ProgressMiniProps) {
  return (
    <div className={cn("h-1 rounded-full bg-surface-secondary overflow-hidden", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--color-cta,var(--color-primary))] transition-[width] duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
