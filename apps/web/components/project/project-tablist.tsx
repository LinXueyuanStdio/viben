"use client"

import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TABS = [
  { value: "overview", label: "Overview", href: (team: string, proj: string) => `/${team}/${proj}` },
  { value: "pages", label: "Pages", href: (team: string, proj: string) => `/${team}/${proj}?tab=pages` },
  { value: "settings", label: "Settings", href: (team: string, proj: string) => `/${team}/${proj}?tab=settings` },
]

interface ProjectTablistProps {
  teamSlug: string
  projectSlug: string
  activeTab: "overview" | "pages" | "settings"
}

export function ProjectTablist({ teamSlug, projectSlug, activeTab }: ProjectTablistProps) {
  const router = useRouter()

  return (
    <div className="flex justify-center">
      <Tabs value={activeTab} onValueChange={(v) => {
        const tab = TABS.find((t) => t.value === v)
        if (tab) router.push(tab.href(teamSlug, projectSlug))
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
