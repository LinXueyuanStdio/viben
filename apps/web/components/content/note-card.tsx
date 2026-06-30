"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface NoteData {
  id: string
  content: string
  createdAt: string
  updatedAt: string
}

interface NoteCardProps {
  note: NoteData
  onEdit: () => void
  onDelete: () => void
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return `${Math.floor(days / 30)}个月前`
}

/** 截取纯文本预览（去除 Markdown 标记） */
function previewMarkdown(md: string, maxLen = 100): string {
  const plain = md
    .replace(/[#*`>\[\]()!_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return plain.length > maxLen ? plain.slice(0, maxLen) + "..." : plain
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const { t } = useTranslation()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    onDelete()
    setConfirmDelete(false)
  }

  return (
    <div className="rounded-[10px] border border-border bg-background p-3 grid gap-2">
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
        {previewMarkdown(note.content)}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">
          {relativeTime(note.createdAt)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-[7px] text-[12px] text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
          >
            <Pencil className="size-3" />
            {t("community.noteEdit")}
          </button>
          <button
            onClick={handleDelete}
            className={cn(
              "inline-flex items-center gap-1 h-7 px-2 rounded-[7px] text-[12px]",
              confirmDelete
                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            )}
          >
            <Trash2 className="size-3" />
            {confirmDelete ? t("community.noteDeleteConfirm") : t("community.noteDelete")}
          </button>
        </div>
      </div>
    </div>
  )
}
