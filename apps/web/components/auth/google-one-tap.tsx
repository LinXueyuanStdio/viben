'use client';

import { useEffect, useRef } from 'react';

const DISMISSAL_COOKIE = 'google_one_tap_dismissed';
const DISMISSAL_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const IDLE_DELAY_MS = 2000; // fallback delay when requestIdleCallback unavailable

interface GoogleOneTapProps {
  /** 是否启用 One Tap（仅未登录且 session 查询完成后为 true） */
  enabled: boolean;
}

function hasDismissalCookie(): boolean {
  if (typeof document === 'undefined') return true;
  return document.cookie.split('; ').some((c) => c.startsWith(`${DISMISSAL_COOKIE}=true`));
}

function setDismissalCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${DISMISSAL_COOKIE}=true; max-age=${DISMISSAL_MAX_AGE_SEC}; path=/; SameSite=Lax`;
}

/**
 * Google One Tap 组件
 *
 * 懒加载 GIS 脚本，在不阻塞首屏的前提下弹出 Google One Tap 登录卡片。
 * 仅在 dashboard 页面、用户未登录时启用。
 */
export function GoogleOneTap({ enabled }: GoogleOneTapProps) {
  const scriptLoadedRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (hasDismissalCookie()) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn('[GoogleOneTap] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set');
      return;
    }

    let cancelled = false;

    function loadScript() {
      if (cancelled || scriptLoadedRef.current) return;

      const existing = document.querySelector(
        `script[src="${GIS_SCRIPT_URL}"]`
      );
      if (existing) {
        scriptLoadedRef.current = true;
        initOneTap();
        return;
      }

      const script = document.createElement('script');
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (cancelled) return;
        scriptLoadedRef.current = true;
        initOneTap();
      };
      script.onerror = () => {
        console.warn('[GoogleOneTap] Failed to load GIS script');
      };
      document.head.appendChild(script);
    }

    function initOneTap() {
      if (cancelled || initializedRef.current) return;
      if (!window.google?.accounts?.id) {
        console.warn('[GoogleOneTap] google.accounts.id not available');
        return;
      }

      initializedRef.current = true;

      window.google.accounts.id.initialize({
        client_id: clientId!,
        callback: handleCredentialResponse,
        itp_support: true,
        use_fedcm_for_prompt: true,
      });

      window.google.accounts.id.prompt((notification) => {
        if (notification.isDismissedMoment()) {
          // 用户关闭了 One Tap → 记录 cookie 防止反复弹出
          setDismissalCookie();
        }
      });
    }

    async function handleCredentialResponse(response: CredentialResponse) {
      try {
        const res = await fetch('/api/auth/google/one-tap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential }),
        });

        if (res.ok) {
          // 登录成功 → 刷新页面让 AppShellWrapper 获取新 session
          window.location.reload();
        } else {
          const data = await res.json().catch(() => ({}));
          console.error('[GoogleOneTap] Login failed:', data.error || res.statusText);
        }
      } catch (err) {
        console.error('[GoogleOneTap] Request failed:', err);
      }
    }

    // 懒加载：优先使用 requestIdleCallback 在浏览器空闲时加载
    if (typeof requestIdleCallback !== 'undefined') {
      const idleId = requestIdleCallback(loadScript, { timeout: IDLE_DELAY_MS });
      return () => {
        cancelled = true;
        cancelIdleCallback(idleId);
      };
    } else {
      const timerId = setTimeout(loadScript, IDLE_DELAY_MS);
      return () => {
        cancelled = true;
        clearTimeout(timerId);
      };
    }
  }, [enabled]);

  // 该组件不渲染任何 DOM — GIS 脚本自动管理 UI
  return null;
}
