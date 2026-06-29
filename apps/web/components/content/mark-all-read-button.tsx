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
      if (!res.ok) throw new Error("标记失败")
      setClicked(true)
      toast.success("已全部标记为已读")
    } catch {
      toast.error("标记失败，请重试")
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
