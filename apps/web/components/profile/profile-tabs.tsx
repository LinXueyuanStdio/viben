"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"

const TAB_KEYS = ["pages", "likes", "mcp", "skills"] as const

const TAB_LABELS: Record<string, string> = {
  pages: "页面",
  likes: "喜欢",
  mcp: "MCP",
  skills: "技能",
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

const DEFAULT_TAB = "概览"

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get("tab")
  const activeTab = TAB_LABELS[currentTab ?? "overview"] ?? DEFAULT_TAB

  const handleTabChange = useCallback((value: string) => {
    const key = Object.entries(TAB_LABELS).find(([, label]) => label === value)?.[0]
    const params = new URLSearchParams(searchParams.toString())
    if (key && key !== "overview") {
      params.set("tab", key)
    } else {
      params.delete("tab")
    }
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
  }, [router, pathname, searchParams])

  const countMap: Record<string, number | undefined> = {
    "页面": pageCount,
    "喜欢": likeCount,
    "MCP": mcpCount,
    "技能": skillCount,
  }

  const content: Record<string, React.ReactNode> = {
    "概览": overview,
    "页面": pages,
    "喜欢": likes,
    "MCP": mcp,
    "技能": skills,
  }

  return (
    <VibenTabs value={activeTab} onValueChange={handleTabChange}>
      <VibenTabsList>
        <VibenTabsTrigger key="overview" value="概览">
          概览
        </VibenTabsTrigger>
        {TAB_KEYS.map((key) => (
          <VibenTabsTrigger key={key} value={TAB_LABELS[key]}>
            {TAB_LABELS[key]}
            {countMap[TAB_LABELS[key]] != null && (
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {countMap[TAB_LABELS[key]]}
              </span>
            )}
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
