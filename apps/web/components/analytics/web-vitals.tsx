"use client"

import { useReportWebVitals } from "next/web-vitals"
import { usePathname } from "next/navigation"
import { isPublishedPageRoute } from "@/lib/navigation/page-route"
import { usePageTracking } from "@/hooks/use-page-tracking"

export function WebVitalsReporter() {
  usePageTracking()

  const pathname = usePathname()
  const { isPage } = isPublishedPageRoute(pathname)

  useReportWebVitals((metric) => {
    // Only report in production
    if (process.env.NODE_ENV !== "production") return

    const payload = {
      name: metric.name,
      value: Math.round(metric.value * 100) / 100,
      rating: metric.rating,
      navigationType: metric.navigationType,
      page_type: isPage ? "read" : "dashboard",
      pathname,
    }

    // Use console.log with [perf] prefix for consistency with existing logging
    // Vercel Logs captures these alongside the Analytics dashboard
    console.log("[perf] web_vital", JSON.stringify(payload))
  })

  return null
}
