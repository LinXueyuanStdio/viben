"use client"

import { useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, Star, ThumbsUp, Globe, Monitor, Sun, Moon, Bell, Clock, MessageSquareText, FilePlus2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { CREATE_MENU_ITEMS } from "@/lib/navigation/create-menu-items"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { LANGUAGES, getLanguageByCode, changeLanguage, getCurrentLanguage } from "@/lib/i18n"
import type { Session } from "@/lib/auth/types"

interface UserMenuProps {
  session: Session
  isMobile?: boolean
}

function Spacer() {
  return <span className="mr-2 h-4 w-4 shrink-0" />
}

export function UserMenu({ session, isMobile = false }: UserMenuProps) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  const THEME_OPTIONS = [
    { value: "system", label: t("settings.system"), icon: Monitor },
    { value: "light", label: t("settings.light"), icon: Sun },
    { value: "dark", label: t("settings.dark"), icon: Moon },
  ] as const
  const router = useRouter()
  const displayLabel = session.displayName || session.userSlug
  const initials = displayLabel.slice(0, 2).toUpperCase()

  const currentLang = getCurrentLanguage()
  const currentLanguage = getLanguageByCode(currentLang)

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // ignore network errors
    }
    // Force full page reload to clear all client state
    window.location.href = "/"
  }, [])

  const handleLanguageChange = useCallback((langCode: string) => {
    changeLanguage(langCode)
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session.avatarUrl} alt={displayLabel} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        {/* Header: avatar + displayName + userSlug */}
        <div
          className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-surface-secondary transition-colors"
          onClick={() => router.push(`/${session.userSlug}`)}
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={session.avatarUrl} alt={displayLabel} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-medium leading-tight truncate">
              {displayLabel}
            </p>
            <p className="text-sm text-muted-foreground leading-tight truncate">
              @{session.userSlug}
            </p>
          </div>
        </div>

        {/* Mobile-only: navigation entries */}
        {isMobile && (
          <>
            <DropdownMenuSeparator />

            {/* 创建子菜单 */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center">
                <FilePlus2 className="mr-2 h-4 w-4 shrink-0" />
                <span>{t("nav.create")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                {CREATE_MENU_ITEMS.map((item) => (
                  <DropdownMenuItem
                    key={item.labelKey}
                    onClick={() => router.push(item.href)}
                  >
                    <item.icon className="mr-2 h-4 w-4 shrink-0" />
                    {t(item.labelKey)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* 通知 — 直接跳转 */}
            <DropdownMenuItem onClick={() => router.push("/notifications")}>
              <Bell className="mr-2 h-4 w-4 shrink-0" />
              {t("nav.notifications")}
            </DropdownMenuItem>

            {/* 动态 — 直接跳转 */}
            <DropdownMenuItem onClick={() => router.push("/moment")}>
              <MessageSquareText className="mr-2 h-4 w-4 shrink-0" />
              {t("nav.moment")}
            </DropdownMenuItem>

            {/* 历史 — 直接跳转 */}
            <DropdownMenuItem onClick={() => router.push("/history")}>
              <Clock className="mr-2 h-4 w-4 shrink-0" />
              {t("nav.history")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
          </>
        )}

        {/* 桌面端使用原来的简单分隔线 */}
        {!isMobile && <DropdownMenuSeparator />}

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

        {/* Theme segmented control */}
        <div className="px-2 py-1">
          <div className="flex items-center rounded-lg bg-surface-secondary p-0.5">
            {THEME_OPTIONS.map((opt) => {
              const isActive = theme === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    "flex-1 inline-flex flex-col items-center justify-center gap-0.5 py-2 rounded-[7px] text-[11px] font-medium transition-colors",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <opt.icon className="h-3.5 w-3.5" />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Language submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center">
            <Globe className="mr-2 h-4 w-4 shrink-0" />
            <span>{t("settings.language")}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {currentLanguage?.nativeName ?? currentLang}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <ScrollArea className="max-h-[320px]">
              <DropdownMenuRadioGroup
                value={currentLang}
                onValueChange={handleLanguageChange}
              >
                {LANGUAGES.map((lang) => (
                  <DropdownMenuRadioItem key={lang.code} value={lang.code}>
                    {lang.nativeName}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </ScrollArea>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Settings */}
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Spacer />
            {t("common.settings")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem onSelect={() => handleLogout()}>
          <Spacer />
          {t("auth.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
