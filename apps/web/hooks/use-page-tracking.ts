"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { isPublishedPageRoute } from "@/lib/navigation/page-route"
import { trackPageView } from "@/lib/analytics/behavior"

export function usePageTracking() {
  const pathname = usePathname()
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (prevPathname.current === pathname) return
    prevPathname.current = pathname

    const { isPage } = isPublishedPageRoute(pathname)
    const pageType = isPage ? "read"
      : pathname.startsWith("/home") ? "landing"
      : pathname === "/" ? "dashboard"
      : "other"

    trackPageView(pathname, pageType)
  }, [pathname])
}
