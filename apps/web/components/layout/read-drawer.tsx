"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils/index"
import { IconButton } from "@/components/ui/icon-button"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { useDrawer } from "./drawer-context"

interface ReadDrawerTab {
  value: string
  label: string
  badge?: number
  content: React.ReactNode
}

interface ReadDrawerProps {
  tabs: ReadDrawerTab[]
  defaultTab?: string
}

export function ReadDrawer({ tabs, defaultTab }: ReadDrawerProps) {
  const { t } = useTranslation()
  const { open, setOpen } = useDrawer()
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.value || "")

  // Escape key + body scroll lock
  React.useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", handleKey)
    }
  }, [open, setOpen])

  return (
    <>
      {/* Backdrop — always rendered, opacity transition */}
      <div
        className={cn(
          "fixed inset-0 z-30 transition-opacity duration-180",
          open ? "opacity-100 pointer-events-auto bg-black/15 dark:bg-black/30" : "opacity-0 pointer-events-none"
        )}
        style={{ top: "var(--nav-h, 56px)" }}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer — always rendered, transform transition */}
      <div
        className={cn(
          "fixed right-0 z-30",
          "w-[min(420px,calc(100vw-22px))]",
          "grid grid-rows-[auto_1fr]",
          "border-l border-border",
          "bg-background/96 backdrop-blur-[16px]",
          "shadow-[-18px_0_36px_rgba(8,91,117,0.14)] dark:shadow-[-18px_0_36px_rgba(0,0,0,0.3)]",
          "transition-transform duration-[220ms] ease-out",
          open ? "translate-x-0" : "translate-x-[104%]"
        )}
        style={{
          top: "var(--nav-h, 56px)",
          height: "calc(100vh - var(--nav-h, 56px))",
          willChange: "transform",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2.5 h-[58px] px-3 border-b border-border">
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
          <IconButton size="compact" label={t("community.closeDrawer")} onClick={() => setOpen(false)}>
            <ArrowRight className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        {/* Content — always rendered, visibility via CSS */}
        <div className="overflow-auto p-3">
          {tabs.map((tab) => (
            <div
              key={tab.value}
              className={cn(activeTab === tab.value ? "grid gap-3" : "hidden")}
            >
              {tab.content}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
