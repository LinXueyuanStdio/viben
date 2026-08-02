"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { Maximize2, Flag, MessageSquare, MoreHorizontal, X } from "lucide-react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils/index"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { useDrawer } from "./drawer-context"
import { useResizable } from "@/hooks/use-resizable"
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

// --- Drawer Header (shared) ---

function DrawerHeader({
  tabs,
  activeTab,
  onTabChange,
  isMobile,
  pageId,
}: {
  tabs: ReadDrawerTab[]
  activeTab: string
  onTabChange: (v: string) => void
  isMobile?: boolean
  pageId?: string
}) {
  const { t } = useTranslation()
  const { setOpen, setImmersive } = useDrawer()

  const [moreOpen, setMoreOpen] = React.useState(false)
  const [reportOpen, setReportOpen] = React.useState(false)
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)

  return (
    <div className="flex items-center gap-2.5 h-[58px] px-3 border-b border-border overflow-hidden whitespace-nowrap">
      <VibenTabs value={activeTab} onValueChange={onTabChange} className="flex-1">
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
            setOpen(false)
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

      {/* Close button (mobile only) */}
      {isMobile && (
        <button
          className="inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors shrink-0"
          aria-label={t("community.closeDrawer")}
          onClick={() => setOpen(false)}
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      )}

      {/* Dialogs */}
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} entityType="published_page" entityId={pageId ?? ""} />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} pageId={pageId ?? ""} />
    </div>
  )
}

// --- Drawer component ---

interface ReadDrawerProps {
  tabs: ReadDrawerTab[]
  defaultTab?: string
  pageId?: string
  userSlug?: string
  isMobile?: boolean
}

export function ReadDrawer({ tabs, defaultTab, pageId, isMobile }: ReadDrawerProps) {
  const { open, setOpen } = useDrawer()
  const [activeTab, setActiveTab] = React.useState(defaultTab || "comments")

  // Resizable drawer width (desktop only)
  const { handleProps, isDragging } = useResizable({
    cssVar: "--drawer-w",
    storageKey: "viben-drawer-w",
    minWidth: 280,
    maxWidth: 600,
    defaultWidth: 420,
    direction: "left",
  })

  // Desktop: auto-open drawer on mount
  React.useEffect(() => {
    if (!isMobile) {
      setOpen(true)
    }
  }, [isMobile, setOpen])

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-40 transition-opacity duration-[220ms] ease-out bg-black/40",
            open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          aria-hidden="true"
        />

        {/* Overlay panel */}
        <div
          className={cn(
            "fixed top-0 right-0 z-50",
            "w-full sm:w-[min(420px,100vw)]",
            "grid grid-rows-[auto_1fr]",
            "bg-background/96 backdrop-blur-[16px]",
            "border-l border-border shadow-[-18px_0_36px_rgba(8,91,117,0.14)]",
            "transition-transform duration-[220ms] ease-out",
            open ? "translate-x-0" : "translate-x-full"
          )}
          style={{ height: "100vh", willChange: "transform" }}
          onClick={(e) => e.stopPropagation()}
        >
          <DrawerHeader
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isMobile
            pageId={pageId}
          />

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
        </div>
      </>
    )
  }

  // Desktop: portal into AppShell's drawer slot (sibling of main)
  const slot = typeof document !== "undefined" ? document.getElementById("viben-drawer-slot") : null
  if (!slot) return null

  return createPortal(
    <div
      className={cn(
        "h-full w-full border-l border-border bg-background relative",
        "grid grid-rows-[auto_1fr]",
        !open && "hidden"
      )}
    >
      {/* Resize handle — left edge */}
      {open && (
        <div
          {...handleProps}
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[5px] cursor-col-resize transition-colors z-10",
            handleProps.className
          )}
        />
      )}
      <DrawerHeader
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pageId={pageId}
      />

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
    </div>,
    slot
  )
}
