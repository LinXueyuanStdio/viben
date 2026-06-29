"use client"

import { Share2 } from "lucide-react"

export function ShareButton({ url, title }: { url: string; title?: string }) {
  const handleShare = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ url, title })
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      }
    } catch {
      // silently ignore errors
    }
  }

  return (
    <button
      type="button"
      className="inline-flex items-center justify-center size-[30px] rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
      aria-label="分享"
      onClick={handleShare}
    >
      <Share2 className="size-4" />
    </button>
  )
}
