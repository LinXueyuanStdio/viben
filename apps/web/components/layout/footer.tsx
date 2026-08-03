"use client"

import Link from "next/link"
import { Trans, useTranslation } from "react-i18next"
import { BookOpen, ExternalLink, Layers, MessageSquare, Sparkles } from "lucide-react"
import { GithubIcon } from "@/components/ui/icons"

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-[min(1280px,100%)] px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Viben */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary/70" />
              Viben
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("homepage.footer.brandDesc")}
            </p>
          </div>

          {/* 产品 */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Layers className="h-4 w-4 text-primary/70" />
              {t("homepage.footer.product")}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/home" className="transition hover:text-foreground">{t("nav.home")}</Link></li>
              <li><Link href="/analytics" className="transition hover:text-foreground">{t("nav.analytics")}</Link></li>
              <li><Link href="/mcp-market" className="transition hover:text-foreground">{t("nav.mcpMarketplace")}</Link></li>
              <li><Link href="/skill-market" className="transition hover:text-foreground">{t("nav.skillsMarket")}</Link></li>
              <li><Link href="/leaderboard" className="transition hover:text-foreground">{t("nav.leaderboard")}</Link></li>
            </ul>
          </div>

          {/* 文档 */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <BookOpen className="h-4 w-4 text-primary/70" />
              {t("homepage.footer.docs")}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="https://linxueyuan.online/viben/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-foreground">
                  {t("nav.docsUsage")}
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </a>
              </li>
              <li><Link href="/docs/mcp" className="transition hover:text-foreground">{t("nav.docsMcp")}</Link></li>
              <li><Link href="/docs/api" className="transition hover:text-foreground">{t("nav.docsApi")}</Link></li>
            </ul>
          </div>

          {/* 社区 */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageSquare className="h-4 w-4 text-primary/70" />
              {t("homepage.footer.community")}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="https://github.com/LinXueyuanStdio/viben" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 transition hover:text-foreground">
                  <GithubIcon className="h-3.5 w-3.5" />
                  GitHub
                </a>
              </li>
              <li><a href="https://github.com/LinXueyuanStdio/viben/issues" target="_blank" rel="noopener noreferrer" className="transition hover:text-foreground">{t("homepage.footer.issues")}</a></li>
              <li><a href="https://github.com/LinXueyuanStdio/viben/discussions" target="_blank" rel="noopener noreferrer" className="transition hover:text-foreground">{t("homepage.footer.discussions")}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <Trans
            i18nKey="homepage.footer.copyright"
            values={{ year: new Date().getFullYear() }}
            components={{
              author: <a href="https://github.com/LinXueyuanStdio" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground" />,
            }}
          />
        </div>
      </div>
    </footer>
  )
}
