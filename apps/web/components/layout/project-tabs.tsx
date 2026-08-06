"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { cn } from "@/lib/utils/index"
import { Eye, FileText, Settings } from "lucide-react"

function getProjectMeta(): { teamSlug: string; projectSlug: string } | null {
  if (typeof window === "undefined") return null
  const el = document.getElementById("viben-project-meta")
  if (!el) return null
  try { return JSON.parse(el.textContent ?? "") } catch { return null }
}

interface ProjectTabsProps {
  className?: string
}

export const ProjectTabs = React.memo(function ProjectTabs({ className }: ProjectTabsProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const meta = getProjectMeta()
  const teamSlug = meta?.teamSlug
  const projectSlug = meta?.projectSlug
  const base = teamSlug && projectSlug ? `/${teamSlug}/${projectSlug}` : ""

  const activeTab = React.useMemo(() => {
    if (!base) return "overview"
    const tab = searchParams.get("tab")
    if (tab === "pages" || tab === "settings") return tab
    return "overview"
  }, [pathname, searchParams, base])

  // Optimistic tab switch
  const [optimisticTab, setOptimisticTab] = React.useState<string | null>(null)
  React.useEffect(() => { setOptimisticTab(null) }, [pathname, searchParams])

  const value = optimisticTab ?? activeTab

  if (!base) return null

  return (
    <VibenTabs
      value={value}
      onValueChange={(v) => {
        setOptimisticTab(v)
        if (v === "overview") router.replace(`${base}?tab=read`, { scroll: false })
        else router.replace(`${base}?tab=${v}`, { scroll: false })
      }}
      className={cn("h-full", className)}
    >
      <VibenTabsList variant="underline" className="h-full gap-1">
        <VibenTabsTrigger value="overview" variant="underline">
          <Eye className="h-4 w-4" />
          <span className="ml-1.5">{t("project.tabs.overview")}</span>
        </VibenTabsTrigger>
        <VibenTabsTrigger value="pages" variant="underline">
          <FileText className="h-4 w-4" />
          <span className="ml-1.5">{t("project.tabs.pages")}</span>
        </VibenTabsTrigger>
        <VibenTabsTrigger value="settings" variant="underline">
          <Settings className="h-4 w-4" />
          <span className="ml-1.5">{t("project.tabs.settings")}</span>
        </VibenTabsTrigger>
      </VibenTabsList>
    </VibenTabs>
  )
})
