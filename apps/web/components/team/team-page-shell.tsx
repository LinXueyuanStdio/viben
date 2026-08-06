"use client"

import { usePathname, useRouter } from "next/navigation"
import { TeamOverview } from "./team-overview"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import type { ReactNode } from "react"

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "projects", label: "Projects" },
  { value: "members", label: "Members" },
  { value: "settings", label: "Settings" },
]

interface ProjectItem {
  projectSlug: string
  name: string
  description: string | null
  createdAt: string | Date
}

interface TeamPageShellProps {
  teamSlug: string
  teamName: string
  teamAvatarUrl: string | null
  currentUserRole: string | null
  projects?: ProjectItem[]
  activeTab?: "overview" | "projects" | "members" | "settings"
  children?: ReactNode
}

export function TeamPageShell({
  teamSlug, teamName, teamAvatarUrl, currentUserRole, projects = [], activeTab = "overview", children,
}: TeamPageShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isOverview = pathname === `/${teamSlug}`

  // overview 页面 topbar 无法检测 team route，在这里渲染本地 tablist
  const localTabs = isOverview ? (
    <VibenTabs
      value="overview"
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
  ) : null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{teamName}</h1>

      {/* overview 页面本地 tablist，子页面由 topbar 显示 */}
      {localTabs}

      <div className="min-w-0">
        {activeTab === "overview" && (
          <TeamOverview
            teamSlug={teamSlug}
            projects={projects}
            currentUserRole={currentUserRole}
          />
        )}
        {children}
      </div>
    </div>
  )
}
