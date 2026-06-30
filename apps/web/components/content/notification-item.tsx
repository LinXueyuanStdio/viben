"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, Check, Bell, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type NotificationType = "update" | "notification"

export interface NotificationItemData {
  type: NotificationType
  icon: LucideIcon
  title: string
  author?: string
  detail?: string
  timeAgo: string
  notificationId?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
    variant?: "arrow" | "follow" | "read" | "subscribed"
  }
}

interface NotificationItemProps {
  data: NotificationItemData
  className?: string
}

function MiniIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex items-center justify-center size-[34px] rounded-[10px] bg-surface-secondary text-primary shrink-0">
      <Icon className="size-4" />
    </div>
  )
}

function ReadAction({ notificationId, label, onClick }: { notificationId: string; label: string; onClick?: () => void }) {
  const [marked, setMarked] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleClick = useCallback(async () => {
    if (onClick) { onClick(); return }
    if (loading || marked) return
    setLoading(true)
    try {
      const res = await fetch("/api/notifications/" + encodeURIComponent(notificationId) + "/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) throw new Error("mark_read_failed")
      setMarked(true)
      toast.success("Marked as read")
    } catch {
      toast.error("Failed to mark as read")
    } finally {
      setLoading(false)
    }
  }, [notificationId, onClick, loading, marked])

  if (marked) {
    return (
      <span className="flex items-center gap-1 text-[13px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
        <Check className="size-3.5" />
        {label}
      </span>
    )
  }

  return (
    <button onClick={handleClick} disabled={loading} className="flex items-center gap-1 text-[13px] font-bold text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-50">
      <Check className="size-3.5" />
      {loading ? "..." : label}
    </button>
  )
}

function renderAction(action: NotificationItemData["action"], notificationId?: string) {
  if (!action) return null
  const { label, href, onClick, variant = "arrow" } = action

  switch (variant) {
    case "arrow":
      return href ? (
        <Link href={href} className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground shrink-0">
          <span className="text-[13px] font-bold">{label}</span>
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null
    case "follow":
      return (
        <Button variant="outline" size="sm" className="h-9 gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 shrink-0" onClick={onClick}>
          <UserPlus className="size-[14px]" />
          {label}
        </Button>
      )
    case "read":
      if (onClick) {
        return (
          <button onClick={onClick} className="flex items-center gap-1 text-[13px] font-bold text-muted-foreground hover:text-foreground shrink-0">
            <Check className="size-3.5" />
            {label}
          </button>
        )
      }
      if (notificationId) {
        return <ReadAction notificationId={notificationId} label={label} />
      }
      return (
        <span className="flex items-center gap-1 text-[13px] font-bold text-muted-foreground shrink-0">
          <Check className="size-3.5" />
          {label}
        </span>
      )
    case "subscribed":
      return (
        <button onClick={onClick} className="flex items-center gap-1 text-[13px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
          <Bell className="size-3.5" />
          {label}
        </button>
      )
    default:
      return null
  }
}

export function NotificationItem({ data, className }: NotificationItemProps) {
  const { type, icon, title, author, detail, timeAgo, action, notificationId } = data

  return (
    <div className={cn(
      "grid gap-2.5 rounded-[10px] border border-border p-2.5",
      className
    )}
    style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto" }}>
      {type === "update" ? (
        <MiniIcon icon={icon} />
      ) : (
        <Avatar className="size-[28px] shrink-0">
          <AvatarImage src={undefined} alt={author ?? ""} />
          <AvatarFallback>{author?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0">
        <strong className="text-sm font-bold line-clamp-2">{title}</strong>
        <div className="text-[13px] text-muted-foreground truncate mt-0.5">
          {author && <span>{author} · </span>}
          {detail && <span>{detail} · </span>}
          {timeAgo}
        </div>
      </div>
      {renderAction(action, notificationId)}
    </div>
  )
}
