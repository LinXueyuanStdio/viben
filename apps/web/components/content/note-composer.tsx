"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface NoteComposerProps {
  entityType?: string
  entityId?: string
  initialContent?: string
  noteId?: string
  onSave: () => void
  onCancel: () => void
}

export function NoteComposer({ entityType, entityId, initialContent = "", noteId, onSave, onCancel }: NoteComposerProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const isEdit = !!noteId

  const handleSave = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      const url = isEdit ? `/api/notes/${noteId}` : "/api/notes"
      const method = isEdit ? "PATCH" : "POST"
      const body = isEdit
        ? JSON.stringify({ content: content.trim() })
        : JSON.stringify({
            entity_type: entityType ?? "published_page",
            entity_id: entityId,
            content: content.trim(),
          })

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? t("community.noteSaveFailed"))
      }
      toast.success(t(isEdit ? "community.noteUpdated" : "community.noteSaved"))
      onSave()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("community.noteSaveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-2 rounded-[10px] border border-primary/30 bg-background p-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t("community.notePlaceholder")}
        autoFocus
        className="w-full min-h-[100px] rounded-[8px] border border-border bg-background p-2.5 text-sm resize-y focus:outline-none focus:border-primary placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t("community.noteCancel")}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!content.trim() || saving}>
          {saving ? t("community.saving") : t("community.noteSave")}
        </Button>
      </div>
    </div>
  )
}
