'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ErrorBoundary } from '@/components/layout/error-boundary';
import type { Session } from '@/lib/auth/types';

interface NotificationItem {
  title: string;
  subtitle: string;
  href: string;
  thumb: string;
}

interface HistoryItem {
  title: string;
  subtitle: string;
  href: string;
  thumb: string;
}

interface AppShellWrapperProps {
  children: React.ReactNode;
}

export function AppShellWrapper({ children }: AppShellWrapperProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Fetch session via the existing /api/users/me endpoint
        const meRes = await fetch('/api/users/me', { cache: 'no-store' });
        if (!meRes.ok) {
          if (!cancelled) setReady(true);
          return;
        }
        const { user } = await meRes.json();
        if (cancelled) return;

        const s: Session = {
          userId: user.id,
          username: user.username,
          userSlug: user.userSlug,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
        setSession(s);

        // Fetch notifications & history in parallel
        const [notifRes, histRes] = await Promise.allSettled([
          fetch('/api/notifications?limit=5&unread_only=false', { cache: 'no-store' }),
          fetch('/api/community/history?limit=5', { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        // Parse notifications
        if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
          try {
            const nd = await notifRes.value.json();
            const raw = nd.items ?? nd.notifications ?? [];
            setNotificationItems(raw.map((item: any) => ({
              title: item.title ?? '',
              subtitle: item.actor_name
                ? `${item.actor_name} · ${item.body ?? ''}`
                : (item.body ?? ''),
              href: item.page_author_slug && item.page_uid
                ? `/${item.page_author_slug}/${item.page_uid}?tab=read`
                : '#',
              thumb: item.actor_avatar_url ?? '',
            })));
          } catch { /* ignore parse errors */ }
        }

        // Parse history
        if (histRes.status === 'fulfilled' && histRes.value.ok) {
          try {
            const hd = await histRes.value.json();
            const raw = hd.items ?? hd.history ?? [];
            setHistoryItems(raw.map((item: any) => ({
              title: item.title ?? item.snapshot_title ?? '',
              subtitle: item.author_name
                ? `${item.author_name} · ${new Date(item.last_viewed_at ?? Date.now()).toLocaleDateString('zh-CN')}`
                : '',
              href: item.author_slug && item.page_id
                ? `/${item.author_slug}/${item.page_id}?tab=read`
                : '#',
              thumb: item.cover_url ?? '',
            })));
          } catch { /* ignore */ }
        }
      } catch {
        // Session fetch failed — remain logged out
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell
      session={session}
      notificationItems={notificationItems}
      historyItems={historyItems}
    >
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </AppShell>
  );
}
