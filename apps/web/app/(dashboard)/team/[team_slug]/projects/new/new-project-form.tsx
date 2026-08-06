"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, FolderKanban, Globe } from "lucide-react"
import { toast } from "sonner"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function NewProjectForm({ teamSlug }: { teamSlug: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<"public" | "private">("public")
  const [creating, setCreating] = useState(false)

  const autoSlug = useMemo(() => slugify(name), [name])
  const displayedSlug = slugManuallyEdited ? slug : autoSlug

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugManuallyEdited) setSlug(slugify(value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalSlug = displayedSlug.trim()
    if (!name.trim() || !finalSlug) return
    setCreating(true)
    try {
      const res = await fetch(`/api/teams/${teamSlug}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          project_slug: finalSlug,
          description: description.trim() || undefined,
          visibility,
        }),
      })
      if (res.ok) {
        toast.success(t("team.newProject.created"))
        router.push(`/team/${teamSlug}/projects`)
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error ?? t("team.newProject.createFailed"))
      }
    } catch {
      toast.error(t("team.newProject.createFailed"))
    } finally {
      setCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-8 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("team.newProject.title")}</h1>

      {/* Basic Info */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b border-border pb-2">
          <FolderKanban className="size-4 mr-2 inline" />
          {t("team.newProject.basicInfo")}
        </h2>
        <p className="text-[13px] text-muted-foreground -mt-2">{t("team.newProject.basicInfoDesc")}</p>

        <div className="space-y-2">
          <Label htmlFor="projectName">
            {t("team.newProject.nameLabel")} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="projectName"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t("team.newProject.namePlaceholder")}
            className="text-lg font-medium"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="projectSlug">
            {t("team.newProject.slugLabel")} <span className="text-red-500">*</span>
          </Label>
          <div className="flex items-center gap-0 rounded-md border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
            <span className="shrink-0 px-3 py-2 text-sm text-muted-foreground bg-surface-secondary border-r border-border select-none">
              {teamSlug} /
            </span>
            <input
              id="projectSlug"
              value={displayedSlug}
              onChange={(e) => { setSlugManuallyEdited(true); setSlug(e.target.value) }}
              placeholder={autoSlug || t("team.newProject.slugPlaceholder")}
              className="flex-1 min-w-0 border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground font-medium"
              required
              pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
            />
          </div>
          <p className="text-[13px] text-muted-foreground">
            {t("team.newProject.urlHint", { teamSlug, slug: displayedSlug || "..." })}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="projectDesc">{t("team.newProject.descriptionLabel")}</Label>
          <Textarea
            id="projectDesc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("team.newProject.descriptionPlaceholder")}
            rows={3}
          />
        </div>
      </section>

      {/* Configuration */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b border-border pb-2">
          <Globe className="size-4 mr-2 inline" />
          {t("team.newProject.configuration")}
        </h2>
        <p className="text-[13px] text-muted-foreground -mt-2">{t("team.newProject.configurationDesc")}</p>

        <div className="rounded-lg border border-border p-4 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 items-center">
          <div>
            <Label className="text-sm font-semibold">{t("team.newProject.visibilityLabel")}</Label>
            <span className="text-red-500 ml-0.5 text-xs">{t("team.newProject.required")}</span>
          </div>
          <Select value={visibility} onValueChange={(v: "public" | "private") => setVisibility(v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">{t("team.newProject.public")}</SelectItem>
              <SelectItem value="private">{t("team.newProject.private")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button type="submit" disabled={creating || !name.trim() || !displayedSlug.trim()} size="lg">
          {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("team.newProject.create")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {t("team.newProject.cancel")}
        </Button>
      </div>
    </form>
  )
}
