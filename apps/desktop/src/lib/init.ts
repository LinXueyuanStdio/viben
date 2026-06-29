/**
 * 应用初始化模块
 *
 * 所有窗口入口点共享的初始化逻辑。
 * 统一处理 Analytics Provider 注册、初始化。
 *
 * ## Provider 切换
 *
 * 默认使用 Firebase。切换到火山引擎的方式：
 *
 * 1. 设置环境变量: VITE_ANALYTICS_PROVIDER=volcengine
 * 2. 或者在代码中手动修改 createProvider() 的返回值
 *
 * 无需改动任何业务代码。
 */

import {
  FirebaseAnalyticsProvider,
  VolcengineAnalyticsProvider,
  registerAnalyticsProvider,
  initAnalytics,
} from "@/lib/analytics";
import type { AnalyticsProvider } from "@/lib/analytics";

// ============================================================
// Provider 配置
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyC6TDECJaxRbX77Wqqqw7aygDoqGwOHWBc",
  authDomain: "viben-66118.firebaseapp.com",
  projectId: "viben-66118",
  storageBucket: "viben-66118.firebasestorage.app",
  messagingSenderId: "1080654454499",
  appId: "1:1080654454499:web:5d4cc59188f1f1c6c96fd6",
  measurementId: "G-2Q89T9JQWD",
};

const volcengineConfig = {
  aid: 1002552,
  token: "4df738f04b384b28a8da2f7b60c36f46",
  appVersion: import.meta.env.VITE_APP_VERSION || "0.0.0",
  environment: (import.meta.env.PROD ? "production" : "development") as
    | "production"
    | "development",
};

// ============================================================
// Provider 工厂
// ============================================================

/**
 * 根据环境变量选择 Analytics Provider。
 *
 * 默认: Firebase
 * 火山引擎: VITE_ANALYTICS_PROVIDER=volcengine
 */
function createProvider(): {
  provider: AnalyticsProvider;
  config: Record<string, unknown>;
} {
  const providerType =
    import.meta.env.VITE_ANALYTICS_PROVIDER || "firebase";

  if (providerType === "volcengine") {
    return {
      provider: new VolcengineAnalyticsProvider(),
      config: volcengineConfig as unknown as Record<string, unknown>,
    };
  }

  // 默认：Firebase
  return {
    provider: new FirebaseAnalyticsProvider(),
    config: firebaseConfig as unknown as Record<string, unknown>,
  };
}

// ============================================================
// 初始化
// ============================================================

let _initialized = false;

/**
 * 初始化 Analytics。
 * 幂等操作——多次调用只执行一次。
 */
export function initApp(): void {
  if (_initialized) return;
  _initialized = true;

  // 根据环境变量选择 Provider 并初始化
  const { provider, config } = createProvider();
  registerAnalyticsProvider(provider);
  initAnalytics(config);

  if (import.meta.env.DEV) {
    console.log(`[init] Analytics Provider: ${provider.name}`);
  }
}
