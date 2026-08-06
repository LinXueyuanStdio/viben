"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Check, FolderKanban } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils/index"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SwitcherChevron } from "./switcher-chevron"

interface ProjectItem {
  projectSlug: string
  name: string
}

interface ProjectSwitcherPopoverProps {
  teamSlug: string
  currentProjectSlug: string
  groupHovered?: boolean
}

export function ProjectSwitcherPopover({
  teamSlug,
  currentProjectSlug,
  groupHovered = false,
}: ProjectSwitcherPopoverProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [selfHovered, setSelfHovered] = useState(false)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchProjects = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamSlug)}/projects`, {
        signal: controller.signal,
      })
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects ?? [])
      } else {
        setError(true)
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(true)
      }
    } finally {
      setLoading(false)
    }
  }, [teamSlug])

  // 打开时获取项目列表
  useEffect(() => {
    if (open) {
      fetchProjects()
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SwitcherChevron
          groupHovered={groupHovered}
          selfHovered={selfHovered}
          onMouseEnter={() => setSelfHovered(true)}
          onMouseLeave={() => setSelfHovered(false)}
          aria-label={t("community.switchProject")}
        />
      </PopoverTrigger>

      <PopoverContent
        className="w-[min(280px,calc(100vw-28px))] p-0"
        align="start"
        sideOffset={4}
      >
        <div className="px-3 py-2.5 border-b border-border">
          <p className="text-sm font-extrabold">{t("community.switchProject")}</p>
        </div>
        <ScrollArea className="max-h-[260px]">
          <div className="p-1">
            {loading && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {t("common.loading")}
              </p>
            )}
            {!loading && error && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {t("common.loadFailed")}
              </p>
            )}
            {!loading && !error && projects.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {t("community.noOtherProject")}
              </p>
            )}
            {!loading &&
              !error &&
              projects.map((project) => (
                <Link
                  key={project.projectSlug}
                  href={`/${encodeURIComponent(teamSlug)}/${encodeURIComponent(project.projectSlug)}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-[9px] px-2 py-1.5 min-h-[34px] text-sm font-extrabold",
                    "hover:bg-surface-secondary",
                    project.projectSlug === currentProjectSlug
                      ? "bg-surface-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FolderKanban className="h-4 w-4 shrink-0" />
                  <span className="truncate">{project.name}</span>
                  {project.projectSlug === currentProjectSlug && (
                    <Check className="h-3.5 w-3.5 ml-auto shrink-0" />
                  )}
                </Link>
              ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
