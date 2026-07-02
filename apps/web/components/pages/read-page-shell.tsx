"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"

declare global {
  interface Window {
    __viben_page_meta?: {
      hasSidePage: boolean
      userSlug: string
      pageId: string
      pageTitle?: string
      authorName?: string
      authorAvatarUrl?: string | null
      pageDbId?: string
      communityEntityId?: string
      visibility?: string
    }
  }
}

interface ReadPageShellProps {
  userSlug: string
  pageId: string
  hasSidePage: boolean
  activeTab: string
  children: React.ReactNode
}

export function ReadPageShell({
  userSlug,
  pageId,
  hasSidePage,
  activeTab: initialTab,
  children,
}: ReadPageShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = React.useState(initialTab)

  // Provide page meta to Topbar via window.__viben_page_meta
  React.useEffect(() => {
    window.__viben_page_meta = {
      hasSidePage,
      userSlug,
      pageId,
    }
    return () => {
      delete window.__viben_page_meta
    }
  }, [hasSidePage, userSlug, pageId])

  const handleTabChange = React.useCallback(
    (value: string) => {
      setActiveTab(value)
      const tab = value === "read" ? "read" : value
      router.replace(`${pathname}?tab=${tab}`, { scroll: false })
    },
    [router, pathname],
  )

  // TODO Phase 8: usePrefetchDrawerTabs(userSlug, pageId)

  return <>{children}</>
}
