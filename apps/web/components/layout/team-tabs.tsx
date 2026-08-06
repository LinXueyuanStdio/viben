"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useTranslation } from "react-i18next"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { cn } from "@/lib/utils/index"
import { Layout, FolderKanban, Users, Settings } from "lucide-react"

const TAB_KEYS = [
  { value: "overview", i18nKey: "team.tabs.overview", icon: Layout },
  { value: "projects", i18nKey: "team.tabs.projects", icon: FolderKanban },
  { value: "members", i18nKey: "team.tabs.members", icon: Users },
  { value: "settings", i18nKey: "team.tabs.settings", icon: Settings },
]

function getTeamMeta(): { teamSlug: string; teamName: string } | null {
  if (typeof window === "undefined") return null
  const el = document.getElementById("viben-team-meta")
  if (!el) return null
  try { return JSON.parse(el.textContent ?? "") } catch { return null }
}

interface TeamTabsProps {
  className?: string
}

function resolveTeamSlug(pathname: string): string {
  // /team/{slug}/... → extract from pathname (works in SSR)
  if (pathname.startsWith("/team/")) {
    return pathname.split("/")[2] ?? ""
  }
  // /{slug} overview → check DOM meta (client-only)
  if (typeof window !== "undefined") {
    const meta = getTeamMeta()
    if (meta?.teamSlug) return meta.teamSlug
  }
  return ""
}

export const TeamTabs = React.memo(function TeamTabs({ className }: TeamTabsProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const teamSlug = resolveTeamSlug(pathname)

  const activeTab = React.useMemo(() => {
    if (!teamSlug) return "overview"
    return TAB_KEYS.find((tab) => {
      if (tab.value === "overview") return pathname === `/${teamSlug}`
      return pathname.startsWith(`/team/${teamSlug}/${tab.value}`)
    })?.value ?? "overview"
  }, [pathname, teamSlug])

  // Optimistic tab switch: update underline immediately on click, reset when navigation completes
  const [optimisticTab, setOptimisticTab] = React.useState<string | null>(null)
  React.useEffect(() => { setOptimisticTab(null) }, [pathname])

  const value = optimisticTab ?? activeTab

  if (!teamSlug) return null

  return (
    <VibenTabs
      value={value}
      onValueChange={(v) => {
        setOptimisticTab(v)
        if (v === "overview") router.push(`/${teamSlug}`)
        else router.push(`/team/${teamSlug}/${v}`)
      }}
      className={cn("h-full", className)}
    >
      <VibenTabsList variant="underline" className="h-full gap-1">
        {TAB_KEYS.map((tab) => (
          <VibenTabsTrigger key={tab.value} value={tab.value} variant="underline">
            <tab.icon className="h-4 w-4" />
            <span className="ml-1.5">{t(tab.i18nKey)}</span>
          </VibenTabsTrigger>
        ))}
      </VibenTabsList>
    </VibenTabs>
  )
})
