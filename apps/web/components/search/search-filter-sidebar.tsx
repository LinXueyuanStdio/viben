"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils/index"

interface FilterItem {
  label: string
  count: number
  value: string
}

interface SearchFilterSidebarProps {
  filters: FilterItem[]
  activeFilter: string
}

export function SearchFilterSidebar({ filters, activeFilter }: SearchFilterSidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("filter", value)
    } else {
      params.delete("filter")
    }
    router.push(`/search?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="grid gap-1.5">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => handleFilter(f.value === activeFilter ? "" : f.value)}
          className={cn(
            "flex items-center justify-between min-h-[34px] rounded-[9px] px-2.5 font-extrabold text-sm",
            f.value === activeFilter
              ? "bg-surface-secondary text-foreground"
              : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
          )}
        >
          <span>
            {f.label} ({f.count})
          </span>
        </button>
      ))}
    </div>
  )
}
