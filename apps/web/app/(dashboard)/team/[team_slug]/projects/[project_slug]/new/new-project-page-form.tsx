"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import DOMPurify from "dompurify"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, FileText, Globe, Eye, Send } from "lucide-react"
import { slugify } from "@/lib/utils"
import { toast } from "sonner"

interface Props {
  userSlug: string
  teamSlug: string
  projectSlug: string
}

export function NewProjectPageForm({ userSlug, teamSlug, projectSlug }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [uid, setUid] = useState("")
  const [uidManuallyEdited, setUidManuallyEdited] = useState(false)
  const [description, setDescription] = useState("")
  const [htmlContent, setHtmlContent] = useState("")
  const [visibility, setVisibility] = useState<"public" | "private">("public")
  const [submitting, setSubmitting] = useState(false)

  const autoUid = useMemo(() => slugify(title), [title])
  const displayedUid = uidManuallyEdited ? uid : autoUid

  const previewHtml = useMemo(() => {
    if (!htmlContent.trim()) return ""
    try { return DOMPurify.sanitize(htmlContent, { WHOLE_DOCUMENT: true }) } catch { return "" }
  }, [htmlContent])

  const handlePublish = async () => {
    if (!title.trim()) { toast.error(t("pageEditor.titleRequired")); return }
    const finalUid = displayedUid.trim()
    if (!finalUid) { toast.error(t("pageEditor.uidRequired")); return }
    if (!htmlContent.trim()) { toast.error(t("pageEditor.contentRequired")); return }

    setSubmitting(true)
    try {
      const html = DOMPurify.sanitize(htmlContent, { WHOLE_DOCUMENT: true })
      // 1. Publish the page
      const publishRes = await fetch("/api/pages/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: finalUid,
          title: title.trim(),
          html,
          description: description.trim() || undefined,
          visibility,
        }),
      })
      const publishData = await publishRes.json()
      if (!publishRes.ok) throw new Error(publishData.error ?? "Publish failed")

      // 2. Add page to project
      if (publishData.page_id) {
        await fetch(`/api/teams/${teamSlug}/projects/${projectSlug}/pages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_id: publishData.page_id }),
        })
      }

      toast.success(t("team.newProject.created"))
      router.push(`/${teamSlug}/${projectSlug}?tab=pages`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8 pb-24">
      <h1 className="text-2xl font-semibold tracking-tight">
        Create Page for {projectSlug}
      </h1>

      {/* Basic Info */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b border-border pb-2">
          <FileText className="size-4 mr-2 inline" />
          {t("pageEditor.basicInfo")}
        </h2>
        <p className="text-[13px] text-muted-foreground -mt-2">
          Title and description for your page.
        </p>

        <div className="space-y-2">
          <Label htmlFor="title">
            {t("pageEditor.titleLabel")} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("pageEditor.titlePlaceholder")}
            className="text-lg font-medium"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="uid">
            Page URL <span className="text-red-500">*</span>
          </Label>
          <div className="flex items-center gap-0 rounded-md border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
            <span className="shrink-0 px-3 py-2 text-sm text-muted-foreground bg-surface-secondary border-r border-border select-none">
              {userSlug} /
            </span>
            <input
              id="uid"
              value={displayedUid}
              onChange={(e) => { setUidManuallyEdited(true); setUid(e.target.value) }}
              placeholder={autoUid || "page-url"}
              className="flex-1 min-w-0 border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground font-medium"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t("pageEditor.descriptionLabel")}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("pageEditor.descriptionPlaceholder")}
            rows={2}
          />
        </div>
      </section>

      {/* Configuration */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b border-border pb-2">
          <Globe className="size-4 mr-2 inline" />
          {t("pageEditor.configuration")}
        </h2>
        <div className="rounded-lg border border-border p-4 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 items-center">
          <div>
            <Label className="text-sm font-semibold">{t("pageEditor.visibilityLabel")}</Label>
          </div>
          <Select value={visibility} onValueChange={(v: "public" | "private") => setVisibility(v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">🌐 {t("pageEditor.public")}</SelectItem>
              <SelectItem value="private">🔒 {t("pageEditor.private")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Content */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b border-border pb-2">
          <Eye className="size-4 mr-2 inline" />
          {t("pageEditor.editContent")} <span className="text-red-500">*</span>
        </h2>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label>{t("pageEditor.htmlLabel")}</Label>
            <Textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
              placeholder="<!DOCTYPE html>..."
            />
          </div>
          {previewHtml && (
            <div className="space-y-2">
              <Label>{t("pageEditor.previewLabel")}</Label>
              <div className="overflow-hidden rounded-md border border-border bg-card aspect-[1200/630]">
                <iframe
                  title="Preview"
                  srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;line-height:1.6;padding:1rem;color:#333}img{max-width:100%;height:auto}</style></head><body>${previewHtml}</body></html>`}
                  sandbox="allow-same-origin"
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Publish bar */}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 border-t border-border bg-background/95 backdrop-blur-sm flex items-center justify-between gap-4">
        <p className="text-[13px] text-muted-foreground">
          {title.trim() ? `${userSlug}/${displayedUid}` : "Fill in a title to publish"}
        </p>
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={submitting} size="lg" className="gap-2">
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {!submitting && <Send className="size-4" />}
            {submitting ? "Publishing..." : "Publish to Project"}
          </Button>
        </div>
      </div>
    </div>
  )
}
