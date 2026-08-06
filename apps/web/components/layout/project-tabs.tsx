"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { cn } from "@/lib/utils/index"
import { Eye, FileText, Settings } from "lucide-react"

interface ProjectTabsProps {
  teamSlug: string
  projectSlug: string
  className?: string
}

export const ProjectTabs = React.memo(function ProjectTabs({ teamSlug, projectSlug, className }: ProjectTabsProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const base = `/${teamSlug}/${projectSlug}`

  const activeTab = React.useMemo(() => {
    const tab = searchParams.get("tab")
    if (tab === "pages" || tab === "settings") return tab
    return "overview"
  }, [searchParams])

  // Optimistic tab switch
  const [optimisticTab, setOptimisticTab] = React.useState<string | null>(null)
  React.useEffect(() => { setOptimisticTab(null) }, [searchParams])

  const value = optimisticTab ?? activeTab

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
