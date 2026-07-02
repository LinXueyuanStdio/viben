"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import type { ComponentType, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  History,
  Info,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Pen,
  RotateCcw,
  Search,
  Share2,
  Tags,
  UploadCloud,
  AlertTriangle,
  GitCompare,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ============================================================================
// Types
// ============================================================================

interface PublishHistoryRecord {
  id: string
  record_number: number
  version: number
  action: string
  title: string
  icon: unknown
  description: string | null
  created_at: string
  is_current: boolean
  url: string
}

interface DiffLine {
  type: "added" | "removed" | "unchanged"
  content: string
  lineNumber: number
}

interface PageSettingsPanelProps {
  userSlug: string
  pageId: string
  pageTitle: string
  pageDescription: string
  pageUid: string
  pageTags: string[]
  pageVisibility: string
  pagePublishedAt: Date | string | null
  pageHtml: string
  pageViewCount?: number
  pageLikeCount?: number
  pageCommentCount?: number
  pageSeoTitle?: string | null
  pageSeoDescription?: string | null
  pageSeoKeywords?: string | null
  pageIsDiscoverable?: boolean
  className?: string
}

// ============================================================================
// Constants
// ============================================================================

const VIBEN_WEB_URL = "https://viben-web.vercel.app"

type PublishSettingsView = "overview" | "seo" | "embed" | "share"

function formatPublishRecordTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function buildEmbedCode(url: string): string {
  return `<iframe src="${url}" width="100%" height="600" frameborder="0" allowfullscreen />`
}

/**
 * Simple line-level diff between two HTML strings.
 * Marks lines as added / removed / unchanged.
 */
function computeSimpleDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  const result: DiffLine[] = []

  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined
    const newLine = i < newLines.length ? newLines[i] : undefined

    if (oldLine === undefined) {
      result.push({ type: "added", content: newLine!, lineNumber: i + 1 })
    } else if (newLine === undefined) {
      result.push({ type: "removed", content: oldLine, lineNumber: i + 1 })
    } else if (oldLine !== newLine) {
      result.push({ type: "removed", content: oldLine, lineNumber: i + 1 })
      result.push({ type: "added", content: newLine, lineNumber: i + 1 })
    } else {
      result.push({ type: "unchanged", content: oldLine, lineNumber: i + 1 })
    }
  }

  return result
}

// ============================================================================
// Sub-components
// ============================================================================

interface PublishActionRowProps {
  icon: ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  trailing?: ReactNode
}

