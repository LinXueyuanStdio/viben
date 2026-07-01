"use client"

import React from "react"
import { useTranslation } from "react-i18next"
import { usePathname } from "next/navigation"
import { Flag, MessageSquare, MoreHorizontal } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { ReportDialog } from "@/components/content/report-dialog"
import { FeedbackDialog } from "@/components/content/feedback-dialog"

export function ReadMoreMenu() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [reportOpen, setReportOpen] = React.useState(false)
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)

  const pageId = React.useMemo(() => {
    const parts = pathname.split("/")
    if (parts.length >= 3 && parts[1] !== "" && parts[1] !== "landing" && parts[2] !== "") {
      return parts[2]
    }
    return ""
  }, [pathname])

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <IconButton size="compact" label={t("community.moreActions")}>
          <MoreHorizontal className="h-4 w-4" />
        </IconButton>
        {open && (
          <div className="absolute top-full right-0 z-70 w-[min(180px,calc(100vw-28px))] grid gap-1 p-1.5 rounded-xl border border-border bg-popover/98 backdrop-blur-[14px] shadow-md">
            <button
              onClick={() => { setOpen(false); setReportOpen(true) }}
              className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            >
              <Flag className="h-4 w-4" /> {t("community.report")}
            </button>
            <button
              onClick={() => { setOpen(false); setFeedbackOpen(true) }}
              className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            >
              <MessageSquare className="h-4 w-4" /> {t("community.feedback")}
            </button>
          </div>
        )}
      </div>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} entityType="published_page" entityId={pageId} />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} pageId={pageId} />
    </>
  )
}
