"use client"

import { useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, LogOut, Settings, Star, ThumbsUp, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Session } from "@/lib/auth/types"

interface UserMenuProps {
  session: Session
}

function Spacer() {
  return <span className="mr-2 h-4 w-4 shrink-0" />
}

export function UserMenu({ session }: UserMenuProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const initials = session.username.slice(0, 2).toUpperCase()

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // ignore network errors
    }
    router.push("/")
    router.refresh()
  }, [router])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session.avatarUrl} alt={session.username} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        {/* Header: avatar + userSlug + username */}
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-10 w-10">
            <AvatarImage src={session.avatarUrl} alt={session.username} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <p className="text-sm text-muted-foreground leading-tight truncate">
              @{session.userSlug}
            </p>
            <p className="text-sm font-medium leading-tight truncate">
              {session.username}
            </p>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Section 1: Profile, Pages, Likes, Favorites */}
        <DropdownMenuItem asChild>
          <Link href={`/${session.userSlug}`}>
            <Spacer />
            {t("auth.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${session.userSlug}?tab=pages`}>
            <FileText className="mr-2 h-4 w-4 shrink-0" />
            {t("nav.pages", "页面")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${session.userSlug}?tab=likes`}>
            <ThumbsUp className="mr-2 h-4 w-4 shrink-0" />
            {t("nav.likes", "喜欢")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${session.userSlug}?tab=favorites`}>
            <Star className="mr-2 h-4 w-4 shrink-0" />
            {t("nav.favorites", "收藏")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Section 2: Settings */}
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Spacer />
            {t("common.settings")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Section 3: Logout */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            handleLogout()
          }}
        >
          <Spacer />
          {t("auth.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
