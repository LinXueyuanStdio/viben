"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Camera } from "lucide-react"
import { toast } from "sonner"

interface TeamSettingsFormProps {
  teamSlug: string
  displayName: string
  bio: string | null
  websiteUrl: string | null
  avatarUrl: string | null
  isOwner: boolean
}

export function TeamSettingsForm({ teamSlug, displayName, bio, websiteUrl, avatarUrl, isOwner }: TeamSettingsFormProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState(displayName)
  const [desc, setDesc] = useState(bio ?? "")
  const [website, setWebsite] = useState(websiteUrl ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Avatar upload
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(avatarUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const validExtensions = ["png", "jpg", "jpeg", "webp"]
      const extension = file.name.split(".").pop()?.toLowerCase() || ""
      if (!validExtensions.includes(extension)) {
        toast.error("不支持的格式，请使用 PNG、JPEG 或 WebP")
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("文件过大，最大 2MB")
        return
      }

      setAvatarUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("kind", "avatar")
        formData.append("user_slug", teamSlug)
        formData.append("uid", teamSlug)

        const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData })
        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}))
          throw new Error(errData.error || `上传失败 (${uploadRes.status})`)
        }
        const uploadData = await uploadRes.json()
        if (!uploadData.url) throw new Error("上传成功但未返回 URL")

        // 更新团队头像
        const updateRes = await fetch(`/api/teams/${teamSlug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar_url: uploadData.url }),
        })
        if (!updateRes.ok) throw new Error("更新资料失败")

        setAvatar(uploadData.url)
        toast.success("头像已更新")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "头像上传失败")
      } finally {
        setAvatarUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [teamSlug, router]
  )

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    const res = await fetch(`/api/teams/${teamSlug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: name,
        bio: desc,
        website_url: website,
      }),
    })
    if (res.ok) {
      setSaved(true)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("team.settings.profile")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 头像 */}
        {isOwner && (
          <div className="space-y-2">
            <label className="text-sm font-medium">头像</label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative cursor-pointer rounded-full"
                disabled={avatarUploading}
              >
                <Avatar className="h-20 w-20 ring-2 ring-border group-hover:ring-primary transition-all">
                  <AvatarImage key={avatar} src={avatar || undefined} />
                  <AvatarFallback className="text-2xl">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  {avatarUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </button>
              <div>
                <p className="text-sm text-muted-foreground">支持 PNG、JPEG、WebP，最大 2MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium">{t("team.settings.name")}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} />
        </div>
        <div>
          <label className="text-sm font-medium">{t("team.settings.slug")}</label>
          <Input value={teamSlug} disabled className="text-muted-foreground" />
        </div>
        <div>
          <label className="text-sm font-medium">{t("team.settings.description")}</label>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!isOwner} rows={3} />
        </div>
        <div>
          <label className="text-sm font-medium">{t("team.settings.website")}</label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} disabled={!isOwner} placeholder={t("team.settings.websitePlaceholder")} />
        </div>
        {isOwner && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("team.settings.saving") : saved ? t("team.settings.saved") : t("team.settings.save")}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
