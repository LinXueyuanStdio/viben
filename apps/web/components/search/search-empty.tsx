"use client"

import { useTranslation } from "react-i18next"
import { Search, TrendingUp, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface SearchEmptyProps {
  query: string
  /** 热门标签（未搜索时展示） */
  popularTags?: string[]
  /** 热门页面（空结果时展示） */
  popularPages?: Array<{ title: string; url: string; coverUrl: string | null }>
}

export function SearchEmpty({ query, popularTags, popularPages }: SearchEmptyProps) {
  const { t } = useTranslation()
  const hasQuery = query.trim().length > 0

  const tags = popularTags && popularTags.length > 0
    ? popularTags
    : ["教程", "入门", "MCP", "部署"]

  return (
    <div className="grid min-h-[360px] place-items-center rounded-xl border border-border bg-surface p-7 shadow-sm">
      <div className="grid justify-items-center gap-3 max-w-[420px] text-center">
        <div className="grid h-[58px] w-[58px] place-items-center rounded-2xl bg-surface-secondary text-primary">
          <Search className="h-6 w-6" />
        </div>
        <h2 className="font-serif text-xl leading-tight">
          {hasQuery ? t('community.noResults') : t('community.searchPlaceholder', "搜索 Viben 社区")}
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          {hasQuery
            ? t('community.noResultsHint')
            : t('community.searchIntro', "探索精选页面和热门话题")}
        </p>

        {/* 热门标签 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {tags.map((kw) => (
              <Button key={kw} variant="outline" size="sm" asChild>
                <a href={`/search?q=${encodeURIComponent(kw)}`}>{kw}</a>
              </Button>
            ))}
          </div>
        )}

        {/* 热门页面推荐 */}
        {popularPages && popularPages.length > 0 && (
          <div className="w-full mt-4">
            <div className="flex items-center gap-1.5 mb-2.5 text-sm text-muted-foreground font-bold">
              <TrendingUp className="h-4 w-4" />
              <span>{t("community.popularPages", "热门页面")}</span>
            </div>
            <div className="grid gap-2">
              {popularPages.map((p) => (
                <Link
                  key={p.url}
                  href={p.url}
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5 hover:border-primary/50 transition-colors text-left"
                >
                  <div
                    className="size-10 rounded-md bg-cover bg-center shrink-0"
                    style={
                      p.coverUrl
                        ? { backgroundImage: `url(${p.coverUrl})` }
                        : { background: "linear-gradient(135deg, var(--primary), var(--accent))" }
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{p.title}</p>
                  </div>
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