function PublishActionRow({
  icon: Icon,
  label,
  onClick,
  trailing = <ChevronRight className="h-4 w-4 text-muted-foreground" />,
}: PublishActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 text-foreground">{label}</span>
      {trailing}
    </button>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function PageSettingsPanel({
  userSlug,
  pageId,
  pageTitle,
  pageDescription,
  pageUid,
  pageTags,
  pageVisibility,
  pagePublishedAt,
  pageHtml,
  pageViewCount,
  pageLikeCount,
  pageCommentCount,
  pageSeoTitle,
  pageSeoDescription,
  pageSeoKeywords,
  pageIsDiscoverable,
  className,
}: PageSettingsPanelProps) {
  const { t } = useTranslation()
  const router = useRouter()

  // Publish sub-view
  const [publishSettingsView, setPublishSettingsView] =
    useState<PublishSettingsView>("overview")

  // SEO state — initialised from props (server-loaded)
  const [seoDiscoverable, setSeoDiscoverable] = useState(pageIsDiscoverable ?? true)
  const [seoTitle, setSeoTitle] = useState(pageSeoTitle ?? pageTitle)
  const [seoDescription, setSeoDescription] = useState(pageSeoDescription ?? pageDescription)
  const [seoKeywords, setSeoKeywords] = useState(pageSeoKeywords ?? "")
  const [seoSaving, setSeoSaving] = useState(false)
  const [seoSaved, setSeoSaved] = useState(false)

  // Embed state
  const [showEmbedTitle, setShowEmbedTitle] = useState(true)

  // Publish state
  const [isPublished, setIsPublished] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)

  // History state
  const [publishHistory, setPublishHistory] = useState<PublishHistoryRecord[]>([])
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isRollingBack, setIsRollingBack] = useState(false)

  // Version diff state
  const [diffViewOpen, setDiffViewOpen] = useState(false)
  const [diffLines, setDiffLines] = useState<DiffLine[]>([])
  const [diffVersionTitle, setDiffVersionTitle] = useState("")
  const [diffVersionNumber, setDiffVersionNumber] = useState<number | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  // Rollback confirmation dialog
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState<PublishHistoryRecord | null>(null)

  // Derived
  const readUrl = `/${encodeURIComponent(userSlug)}/${encodeURIComponent(pageUid)}?tab=read`
  const externalPublishedUrl = publishedUrl
    ? `${VIBEN_WEB_URL}${publishedUrl}`
    : `${VIBEN_WEB_URL}${readUrl}`
  const embedCode = buildEmbedCode(externalPublishedUrl)
  const selectedRecord =
    publishHistory.find((record) => record.id === selectedRecordId) ??
    publishHistory[0] ??
    null

  // Check if SEO values changed from server state
  const seoChanged = useMemo(() => {
    return (
      seoDiscoverable !== (pageIsDiscoverable ?? true) ||
      seoTitle !== (pageSeoTitle ?? pageTitle) ||
      seoDescription !== (pageSeoDescription ?? pageDescription) ||
      seoKeywords !== (pageSeoKeywords ?? "")
    )
  }, [seoDiscoverable, seoTitle, seoDescription, seoKeywords, pageIsDiscoverable, pageSeoTitle, pageTitle, pageSeoDescription, pageDescription, pageSeoKeywords])

  // Reset seoSaved when seo values change
  useEffect(() => {
    if (seoChanged) {
      setSeoSaved(false)
    }
  }, [seoChanged])

  // ==========================================================================
  // Load publish history
  // ==========================================================================

  const loadPublishHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const res = await fetch("/api/pages/publish-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: pageUid }),
      })
      const data = await res.json()
      if (data.success) {
        const records = (data.records ?? []) as PublishHistoryRecord[]
        setPublishHistory(records)
        setIsPublished(records.length > 0)
        if (records.length > 0) {
          setPublishedUrl(data.records[0]?.url ?? null)
          setSelectedRecordId((current) => {
            if (current && records.some((r) => r.id === current)) return current
            return records[0]?.id ?? null
          })
        }
      }
    } catch (error) {
      console.error("[PageSettingsPanel] load publish history failed:", error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [pageUid])

  useEffect(() => {
    void loadPublishHistory()
  }, [loadPublishHistory])

  // ==========================================================================
  // SEO save handler
  // ==========================================================================

  const handleSaveSeoSettings = useCallback(async () => {
    setSeoSaving(true)
    try {
      const res = await fetch("/api/pages/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: pageUid,
          seo_title: seoTitle || null,
          seo_description: seoDescription || null,
          seo_keywords: seoKeywords || null,
          is_discoverable: seoDiscoverable,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save SEO settings")
      }
      setSeoSaved(true)
      toast.success(t("page.settings.seoSaved", "SEO 设置已保存"))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("page.settings.seoSaveFailed", "SEO 设置保存失败"),
      )
    } finally {
      setSeoSaving(false)
    }
  }, [pageUid, seoTitle, seoDescription, seoKeywords, seoDiscoverable, t])

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(successMessage)
    } catch {
      toast.error(t("community.copyFailed"))
    }
  }

  const handleEditPage = () => {
    router.push(`/pages/edit?page_id=${encodeURIComponent(pageUid)}`)
  }

  const handleOpenPublishedPage = () => {
    window.open(externalPublishedUrl, "_blank")
  }

  const handleOpenSelectedVersion = () => {
    if (!selectedRecord) return
    window.open(
      `${VIBEN_WEB_URL}${selectedRecord.url}`,
      "_blank",
    )
  }

  // ==========================================================================
  // Version diff
  // ==========================================================================

  const handleCompareVersion = useCallback(async (record: PublishHistoryRecord) => {
    setDiffLoading(true)
    setDiffViewOpen(true)
    setDiffVersionTitle(record.title)
    setDiffVersionNumber(record.version)

    try {
      // Fetch the version's HTML content
      const res = await fetch("/api/pages/publish-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: pageUid, version: record.version }),
      })
      const data = await res.json()
      if (data.success && data.html) {
        const diff = computeSimpleDiff(data.html, pageHtml)
        setDiffLines(diff)
      } else {
        // Fallback: compare line counts
        setDiffLines([
          { type: "unchanged", content: t("page.settings.diffUnavailable", "版本内容无法加载"), lineNumber: 1 },
        ])
      }
    } catch {
      setDiffLines([
        { type: "unchanged", content: t("page.settings.diffUnavailable", "版本内容无法加载"), lineNumber: 1 },
      ])
    } finally {
      setDiffLoading(false)
    }
  }, [pageUid, pageHtml, t])

  const handleOpenRollbackDialog = useCallback((record: PublishHistoryRecord) => {
    setRollbackTarget(record)
    setRollbackDialogOpen(true)
  }, [])

  const handleConfirmRollback = useCallback(async () => {
    if (!rollbackTarget || rollbackTarget.is_current) return

    setRollbackDialogOpen(false)
    setIsRollingBack(true)
    try {
      const res = await fetch("/api/pages/publish-rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: pageUid,
          version: rollbackTarget.version,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(
          data.error ?? t("page.settings.rollbackFailed", "Rollback failed"),
        )
      }
      if (data.url) {
        setPublishedUrl(data.url)
      }
      toast.success(
        t("page.settings.rollbackComplete", "Rollback complete"),
      )
      await loadPublishHistory()
    } catch (error) {
      console.error("[PageSettingsPanel] rollback failed:", error)
      toast.error(
        t("page.settings.rollbackFailed", "Rollback failed"),
      )
    } finally {
      setIsRollingBack(false)
      setRollbackTarget(null)
    }
  }, [rollbackTarget, pageUid, loadPublishHistory, t])

  const handleSocialShare = async (
    target: "x" | "whatsapp" | "facebook" | "linkedin" | "email",
  ) => {
    const encodedUrl = encodeURIComponent(externalPublishedUrl)
    const encodedTitle = encodeURIComponent(pageTitle)
    const targets: Record<typeof target, string> = {
      x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
    }
    window.open(targets[target], "_blank")
  }

  // ==========================================================================
  // Helper: diff stats
  // ==========================================================================

  const diffStats = useMemo(() => {
    const added = diffLines.filter((l) => l.type === "added").length
    const removed = diffLines.filter((l) => l.type === "removed").length
    return { added, removed }
  }, [diffLines])

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className={cn("grid gap-6", className)}>
      {/* Page Info Section */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {t("page.settings.pageInfo", "Page Info")}
          </h2>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              {t("page.settings.name", "Name")}
            </dt>
            <dd className="font-medium text-foreground">{pageTitle}</dd>
          </div>

          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              {t("pageEditor.uidLabel", "Page ID")}
            </dt>
            <dd className="font-mono text-xs text-foreground">{pageUid}</dd>
          </div>

          {pagePublishedAt && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t("pageEditor.settingsPublishedDate", "Published Date")}
              </dt>
              <dd className="text-xs text-foreground">
                {new Date(pagePublishedAt).toLocaleDateString("zh-CN")}
              </dd>
            </div>
          )}

          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              {t("pageEditor.settingsVisibilityLabel", "Visibility")}
            </dt>
            <dd className="text-xs text-foreground capitalize">
              {pageVisibility}
            </dd>
          </div>

          {pageViewCount !== undefined && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t("page.settings.views", "Views")}
              </dt>
              <dd className="text-xs text-foreground">{pageViewCount}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Publish Section */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <UploadCloud className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {t("page.settings.publish", "Publish")}
          </h2>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          {t(
            "page.settings.publishDescription",
            "Publish this static HTML page to the cloud.",
          )}
        </p>

        {/* Published URL card */}
        {isPublished && externalPublishedUrl && (
          <div className="mb-4 rounded-md border border-border bg-muted/50 p-3">
            {publishSettingsView === "overview" && (
              <div className="space-y-3">
                {/* URL bar */}
                <div className="flex min-w-0 items-center rounded-md border border-border bg-background">
                  <div className="shrink-0 border-r border-border px-2 py-2 font-mono text-xs text-muted-foreground">
                    {VIBEN_WEB_URL}
                  </div>
                  <div className="min-w-0 flex-1 truncate px-2 py-2 font-mono text-xs text-foreground">
                    {publishedUrl ?? readUrl}
                  </div>
                  <button
                    type="button"
                    aria-label={t("pageEditor.settingsCopyUrl", "Copy URL")}
                    onClick={() =>
                      copyText(
                        externalPublishedUrl,
                        t("page.settings.copyPublishedUrlSuccess", "Link copied"),
                      )
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("pageEditor.settingsOpenUrl", "Open Page")}
                    onClick={handleOpenPublishedPage}
                    className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>

                {/* SEO */}
                <div className="space-y-1">
                  <PublishActionRow
                    icon={Search}
                    label={t(
                      "page.settings.searchEngineIndex",
                      "Search engine indexing",
                    )}
                    onClick={() => setPublishSettingsView("seo")}
                  />
                </div>
                <div className="border-t border-border" />

                {/* Embed + Share */}
                <div className="space-y-1">
                  <PublishActionRow
                    icon={Code2}
                    label={t("page.settings.embedThisPage", "Embed this page")}
                    onClick={() => setPublishSettingsView("embed")}
                  />
                  <PublishActionRow
                    icon={Share2}
                    label={t(
                      "page.settings.shareToSocial",
                      "Share to social media",
                    )}
                    onClick={() => setPublishSettingsView("share")}
                  />
                </div>
                <div className="border-t border-border" />

                {/* Open in browser */}
                <div className="space-y-1">
                  <PublishActionRow
                    icon={ExternalLink}
                    label={t(
                      "page.settings.openInBrowser",
                      "Open in browser",
                    )}
                    onClick={handleOpenPublishedPage}
                    trailing={null}
                  />
                </div>
              </div>
            )}

            {/* SEO sub-view */}
            {publishSettingsView === "seo" && (
              <div className="space-y-4">
                <button
                  type="button"
                  aria-label={t("common.back", "Back")}
                  onClick={() => setPublishSettingsView("overview")}
                  className="flex items-center gap-2 text-sm font-medium text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t(
                    "page.settings.searchEngineIndex",
                    "Search engine indexing",
                  )}
                </button>

                <div className="flex items-center gap-3 rounded-md px-2 py-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-sm text-foreground">
                    {t(
                      "page.settings.discoverableOnWeb",
                      "Discoverable on the web",
                    )}
                  </span>
                  <Switch
                    checked={seoDiscoverable}
                    onCheckedChange={setSeoDiscoverable}
                    aria-label={t(
                      "page.settings.discoverableOnWeb",
                      "Discoverable on the web",
                    )}
                  />
                </div>

                <div className="border-t border-border" />

                <div className="space-y-3">
                  <div className="text-sm font-medium text-foreground">
                    {t("page.settings.seoPreview", "SEO Preview")}
                  </div>
                  <div className="rounded-md border border-border bg-background p-3">
                    <div className="truncate text-sm font-medium text-blue-600 dark:text-blue-400">
                      {seoTitle || pageTitle}
                    </div>
                    <div className="truncate text-xs text-green-700 dark:text-green-400">
                      {externalPublishedUrl}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {seoDescription ||
                        pageDescription ||
                        t("page.settings.seoDemoDescription", "Demo description")}
                    </div>
                  </div>

                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium text-foreground">
                      {t("page.settings.linkTitle", "Link title")}
                    </span>
                    <Input
                      value={seoTitle}
                      onChange={(event) => setSeoTitle(event.target.value)}
                    />
                  </label>

                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium text-foreground">
                      {t("page.settings.description", "Description")}
                    </span>
                    <Textarea
                      value={seoDescription}
                      onChange={(event) =>
                        setSeoDescription(event.target.value)
                      }
                      className="min-h-[84px]"
                    />
                  </label>

                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium text-foreground">
                      {t("page.settings.seoKeywords", "Keywords (comma separated)")}
                    </span>
                    <Input
                      value={seoKeywords}
                      onChange={(event) => setSeoKeywords(event.target.value)}
                      placeholder="keyword1, keyword2, keyword3"
                    />
                  </label>

                  <Button
                    size="sm"
                    onClick={handleSaveSeoSettings}
                    disabled={seoSaving || !seoChanged}
                    className="gap-2"
                  >
                    {seoSaving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : seoSaved ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : null}
                    {seoSaving
                      ? t("page.settings.saving", "保存中...")
                      : seoSaved
                        ? t("page.settings.seoSavedBtn", "已保存")
                        : t("page.settings.saveSeo", "保存 SEO 设置")}
                  </Button>
                </div>
              </div>
            )}

            {/* Embed sub-view */}
            {publishSettingsView === "embed" && (
              <div className="space-y-4">
                <button
                  type="button"
                  aria-label={t("common.back", "Back")}
                  onClick={() => setPublishSettingsView("overview")}
                  className="flex items-center gap-2 text-sm font-medium text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("page.settings.embedThisPage", "Embed this page")}
                </button>

                <div className="flex items-center gap-3 rounded-md px-2 py-2">
                  <Tags className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-sm text-foreground">
                    {t("page.settings.showPageTitle", "Show page title")}
                  </span>
                  <Switch
                    checked={showEmbedTitle}
                    onCheckedChange={setShowEmbedTitle}
                    aria-label={t(
                      "page.settings.showPageTitle",
                      "Show page title",
                    )}
                  />
                </div>

                <div className="border-t border-border" />

                <label className="block space-y-2 text-sm">
                  <span className="sr-only">
                    {t("page.settings.embedCode", "Embed code")}
                  </span>
                  <Textarea
                    aria-label={t("page.settings.embedCode", "Embed code")}
                    value={embedCode}
                    readOnly
                    className="min-h-[108px] font-mono text-xs"
                  />
                </label>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyText(
                      embedCode,
                      t(
                        "page.settings.copyEmbedSuccess",
                        "Embed code copied",
                      ),
                    )
                  }
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {t("page.settings.copyCode", "Copy code")}
                </Button>
              </div>
            )}

            {/* Share sub-view */}
            {publishSettingsView === "share" && (
              <div className="space-y-3">
                <button
                  type="button"
                  aria-label={t("common.back", "Back")}
                  onClick={() => setPublishSettingsView("overview")}
                  className="flex items-center gap-2 text-sm font-medium text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("page.settings.shareToSocial", "Share to social media")}
                </button>

                <div className="space-y-1">
                  <PublishActionRow
                    icon={Share2}
                    label={t("page.settings.shareToX", "Share to X")}
                    onClick={() => handleSocialShare("x")}
                    trailing={null}
                  />
                  <PublishActionRow
                    icon={MessageCircle}
                    label={t(
                      "page.settings.shareToWhatsapp",
                      "Share to WhatsApp",
                    )}
                    onClick={() => handleSocialShare("whatsapp")}
                    trailing={null}
                  />
                  <PublishActionRow
                    icon={Globe}
                    label={t(
                      "page.settings.shareToFacebook",
                      "Share to Facebook",
                    )}
                    onClick={() => handleSocialShare("facebook")}
                    trailing={null}
                  />
                  <PublishActionRow
                    icon={Link2}
                    label={t(
                      "page.settings.shareToLinkedin",
                      "Share to LinkedIn",
                    )}
                    onClick={() => handleSocialShare("linkedin")}
                    trailing={null}
                  />
                </div>

                <div className="border-t border-border" />

                <PublishActionRow
                  icon={Mail}
                  label={t("page.settings.shareToEmail", "Share via Email")}
                  onClick={() => handleSocialShare("email")}
                  trailing={null}
                />
              </div>
            )}
          </div>
        )}

        {/* Publish History */}
        {isPublished && publishHistory.length > 0 && (
          <div className="mb-4 rounded-md border border-border bg-muted/50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">
                  {t("page.settings.publishHistory", "Publish history")}
                </h3>
              </div>
              {isLoadingHistory && (
                <span className="text-xs text-muted-foreground">
                  {t("page.settings.loadingHistory", "Loading...")}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="max-h-48 space-y-1 overflow-auto">
                {publishHistory.map((record) => {
                  const selected = selectedRecord?.id === record.id
                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => setSelectedRecordId(record.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                        selected
                          ? "bg-background text-foreground"
                          : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {t("page.settings.versionLabel", "Version")}{" "}
                          {record.version}
                        </span>
                        <span className="block truncate text-xs">
                          {record.action === "rollback"
                            ? t(
                                "page.settings.rollbackAction",
                                "Rollback",
                              )
                            : t(
                                "page.settings.publishAction",
                                "Publish",
                              )}{" "}
                          · {formatPublishRecordTime(record.created_at)}
                        </span>
                      </span>
                      {record.is_current && (
                        <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                          {t(
                            "page.settings.currentVersion",
                            "Current",
                          )}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenSelectedVersion}
                  disabled={!selectedRecord}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("page.settings.openVersion", "Open version")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedRecord && !selectedRecord.is_current) {
                      void handleCompareVersion(selectedRecord)
                    }
                  }}
                  disabled={
                    !selectedRecord ||
                    selectedRecord.is_current
                  }
                >
                  <GitCompare className="mr-2 h-4 w-4" />
                  {t("page.settings.compare", "Compare")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedRecord && !selectedRecord.is_current) {
                      handleOpenRollbackDialog(selectedRecord)
                    }
                  }}
                  disabled={
                    !selectedRecord ||
                    selectedRecord.is_current ||
                    isRollingBack
                  }
                >
                  {isRollingBack ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  {isRollingBack
                    ? t(
                        "page.settings.rollingBack",
                        "Rolling back...",
                      )
                    : t("page.settings.rollbackAction", "Rollback")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit page button */}
        <Button
          variant="default"
          size="sm"
          onClick={handleEditPage}
        >
          <Pen className="mr-2 h-4 w-4" />
          {t("pageEditor.settingsEditPage")}
        </Button>
      </section>

      {/* Version Diff Dialog */}
      <Dialog open={diffViewOpen} onOpenChange={setDiffViewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="size-5" />
              {t("page.settings.diffTitle", "版本对比")}
              {diffVersionNumber !== null && (
                <span className="text-sm font-normal text-muted-foreground">
                  Version {diffVersionNumber} → {t("page.settings.currentVersion", "Current")}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {diffVersionTitle && (
                <span className="block truncate">{diffVersionTitle}</span>
              )}
              {!diffLoading && (
                <span className="text-xs">
                  <span className="text-emerald-500">+{diffStats.added}</span>{" "}
                  {t("page.settings.diffAdded", "added")},{" "}
                  <span className="text-red-500">-{diffStats.removed}</span>{" "}
                  {t("page.settings.diffRemoved", "removed")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {diffLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-auto flex-1 rounded-md border border-border bg-card">
              <pre className="p-4 text-xs font-mono leading-relaxed">
                {diffLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex",
                      line.type === "added" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      line.type === "removed" && "bg-red-500/10 text-red-600 dark:text-red-400",
                      line.type === "unchanged" && "text-muted-foreground",
                    )}
                  >
                    <span className="shrink-0 w-8 text-right mr-4 select-none text-muted-foreground">
                      {line.lineNumber}
                    </span>
                    <span className="shrink-0 w-4 mr-2 select-none">
                      {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                    </span>
                    <span className="whitespace-pre-wrap break-all">{line.content}</span>
                  </div>
                ))}
              </pre>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiffViewOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              {t("common.close", "关闭")}
            </Button>
            {diffVersionNumber !== null && !selectedRecord?.is_current && (
              <Button
                onClick={() => {
                  setDiffViewOpen(false)
                  if (selectedRecord) {
                    handleOpenRollbackDialog(selectedRecord)
                  }
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("page.settings.restoreThisVersion", "恢复此版本")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              {t("page.settings.confirmRollbackTitle", "确认回滚")}
            </DialogTitle>
            <DialogDescription>
              {rollbackTarget && (
                <span>
                  {t("page.settings.confirmRollbackDescription", "确定要回滚到 Version {version}（{title}）吗？当前版本的内容将被替换。", {
                    version: rollbackTarget.version,
                    title: rollbackTarget.title,
                  })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackDialogOpen(false)}>
              {t("common.cancel", "取消")}
            </Button>
            <Button onClick={handleConfirmRollback}>
              {t("page.settings.rollbackAction", "回滚")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PageSettingsPanel
