"use client"

import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SearchEmptyProps {
  query: string
}

export function SearchEmpty({ query }: SearchEmptyProps) {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-[360px] place-items-center rounded-xl border border-border bg-surface p-7 shadow-sm">
      <div className="grid justify-items-center gap-3 max-w-[420px] text-center">
        <div className="grid h-[58px] w-[58px] place-items-center rounded-2xl bg-surface-secondary text-primary">
          <Search className="h-6 w-6" />
        </div>
        <h2 className="font-serif text-xl leading-tight">{t('community.noResults')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('community.noResultsHint')}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {["教程", "入门", "MCP", "部署"].map((kw) => (
            <Button key={kw} variant="outline" size="sm" asChild>
              <a href={`/search?q=${encodeURIComponent(kw)}`}>{kw}</a>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
