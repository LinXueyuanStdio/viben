'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ErrorBoundary } from '@/components/layout/error-boundary';
import { GoogleOneTap } from '@/components/auth/google-one-tap';
import type { Session } from '@/lib/auth/types';

interface AppShellWrapperProps {
  children: React.ReactNode;
  isLoggedIn?: boolean;
}

export function AppShellWrapper({ children, isLoggedIn }: AppShellWrapperProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 服务端已判定未登录 → 跳过无效的 /api/users/me 调用
    if (isLoggedIn === false) {
      setReady(true);
      return;
    }

    let cancelled = false;

    async function init() {
      try {
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
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
        setSession(s);
      } catch {
        // Session fetch failed — remain logged out
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  return (
    <>
      <AppShell session={session}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </AppShell>
      <GoogleOneTap enabled={session === null && ready} />
    </>
  );
}
