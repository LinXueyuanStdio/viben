'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ErrorBoundary } from '@/components/layout/error-boundary';
import { GoogleOneTap } from '@/components/auth/google-one-tap';
import type { Session } from '@/lib/auth/types';

const SESSION_CACHE_KEY = 'viben_session';
// 本地缓存的乐观过期点（略短于 access token 的 15 分钟，避免显示已登录却 token 已失效）
const SESSION_CACHE_MAX_AGE = 14 * 60 * 1000; // 14 分钟

interface CachedSession {
  session: Session;
  expiresAt: number; // 绝对过期时间戳（ms）
}

// 模块级内存缓存，同 SPA session 内避免重复请求
let __sessionCache: CachedSession | null = null;

function readCache(): CachedSession | null {
  if (__sessionCache && __sessionCache.expiresAt > Date.now()) {
    return __sessionCache;
  }
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (raw) {
      const cached: CachedSession = JSON.parse(raw);
      if (cached.expiresAt > Date.now()) {
        __sessionCache = cached;
        return cached;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function writeCache(session: Session): void {
  const cached: CachedSession = { session, expiresAt: Date.now() + SESSION_CACHE_MAX_AGE };
  __sessionCache = cached;
  try {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cached));
  } catch { /* ignore */ }
}

async function fetchMe(): Promise<Session | null> {
  const meRes = await fetch('/api/users/me');
  if (!meRes.ok) return null;
  const { user } = await meRes.json();
  return {
    userId: user.id,
    username: user.username,
    userSlug: user.userSlug,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    expiresAt: Date.now() + SESSION_CACHE_MAX_AGE,
  };
}

interface AppShellWrapperProps {
  children: React.ReactNode;
  isLoggedIn?: boolean;
}

export function AppShellWrapper({ children, isLoggedIn }: AppShellWrapperProps) {
  const [session, setSession] = useState<Session | null>(() => {
    // 后端明确未登录时，不读本地缓存，避免显示 stale 的「已登录」头像
    if (isLoggedIn === false) return null;
    const cached = readCache();
    return cached?.session ?? null;
  });
  const [ready, setReady] = useState(() =>
    isLoggedIn === false ? true : !!readCache(),
  );

  useEffect(() => {
    if (isLoggedIn === false) {
      // 后端读到 access token 失效。可能是「真未登录」，也可能是 access 过期
      // 而 refresh 仍有效（middleware 未 refresh 或软导航未经过 middleware）。
      // 若本地曾有缓存，先尝试 refresh 恢复；失败才清缓存。
      if (!readCache()) {
        __sessionCache = null;
        setSession(null);
        setReady(true);
        return;
      }

      let cancelled = false;
      (async () => {
        try {
          await fetch('/api/auth/refresh', { method: 'POST' });
          const s = await fetchMe();
          if (cancelled) return;
          if (s) {
            writeCache(s);
            setSession(s);
            setReady(true);
            return;
          }
        } catch {
          // ignore — refresh 失败走清缓存
        }
        if (cancelled) return;
        __sessionCache = null;
        try {
          localStorage.removeItem(SESSION_CACHE_KEY);
        } catch {
          // ignore
        }
        setSession(null);
        setReady(true);
      })();
      return () => { cancelled = true; };
    }

    // 已有有效缓存则跳过请求
    if (readCache()) {
      setReady(true);
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        let s = await fetchMe();

        // 401（access token 缺失/过期）→ 先刷新一次再重试，缓解 middleware
        // 刷新后当前请求 RSC 读不到新 cookie 的一次性「未登录」闪烁。
        if (!s) {
          try {
            await fetch('/api/auth/refresh', { method: 'POST' });
            s = await fetchMe();
          } catch {
            // refresh 失败则保持未登录
          }
        }

        if (cancelled) return;

        if (s) {
          writeCache(s);
          setSession(s);
        }
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
