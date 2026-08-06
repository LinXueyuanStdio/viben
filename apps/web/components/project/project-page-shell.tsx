"use client"

import type { ReactNode } from "react"

interface ProjectPageShellProps {
  teamSlug: string
  projectSlug: string
  projectName: string
  children?: ReactNode
}

export function ProjectPageShell({ teamSlug, projectSlug, projectName, children }: ProjectPageShellProps) {
  return (
    <>
      <script
        id="viben-project-meta"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ teamSlug, projectSlug }),
        }}
      />
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{projectName}</h1>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  )
}
