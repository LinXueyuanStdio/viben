"use client"

import { useRouter, usePathname } from "next/navigation"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"

const TABS = [
  { value: "overview", label: "Overview", match: (p: string, slug: string) => p === `/${slug}` },
  { value: "projects", label: "Projects", match: (p: string, slug: string) => p.startsWith(`/team/${slug}/projects`) },
  { value: "members", label: "Members", match: (p: string, slug: string) => p.startsWith(`/team/${slug}/members`) },
  { value: "settings", label: "Settings", match: (p: string, slug: string) => p.startsWith(`/team/${slug}/settings`) },
]

interface TeamTablistProps {
  teamSlug: string
}

export function TeamTablist({ teamSlug }: TeamTablistProps) {
  const router = useRouter()
  const pathname = usePathname()

  const activeTab = TABS.find((t) => t.match(pathname, teamSlug))?.value ?? "overview"

  return (
    <VibenTabs
      value={activeTab}
      onValueChange={(v) => {
        const tab = TABS.find((t) => t.value === v)
        if (tab) {
          if (v === "overview") router.push(`/${teamSlug}`)
          else router.push(`/team/${teamSlug}/${v}`)
        }
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
