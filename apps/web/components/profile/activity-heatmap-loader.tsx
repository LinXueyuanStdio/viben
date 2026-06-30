"use client"

import { useEffect, useState, Suspense } from "react"
import { PageActivityHeatmap } from "@/components/content/page-activity-heatmap"
import type { PageActivityDay } from "@/components/content/page-activity-heatmap"

interface ActivityHeatmapLoaderProps {
  userSlug: string
}

function HeatmapInner({ userSlug }: ActivityHeatmapLoaderProps) {
  const [data, setData] = useState<PageActivityDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/users/${userSlug}/activity`)
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
  }, [userSlug])

  if (loading) {
    return (
      <div className="grid grid-cols-53 gap-[2px]">
        {Array.from({ length: 371 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-sm bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <section>
      <PageActivityHeatmap data={data} />
    </section>
  )
}

export function ActivityHeatmapLoader({ userSlug }: ActivityHeatmapLoaderProps) {
  return (
    <Suspense fallback={
      <div className="grid grid-cols-53 gap-[2px]">
        {Array.from({ length: 371 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-sm bg-muted" />
        ))}
      </div>
    }>
      <HeatmapInner userSlug={userSlug} />
    </Suspense>
  )
}
