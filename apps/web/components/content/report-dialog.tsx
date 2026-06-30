"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Flag } from "lucide-react"
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

const REASONS = [
  { value: "spam", key: "community.reportReasonSpam" },
  { value: "inappropriate", key: "community.reportReasonInappropriate" },
  { value: "copyright", key: "community.reportReasonCopyright" },
  { value: "security", key: "community.reportReasonSecurity" },
  { value: "other", key: "community.reportReasonOther" },
] as const

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: string
  entityId: string
}

export function ReportDialog({ open, onOpenChange, entityType, entityId }: ReportDialogProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setReason("")
      setDescription("")
    }
  }, [open])

  const handleSubmit = async () => {
    if (!reason || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          reason,
          description: description.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? t("community.reportFailed"))
      }
      toast.success(t("community.reportSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("community.reportFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="size-4" />
            {t("community.report")}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>{t("community.reportReason")}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder={t("community.reportReason")} />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {t(r.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="report-desc">{t("community.reportDescription")}</Label>
            <Textarea
              id="report-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder={t("community.reportDescriptionPlaceholder")}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("community.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!reason || submitting}>
            {submitting ? t("community.submitting") : t("community.reportSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
