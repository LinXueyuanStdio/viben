"use client"

import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TABS = [
  { value: "overview", label: "Overview", href: (slug: string) => `/${slug}` },
  { value: "projects", label: "Projects", href: (slug: string) => `/team/${slug}/projects` },
  { value: "members", label: "Members", href: (slug: string) => `/team/${slug}/members` },
  { value: "settings", label: "Settings", href: (slug: string) => `/team/${slug}/settings` },
]

interface TeamTablistProps {
  teamSlug: string
  activeTab: "overview" | "projects" | "members" | "settings"
}

export function TeamTablist({ teamSlug, activeTab }: TeamTablistProps) {
  const router = useRouter()

  return (
    <div className="flex justify-center">
      <Tabs value={activeTab} onValueChange={(v) => {
        const tab = TABS.find((t) => t.value === v)
        if (tab) router.push(tab.href(teamSlug))
      }}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
