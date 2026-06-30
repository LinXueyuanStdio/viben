import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCount } from "@/lib/utils/format"

export interface StatProps {
  icon: LucideIcon
  value: number | string
  format?: boolean
  className?: string
  dataAction?: string
  onClick?: (action: string) => void
  disabled?: boolean
  active?: boolean
}

export function Stat({ icon: Icon, value, format = false, className, dataAction, onClick, disabled, active }: StatProps) {
  const displayValue = format && typeof value === "number" ? formatCount(value) : value

  if (onClick && dataAction) {
    return (
      <button
        type="button"
        data-action={dataAction}
        onClick={disabled ? undefined : () => onClick(dataAction)}
        aria-pressed={active}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-1 text-[12.5px] text-muted-foreground rounded-md px-1 py-0.5 -mx-1 transition-all duration-200",
          !disabled && "hover:text-foreground",
          disabled && "opacity-60 cursor-default",
          active && "text-red-500",
          className
        )}
      >
        <Icon className={cn("size-[14px] shrink-0 transition-transform duration-200", active && "scale-110")} />
        <span>{displayValue}</span>
      </button>
    )
  }

  return (
    <span className={cn("inline-flex items-center gap-1 text-[12.5px] text-muted-foreground", className)}>
      <Icon className="size-[14px] shrink-0" />
      <span>{displayValue}</span>
    </span>
  )
}

interface StatsRowProps {
  stats: StatProps[]
  className?: string
}

export function StatsRow({ stats, className }: StatsRowProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-[7px]", className)}>
      {stats.map((stat, i) => (
        <Stat key={stat.dataAction ?? i} {...stat} />
      ))}
    </div>
  )
}
