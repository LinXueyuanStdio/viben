import { TeamTablist } from "./team-tablist"
import { TeamOverview } from "./team-overview"
import type { ReactNode } from "react"

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
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">{teamName}</h1>
      </div>

      <TeamTablist teamSlug={teamSlug} activeTab={activeTab} />

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
