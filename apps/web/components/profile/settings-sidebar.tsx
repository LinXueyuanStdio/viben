'use client'

import { useTranslation } from 'react-i18next'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { UserRound, Shield, Key, Sparkles, BarChart3, Box, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/settings', match: (p: string) => p === '/settings' || p === '/settings/profile', label: 'profile.settings.nav.profile', icon: UserRound },
  { href: '/settings/account', match: (p: string) => p.startsWith('/settings/account'), label: 'profile.settings.nav.account', icon: Shield },
  { href: '/settings/api_keys', match: (p: string) => p.startsWith('/settings/api_keys'), label: 'profile.settings.nav.apiKeys', icon: Key },
  { href: '/settings/assistant', match: (p: string) => p.startsWith('/settings/assistant'), label: 'nav.assistant', icon: Sparkles },
  { href: '/settings/sandbox', match: (p: string) => p.startsWith('/settings/sandbox'), label: 'nav.sandbox', icon: Box },
  { href: '/settings/usage', match: (p: string) => p.startsWith('/settings/usage'), label: 'nav.usage', icon: BarChart3 },
  { href: '/settings/subscription', match: (p: string) => p.startsWith('/settings/subscription'), label: 'nav.subscription', icon: CreditCard },
]

export function SettingsSidebar() {
  const { t } = useTranslation()
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
        const isActive = match(pathname)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-secondary"
            )}
          >
            <Icon className="size-4" />
            {t(label)}
          </Link>
        )
      })}
    </nav>
  )
}
