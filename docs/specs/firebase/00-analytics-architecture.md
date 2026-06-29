# Viben Desktop 分析系统架构设计

> **日期**: 2026-06-29  
> **版本**: 1.0  
> **状态**: 草案

---

## 一、问题与目标

### 1.1 背景

当前计划直接使用 Firebase Analytics SDK 做业务埋点。但团队后续可能将分析后端从 Firebase 迁移到**火山引擎（Volcengine）应用分析**。如果业务代码中直接调用 `logEvent()` 等 Firebase 专用 API，未来切换成本极高——需要修改所有埋点调用点。

### 1.2 目标

- **Provider 可替换**：切换分析后端只需实现一个新 Provider，业务代码零改动
- **事件定义统一**：235 个事件的定义（名称、参数、优先级）与 Provider 无关，是唯一的真相来源
- **React 集成友好**：通过 hooks 提供类型安全、可测试的埋点调用
- **渐进式迁移**：不影响现有的 Sentry 集成（Sentry 是另一个独立维度）

---

## 二、分层架构

```
┌─────────────────────────────────────────────────────┐
│                    UI 层 (React)                      │
│  useAnalytics() / usePageView() / <ErrorBoundary>    │
├─────────────────────────────────────────────────────┤
│                 事件定义层 (types.ts)                  │
│  235 个事件名常量 + 参数类型（与 Provider 无关）         │
├─────────────────────────────────────────────────────┤
│                Provider 接口 (provider.ts)            │
│  AnalyticsProvider interface:                        │
│  initialize / logEvent / setUserProperties / ...     │
├──────────────────┬──────────────────────────────────┤
│  FirebaseProvider │  VolcengineProvider  (future)    │
│  (当前实现)        │  (未来实现)                       │
└──────────────────┴──────────────────────────────────┘
```

### 2.1 依赖规则

1. **UI 层只依赖事件定义层**，不直接 import Firebase SDK
2. **Provider 实现依赖接口 + 对应 SDK**，彼此独立
3. **应用启动时注入 Provider**，类似于依赖注入的"注册一次，处处使用"

### 2.2 文件结构

```
apps/desktop/src/lib/analytics/
├── index.ts                  # 公共 API 入口
├── types.ts                  # 事件名称常量 + 参数类型定义（纯类型文件）
├── provider.ts               # AnalyticsProvider 接口定义
├── providers/
│   ├── firebase.ts           # FirebaseAnalyticsProvider 实现
│   └── volcengine.ts         # (future) VolcengineAnalyticsProvider 实现
├── factory.ts                # 单例工厂：创建/获取/切换 Provider
├── context.tsx               # React Context + Provider 组件
└── hooks.ts                  # useAnalytics / usePageView / useTrackEvent

apps/desktop/src/lib/sentry/     # ⚠️ Sentry 独立，不经过 analytics 抽象
├── init.ts
└── error-boundary.tsx
```

---

## 三、核心接口设计

### 3.1 AnalyticsProvider 接口

```typescript
// provider.ts

/**
 * 分析服务 Provider 接口。
 * 所有分析后端（Firebase、火山引擎等）必须实现此接口。
 * 业务代码不直接依赖此接口——通过 factory 获取单例。
 */
interface AnalyticsProvider {
  /** Provider 唯一标识 */
  readonly name: string;

  /**
   * 初始化 Provider。
   * 在应用启动时调用一次。
   * @param config - Provider 特定配置，由各 Provider 自行解析
   */
  initialize(config: Record<string, unknown>): Promise<void>;

  /**
   * 上报事件。
   * @param eventName - 事件名（使用 types.ts 中的常量）
   * @param params   - 事件参数对象（snake_case key）
   */
  logEvent(eventName: string, params?: Record<string, unknown>): void;

  /**
   * 设置用户属性（用于用户分群、漏斗分析）。
   * 属性在整个 session 中持久保留，多次调用会合并。
   */
  setUserProperties(properties: Record<string, unknown>): void;

  /**
   * 设置用户标识。
   * @param userId - 匿名化的用户 ID；传 null 表示登出
   */
  setUserId(userId: string | null): void;

  /**
   * 设置当前屏幕名称（用于页面浏览分析）。
   * 通常在路由切换时自动调用。
   */
  setScreenName(screenName: string): void;

  /**
   * 刷新缓冲区，确保事件被发送。
   * 在应用即将关闭/进入后台时调用。
   */
  flush(): Promise<void>;
}
```

### 3.2 工厂模式

