"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Image as ImageIcon, Upload, Link as LinkIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { insertAtCursor } from "@/lib/utils/textarea"

interface InsertImageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

export function InsertImageDialog({ open, onOpenChange, textareaRef }: InsertImageDialogProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<"url" | "upload">("url")
  const [imageUrl, setImageUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setImageUrl("")
      setTab("url")
    }
  }, [open])

  // === URL 插入 ===
  const handleUrlInsert = () => {
    const ta = textareaRef.current
    if (!ta || !imageUrl.trim()) return
    insertAtCursor(ta, `![](${imageUrl.trim()})`)
    onOpenChange(false)
  }

  // === 文件上传 ===
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 客户端验证
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"]
    if (!allowed.includes(file.type)) {
      toast.error(t("community.imageInvalidType"))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("community.imageTooLarge"))
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/media/upload", { method: "POST", body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? t("community.uploadFailed"))
      }
      const data = await res.json()
      const ta = textareaRef.current
      if (ta) {
        insertAtCursor(ta, `![](${data.url})`)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("community.uploadFailed"))
    } finally {
      setUploading(false)
      // 重置 input 以便重复选择同一文件
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="size-4" />
            {t("community.insertImage")}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "url" | "upload")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url" className="gap-1.5">
              <LinkIcon className="size-3.5" />
              {t("community.imageUrl")}
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="size-3.5" />
              {t("community.imageUpload")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="image-url">{t("community.imageUrlInput")}</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://...jpg"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("community.cancel")}
              </Button>
              <Button onClick={handleUrlInsert} disabled={!imageUrl.trim()}>
                {t("community.insert")}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="upload" className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label>{t("community.imageUploadLabel")}</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90"
              />
              <p className="text-xs text-muted-foreground">
                {t("community.imageUploadHint")}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("community.cancel")}
              </Button>
              <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? t("community.uploading") : t("community.upload")}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
