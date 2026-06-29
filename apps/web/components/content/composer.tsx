"use client"

import { useState } from "react"
import { Link as LinkIcon, Image as ImageIcon, Send } from "lucide-react"
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
  const [text, setText] = useState("")

  const handleSubmit = () => {
    if (!text.trim()) return
    onSubmit?.(text)
    setText("")
  }

  return (
    <div className={cn("grid gap-2.5", className)}>
      <div className="grid grid-cols-[auto_1fr] gap-2.5 items-start">
        <Avatar className="size-[34px] shrink-0">
          <AvatarImage src={userAvatarUrl} alt={userFallbackText} />
          <AvatarFallback>{userFallbackText}</AvatarFallback>
        </Avatar>
        <div className="grid gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="分享你的想法..."
            className="w-full min-h-[78px] rounded-[10px] border border-border bg-background p-3 text-sm resize-y focus:outline-none focus:border-primary placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex items-center justify-between pl-[44px]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex items-center justify-center size-9 rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
            aria-label="添加链接"
          >
            <LinkIcon className="size-4" />
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center size-9 rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
            aria-label="添加图片"
          >
            <ImageIcon className="size-4" />
          </button>
        </div>
        <Button onClick={handleSubmit} disabled={!text.trim()} size="sm" className="gap-1.5 min-h-[38px]">
          <Send className="size-3.5" />
          发布
        </Button>
      </div>
    </div>
  )
}
