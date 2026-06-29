/**
 * Analytics 单例工厂
 *
 * 管理当前 AnalyticsProvider 实例的生命周期。
 * 应用启动时注册 Provider，之后所有代码通过 getProvider() 获取。
 */

import type { AnalyticsProvider } from "./provider";

let _provider: AnalyticsProvider | null = null;

/**
 * 注册分析 Provider。
 * 必须在应用启动时调用一次，在初始化之前。
 *
 * @example
 * import { FirebaseAnalyticsProvider } from "./providers/firebase";
 * registerAnalyticsProvider(new FirebaseAnalyticsProvider());
 */
export function registerAnalyticsProvider(provider: AnalyticsProvider): void {
  if (_provider) {
    console.warn(
      `[analytics] Provider 已注册，正在替换: ${_provider.name} → ${provider.name}`,
    );
  }
  _provider = provider;
}

/**
 * 初始化当前 Provider。
 * 必须在 registerAnalyticsProvider() 之后调用。
 */
export async function initAnalytics(
  config: Record<string, unknown>,
): Promise<void> {
  if (!_provider) {
    throw new Error(
      "[analytics] 未注册 Provider，请先调用 registerAnalyticsProvider()",
    );
  }
  await _provider.initialize(config);
}

/**
 * 获取当前 Provider 单例。
 * 内部使用——业务代码应通过 useAnalytics() hook 调用。
 */
export function getProvider(): AnalyticsProvider {
  if (!_provider) {
    throw new Error(
      "[analytics] 未注册 Provider，请先调用 registerAnalyticsProvider()",
    );
  }
  return _provider;
}

/**
 * 运行时切换 Provider（如远程配置下发切换指令）。
 * 会先 flush 旧 Provider 再初始化新 Provider。
 */
export async function switchProvider(
  newProvider: AnalyticsProvider,
  config: Record<string, unknown>,
): Promise<void> {
  await _provider?.flush();
  _provider = newProvider;
  await _provider.initialize(config);
}
