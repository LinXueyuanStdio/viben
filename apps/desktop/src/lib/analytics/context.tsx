/**
 * Analytics React Context
 *
 * 通过 Context 向组件树提供 AnalyticsProvider 实例。
 * 在 App 根组件中包裹一次即可。
 */

import { createContext, useContext, type ReactNode } from "react";
import { getProvider } from "./factory";
import type { AnalyticsProvider } from "./provider";

const AnalyticsContext = createContext<AnalyticsProvider | null>(null);

/**
 * Analytics Context Provider。
 * 应在 App 根组件中包裹，确保所有子组件可通过 useAnalytics() 访问。
 */
export function AnalyticsContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const provider = getProvider();
  return (
    <AnalyticsContext.Provider value={provider}>
      {children}
    </AnalyticsContext.Provider>
  );
}

/**
 * 通过 Context 获取 Provider（供 hooks.ts 内部使用）。
 */
export function useAnalyticsContext(): AnalyticsProvider | null {
  return useContext(AnalyticsContext);
}
