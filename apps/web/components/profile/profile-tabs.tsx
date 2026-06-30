"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"

const TAB_LABELS: Record<string, string> = {
  pages: "页面",
  likes: "喜欢",
  favorites: "收藏",
  moments: "动态",
  collections: "合集",
  about: "关于",
}

interface ProfileTabsProps {
  pages: React.ReactNode
  likes: React.ReactNode
  favorites: React.ReactNode
  moments: React.ReactNode
  collections: React.ReactNode
  about: React.ReactNode
}

export function ProfileTabs({ pages, likes, favorites, moments, collections, about }: ProfileTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get("tab")
  const activeTab = TAB_LABELS[currentTab ?? "pages"] ?? "页面"

  const handleTabChange = useCallback((value: string) => {
    const key = Object.entries(TAB_LABELS).find(([, label]) => label === value)?.[0]
    const params = new URLSearchParams(searchParams.toString())
    if (key && key !== "pages") {
      params.set("tab", key)
    } else {
      params.delete("tab")
    }
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
  }, [router, pathname, searchParams])

  const content: Record<string, React.ReactNode> = {
    "页面": pages,
    "喜欢": likes,
    "收藏": favorites,
    "动态": moments,
    "合集": collections,
    "关于": about,
  }

  return (
    <VibenTabs value={activeTab} onValueChange={handleTabChange}>
      <VibenTabsList>
        {Object.keys(TAB_LABELS).map((key) => (
          <VibenTabsTrigger key={key} value={TAB_LABELS[key]}>
            {TAB_LABELS[key]}
          </VibenTabsTrigger>
        ))}
      </VibenTabsList>
      {Object.entries(content).map(([label, node]) => (
        <VibenTabsContent key={label} value={label} className="mt-3">
          {node}
        </VibenTabsContent>
      ))}
    </VibenTabs>
  )
}
