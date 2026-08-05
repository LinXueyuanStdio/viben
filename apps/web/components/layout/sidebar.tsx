'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useResizable } from '@/hooks/use-resizable';
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
  ChevronRight,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Terminal,
  Braces,
} from 'lucide-react';
import type { AdminPermission, UserRole } from '@/lib/types/admin';
import { ROLE_PERMISSIONS, ADMIN_ROLES } from '@/lib/types/admin';
import { SidebarViewStack } from './sidebar-view-stack';

// Navigation items
const browseNavigation = [
  { nameKey: 'nav.home', href: '/', icon: Home },
  { nameKey: 'nav.analytics', href: '/analytics', icon: BarChart3 },
  { nameKey: 'nav.assistant', href: '/assistant', icon: Sparkles },
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

  // Resizable sidebar
  const { handleProps, isDragging: isResizing } = useResizable({
    cssVar: "--sidebar-w",
    storageKey: "viben-sidebar-w",
    minWidth: 200,
    maxWidth: 400,
    defaultWidth: 256,
    direction: "right",
  })

  // Panel toggles
  const [adminPanelOpen, setAdminPanelOpen] = React.useState(false);
  const [docsPanelOpen, setDocsPanelOpen] = React.useState(false);

  const isDocsActive = pathname.startsWith('/docs');
  const isAdminActive = pathname.startsWith('/admin');

  // Auto-open panels when on their routes, auto-close when leaving
  React.useEffect(() => {
    if (showAdmin && isAdminActive) {
      setAdminPanelOpen(true);
      setDocsPanelOpen(false);
    } else if (isDocsActive) {
      setDocsPanelOpen(true);
      setAdminPanelOpen(false);
    } else {
      setAdminPanelOpen(false);
      setDocsPanelOpen(false);
    }
  }, [pathname, showAdmin, isAdminActive, isDocsActive]);

  const openAdminPanel = React.useCallback(() => { setDocsPanelOpen(false); setAdminPanelOpen(true); }, []);
  const closeAdminPanel = React.useCallback(() => setAdminPanelOpen(false), []);
  const openDocsPanel = React.useCallback(() => { setAdminPanelOpen(false); setDocsPanelOpen(true); }, []);
  const closeDocsPanel = React.useCallback(() => setDocsPanelOpen(false), []);

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
      {/* Backdrop — mobile only, when sidebar is open */}
      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 z-40 transition-opacity duration-180",
            open
              ? "opacity-100 pointer-events-auto bg-black/40"
              : "opacity-0 pointer-events-none"
          )}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

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
        <div className="relative flex-1 flex flex-col min-h-0">
        <SidebarViewStack activePanelId={adminPanelOpen ? 'admin' : docsPanelOpen ? 'docs' : 'main'}>
          {/* ─── Main Panel ──────────────────────────────────────── */}
          <SidebarViewStack.Panel id="main">
            <nav className="h-full space-y-1 overflow-y-auto p-4">
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

              {/* Docs entry — opens docs sub-panel */}
              <div className="my-3 border-t" />
              <button
                type="button"
                onClick={openDocsPanel}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-left',
                  isDocsActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <BookOpen className="h-4 w-4" />
                <span className="flex-1">{t('nav.docs')}</span>
                <ChevronRight className="h-4 w-4 opacity-50" />
              </button>

              {/* Admin entry — opens admin sub-panel */}
              {showAdmin && (
                <>
                  <div className="my-4 border-t" />
                  <button
                    type="button"
                    onClick={openAdminPanel}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-left',
                      isAdminActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="flex-1">{t('nav.admin')}</span>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </button>
                </>
              )}
            </nav>
          </SidebarViewStack.Panel>

          {/* ─── Docs Panel ──────────────────────────────────────── */}
          <SidebarViewStack.Panel id="docs">
            <nav className="h-full space-y-1 overflow-y-auto p-4">
              {/* Back button */}
              <button
                type="button"
                onClick={closeDocsPanel}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left text-muted-foreground hover:bg-muted hover:text-foreground mb-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="font-medium text-foreground">{t('nav.docs')}</span>
              </button>

              <a
                href="https://linxueyuan.online/viben/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                <span className="flex-1">{t('nav.docsUsage')}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
              </a>
              <Link
                href="/docs/mcp"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname.startsWith('/docs/mcp')
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Terminal className="h-4 w-4" />
                {t('nav.docsMcp')}
              </Link>
              <a
                href="/docs/api"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Braces className="h-4 w-4" />
                <span className="flex-1">{t('nav.docsApi')}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
              </a>
            </nav>
          </SidebarViewStack.Panel>

          {/* ─── Admin Panel ─────────────────────────────────────── */}
          <SidebarViewStack.Panel id="admin">
            <nav className="h-full space-y-1 overflow-y-auto p-4">
              {/* Back button */}
              <button
                type="button"
                onClick={closeAdminPanel}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left text-muted-foreground hover:bg-muted hover:text-foreground mb-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="font-medium text-foreground">{t('nav.admin')}</span>
              </button>

              {/* Admin groups */}
              {adminGroups.map((group) => {
                // Filter items by permission
                const visibleItems = group.items.filter(
                  (item) => !item.permission || hasPermission(userRole!, item.permission)
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
            </nav>
          </SidebarViewStack.Panel>
        </SidebarViewStack>
        {/* Resize handle — desktop only */}
        {!isMobile && (
          <div
            {...handleProps}
            className={cn(
              "absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize transition-colors",
              handleProps.className
            )}
          />
        )}
        </div>
      </aside>
    </>
  );
}
