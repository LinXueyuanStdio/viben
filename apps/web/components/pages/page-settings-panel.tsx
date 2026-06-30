"use client"

import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Copy, ExternalLink, Info, Loader2, Save } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

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
  className?: string
}

const VIBEN_WEB_URL = "https://viben-web.vercel.app"

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
  className,
}: PageSettingsPanelProps) {
  const { t } = useTranslation()

  const [title, setTitle] = useState(pageTitle)
  const [description, setDescription] = useState(pageDescription)
  const [visibility, setVisibility] = useState(pageVisibility || "public")
  const [tags, setTags] = useState<string[]>(pageTags)
  const [tagInput, setTagInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const publishedUrl = `${VIBEN_WEB_URL}/${encodeURIComponent(userSlug)}/${encodeURIComponent(pageUid)}`

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

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.error(t("pageEditor.titleRequired"))
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/pages/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: pageUid,
          title: title.trim(),
          html: pageHtml,
          description: description.trim() || undefined,
          visibility,
          tags: tags.length > 0 ? tags : undefined,
          importance: "normal",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("pageEditor.publishFailed"))
      toast.success(t("pageEditor.publishSuccess"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pageEditor.publishFailed"))
    } finally {
      setIsSubmitting(false)
    }
  }, [title, description, visibility, tags, pageUid, pageHtml, t])

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publishedUrl)
      toast.success(t("common.copied"))
    } catch {
      toast.error(t("community.copyFailed"))
    }
  }

  const handleOpenUrl = () => {
    window.open(publishedUrl, "_blank")
  }

  return (
    <div className={cn("grid gap-4", className)}>
      {/* Published URL */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">已发布链接</h2>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3">
          <div className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
            {publishedUrl}
          </div>
          <button
            type="button"
            aria-label="Copy published URL"
            onClick={handleCopyUrl}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Open published page"
            onClick={handleOpenUrl}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Page Info */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">页面信息</h2>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">UID</dt>
            <dd className="font-mono text-xs text-foreground">{pageUid}</dd>
          </div>
          {pagePublishedAt && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">发布日期</dt>
              <dd className="text-xs text-foreground">
                {new Date(pagePublishedAt).toLocaleDateString("zh-CN")}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">可见性</dt>
            <dd className="text-xs text-foreground capitalize">{visibility}</dd>
          </div>
        </dl>
      </section>

      {/* Editable Fields */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Save className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">编辑页面</h2>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="settings-title">标题</Label>
            <Input
              id="settings-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="页面标题"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="settings-description">描述</Label>
            <Textarea
              id="settings-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="页面描述"
              rows={3}
            />
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label htmlFor="settings-visibility">可见性</Label>
            <select
              id="settings-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="public">公开</option>
              <option value="unlisted">不公开列出</option>
              <option value="private">私有</option>
            </select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>标签</Label>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-full outline-none hover:bg-secondary-foreground/20"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="添加标签后按回车"
                className="min-w-[120px] flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
              {isSubmitting ? "保存中..." : "保存设置"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default PageSettingsPanel
