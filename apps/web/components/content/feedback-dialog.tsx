"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { MessageSquare, Star } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  { value: "bug", key: "community.feedbackCategoryBug" },
  { value: "suggestion", key: "community.feedbackCategorySuggestion" },
  { value: "other", key: "community.feedbackCategoryOther" },
] as const

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
}

export function FeedbackDialog({ open, onOpenChange, pageId }: FeedbackDialogProps) {
  const { t } = useTranslation()
  const [category, setCategory] = useState("")
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setCategory("")
      setRating(0)
      setContent("")
    }
  }, [open])

  const handleSubmit = async () => {
    if (!category || rating === 0 || !content.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          category,
          rating,
          content: content.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? t("community.feedbackFailed"))
      }
      toast.success(t("community.feedbackSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("community.feedbackFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            {t("community.feedback")}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 分类 */}
          <div className="grid gap-2">
            <Label>{t("community.feedbackCategory")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t("community.feedbackCategory")} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {t(c.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 星级评分 */}
          <div className="grid gap-2">
            <Label>{t("community.feedbackRating")}</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-0.5"
                >
                  <Star
                    className={cn(
                      "size-6 transition-colors",
                      star <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30 hover:text-amber-400/50"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* 描述 */}
          <div className="grid gap-2">
            <Label htmlFor="feedback-content">{t("community.feedbackContent")}</Label>
            <Textarea
              id="feedback-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              placeholder={t("community.feedbackContentPlaceholder")}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("community.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!category || rating === 0 || !content.trim() || submitting}>
            {submitting ? t("community.submitting") : t("community.feedbackSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
