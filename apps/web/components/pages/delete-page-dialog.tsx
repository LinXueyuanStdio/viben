"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DeletePageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
  onConfirm: () => void
  isDeleting: boolean
}

export function DeletePageDialog({
  open,
  onOpenChange,
  pageId,
  onConfirm,
  isDeleting,
}: DeletePageDialogProps) {
  const { t } = useTranslation()
  const [countdown, setCountdown] = useState(15)
  const [confirmInput, setConfirmInput] = useState("")

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCountdown(15)
      setConfirmInput("")
    }
  }, [open])

  // Countdown timer
  useEffect(() => {
    if (!open || countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [open, countdown])

  const inputMatch = confirmInput.trim() === pageId
  const canDelete = countdown <= 0 && inputMatch && !isDeleting

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (isDeleting) return // prevent closing while deleting
      onOpenChange(value)
    },
    [isDeleting, onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t("community.deletePage")}
          </DialogTitle>
          <DialogDescription>{t("community.deletePageWarning")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Confirm input */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-foreground">
              {t("community.deleteTypePageId", { pageId })}
            </label>
            <Input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={pageId}
              disabled={isDeleting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!canDelete}>
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("community.deleting")}
              </>
            ) : countdown > 0 ? (
              t("community.deleteCountdown", { seconds: countdown })
            ) : !inputMatch ? (
              t("community.confirmDelete")
            ) : (
              t("community.confirmDelete")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
