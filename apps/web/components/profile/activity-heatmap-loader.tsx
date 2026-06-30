"use client"

import { useEffect, useState, Suspense } from "react"
import { PageActivityHeatmap } from "@/components/content/page-activity-heatmap"
import type { PageActivityDay } from "@/components/content/page-activity-heatmap"

interface ActivityHeatmapLoaderProps {
  userId: string
}

function HeatmapInner({ userId }: ActivityHeatmapLoaderProps) {
  const [data, setData] = useState<PageActivityDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/users/${userId}/activity`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setData(json.data ?? [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId])

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
        <div className="h-3 w-24 rounded bg-muted mb-3" />
        <div className="grid grid-cols-53 gap-[2px]">
          {Array.from({ length: 371 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-sm bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <PageActivityHeatmap data={data} />
    </section>
  )
}

export function ActivityHeatmapLoader({ userId }: ActivityHeatmapLoaderProps) {
  return (
    <Suspense fallback={
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
        <div className="h-3 w-24 rounded bg-muted mb-3" />
        <div className="grid grid-cols-53 gap-[2px]">
          {Array.from({ length: 371 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-sm bg-muted" />
          ))}
        </div>
      </div>
    }>
      <HeatmapInner userId={userId} />
    </Suspense>
  )
}