```typescript
// factory.ts

import type { AnalyticsProvider } from './provider';

let _provider: AnalyticsProvider | null = null;
let _initialized = false;

/**
 * 设置当前分析 Provider。
 * 必须在应用启动时调用一次（在 import "./lib/firebase" 之前）。
 *
 * @example
 * import { FirebaseAnalyticsProvider } from './providers/firebase';
 * setupAnalyticsProvider(new FirebaseAnalyticsProvider());
 * await initAnalytics({ apiKey: '...', ... });
 */
export function setupAnalyticsProvider(provider: AnalyticsProvider): void {
  if (_provider) {
    console.warn('[analytics] Provider already set, replacing:', _provider.name, '→', provider.name);
  }
  _provider = provider;
}

export async function initAnalytics(config: Record<string, unknown>): Promise<void> {
  if (!_provider) throw new Error('[analytics] No provider registered. Call setupAnalyticsProvider() first.');
  await _provider.initialize(config);
  _initialized = true;
}

/** 获取当前 Provider 单例（内部使用，不直接暴露给 UI） */
export function getProvider(): AnalyticsProvider {
  if (!_provider) throw new Error('[analytics] No provider registered.');
  return _provider;
}

/** 切换 Provider（如远程配置下发切换指令） */
export async function switchProvider(newProvider: AnalyticsProvider, config: Record<string, unknown>): Promise<void> {
  await _provider?.flush();
  _provider = newProvider;
  await _provider.initialize(config);
}
```

### 3.3 Firebase Provider 实现

```typescript
// providers/firebase.ts

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, logEvent as firebaseLogEvent, setUserId as firebaseSetUserId,
         setUserProperties as firebaseSetUserProperties, type Analytics } from 'firebase/analytics';
import type { AnalyticsProvider } from '../provider';

export class FirebaseAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'firebase';
  private app: FirebaseApp | null = null;
  private analytics: Analytics | null = null;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const firebaseConfig = config as {
      apiKey: string; authDomain: string; projectId: string;
      storageBucket: string; messagingSenderId: string;
      appId: string; measurementId: string;
    };
    this.app = initializeApp(firebaseConfig);
    this.analytics = getAnalytics(this.app);
  }

  logEvent(eventName: string, params?: Record<string, unknown>): void {
    if (!this.analytics) return;
    firebaseLogEvent(this.analytics, eventName, params ?? {});
  }

  setUserId(userId: string | null): void {
    if (!this.analytics) return;
    firebaseSetUserId(this.analytics, userId);
  }

  setUserProperties(properties: Record<string, unknown>): void {
    if (!this.analytics) return;
    firebaseSetUserProperties(this.analytics, properties);
  }

  setScreenName(screenName: string): void {
    // Firebase Analytics 中 screen_view 事件自动采集，此处补充手动设置
    this.logEvent('screen_view', { firebase_screen: screenName });
  }

  async flush(): Promise<void> {
    // Firebase Analytics SDK 自动批量发送，无需手动 flush
  }
}
```

### 3.4 火山引擎 Provider（未来实现模板）

```typescript
// providers/volcengine.ts (FUTURE)

import type { AnalyticsProvider } from '../provider';

export class VolcengineAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'volcengine';

  async initialize(config: Record<string, unknown>): Promise<void> {
    // 火山引擎 应用分析 SDK 初始化
    // const { appId, token, channel } = config as VolcengineConfig;
    // window.collectEvent('init', { app_id: appId, channel_domain: '...', ... });
  }

  logEvent(eventName: string, params?: Record<string, unknown>): void {
    // window.collectEvent(eventName, params);
  }

  setUserId(userId: string | null): void {
    // window.collectEvent('setUserUniqueId', { user_unique_id: userId });
  }

  setUserProperties(properties: Record<string, unknown>): void {
    // window.collectEvent('setProfile', properties);
  }

  setScreenName(screenName: string): void {
    // window.collectEvent('setPage', { page_name: screenName });
  }

  async flush(): Promise<void> {
    // 火山引擎 SDK 自动批量发送
  }
}
```

---

## 四、事件定义层（types.ts）

事件定义层与 Provider 完全解耦：

