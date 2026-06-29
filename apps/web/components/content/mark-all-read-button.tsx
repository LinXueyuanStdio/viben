"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { CheckCheck } from "lucide-react"
import { toast } from "sonner"

export function MarkAllReadButton() {
  const { t } = useTranslation()
  const [clicked, setClicked] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error(t("community.markAllReadFailed"))
      setClicked(true)
      toast.success(t("community.markAllReadSuccess"))
    } catch {
      toast.error(t("community.markAllReadRetry"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleClick}
      variant="ghost"
      size="sm"
      className="gap-1.5"
      disabled={clicked || loading}
    >
      <CheckCheck className="size-3.5" />
      {clicked ? t("community.marked") : t("community.markAllRead")}
    </Button>
  )
}
