/**
 * Analytics Hooks
 *
 * 提供类型安全的埋点调用方式。
 * 所有业务组件通过 useAnalytics() 上报事件，不直接依赖 Provider。
 */

import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { getProvider } from "./factory";
import { AnalyticsEvents } from "./types";

/**
 * 核心 hook：返回 logEvent 函数。
 *
 * @example
 * const { logEvent } = useAnalytics();
 * logEvent(AnalyticsEvents.PAGE_VIEW, { page_name: "workspace" });
 */
export function useAnalytics() {
  const provider = getProvider();

  const logEvent = useCallback(
    (eventName: string, params?: Record<string, unknown>) => {
      // 开发环境下打印到 console 方便调试
      if (import.meta.env.DEV) {
        console.debug(
          `[analytics] ${eventName}`,
          params ? JSON.stringify(params) : "",
        );
      }
      provider.logEvent(eventName, params);
    },
    [],
  );

  const setUserId = useCallback((userId: string | null) => {
    provider.setUserId(userId);
  }, []);

  const setUserProperties = useCallback(
    (properties: Record<string, unknown>) => {
      provider.setUserProperties(properties);
    },
    [],
  );

  return { logEvent, setUserId, setUserProperties };
}

/**
 * 自动页面浏览追踪 hook。
 * 在路由组件中使用，路由切换时自动上报 page_view 事件。
 *
 * @example
 * function AppLayout() {
 *   usePageViewTracking();
 *   return <Outlet />;
 * }
 */
export function usePageViewTracking() {
  const location = useLocation();
  const { logEvent } = useAnalytics();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const currentPath = location.pathname;
    if (prevPathRef.current === currentPath) return;
    prevPathRef.current = currentPath;

    // 从路径提取页面名称
    const segments = currentPath.split("/").filter(Boolean);
    const pageName = segments.length > 0 ? segments.join("_") : "home";

    logEvent(AnalyticsEvents.PAGE_VIEW, {
      page_name: pageName,
      page_path: currentPath,
      page_referrer: document.referrer || "",
    });
  }, [location.pathname]);
}
