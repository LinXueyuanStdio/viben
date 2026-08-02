"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { Maximize2, Flag, MessageSquare, MoreHorizontal } from "lucide-react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils/index"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { useDrawer } from "./drawer-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { trackAnalytics } from "@/lib/analytics/track"
import { trackEngagement } from "@/lib/analytics/behavior"
import type { PageMetaData } from "@/components/content/page-meta"
import type { CommunityComment } from "@/components/content/comments-panel"

// --- Lazy-loaded tab content components ---

const loadingSkeleton = (
  <div className="animate-pulse space-y-3">
    <div className="h-5 w-2/3 rounded bg-muted/30" />
    <div className="h-4 w-full rounded bg-muted/30" />
    <div className="h-4 w-4/5 rounded bg-muted/30" />
  </div>
)

const LazyPageMeta = dynamic(
  () => import("@/components/content/page-meta").then((m) => ({ default: m.PageMeta })),
  { loading: () => loadingSkeleton },
)

const LazyCommentsPanel = dynamic(
  () => import("@/components/content/comments-panel").then((m) => ({ default: m.CommentsPanel })),
  { loading: () => loadingSkeleton },
)

const LazyNotesPanel = dynamic(
  () => import("@/components/content/notes-panel").then((m) => ({ default: m.NotesPanel })),
  { loading: () => loadingSkeleton },
)

const ReportDialog = dynamic(
  () => import("@/components/content/report-dialog").then(m => ({ default: m.ReportDialog })),
)

const FeedbackDialog = dynamic(
  () => import("@/components/content/feedback-dialog").then(m => ({ default: m.FeedbackDialog })),
)

// --- Typed tab interfaces ---

interface ReadDrawerMetaTab {
  value: string
  label: string
  badge?: number
  type: "meta"
  pageMeta: PageMetaData
  currentUserSlug?: string
}

interface ReadDrawerCommentsTab {
  value: string
  label: string
  badge?: number
  type: "comments"
  communityEntityId: string
  pageDbId: string
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
  sessionUserId?: string
  initialComments: CommunityComment[]
  initialNextCursor: string | null
}

interface ReadDrawerNotesTab {
  value: string
  label: string
  badge?: number
  type: "notes"
  pageId: string
}

type ReadDrawerTab = ReadDrawerMetaTab | ReadDrawerCommentsTab | ReadDrawerNotesTab

// --- Tab content renderer ---

function TabContent({ tab }: { tab: ReadDrawerTab }) {
  switch (tab.type) {
    case "meta":
      return <LazyPageMeta data={tab.pageMeta} currentUserSlug={tab.currentUserSlug} />
    case "comments":
      return (
        <LazyCommentsPanel
          communityEntityId={tab.communityEntityId}
          pageDbId={tab.pageDbId}
          isAuthenticated={tab.isAuthenticated}
          sessionUsername={tab.sessionUsername}
          sessionAvatarUrl={tab.sessionAvatarUrl}
          sessionUserId={tab.sessionUserId}
          initialComments={tab.initialComments}
          initialNextCursor={tab.initialNextCursor}
        />
      )
    case "notes":
      return <LazyNotesPanel pageId={tab.pageId} />
  }
}

// --- Drawer component ---

interface ReadDrawerProps {
  tabs: ReadDrawerTab[]
  defaultTab?: string
  pageId?: string
  userSlug?: string
}

export function ReadDrawer({ tabs, defaultTab, pageId, userSlug }: ReadDrawerProps) {
  const { t } = useTranslation()
  const { open, setOpen, setImmersive } = useDrawer()
  const [activeTab, setActiveTab] = React.useState(defaultTab || "comments")

  const [moreOpen, setMoreOpen] = React.useState(false)
  const [reportOpen, setReportOpen] = React.useState(false)
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)

  return (
    <div
      className={cn(
        "shrink-0 border-l border-border bg-background",
        "transition-[width] duration-[220ms] ease-out",
        "grid grid-rows-[auto_1fr]",
        open ? "w-[var(--drawer-w,420px)]" : "w-0 overflow-hidden border-l-0"
      )}
      style={{
        willChange: "width",
        paddingTop: "var(--reader-header-safe, var(--nav-h, 56px))",
        transition: "width 220ms ease-out, padding-top 180ms ease",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 h-[58px] px-3 border-b border-border overflow-hidden whitespace-nowrap">
        <VibenTabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <VibenTabsList variant="drawer">
            {tabs.map((tab) => (
              <VibenTabsTrigger key={tab.value} value={tab.value} variant="drawer">
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">{tab.badge}</span>
                )}
              </VibenTabsTrigger>
            ))}
          </VibenTabsList>
        </VibenTabs>

        {/* More menu */}
        <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors shrink-0"
              aria-label={t("community.moreActions")}
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => {
              setImmersive(true)
              trackAnalytics("immersive_enter")
              trackEngagement("immersive_toggle", { action: "enter" })
              setMoreOpen(false)
            }}>
              <Maximize2 className="mr-2 h-4 w-4 shrink-0" />
              {t("community.immersiveReading")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setMoreOpen(false); setReportOpen(true) }}>
              <Flag className="mr-2 h-4 w-4 shrink-0" />
              {t("community.report")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setMoreOpen(false); setFeedbackOpen(true) }}>
              <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
              {t("community.feedback")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="overflow-auto p-3">
        {tabs.map((tab) => (
          <div
            key={tab.value}
            className={cn(activeTab === tab.value ? "grid gap-3" : "hidden")}
          >
            <TabContent tab={tab} />
          </div>
        ))}
      </div>

      {/* Dialogs */}
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} entityType="published_page" entityId={pageId ?? ""} />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} pageId={pageId ?? ""} />
    </div>
  )
}
