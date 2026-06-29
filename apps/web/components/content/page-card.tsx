import Link from "next/link"
import { Eye, MessageCircle, Bookmark, Heart } from "lucide-react"
import { Cover } from "./cover"
import { MetaRow } from "./meta-row"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

export interface PageCardData {
  cover: string
  title: string
  description?: string
  author: {
    name: string
    fallbackText: string
    avatarUrl?: string
  }
  timeAgo: string
  stats: {
    views: number
    likes?: number
    comments?: number
    bookmarks?: number
  }
}

interface PageCardProps {
  data: PageCardData
  variant?: "default" | "home"
  href: string
  className?: string
}

export function PageCard({ data, variant = "default", href, className }: PageCardProps) {
  const { cover, title, description, author, timeAgo, stats } = data

  const coverStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    { icon: MessageCircle, value: stats.comments ?? 0, format: true },
  ]

  const detailStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    ...(stats.likes != null ? [{ icon: Heart, value: stats.likes, format: true }] : []),
    ...(stats.bookmarks != null ? [{ icon: Bookmark, value: stats.bookmarks, format: true }] : []),
    ...(stats.comments != null ? [{ icon: MessageCircle, value: stats.comments, format: true }] : []),
  ]

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-[12px] border border-border bg-background shadow-sm overflow-hidden",
        "hover:border-primary transition-colors duration-150",
        className
      )}
    >
      <Cover
        src={cover}
        aspectRatio="16/9"
        overlay={variant === "home"}
      >
        {variant === "home" && (
          <StatsRow
            stats={coverStats}
            className="text-white [&_svg]:text-white [&_span]:text-white"
          />
        )}
      </Cover>
      <div className={cn("p-2.5", variant === "home" ? "space-y-1" : "space-y-1.5")}>
        <h3 className="font-['Lexend'] text-[15px] font-bold leading-snug line-clamp-2 text-foreground">
          {title}
        </h3>
        {variant === "default" && description && (
          <p className="text-[13px] text-muted-foreground truncate">{description}</p>
        )}
        <MetaRow
          author={author}
          meta={[timeAgo]}
        />
        {variant === "default" && <StatsRow stats={detailStats} />}
      </div>
    </Link>
  )
}
