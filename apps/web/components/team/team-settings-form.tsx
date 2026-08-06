"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TeamSettingsFormProps {
  teamSlug: string
  displayName: string
  bio: string | null
  websiteUrl: string | null
  isOwner: boolean
}

export function TeamSettingsForm({ teamSlug, displayName, bio, websiteUrl, isOwner }: TeamSettingsFormProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState(displayName)
  const [desc, setDesc] = useState(bio ?? "")
  const [website, setWebsite] = useState(websiteUrl ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
