"use client"

"use client"

import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export function RefreshButton() {
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 gap-1"
      onClick={() => router.refresh()}
    >
      <RefreshCw className="size-[14px]" />
      {t("community.refreshShuffle")}
    </Button>
  )
}
