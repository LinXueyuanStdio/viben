import { cn } from "@/lib/utils"

interface ProgressMiniProps {
  value: number
  className?: string
}

export function ProgressMini({ value, className }: ProgressMiniProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className={cn("h-1.5 rounded-full bg-surface-secondary overflow-hidden", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          pct >= 100
            ? "bg-emerald-400 dark:bg-emerald-500"
            : "bg-gradient-to-r from-primary to-[var(--color-cta,var(--color-primary))]"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
