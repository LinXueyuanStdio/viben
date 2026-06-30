'use client';

"use client"

import { useCallback } from "react"
import Link from 'next/link';
import { useRouter } from "next/navigation"
import { LogOut, Settings, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Session } from '@/lib/auth/types';

interface UserMenuProps {
  session: Session;
}

export function UserMenu({ session }: UserMenuProps) {
  const { t } = useTranslation();
  const router = useRouter()
  const initials = session.username.slice(0, 2).toUpperCase();

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
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{session.username}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {session.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User className="mr-2 h-4 w-4" />
            {t('auth.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile/settings">
            <Settings className="mr-2 h-4 w-4" />
            {t('common.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            handleLogout()
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
