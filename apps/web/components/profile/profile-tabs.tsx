"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTranslation } from "react-i18next"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"

const TAB_KEYS = ["pages", "likes", "mcp", "skills"] as const
type TabKey = "overview" | (typeof TAB_KEYS)[number]

const TAB_I18N_KEYS: Record<TabKey, string> = {
  overview: "profile.tabs.overview",
  pages: "profile.tabs.pages",
  likes: "profile.tabs.likes",
  mcp: "profile.tabs.mcp",
  skills: "profile.tabs.skills",
}

interface ProfileTabsProps {
  overview: React.ReactNode
  pages: React.ReactNode
  likes: React.ReactNode
  mcp: React.ReactNode
  skills: React.ReactNode
  pageCount?: number
  likeCount?: number
  mcpCount?: number
  skillCount?: number
}

export function ProfileTabs({
  overview,
  pages,
  likes,
  mcp,
  skills,
  pageCount,
  likeCount,
  mcpCount,
  skillCount,
}: ProfileTabsProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get("tab") ?? "overview"
  const activeTab: TabKey = (TAB_KEYS as readonly string[]).includes(currentTab) ? currentTab as TabKey : "overview"

  const handleTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value !== "overview") {
      params.set("tab", value)
    } else {
      params.delete("tab")
    }
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
  }, [router, pathname, searchParams])

  const countMap: Record<string, number | undefined> = {
    pages: pageCount,
    likes: likeCount,
    mcp: mcpCount,
    skills: skillCount,
  }

  const content: Record<string, React.ReactNode> = {
    overview,
    pages,
    likes,
    mcp,
    skills,
  }

  return (
    <VibenTabs value={activeTab} onValueChange={handleTabChange}>
      <VibenTabsList>
        <VibenTabsTrigger key="overview" value="overview">
          {t("profile.tabs.overview")}
        </VibenTabsTrigger>
        {TAB_KEYS.map((key) => (
          <VibenTabsTrigger key={key} value={key}>
            {t(TAB_I18N_KEYS[key])}
            {countMap[key] != null && (
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {countMap[key]}
              </span>
            )}
          </VibenTabsTrigger>
        ))}
      </VibenTabsList>
      {Object.entries(content).map(([key, node]) => (
        <VibenTabsContent key={key} value={key} className="mt-3">
          {node}
        </VibenTabsContent>
      ))}
    </VibenTabs>
  )
}
