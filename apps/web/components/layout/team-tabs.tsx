"use client"

import { useRouter, usePathname } from "next/navigation"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "projects", label: "Projects" },
  { value: "members", label: "Members" },
  { value: "settings", label: "Settings" },
]

interface TeamTabsProps {
  teamSlug: string
}

export function TeamTabs({ teamSlug }: TeamTabsProps) {
  const router = useRouter()
  const pathname = usePathname()

  const activeTab = TABS.find((t) => {
    if (t.value === "overview") return pathname === `/${teamSlug}`
    return pathname.startsWith(`/team/${teamSlug}/${t.value}`)
  })?.value ?? "overview"

  return (
    <VibenTabs
      value={activeTab}
      onValueChange={(v) => {
        if (v === "overview") router.push(`/${teamSlug}`)
        else router.push(`/team/${teamSlug}/${v}`)
      }}
    >
      <VibenTabsList variant="underline" className="gap-1">
        {TABS.map((tab) => (
          <VibenTabsTrigger key={tab.value} value={tab.value} variant="underline">
            {tab.label}
          </VibenTabsTrigger>
        ))}
      </VibenTabsList>
    </VibenTabs>
  )
}
