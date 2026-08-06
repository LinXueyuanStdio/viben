"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FileText, Globe, User, Users, Calendar, FileEdit } from "lucide-react"

export interface ProjectMetaData {
  name: string
  projectSlug: string
  description: string | null
  team: {
    slug: string
    displayName: string
  }
  createdBy: {
    userSlug: string
    displayName: string
    avatarUrl: string | null
  }
  createdAt: Date | string
  stats: {
    pagesCount: number
  }
}

function formatDate(d: Date | string, locale: string): string {
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })
}

const metaRowClass = "flex items-center gap-2.5 py-2 text-sm"
const metaIconClass = "size-4 shrink-0 text-muted-foreground"

export function ProjectMeta({ data }: { data: ProjectMetaData }) {
  const { t, i18n } = useTranslation()

  return (
    <div className="grid gap-1">
      {/* 项目名称 */}
      <div className={metaRowClass}>
        <FileText className={metaIconClass} />
        <div>
          <div className="font-semibold text-base">{data.name}</div>
          <div className="text-xs text-muted-foreground">{data.projectSlug}</div>
        </div>
      </div>

      {/* 描述 */}
      <div className={metaRowClass}>
        <FileEdit className={metaIconClass} />
        <div>
          <span className="text-xs text-muted-foreground">{t("project.details.description")}</span>
          <p className="text-sm">{data.description || t("project.details.noDescription")}</p>
        </div>
      </div>

      {/* 所属团队 */}
      <div className={metaRowClass}>
        <Users className={metaIconClass} />
        <span className="text-xs text-muted-foreground">{t("project.details.team")}</span>
        <Link
          href={`/${encodeURIComponent(data.team.slug)}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {data.team.displayName}
        </Link>
      </div>

      {/* 创建者 */}
      <div className={metaRowClass}>
        <User className={metaIconClass} />
        <span className="text-xs text-muted-foreground">{t("project.details.createdBy")}</span>
        <Avatar className="size-5">
          <AvatarImage src={data.createdBy.avatarUrl ?? undefined} />
          <AvatarFallback className="text-[10px]">
            {data.createdBy.displayName.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <Link
          href={`/${encodeURIComponent(data.createdBy.userSlug)}`}
          className="text-sm font-medium hover:underline"
        >
          {data.createdBy.displayName}
        </Link>
      </div>

      {/* 创建时间 */}
      <div className={metaRowClass}>
        <Calendar className={metaIconClass} />
        <span className="text-xs text-muted-foreground">{t("project.details.createdAt")}</span>
        <span className="text-sm">{formatDate(data.createdAt, i18n.language)}</span>
      </div>

      {/* Pages 数量 */}
      <div className={metaRowClass}>
        <FileText className={metaIconClass} />
        <span className="text-xs text-muted-foreground">{t("project.details.pagesCount")}</span>
        <span className="text-sm font-medium">{data.stats.pagesCount}</span>
      </div>

      {/* 项目 URL */}
      <div className={metaRowClass}>
        <Globe className={metaIconClass} />
        <span className="text-xs text-muted-foreground">{t("project.details.url")}</span>
        <span className="text-xs font-mono break-all">
          {(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/^https?:\/\//, "")}/{encodeURIComponent(data.team.slug)}/{encodeURIComponent(data.projectSlug)}
        </span>
      </div>
    </div>
  )
}
