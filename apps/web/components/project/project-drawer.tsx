"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import dynamic from "next/dynamic"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils/index"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { useDrawer } from "@/components/layout/drawer-context"
import { useResizable } from "@/hooks/use-resizable"
import type { ProjectMetaData } from "@/components/project/project-meta"
import type { CommunityComment } from "@/components/content/comments-panel"

// --- Lazy-loaded tab content ---

const loadingSkeleton = (
  <div className="animate-pulse space-y-3">
    <div className="h-5 w-2/3 rounded bg-muted/30" />
    <div className="h-4 w-full rounded bg-muted/30" />
    <div className="h-4 w-4/5 rounded bg-muted/30" />
  </div>
)

const LazyProjectMeta = dynamic(
  () => import("@/components/project/project-meta").then((m) => ({ default: m.ProjectMeta })),
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

// --- Typed tabs ---

export interface ProjectDrawerDetailsTab {
  value: string
  label: string
  badge?: number
  type: "details"
  projectMeta: ProjectMetaData
}

export interface ProjectDrawerCommentsTab {
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

export interface ProjectDrawerNotesTab {
  value: string
  label: string
  badge?: number
  type: "notes"
  entityType: "project"
  entityId: string
}

export type ProjectDrawerTab =
  | ProjectDrawerDetailsTab
  | ProjectDrawerCommentsTab
  | ProjectDrawerNotesTab

// --- Tab content renderer ---

function TabContent({ tab }: { tab: ProjectDrawerTab }) {
  switch (tab.type) {
    case "details":
      return <LazyProjectMeta data={tab.projectMeta} />
    case "comments":
      return (
        <LazyCommentsPanel
          communityEntityId={tab.communityEntityId}
          pageDbId={tab.projectDbId}
          entityType="project"
          isAuthenticated={tab.isAuthenticated}
          sessionUsername={tab.sessionUsername}
          sessionAvatarUrl={tab.sessionAvatarUrl}
          sessionUserId={tab.sessionUserId}
          initialComments={tab.initialComments}
          initialNextCursor={tab.initialNextCursor}
        />
      )
    case "notes":
      return (
        <LazyNotesPanel
          entityType={tab.entityType}
          entityId={tab.entityId}
        />
      )
    default:
      return null
  }
}

// --- Drawer Header ---

function DrawerHeader({
  tabs,
  activeTab,
  onTabChange,
  isMobile,
}: {
  tabs: ProjectDrawerTab[]
  activeTab: string
  onTabChange: (v: string) => void
  isMobile?: boolean
}) {
  const { t } = useTranslation()
  const { setOpen } = useDrawer()

  return (
    <div className="flex items-center gap-2.5 h-[var(--nav-h)] px-3 border-b border-border/52 whitespace-nowrap">
      <VibenTabs value={activeTab} onValueChange={onTabChange} className="flex-1 h-full">
        <VibenTabsList variant="underline" className="h-full">
          {tabs.map((tab) => (
            <VibenTabsTrigger key={tab.value} value={tab.value} variant="underline">
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">{tab.badge}</span>
              )}
            </VibenTabsTrigger>
          ))}
        </VibenTabsList>
      </VibenTabs>

      {/* Close button */}
      <button
        className="inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors shrink-0"
        aria-label={t("community.closeDrawer")}
        onClick={() => setOpen(false)}
      >
        <X className="h-[18px] w-[18px]" />
      </button>
    </div>
  )
}

// --- ProjectDrawer component ---

export interface ProjectDrawerProps {
  tabs: ProjectDrawerTab[]
  defaultTab?: string
  isMobile?: boolean
}

export function ProjectDrawer({ tabs, defaultTab, isMobile }: ProjectDrawerProps) {
  const { open, setOpen } = useDrawer()
  const [activeTab, setActiveTab] = React.useState(defaultTab || "details")

  // Resizable drawer width (desktop only)
  const { handleProps } = useResizable({
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
            "border-l border-border transition-transform duration-[220ms] ease-out",
            open
              ? "translate-x-0 shadow-[-18px_0_36px_rgba(8,91,117,0.14)]"
              : "translate-x-full"
          )}
          style={{ height: "100vh", willChange: "transform" }}
          onClick={(e) => e.stopPropagation()}
        >
          <DrawerHeader
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isMobile
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

  // Desktop: portal into AppShell's drawer slot
  const slot = typeof document !== "undefined" ? document.getElementById("viben-drawer-slot") : null
  if (!slot) return null

  return createPortal(
    <div
      className={cn(
        "h-full w-full border-l border-border/52 bg-background/68 backdrop-blur-[18px] saturate-[1.18] relative",
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
