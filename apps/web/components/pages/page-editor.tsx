"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import DOMPurify from "dompurify"
import { toast } from "sonner"
import { X, Loader2, Upload } from "lucide-react"

import { cn } from "@/lib/utils"
import { slugify } from "@/lib/utils"
import { captureHtmlCover } from "@/lib/cover-capture"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CollectionSelector } from "./collection-selector"
import type { CollectionSelectorValue } from "./collection-selector"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface PageEditorInitialData {
  pageId: string
  title: string
  uid: string
  description: string
  html: string
  visibility: "public" | "unlisted" | "private"
  tags: string[]
  coverUrl?: string | null
  coverAssetId?: string | null
}

interface PageEditorProps {
  userSlug: string
  initialData?: PageEditorInitialData
}

export function PageEditor({ userSlug, initialData }: PageEditorProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const isEditMode = !!initialData

  const [title, setTitle] = useState(initialData?.title ?? "")
  const [uid, setUid] = useState(initialData?.uid ?? "")
  const [uidManuallyEdited, setUidManuallyEdited] = useState(isEditMode)
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [htmlContent, setHtmlContent] = useState(initialData?.html ?? "")
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">(
    initialData?.visibility ?? "public",
  )
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [tagInput, setTagInput] = useState("")
  const [coverAssetId, setCoverAssetId] = useState<string | null>(
    initialData?.coverAssetId ?? null,
  )
  const [coverUrl, setCoverUrl] = useState<string | null>(initialData?.coverUrl ?? null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [collection, setCollection] = useState<CollectionSelectorValue | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewIframeRef = useRef<HTMLIFrameElement>(null)

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value)
    if (!uidManuallyEdited) {
      setUid(slugify(value))
    }
  }, [uidManuallyEdited])

  const handleUidChange = useCallback((value: string) => {
    setUidManuallyEdited(true)
    setUid(value)
  }, [])

  const handleCoverUpload = useCallback(async (file: File) => {
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
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      setCoverUrl(data.url)
      setCoverAssetId(data.asset_id)
    } catch {
      toast.error("Cover upload failed")
    } finally {
      setIsUploading(false)
    }
  }, [t])

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const newTag = tagInput.trim()
      if (!newTag) return
      if (tags.length >= 12) {
        toast.warning(t("pageEditor.tagLimitReached"))
        return
      }
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
    if (!title.trim()) {
      toast.error(t("pageEditor.titleRequired"))
      return
    }
    if (!uid.trim()) {
      toast.error(t("pageEditor.uidRequired"))
      return
    }
    if (!htmlContent.trim()) {
      toast.error(t("pageEditor.contentRequired"))
      return
    }

    setIsSubmitting(true)
    try {
      // 自动封面：未上传封面时从预览 iframe 截取
      let finalCoverAssetId = coverAssetId
      if (!finalCoverAssetId && previewIframeRef.current?.contentDocument?.body) {
        try {
          const blob = await captureHtmlCover(previewIframeRef.current.contentDocument.body)
          if (blob) {
            const formData = new FormData()
            formData.append("file", new File([blob], "cover.png", { type: "image/png" }))
            formData.append("kind", "page_cover")
            const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData })
            if (uploadRes.ok) {
              const data = await uploadRes.json()
              finalCoverAssetId = data.asset_id
            }
          }
        } catch (e) {
          // 截图失败不阻塞发布
          console.warn("Auto cover capture failed:", e)
        }
      }

      const html = DOMPurify.sanitize(htmlContent, { WHOLE_DOCUMENT: true })
      const res = await fetch("/api/pages/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: uid.trim(),
          title: title.trim(),
          html,
          description: description.trim() || undefined,
          visibility,
          tags: tags.length > 0 ? tags : undefined,
          cover_asset_id: finalCoverAssetId,
          collection_slug: collection?.slug,
          collection_name: collection?.name,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("pageEditor.publishFailed"))
      toast.success(t("pageEditor.publishSuccess"))
      router.push(
        data.read_url ||
          `/${encodeURIComponent(userSlug)}/${encodeURIComponent(uid.trim())}?tab=read`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pageEditor.publishFailed"))
    } finally {
      setIsSubmitting(false)
    }
  }, [title, uid, htmlContent, description, visibility, tags, coverAssetId, collection, router, t, userSlug])

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isEditMode ? t("pageEditor.editTitle") : t("pageEditor.title")}
      </h1>

      {/* Cover upload area */}
      <div className="space-y-2">
        <Label>{t("pageEditor.coverLabel")}</Label>
        <div
          className={cn(
            "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-8 text-center transition-colors",
            isDragging && "border-primary bg-primary/5",
            coverUrl && "border-solid p-2",
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return
            setIsDragging(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) handleCoverUpload(file)
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click()
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleCoverUpload(file)
            }}
          />
          {isUploading ? (
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          ) : coverUrl ? (
            <div className="relative w-full">
              <img
                src={coverUrl}
                alt="Cover preview"
                className="h-48 w-full rounded-lg object-cover"
              />
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground hover:bg-background"
                onClick={(e) => {
                  e.stopPropagation()
                  setCoverUrl(null)
                  setCoverAssetId(null)
                }}
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("pageEditor.coverHint")}</p>
            </>
          )}
        </div>
      </div>

      {/* Title + UID + Visibility row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="title">{t("pageEditor.titleLabel")}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={t("pageEditor.titlePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="uid">{t("pageEditor.uidLabel")}</Label>
          <Input
            id="uid"
            value={uid}
            onChange={(e) => handleUidChange(e.target.value)}
            placeholder={t("pageEditor.uidPlaceholder")}
            readOnly={isEditMode}
            disabled={isEditMode}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("pageEditor.visibilityLabel")}</Label>
          <Select
            value={visibility}
            onValueChange={(v: "public" | "unlisted" | "private") => setVisibility(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">{t("pageEditor.public")}</SelectItem>
              <SelectItem value="unlisted">{t("pageEditor.unlisted")}</SelectItem>
              <SelectItem value="private">{t("pageEditor.private")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
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

      {/* Tags */}
      <div className="space-y-2">
        <Label>{t("pageEditor.tagsLabel")}</Label>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 rounded-full outline-none hover:bg-secondary-foreground/20"
                aria-label={t("pageEditor.removeTag", { tag })}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder={t("pageEditor.tagsPlaceholder")}
            className="min-w-[120px] flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Collection selector */}
      <div className="space-y-2">
        <Label>{t("pageEditor.collectionLabel")}</Label>
        <CollectionSelector value={collection} onChange={setCollection} />
      </div>

      {/* Editor + Preview split */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
          <div className="overflow-hidden rounded-md border border-border bg-background">
            <iframe
              ref={previewIframeRef}
              title="Preview"
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;line-height:1.6;padding:1rem;color:#333;max-width:100%;overflow-x:hidden}img{max-width:100%;height:auto}pre{overflow-x:auto;background:#f5f5f5;padding:1rem;border-radius:4px}code{font-size:0.9em}</style></head><body>${previewHtml}</body></html>`}
              sandbox="allow-same-origin"
              className="h-[400px] w-full border-0"
            />
          </div>
        </div>
      </div>

      {/* Publish button */}
      <div className="flex justify-end">
        <Button onClick={handlePublish} disabled={isSubmitting} size="lg">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting
            ? t("pageEditor.publishing")
            : isEditMode
              ? t("pageEditor.updatePublish")
              : t("pageEditor.publish")}
        </Button>
      </div>
    </div>
  )
}