```typescript
// types.ts

// ============================================================
// 事件名称常量
// ============================================================
export const AnalyticsEvents = {
  // Navigation
  PAGE_VIEW:              'page_view',
  TAB_SWITCHED:           'tab_switched',
  // Lifecycle
  APP_LAUNCH:             'app_launch',
  SESSION_START:          'session_start',
  SESSION_END:            'session_end',
  // Engagement — Chat
  CHAT_MESSAGE_SENT:      'chat_message_sent',
  CHAT_MESSAGE_RECEIVED:  'chat_message_received',
  // ... 其余 230+ 事件常量
} as const;

// ============================================================
// 参数类型（snake_case，与 Provider 无关）
// ============================================================
interface PageViewParams {
  page_name: string;
  page_path: string;
}

interface ChatMessageParams {
  workspace_id: string;
  provider_type: string;
  model_id: string;
  message_role: 'user' | 'assistant';
  token_count?: number;
  duration_ms?: number;
}

// 联合类型：用于 logEvent 的类型约束
type AnalyticsEventParams = PageViewParams | ChatMessageParams | /* ... */;
```

---

## 五、React 集成

### 5.1 Context + Hook

```typescript
// context.tsx
import { createContext, useContext } from 'react';
import type { AnalyticsProvider } from './provider';
import { getProvider } from './factory';

const AnalyticsContext = createContext<AnalyticsProvider | null>(null);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsContext.Provider value={getProvider()}>
      {children}
    </AnalyticsContext.Provider>
  );
}

// hooks.ts
import { useCallback } from 'react';
import { getProvider } from './factory';

/**
 * 核心 hook：返回类型安全的 logEvent 函数。
 *
 * @example
 * const { logEvent } = useAnalytics();
 * logEvent(AnalyticsEvents.PAGE_VIEW, { page_name: 'workspace' });
 */
export function useAnalytics() {
  const provider = getProvider();

  const logEvent = useCallback(
    (eventName: string, params?: Record<string, unknown>) => {
      provider.logEvent(eventName, params);
    },
    []
  );

  return { logEvent };
}
```

### 5.2 初始化入口

```typescript
// main.tsx 中的初始化流程

import { FirebaseAnalyticsProvider } from './lib/analytics/providers/firebase';
import { setupAnalyticsProvider, initAnalytics } from './lib/analytics/factory';

// 1. 注册 Provider（将来切换只需改这一行）
setupAnalyticsProvider(new FirebaseAnalyticsProvider());

// 2. 初始化
const firebaseConfig = { apiKey: '...', /* ... */ };
await initAnalytics(firebaseConfig);

// 3. React 渲染（之后组件内通过 useAnalytics() 使用）
```

---

## 六、Provider 切换清单

从 Firebase 切到火山引擎时，**只需改动以下内容**，业务代码零变更：

| # | 文件 | 变更 |
|---|------|------|
| 1 | `main.tsx`（及其他入口点） | `import { FirebaseAnalyticsProvider }` → `import { VolcengineAnalyticsProvider }` |
| 2 | `providers/volcengine.ts` | 实现 `AnalyticsProvider` 接口 |
| 3 | `package.json` | 移除 `firebase`，添加火山引擎 SDK |

**不受影响的文件**（零变更）：
- `types.ts` — 事件定义不变
- `provider.ts` — 接口不变
- `hooks.ts` — hook 代码不变
- 所有业务组件中的 `useAnalytics().logEvent(...)` 调用不变

---

## 七、更新后的实施计划

基于抽象层设计，`03-implementation-plan.md` 的 Phase 1 文件结构需调整为：

```
apps/desktop/src/lib/
├── analytics/                    # ← 分析抽象层
│   ├── index.ts                  # 公共 API
│   ├── types.ts                  # 事件常量 + 参数类型
│   ├── provider.ts               # AnalyticsProvider 接口
│   ├── factory.ts                # 单例工厂
│   ├── context.tsx               # React Context
│   ├── hooks.ts                  # useAnalytics / usePageViewTracking
│   └── providers/
│       ├── firebase.ts           # Firebase 实现
│       └── volcengine.ts         # (future) 火山引擎实现
```

此架构下，未来的 `providers/volcengine.ts` 只需实现同一接口即可完成切换。

---

## 九、设计收益

| 维度 | 无抽象 | 有抽象 |
|------|--------|--------|
| 切换 Provider | 修改所有 50+ 业务文件 | 只改 main.tsx 一行 import + 新增 provider 文件 |
| 事件定义 | 分散在业务代码中 | 集中在 types.ts，单一真相来源 |
| 测试 | 需 mock Firebase SDK | 用 mock AnalyticsProvider 即可 |
| 类型安全 | 手写字符串 | TypeScript const 常量 + 接口约束 |
| 离线/调试 | 依赖 Firebase DebugView | 可加 ConsoleProvider 本地调试 |
