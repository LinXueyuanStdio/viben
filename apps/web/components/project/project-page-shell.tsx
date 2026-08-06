"use client"

import type { ReactNode } from "react"

interface ProjectPageShellProps {
  teamSlug: string
  projectSlug: string
  children?: ReactNode
}

export function ProjectPageShell({ children }: ProjectPageShellProps) {
  return (
    <div
      className="h-full"
      style={{ paddingTop: "var(--reader-header-safe, var(--nav-h, 56px))" }}
    >
      {children}
    </div>
  )
}
