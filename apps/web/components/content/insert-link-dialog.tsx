"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link as LinkIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { insertAtCursor } from "@/lib/utils/textarea"

interface InsertLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

export function InsertLinkDialog({ open, onOpenChange, textareaRef }: InsertLinkDialogProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState("")
  const [displayText, setDisplayText] = useState("")

  // 每次打开时清空输入
  useEffect(() => {
    if (open) {
      setUrl("")
      setDisplayText("")
    }
  }, [open])

  const handleInsert = () => {
    const ta = textareaRef.current
    if (!ta || !url.trim()) return

    const text = displayText.trim()
      ? `[${displayText.trim()}](${url.trim()})`
      : `[${url.trim()}](${url.trim()})`

    insertAtCursor(ta, text)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="size-4" />
            {t("community.insertLink")}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="link-url">{t("community.linkUrl")}</Label>
            <Input
              id="link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="link-text">{t("community.linkText")}</Label>
            <Input
              id="link-text"
              value={displayText}
              onChange={(e) => setDisplayText(e.target.value)}
              placeholder={t("community.linkTextPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("community.cancel")}
          </Button>
          <Button onClick={handleInsert} disabled={!url.trim()}>
            {t("community.insert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
