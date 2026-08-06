"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { NoteCard } from "@/components/content/note-card"
import { NoteComposer } from "@/components/content/note-composer"

interface NoteData {
  id: string
  uid: string
  entityType: string
  entityId: string
  content: string
  contentFormat: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

interface NotesPanelProps {
  entityType?: "published_page" | "project"
  entityId: string
}

export function NotesPanel({ entityType = "published_page", entityId }: NotesPanelProps) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<NoteData[]>([])
  const [loading, setLoading] = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const [editingNote, setEditingNote] = useState<NoteData | null>(null)

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/notes?entity_type=${entityType}&entity_id=${encodeURIComponent(entityId)}`)
      if (res.ok) {
        const data = await res.json()
        setNotes(data.notes ?? [])
      }
    } catch (err) {
      console.error("Failed to fetch notes:", err)
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const handleDelete = async (noteId: string) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" })
      if (res.ok || res.status === 204) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId))
      }
    } catch (err) {
      console.error("Failed to delete note:", err)
    }
  }

  const handleSaved = () => {
    setShowComposer(false)
    setEditingNote(null)
    fetchNotes()
  }

  return (
    <div className="grid gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-['Lexend'] text-[17px] font-bold">{t("community.notes")}</h2>
        {!showComposer && !editingNote && (
          <button
            onClick={() => setShowComposer(true)}
            className="inline-flex items-center gap-1 text-[14px] font-bold text-primary hover:underline"
          >
            <Plus className="size-3.5" />
            {t("community.newNote")}
          </button>
        )}
      </div>

      {/* New composer */}
      {showComposer && (
        <NoteComposer
          entityType={entityType}
          entityId={entityId}
          onSave={handleSaved}
          onCancel={() => setShowComposer(false)}
        />
      )}

      {/* Note list */}
      {loading ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">
          {t("community.loading")}
        </p>
      ) : notes.length === 0 && !showComposer ? (
        <div className="py-6 text-center">
          <p className="text-[13px] text-muted-foreground">{t("community.noNotes")}</p>
          <p className="mt-1 text-[12px] text-muted-foreground/60">
            {t("community.noNotesHint")}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {notes.map((note) =>
            editingNote?.id === note.id ? (
              <NoteComposer
                key={note.id}
                entityType={entityType}
                entityId={entityId}
                noteId={note.id}
                initialContent={note.content}
                onSave={handleSaved}
                onCancel={() => setEditingNote(null)}
              />
            ) : (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => {
                  setShowComposer(false)
                  setEditingNote(note)
                }}
                onDelete={() => handleDelete(note.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
