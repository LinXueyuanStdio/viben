"use client"

import { ProjectDrawer } from "@/components/project/project-drawer"
import { useAppShell } from "@/components/layout/app-shell"
import type { ProjectMetaData } from "@/components/project/project-meta"
import type { CommunityComment } from "@/components/content/comments-panel"

interface ProjectDrawerClientProps {
  projectMeta: ProjectMetaData
  projectDbId: string
  communityEntityId: string
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
  sessionUserId?: string
  tabs: Array<"details" | "comments" | "notes">
}

export function ProjectDrawerClient({
  projectMeta,
  projectDbId,
  communityEntityId,
  isAuthenticated,
  sessionUsername,
  sessionAvatarUrl,
  sessionUserId,
  tabs,
}: ProjectDrawerClientProps) {
  const { isMobile } = useAppShell()

  const drawerTabs: Array<
    | { value: string; label: string; type: "details"; projectMeta: ProjectMetaData }
    | {
        value: string
        label: string
        badge?: number
        type: "comments"
        communityEntityId: string
        projectDbId: string
        isAuthenticated: boolean
        sessionUsername?: string
        sessionAvatarUrl?: string
        sessionUserId?: string
        initialComments: CommunityComment[]
        initialNextCursor: string | null
      }
    | {
        value: string
        label: string
        badge?: number
        type: "notes"
        entityType: "project"
        entityId: string
      }
  > = []

  if (tabs.includes("details")) {
    drawerTabs.push({ value: "details", label: "详情", type: "details", projectMeta })
  }
  if (tabs.includes("comments")) {
    drawerTabs.push({
      value: "comments",
      label: "评论",
      type: "comments",
      communityEntityId,
      projectDbId,
      isAuthenticated,
      sessionUsername,
      sessionAvatarUrl,
      sessionUserId,
      initialComments: [],
      initialNextCursor: null,
    })
  }
  if (tabs.includes("notes")) {
    drawerTabs.push({
      value: "notes",
      label: "笔记",
      type: "notes",
      entityType: "project",
      entityId: projectDbId,
    })
  }

  if (drawerTabs.length === 0) return null

  return (
    <ProjectDrawer tabs={drawerTabs} defaultTab="details" isMobile={isMobile} />
  )
}
