"use client"

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
    <>
      <script
        id="viben-team-meta"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ teamSlug, teamName }),
        }}
      />
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{teamName}</h1>

        <div className="min-w-0">
          {children}
        </div>
      </div>
    </>
  )
}
