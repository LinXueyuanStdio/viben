"use client"

import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import DOMPurify from "dompurify"
import { toast } from "sonner"
import { X, Loader2, Upload, FileText, Globe, Eye, Send, Clock, AlertTriangle } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { slugify } from "@/lib/utils"
import { captureHtmlCover } from "@/lib/cover-capture"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CollectionSelector } from "@/components/pages/collection-selector"
import type { CollectionSelectorValue } from "@/components/pages/collection-selector"
import { useAutoSave } from "@/hooks/use-auto-save"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface PageEditorInitialData {
  pageId: string
  title: string
  uid: string
  description: string
  html: string
  visibility: "public" | "unlisted" | "private"
  tags: string[]
  coverUrl?: string | null
}

interface ProjectPageEditorProps {
  userSlug: string
  teamSlug: string
  projectSlug: string
  initialData?: PageEditorInitialData
}

/** Shape of data persisted in localStorage for the page editor draft */
interface PageEditorDraft {
  title: string
  uid: string
  uidManuallyEdited: boolean
  description: string
  htmlContent: string
  visibility: "public" | "private"
  tags: string[]
  coverUrl: string | null
}

type PublishMode = "now" | "scheduled"

export function ProjectPageEditor({ userSlug, teamSlug, projectSlug, initialData }: ProjectPageEditorProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const isEditMode = !!initialData

  const [title, setTitle] = useState(initialData?.title ?? "")
  const [uid, setUid] = useState(initialData?.uid ?? "")
  const [uidManuallyEdited, setUidManuallyEdited] = useState(isEditMode)
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [htmlContent, setHtmlContent] = useState(initialData?.html ?? "")
  const [visibility, setVisibility] = useState<"public" | "private">(
    initialData?.visibility === "private" ? "private" : "public",
  )
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [tagInput, setTagInput] = useState("")
  const [coverUrl, setCoverUrl] = useState<string | null>(initialData?.coverUrl ?? null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const uploadBackoffRef = useRef({ attempts: 0, cooldownUntil: 0 })
  const [collection, setCollection] = useState<CollectionSelectorValue | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewWrapperRef = useRef<HTMLDivElement>(null)
  const previewIframeRef = useRef<HTMLIFrameElement>(null)
  const [previewScale, setPreviewScale] = useState(1)

  // Scheduled publishing
  const [publishMode, setPublishMode] = useState<PublishMode>("now")
  const [scheduledAt, setScheduledAt] = useState("")

  // Draft restoration dialog
  const [showDraftDialog, setShowDraftDialog] = useState(false)
  const draftHandledRef = useRef(false)

  // Build draft key
  const draftKey = useMemo(
    () => `project-page-editor:${teamSlug}/${projectSlug}:${userSlug}:${initialData?.uid ?? "new"}`,
    [teamSlug, projectSlug, userSlug, initialData?.uid],
  )

  // Build draft data for auto-save
  const draftData = useMemo<PageEditorDraft>(() => ({
    title,
    uid,
    uidManuallyEdited,
    description,
    htmlContent,
    visibility,
    tags,
    coverUrl,
  }), [title, uid, uidManuallyEdited, description, htmlContent, visibility, tags, coverUrl])

  const hasChanges = useMemo(() => {
    return (
      title !== (initialData?.title ?? "") ||
      htmlContent !== (initialData?.html ?? "") ||
      description !== (initialData?.description ?? "")
    )
  }, [title, htmlContent, description, initialData])

  // Auto-save hook
  const { saved, saving, restoreDraft, clearDraft, hasDraft } = useAutoSave<PageEditorDraft>({
    key: draftKey,
    data: draftData,
    debounceMs: 3000,
    enabled: hasChanges,
  })

  // Check for existing draft on mount
  useEffect(() => {
    if (draftHandledRef.current) return
    draftHandledRef.current = true
    if (!initialData && hasDraft()) {
      setShowDraftDialog(true)
    }
  }, [initialData, hasDraft])

  const handleRestoreDraft = useCallback(() => {
    const draft = restoreDraft()
    if (draft) {
      setTitle(draft.title)
      setUid(draft.uid)
      setUidManuallyEdited(draft.uidManuallyEdited)
      setDescription(draft.description)
      setHtmlContent(draft.htmlContent)
      setVisibility(draft.visibility)
      setTags(draft.tags)
      setCoverUrl(draft.coverUrl)
      toast.success(t("pageEditor.draftRestored"))
    }
    setShowDraftDialog(false)
  }, [restoreDraft, t])

  const handleDiscardDraft = useCallback(() => {
    clearDraft()
    setShowDraftDialog(false)
  }, [clearDraft])

  // beforeunload protection for unsaved changes
  useEffect(() => {
    if (!hasChanges) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [hasChanges])

  useEffect(() => {
    const el = previewWrapperRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setPreviewScale(el.clientWidth / 1200)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Auto-slugify from title when not manually edited
  const autoUid = useMemo(() => slugify(title), [title])
  useEffect(() => {
    if (!uidManuallyEdited) setUid(autoUid)
  }, [autoUid, uidManuallyEdited])

  const displayedUid = uid || autoUid

  // UID availability check
  const [uidStatus, setUidStatus] = useState<"idle" | "checking" | "available" | "unavailable">("idle")
  const uidCheckRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!displayedUid.trim()) { setUidStatus("idle"); return }
    setUidStatus("checking")
    clearTimeout(uidCheckRef.current)
    uidCheckRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pages/check-uid?uid=${encodeURIComponent(displayedUid)}`)
        if (!res.ok) { setUidStatus("available"); return }
        const data = await res.json()
        setUidStatus(data.available ? "available" : "unavailable")
      } catch {
        setUidStatus("available")
      }
    }, 500)
    return () => clearTimeout(uidCheckRef.current)
  }, [displayedUid])

  const handleCoverUpload = useCallback(async (file: File) => {
    const now = Date.now()
    const backoff = uploadBackoffRef.current

    if (now < backoff.cooldownUntil) {
      const wait = Math.ceil((backoff.cooldownUntil - now) / 1000)
      toast.error(`请等待 ${wait} 秒后再上传`)
      return
    }

    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    const MAX_SIZE = 10 * 1024 * 1024
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t("pageEditor.invalidFileType"))
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error(t("pageEditor.fileTooLarge"))
      return
    }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("kind", "page_cover")
      formData.append("user_slug", userSlug)
      formData.append("uid", uid || autoUid)
      const res = await fetch("/api/media/upload", { method: "POST", body: formData })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      setCoverUrl(data.url)
      const attempts = backoff.attempts + 1
      const delay = Math.pow(2, attempts) * 1000
      uploadBackoffRef.current = { attempts, cooldownUntil: Date.now() + delay }
    } catch {
      const attempts = backoff.attempts + 1
      const delay = Math.pow(2, attempts) * 1000
      uploadBackoffRef.current = { attempts, cooldownUntil: Date.now() + delay }
      toast.error(`上传失败，请 ${Math.ceil(delay / 1000)} 秒后重试`)
    } finally {
      setIsUploading(false)
    }
  }, [t])

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const newTag = tagInput.trim()
      if (!newTag) return
      if (tags.length >= 12) { toast.warning(t("pageEditor.tagLimitReached")); return }
      if (!tags.some((t) => t.toLowerCase() === newTag.toLowerCase())) {
        setTags((prev) => [...prev, newTag])
      }
      setTagInput("")
    }
  }, [tagInput, tags, t])

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const previewHtml = useMemo(() => {
    if (!htmlContent.trim()) return ""
    try {
      return DOMPurify.sanitize(htmlContent, { WHOLE_DOCUMENT: true })
    } catch {
      return `<div style="color:red;padding:1rem;">${t("pageEditor.parseError")}</div>`
    }
  }, [htmlContent, t])

  const handlePublish = useCallback(async () => {
    if (!title.trim()) { toast.error(t("pageEditor.titleRequired")); return }
    const finalUid = (uid || autoUid).trim()
    if (!finalUid) { toast.error(t("pageEditor.uidRequired")); return }
    if (!htmlContent.trim()) { toast.error(t("pageEditor.contentRequired")); return }

    // Validate scheduled time
    if (publishMode === "scheduled" && scheduledAt) {
      const scheduledDate = new Date(scheduledAt)
      if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        toast.error(t("pageEditor.scheduledTimeInvalid"))
        return
      }
    }

    setIsSubmitting(true)
    try {
      // 自动封面：未上传封面时从预览 iframe 截图
      let finalCoverUrl = coverUrl
      if (!finalCoverUrl && previewIframeRef.current?.contentDocument?.body) {
        try {
          const blob = await captureHtmlCover(previewIframeRef.current.contentDocument.body)
          if (blob) {
            const formData = new FormData()
            formData.append("file", new File([blob], "cover.png", { type: "image/png" }))
            formData.append("kind", "page_cover")
            formData.append("user_slug", userSlug)
            formData.append("uid", finalUid)
            const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData })
            if (uploadRes.ok) {
              const data = await uploadRes.json()
              finalCoverUrl = data.url
            }
          }
        } catch (e) { console.warn("Auto cover capture failed:", e) }
      }
      const html = DOMPurify.sanitize(htmlContent, { WHOLE_DOCUMENT: true })
      const res = await fetch("/api/pages/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: finalUid, title: title.trim(), html,
          description: description.trim() || undefined,
          visibility, tags: tags.length > 0 ? tags : undefined,
          cover_url: finalCoverUrl,
          collection_slug: collection?.slug, collection_name: collection?.name,
          scheduled_at: publishMode === "scheduled" && scheduledAt ? scheduledAt : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("pageEditor.publishFailed"))
      // Clear draft on successful publish
      clearDraft()

      // Add page to project
      if (data.page_id) {
        await fetch(`/api/teams/${teamSlug}/projects/${projectSlug}/pages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_id: data.page_id }),
        })
      }

      toast.success(
        publishMode === "scheduled"
          ? t("pageEditor.scheduledSuccess")
          : t("pageEditor.publishSuccess"),
      )
      router.push(`/${encodeURIComponent(teamSlug)}/${encodeURIComponent(projectSlug)}?tab=pages`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pageEditor.publishFailed"))
    } finally { setIsSubmitting(false) }
  }, [title, uid, autoUid, htmlContent, description, visibility, tags, coverUrl, collection, router, t, userSlug, publishMode, scheduledAt, clearDraft])

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8 pb-24">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isEditMode ? t("pageEditor.editTitle") : `Create Page for ${projectSlug}`}
      </h1>

      {/* Draft restoration dialog */}
      <Dialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              {t("pageEditor.draftFoundTitle", "未保存的草稿")}
            </DialogTitle>
            <DialogDescription>
              {t("pageEditor.draftFoundDescription", "检测到之前未完成的编辑内容。是否恢复草稿？")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDiscardDraft}>
              {t("pageEditor.discardDraft", "丢弃草稿")}
            </Button>
            <Button onClick={handleRestoreDraft}>
              {t("pageEditor.restoreDraft", "恢复草稿")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Basic Info */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b border-border pb-2">
          <FileText className="size-4 mr-2 inline" />
          {t("pageEditor.basicInfo")}
        </h2>
        <p className="text-[13px] text-muted-foreground -mt-2">Title and description for your page.</p>

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
          <div className="space-y-1">
            <div className="flex items-center gap-0 rounded-md border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
              <span className="shrink-0 px-3 py-2 text-sm text-muted-foreground bg-surface-secondary border-r border-border select-none">
                {userSlug} /
              </span>
              <input
                value={uidManuallyEdited ? uid : autoUid}
                onChange={(e) => { setUidManuallyEdited(true); setUid(e.target.value) }}
                placeholder={autoUid || "page-url-identifier"}
                readOnly={isEditMode}
                className="flex-1 min-w-0 border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground font-medium"
              />
            </div>
            {uid !== autoUid && (
              <p className="text-[13px] text-amber-600 dark:text-amber-400 leading-relaxed">
                {t("pageEditor.urlHint")}
              </p>
            )}
            {uidStatus === "checking" && (
              <p className="text-[13px] text-muted-foreground">
                <Loader2 className="size-3 inline animate-spin mr-1" />{t("pageEditor.checkingAvailability")}
              </p>
            )}
            {uidStatus === "available" && (
              <p className="text-[13px] text-emerald-600 dark:text-emerald-400 leading-relaxed">
                {t("pageEditor.availableMsg", { userSlug, uid: displayedUid })}
              </p>
            )}
            {uidStatus === "unavailable" && (
              <p className="text-[13px] text-red-500 leading-relaxed">
                {t("pageEditor.unavailableMsg")}
              </p>
            )}
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
        <p className="text-[13px] text-muted-foreground -mt-2">Visibility, tags, collection, and cover image.</p>

        <div className="space-y-3">
          {/* Visibility */}
          <div className="rounded-lg border border-border p-4 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 items-center">
            <div>
              <Label className="text-sm font-semibold">{t("pageEditor.visibilityLabel")}</Label>
              <span className="text-red-500 ml-0.5 text-xs">* 必填</span>
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

          {/* Tags */}
          <div className="rounded-lg border border-border p-4 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">
            <div>
              <Label className="text-sm font-semibold">{t("pageEditor.tagsLabel")}</Label>
              <p className="text-[12px] text-muted-foreground">可选</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 rounded-full outline-none hover:bg-secondary-foreground/20" aria-label={t("pageEditor.removeTag", { tag })}>
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder={t("pageEditor.tagsPlaceholder")} className="min-w-[120px] flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
          </div>

          {/* Collection */}
          <div className="rounded-lg border border-border p-4 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">
            <div>
              <Label className="text-sm font-semibold">{t("pageEditor.collectionLabel")}</Label>
              <p className="text-[12px] text-muted-foreground">可选</p>
            </div>
            <CollectionSelector value={collection} onChange={setCollection} />
          </div>

          {/* Cover */}
          <div className="rounded-lg border border-border p-4 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">
            <div>
              <Label className="text-sm font-semibold">{t("pageEditor.coverLabel")}</Label>
              <p className="text-[12px] text-muted-foreground">可选</p>
            </div>
            <div
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-6 text-center transition-colors cursor-pointer",
                isDragging && "border-primary bg-primary/5",
                coverUrl && "border-solid p-2",
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDragging(false) }}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) handleCoverUpload(file) }}
              onClick={() => fileInputRef.current?.click()}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click() }}
            >
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleCoverUpload(file) }} />
              {isUploading ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : coverUrl ? (
                <div className="relative w-full">
                  <img src={coverUrl} alt="Cover preview" className="h-48 w-full rounded-lg object-cover" />
                  <button type="button" className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground hover:bg-background" onClick={(e) => { e.stopPropagation(); setCoverUrl(null) }}>
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="mb-1 size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t("pageEditor.coverHint")}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Edit Content */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b border-border pb-2">
          <Eye className="size-4 mr-2 inline" />
          {t("pageEditor.editContent")} <span className="text-red-500">*</span>
        </h2>
        <p className="text-[13px] text-muted-foreground -mt-2">Write HTML and preview.</p>

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
          <div className="space-y-2">
            <Label>{t("pageEditor.previewLabel")}</Label>
            <div
              ref={previewWrapperRef}
              className="overflow-hidden rounded-md border border-border bg-card"
              style={{ aspectRatio: "1200/630" }}
            >
              <iframe
                ref={previewIframeRef}
                title="Preview"
                width={1200}
                height={630}
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1200,initial-scale=1"><style>body{font-family:system-ui,sans-serif;line-height:1.6;padding:1rem;color:#333;max-width:100%;overflow-x:hidden}img{max-width:100%;height:auto}pre{overflow-x:auto;background:#f5f5f5;padding:1rem;border-radius:4px}code{font-size:0.9em}</style></head><body>${previewHtml}</body></html>`}
                sandbox="allow-same-origin"
                className="border-0"
                style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sticky publish bar */}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 border-t border-border bg-background/95 backdrop-blur-sm flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[13px] text-muted-foreground">
            {title.trim() ? `${userSlug}/${uid}` : t("pageEditor.fillTitleFirst")}
          </p>
          {/* Auto-save status */}
          {hasChanges && (
            <span className={cn("text-[11px]", saving ? "text-amber-500" : saved ? "text-emerald-500" : "text-muted-foreground")}>
              {saving ? t("pageEditor.saving", "保存中...") : saved ? t("pageEditor.saved", "已保存") : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Scheduled publishing */}
          <div className="flex items-center gap-2">
            <Select value={publishMode} onValueChange={(v: PublishMode) => setPublishMode(v)}>
              <SelectTrigger className="w-[120px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="now">
                  <Send className="size-3 mr-1 inline" />
                  {t("pageEditor.publishNow", "立即发布")}
                </SelectItem>
                <SelectItem value="scheduled">
                  <Clock className="size-3 mr-1 inline" />
                  {t("pageEditor.scheduledPublish", "定时发布")}
                </SelectItem>
              </SelectContent>
            </Select>

            {publishMode === "scheduled" && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                min={new Date().toISOString().slice(0, 16)}
              />
            )}
          </div>

          <Button onClick={handlePublish} disabled={isSubmitting} size="lg" className="gap-2 min-w-[140px]">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {!isSubmitting && (
              publishMode === "scheduled" ? <Clock className="size-4" /> : <Send className="size-4" />
            )}
            {isSubmitting
              ? t("pageEditor.publishing")
              : publishMode === "scheduled"
                ? t("pageEditor.schedule", "定时发布")
                : isEditMode
                  ? t("pageEditor.updatePublish")
                  : t("pageEditor.publish")}
          </Button>
        </div>
      </div>
    </div>
  )
}
