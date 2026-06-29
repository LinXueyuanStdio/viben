"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export function RefreshButton() {
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 gap-1"
      onClick={() => router.refresh()}
    >
      <RefreshCw className="size-[14px]" />
      换一换
    </Button>
  )
}
