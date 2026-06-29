"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { X } from "lucide-react"
import { cn } from "@/lib/utils/index"
import { IconButton } from "@/components/ui/icon-button"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const open = searchParams.get("drawer") === "open"
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.value || "")

  const setOpen = (open: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (open) {
      params.set("drawer", "open")
    } else {
      params.delete("drawer")
    }
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }

  // Escape 键关闭
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open])

  // Body 滚动锁定
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={cn(
          "fixed inset-0 z-80 transition-colors duration-180",
          open
            ? "pointer-events-auto bg-[rgba(6,29,38,0.16)]"
            : "pointer-events-none bg-transparent"
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* 抽屉 */}
      <div
        className={cn(
          "fixed top-0 right-0 z-90 h-screen",
          "w-[min(420px,calc(100vw-22px))]",
          "grid grid-rows-[auto_1fr]",
          "border-l border-border",
          "bg-background/96 backdrop-blur-[16px]",
          "shadow-[-18px_0_36px_rgba(8,91,117,0.14)]",
          "transition-transform duration-[220ms] ease-out",
          open ? "translate-x-0" : "translate-x-[104%]"
        )}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between gap-2.5 h-[58px] px-3 border-b border-border">
          <VibenTabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1"
          >
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

          <IconButton size="compact" label="关闭抽屉" onClick={() => setOpen(false)}>
            <X className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        {/* 内容区 */}
        <div className="overflow-auto p-3">
          {tabs.map((tab) => (
            <div
              key={tab.value}
              className={cn(
                activeTab === tab.value ? "grid gap-3" : "hidden"
              )}
            >
              {tab.content}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
