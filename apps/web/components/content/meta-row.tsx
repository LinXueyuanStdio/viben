import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { StatProps } from "./stats-row"
import { StatsRow } from "./stats-row"

interface MetaAuthorProps {
  fallbackText: string
  avatarUrl?: string
  name: string
  className?: string
}

function MetaAuthor({ fallbackText, avatarUrl, name, className }: MetaAuthorProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      <Avatar className="size-[28px] shrink-0">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback>{fallbackText}</AvatarFallback>
      </Avatar>
      <span className="text-[13px] font-bold truncate">{name}</span>
    </span>
  )
}

// 3px dot separator
function Dot() {
  return <span className="inline-block size-[3px] rounded-full bg-[#9bb8c2] shrink-0" />
}

interface MetaRowProps {
  author: MetaAuthorProps
  meta?: string[]
  stats?: StatProps[]
  className?: string
}

export function MetaRow({ author, meta, stats, className }: MetaRowProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-[7px]", className)}>
      <MetaAuthor {...author} />
      {meta?.map((text, i) => (
        <span key={i} className="inline-flex items-center gap-[7px]">
          <Dot />
          <span className="text-[13px] text-muted-foreground">{text}</span>
        </span>
      ))}
      {stats && stats.length > 0 && (
        <>
          <Dot />
          <StatsRow stats={stats} />
        </>
      )}
    </div>
  )
}
