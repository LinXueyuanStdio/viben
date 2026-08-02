'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Home,
  Grid3X3,
  TrendingUp,
  Search,
  MessageSquare,
  Bell,
  Clock,
  Package,
  Sparkles,
  Layers,
  BarChart3,
  LayoutDashboard,
  Key,
  Users,
  Flag,
  ScrollText,
  FileText,
  Activity,
  Star,
  FileEdit,
  Image,
  Download,
  Share2,
} from 'lucide-react';
import type { AdminPermission, UserRole } from '@/lib/types/admin';
import { ROLE_PERMISSIONS, ADMIN_ROLES } from '@/lib/types/admin';

// Navigation items
const browseNavigation = [
  { nameKey: 'nav.home', href: '/', icon: Home },
  { nameKey: 'nav.analytics', href: '/analytics', icon: BarChart3 },
];

interface AdminNavItem {
  name: string;
  href: string;
  icon: typeof Package;
  permission?: AdminPermission;
  badgeCount?: number;
}

interface SidebarProps {
  collapsed: boolean
  session?: { role?: string; username?: string; email?: string; avatarUrl?: string; userSlug?: string } | null
  pendingPackagesCount?: number
  isMobile: boolean
  open: boolean
  onClose: () => void
}

function hasPermission(role: string, permission: AdminPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role as UserRole] ?? [];
  return permissions.includes(permission);
}

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as UserRole);
}

export function Sidebar({
  collapsed,
  session,
  pendingPackagesCount = 0,
  isMobile,
  open,
  onClose,
}: SidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const userRole = session?.role;

  const showAdmin = userRole && isAdminRole(userRole);

  // Admin navigation organized by functional workflow
  const adminGroups: { label: string; items: AdminNavItem[] }[] = [
    {
      label: t('nav.adminOverview', '总览'),
      items: [
        { name: t('adminNav.dashboard'), href: '/admin', icon: LayoutDashboard },
        { name: t('adminNav.logs'), href: '/admin/logs', icon: ScrollText, permission: 'admin.access' },
      ],
    },
    {
      label: t('nav.adminModeration', '审核'),
      items: [
        {
          name: t('adminNav.packages'),
          href: '/admin/packages',
          icon: Package,
          permission: 'packages.review',
          badgeCount: pendingPackagesCount,
        },
        { name: t('adminNav.pageReview'), href: '/admin/pages', icon: FileText, permission: 'pages.review' },
        { name: t('adminNav.comments'), href: '/admin/comments', icon: MessageSquare, permission: 'content.moderate' },
        { name: t('adminNav.collections'), href: '/admin/collections', icon: Layers, permission: 'content.moderate' },
        { name: t('adminNav.moments'), href: '/admin/moments', icon: Clock, permission: 'moments.moderate' },
        { name: t('adminNav.reports'), href: '/admin/reports', icon: Flag, permission: 'reports.view' },
        { name: t('adminNav.feedbacks'), href: '/admin/feedbacks', icon: MessageSquare, permission: 'feedbacks.view' },
        { name: t('adminNav.ratings'), href: '/admin/ratings', icon: Star, permission: 'content.moderate' },
      ],
    },
    {
      label: t('nav.adminContentOps', '运营'),
      items: [
        { name: t('adminNav.categories'), href: '/admin/categories', icon: Grid3X3, permission: 'categories.manage' },
        { name: t('adminNav.topics'), href: '/admin/topics', icon: MessageSquare, permission: 'topics.manage' },
        { name: t('adminNav.rankings'), href: '/admin/rankings', icon: TrendingUp, permission: 'rankings.view' },
        { name: t('adminNav.operations'), href: '/admin/operations', icon: Layers, permission: 'operations.manage' },
      ],
    },
    {
      label: t('nav.adminUsersGroup', '用户'),
      items: [
        { name: t('adminNav.users'), href: '/admin/users', icon: Users, permission: 'users.view' },
        { name: t('adminNav.drafts'), href: '/admin/drafts', icon: FileEdit, permission: 'content.delete' },
      ],
    },
    {
      label: t('nav.adminAnalytics', '数据'),
      items: [
        { name: t('adminNav.analytics'), href: '/admin/analytics', icon: BarChart3, permission: 'rankings.view' },
        { name: t('adminNav.searchAnalytics'), href: '/admin/search-analytics', icon: Search, permission: 'rankings.view' },
        { name: t('adminNav.downloads'), href: '/admin/downloads', icon: Download, permission: 'rankings.view' },
        { name: t('adminNav.activity'), href: '/admin/activity', icon: Activity, permission: 'rankings.view' },
      ],
    },
    {
      label: t('nav.adminSystem', '系统'),
      items: [
        { name: t('adminNav.media'), href: '/admin/media', icon: Image, permission: 'content.moderate' },
        { name: t('adminNav.shares'), href: '/admin/shares', icon: Share2, permission: 'content.moderate' },
        { name: t('adminNav.notifications'), href: '/admin/notifications', icon: Bell, permission: 'admin.access' },
        { name: t('adminNav.apiKeys'), href: '/admin/api-keys', icon: Key, permission: 'users.view' },
      ],
    },
  ];

  const visible = isMobile ? open : !collapsed

  // Body scroll lock + Escape key when mobile sidebar is open
  React.useEffect(() => {
    if (!isMobile || !open) return
    document.body.style.overflow = "hidden"
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handleKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", handleKey)
    }
  }, [isMobile, open, onClose])

  return (
    <>
      {/* Backdrop — always rendered, CSS-controlled visibility */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-opacity duration-180",
          isMobile && open
            ? "opacity-100 pointer-events-auto bg-black/40"
            : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed left-0 z-50 flex flex-col border-r bg-background",
          "w-[var(--sidebar-w)]",
          "transition-transform duration-[220ms] ease-out",
          visible ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          top: "var(--nav-h, 56px)",
          height: "calc(100vh - var(--nav-h, 56px))",
          willChange: "transform",
        }}
      >
        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {browseNavigation.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {t(item.nameKey)}
              </Link>
            );
          })}

          {/* Admin Section — grouped by function */}
          {showAdmin && (
            <>
              <div className="my-4 border-t" />
              <div className="px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('nav.admin')}
                </span>
              </div>
              {adminGroups.map((group) => {
                // Filter items by permission
                const visibleItems = group.items.filter(
                  (item) => !item.permission || hasPermission(userRole, item.permission)
                );
                if (visibleItems.length === 0) return null;

                return (
                  <div key={group.label} className="mb-1">
                    <div className="px-3 py-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground/60">
                        {group.label}
                      </span>
                    </div>
                    {visibleItems.map((item) => {
                      const isActive =
                        item.href === '/admin'
                          ? pathname === '/admin'
                          : pathname.startsWith(item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.name}
                          {item.badgeCount !== undefined && item.badgeCount > 0 && (
                            <Badge variant="destructive" className="ml-auto">
                              {item.badgeCount}
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
