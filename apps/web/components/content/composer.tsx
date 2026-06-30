"use client"

import { useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Link as LinkIcon, Image as ImageIcon, Send } from "lucide-react"
import { InsertLinkDialog } from "@/components/content/insert-link-dialog"
import { InsertImageDialog } from "@/components/content/insert-image-dialog"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ComposerProps {
  userFallbackText: string
  userAvatarUrl?: string
  onSubmit?: (text: string) => void
  className?: string
}

export function Composer({ userFallbackText, userAvatarUrl, onSubmit, className }: ComposerProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return

    if (onSubmit) {
      onSubmit(text)
      setText("")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/moments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t("community.publishFailed"))
      }
      toast.success(t("community.publishSuccess"))
      setText("")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("community.publishFailed"))
    } finally {
      setSubmitting(false)
    }
  }, [text, onSubmit, t, router])

  const handleFocus = useCallback(() => {
    setFocused(true)
  }, [])

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Keep expanded if focus moves to another element within the composer
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return
    }
    setFocused(false)
  }, [])

  return (
    <div ref={containerRef} className={cn("grid gap-2.5", className)}>
      <div className="grid grid-cols-[auto_1fr] gap-2.5 items-start">
        <Avatar className="size-[34px] shrink-0">
          <AvatarImage src={userAvatarUrl} alt={userFallbackText} />
          <AvatarFallback>{userFallbackText}</AvatarFallback>
        </Avatar>
        <div className="grid gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={t('community.postPlaceholder')}
            className={cn(
              "w-full rounded-[10px] border border-border bg-background px-3 text-sm resize-y focus:outline-none focus:border-primary placeholder:text-muted-foreground",
              focused ? "min-h-[78px] py-3" : "min-h-[38px] h-[38px] py-1.5 overflow-hidden",
            )}
          />
        </div>
      </div>
      {focused && (
        <div className="flex items-center justify-between pl-[44px]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLinkDialogOpen(true)}
              className="inline-flex items-center justify-center size-9 rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
              aria-label={t("community.addLink")}
            >
              <LinkIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setImageDialogOpen(true)}
              className="inline-flex items-center justify-center size-9 rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
              aria-label={t("community.addImage")}
            >
              <ImageIcon className="size-4" />
            </button>
          </div>
          <Button onClick={handleSubmit} disabled={!text.trim() || submitting} size="sm" className="gap-1.5 min-h-[38px]">
            <Send className="size-3.5" />
            {submitting ? t("community.publishing") : t("community.published")}
          </Button>
        </div>
      )}
      <InsertLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        textareaRef={textareaRef}
      />
      <InsertImageDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        textareaRef={textareaRef}
      />
    </div>
  )
}
