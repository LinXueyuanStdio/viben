"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { cn } from "@/lib/utils/index"
import { Layout, FolderKanban, Users, Settings } from "lucide-react"

const TABS = [
  { value: "overview", label: "Overview", icon: Layout },
  { value: "projects", label: "Projects", icon: FolderKanban },
  { value: "members", label: "Members", icon: Users },
  { value: "settings", label: "Settings", icon: Settings },
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

export const TeamTabs = React.memo(function TeamTabs({ className }: TeamTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const teamMeta = getTeamMeta()
  const teamSlug = teamMeta?.teamSlug

  const activeTab = React.useMemo(() => {
    if (!teamSlug) return "overview"
    return TABS.find((t) => {
      if (t.value === "overview") return pathname === `/${teamSlug}`
      return pathname.startsWith(`/team/${teamSlug}/${t.value}`)
    })?.value ?? "overview"
  }, [pathname, teamSlug])

  if (!teamSlug) return null

  return (
    <VibenTabs
      value={activeTab}
      onValueChange={(v) => {
        if (v === "overview") router.push(`/${teamSlug}`)
        else router.push(`/team/${teamSlug}/${v}`)
      }}
      className={cn("h-full", className)}
    >
      <VibenTabsList variant="underline" className="h-full gap-1">
        {TABS.map((tab) => (
          <VibenTabsTrigger key={tab.value} value={tab.value} variant="underline">
            <tab.icon className="h-4 w-4" />
            <span className="ml-1.5">{tab.label}</span>
          </VibenTabsTrigger>
        ))}
      </VibenTabsList>
    </VibenTabs>
  )
})
