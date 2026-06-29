import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { IconButton } from "@/components/ui/icon-button"
import { MoreHorizontal } from "lucide-react"
import { Pill } from "./pill"
import { cn } from "@/lib/utils"

export type FeedKind = "更新" | "发布" | "转发" | "评论" | "收藏" | "模板" | "数据" | "合集" | "论文" | "笔记"

export interface FeedHeadData {
  fallbackText: string
  avatarUrl?: string
  name: string
  handle: string
  kind: FeedKind
  timeAgo: string
  source?: string
}

interface FeedHeadProps {
  data: FeedHeadData
  className?: string
}

export function FeedHead({ data, className }: FeedHeadProps) {
  const { fallbackText, avatarUrl, name, handle, kind, timeAgo, source } = data

  return (
    <div className={cn("grid grid-cols-[auto_1fr_auto] gap-[9px] items-center", className)}>
      <Avatar className="size-[34px]">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback>{fallbackText}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm truncate">{name}</span>
          <Pill variant="kind">{kind}</Pill>
        </div>
        <div className="text-[13px] text-muted-foreground truncate">
          {handle}
          <span className="mx-[7px]">·</span>
          {timeAgo}
          {source && (
            <>
              <span className="mx-[7px]">·</span>
              来自 {source}
            </>
          )}
        </div>
      </div>
      <IconButton label="更多操作" size="compact">
        <MoreHorizontal className="size-4" />
      </IconButton>
    </div>
  )
}
