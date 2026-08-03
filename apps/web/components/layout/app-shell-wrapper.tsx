'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ErrorBoundary } from '@/components/layout/error-boundary';
import { GoogleOneTap } from '@/components/auth/google-one-tap';
import type { Session } from '@/lib/auth/types';

const SESSION_CACHE_KEY = 'viben_session';
const SESSION_CACHE_TTL = 30 * 60 * 1000; // 30 分钟

interface CachedSession {
  session: Session;
  ts: number;
}

// 模块级内存缓存，同 SPA session 内避免重复请求
let __sessionCache: CachedSession | null = null;

function readCache(): CachedSession | null {
  if (__sessionCache && Date.now() - __sessionCache.ts < SESSION_CACHE_TTL) {
    return __sessionCache;
  }
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (raw) {
      const cached: CachedSession = JSON.parse(raw);
      if (Date.now() - cached.ts < SESSION_CACHE_TTL) {
        __sessionCache = cached;
        return cached;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function writeCache(session: Session): void {
  const cached: CachedSession = { session, ts: Date.now() };
  __sessionCache = cached;
  try {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cached));
  } catch { /* ignore */ }
}

interface AppShellWrapperProps {
  children: React.ReactNode;
  isLoggedIn?: boolean;
}

export function AppShellWrapper({ children, isLoggedIn }: AppShellWrapperProps) {
  const [session, setSession] = useState<Session | null>(() => {
    const cached = readCache();
    return cached?.session ?? null;
  });
  const [ready, setReady] = useState(() => !!readCache());

  useEffect(() => {
    if (isLoggedIn === false) {
      setReady(true);
      return;
    }

    // 已有有效缓存则跳过请求
    if (readCache()) {
      setReady(true);
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const meRes = await fetch('/api/users/me');
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
        writeCache(s);
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
