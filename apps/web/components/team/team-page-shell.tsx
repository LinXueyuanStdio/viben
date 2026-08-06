"use client"

import { useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { TeamOverview } from "./team-overview"
import { TopbarSlotProvider } from "@/components/layout/topbar-slots"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import type { ReactNode } from "react"

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "projects", label: "Projects" },
  { value: "members", label: "Members" },
  { value: "settings", label: "Settings" },
] as const

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

function TeamTabs({ teamSlug }: { teamSlug: string }) {
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

export function TeamPageShell({
  teamSlug, teamName, teamAvatarUrl, currentUserRole, projects = [], activeTab = "overview", children,
}: TeamPageShellProps) {
  const slots = useMemo(() => ({
    centerContent: <TeamTabs teamSlug={teamSlug} />,
  }), [teamSlug])

  return (
    <TopbarSlotProvider value={slots}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{teamName}</h1>

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
    </TopbarSlotProvider>
  )
}
