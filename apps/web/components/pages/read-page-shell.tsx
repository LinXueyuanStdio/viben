"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useScriptData } from "@/hooks/use-script-data"
import { usePrefetchDrawerTabs } from "@/hooks/use-prefetch-drawer-tabs"
import { useAppShell } from "@/components/layout/app-shell"

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
  isPageManager: boolean
  activeTab: string
  children: React.ReactNode
}

export function ReadPageShell({
  userSlug,
  pageId,
  hasSidePage,
  isPageManager,
  activeTab: initialTab,
  children,
}: ReadPageShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = React.useState(initialTab)
  const { setReadPageMeta } = useAppShell()

  // Provide page meta to Topbar via AppShellContext
  React.useEffect(() => {
    setReadPageMeta({ hasSidePage, isPageManager })
    return () => setReadPageMeta(null)
  }, [hasSidePage, isPageManager, setReadPageMeta])

  // Provide page meta to legacy consumers via window.__viben_page_meta
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

  // Prefetch drawer tab data on idle
  const pageMeta = useScriptData<{ pageDbId: string; communityEntityId: string; pageUid: string }>("viben-page-meta")
  usePrefetchDrawerTabs({
    communityEntityId: pageMeta?.communityEntityId ?? "",
    pageDbId: pageMeta?.pageDbId ?? "",
    pageUid: pageMeta?.pageUid ?? "",
  })

  const handleTabChange = React.useCallback(
    (value: string) => {
      setActiveTab(value)
      const tab = value === "read" ? "read" : value
      router.replace(`${pathname}?tab=${tab}`, { scroll: false })
    },
    [router, pathname],
  )

  return <>{children}</>
}
