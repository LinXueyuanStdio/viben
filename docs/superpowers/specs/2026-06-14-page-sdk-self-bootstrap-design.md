# Page SDK 重设计 — 零配置自举 + 极简 API

## Context

当前 standalone 页面接入 Viben Page SDK 需要 ~120 行样板代码，概念负担重：
- 密钥对生成/持久化（导入 `@noble/ed25519`、异步调用、hex 编码、sessionStorage）
- 配置对象手动组装（`__VIBEN_CONFIG__` 7 个字段）
- 脚本加载 + 轮询等待（动态 `<script>` + 200ms × 50 poll）
- 连接生命周期管理（ready promise + state change + 注册/卸载）
- Action 返回值必须是 `{content: [{type: "text", text: "..."}]}` MCP 格式

**目标**：
1. SDK **自举**（self-bootstrap）— 加载即连接，零配置
2. Action 注册 **去仪式感** — 返回值自动标准化，无需手写 MCP 格式
3. 页面端代码 **从 120 行降到 ~10 行**

---

## 设计

### 理念：SDK 应该像浏览器平台 API

```
┌─────────────────────────────────────────┐
│  Page code (你写的)                      │
│  VibenPage.actions.register(...)         │
├─────────────────────────────────────────┤
│  SDK (平台层，不需要你操心)               │
│  • 身份管理 (生成/持久化/轮换)            │
│  • 连接管理 (重连/签名/心跳)             │
│  • 返回值标准化                          │
│  • 事件广播                              │
└─────────────────────────────────────────┘
```

### 最终页面端 API

#### 设计哲学

**API 保持 `register` / `unregister` 语义**（已有概念，不引入新词汇），但大幅降低使用门槛：

**Action 定义支持两种形式**：
- **简写**：直接传函数 → action name 就是描述（适合快速原型）
- **完整**：`{ description, inputSchema, execute }` 对象 → 提供人类可读描述和 schema（适合正式项目）

#### HTML — 一个 `<script>` + register

```html
<script src="http://localhost:18790/api/page/_sdk/v1/viben-page-sdk.js"
        data-page="trading"></script>
<script>
  VibenPage.ready.then(() => {
    // 简写形式 — 裸函数，action name 作为描述
    const unregister = VibenPage.actions.register("trading", {
      getPrice: async () => ({ price: 50000, ts: Date.now() }),
      pauseTrading: async () => { paused = true; return { paused: true }; },
    });

    // 完整形式 — 带描述和 inputSchema
    VibenPage.actions.register("trading", {
      placeOrder: {
        description: "提交交易订单",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            side: { type: "string", enum: ["buy", "sell"] },
            amount: { type: "number" }
          },
          required: ["symbol", "side", "amount"]
        },
        execute: async ({ symbol, side, amount }) => placeOrder(symbol, side, amount)
      }
    });

    // 卸载
    unregister();
    // 或按 namespace 卸载
    VibenPage.actions.unregister("trading");
  });
</script>
```

#### React — 一个 hook

```tsx
// 最简 — hook 内部自动 register/unregister
const { connected } = useVibenPage("trading", {
  getState: async () => state,
  pauseTrading: async () => { pause(); return { paused: true }; },
});

// 带描述 — 正式项目
const { connected } = useVibenPage("trading", {
  getState: {
    description: "获取当前交易会话完整状态",
    execute: async () => state
  },
  placeOrder: {
    description: "提交交易订单",
    inputSchema: {
      type: "object",
      properties: { symbol: { type: "string" }, side: { type: "string" }, amount: { type: "number" } },
      required: ["symbol", "side", "amount"]
    },
    execute: async ({ symbol, side, amount }) => executeTrade(symbol, side, amount)
  }
});
// 组件卸载时自动调用 unregister
```

#### 对比：Before vs After

```
BEFORE (120 行):                          AFTER (5 行):
─────────────────────                     ──────────────
import * as ed from "@noble/ed25519"      <script src="…/viben-page-sdk.js"
                                                  data-page="trading"></script>
const priv = ed.utils.randomSecretKey()
const pub = await ed.getPublicKeyAsync()  VibenPage.ready.then(() => {
const hex = bytesToHex(pub)                 VibenPage.actions.register("trading", {
sessionStorage.setItem(...)                   getState: async () => state,
window.__VIBEN_CONFIG__ = {                 });
  gatewayUrl, clientId, publicKey,        });
  privateKey, pageUid, source
}
const script = document.createElement...
script.src = ...
document.head.appendChild(script)
// poll 50 × 200ms...
// onStateChange...
// ready.then(() => register...)
// cleanup on unmount...
```

**核心简化**：
- `actions.register()` 支持裸函数简写 — 最低仪式感
- `execute` 返回任意值 — SDK 自动标准化为 ActionResult
- `data-page` 代替 `data-page-uid` — 更短
- SDK 自举 — 不需要 `@noble/ed25519`、不需要手动密钥/配置管理
- `register()` 返回 `unregister` 函数 — 清理无负担

---

## 文件变更

### 1. 修改 SDK：`packages/core/src/assets/viben-page-sdk.ts`

#### 1a. 自举逻辑（核心变更）

`init()` 改为 async，增加 standalone 自举分支：

```typescript
private async init(): Promise<void> {
  const config = (window as any).__VIBEN_CONFIG__;
  if (config) {
    this.applyConfig(config);
    return;
  }

  if (window.parent !== window) {
    this.waitForPostMessage();
    return;
  }

  // Standalone: self-bootstrap
  await this.selfBootstrap();
}

private async selfBootstrap(): Promise<void> {
  const sdkScriptElement = document.querySelector(
    'script[src*="viben-page-sdk"]'
  ) as HTMLScriptElement | null;

  const gatewayUrl = sdkScriptElement
    ? new URL(sdkScriptElement.src).origin
    : window.location.origin;
  const pageUid = sdkScriptElement?.dataset.page
    ?? sdkScriptElement?.dataset.pageUid
    ?? document.title.toLowerCase().replace(/\s+/g, "-");

  const identity = await this.resolveIdentity(pageUid);

  this.applyConfig({
    gatewayUrl,
    clientId: identity.clientId,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
    pageUid,
    source: "standalone",
  });
}
```

#### 1b. 返回值自动标准化

在 `handleExecute` 中包装 execute 返回值：

```typescript
private normalizeResult(raw: unknown): ActionResult {
  // Already ActionResult shape
  if (raw && typeof raw === "object" && "content" in raw && Array.isArray((raw as any).content)) {
    return raw as ActionResult;
  }
  // String → text content
  if (typeof raw === "string") {
    return { content: [{ type: "text", text: raw }] };
  }
  // Object/primitive → JSON text + structuredContent
  const text = JSON.stringify(raw, null, 2);
  return {
    content: [{ type: "text", text }],
    structuredContent: typeof raw === "object" ? (raw as Record<string, unknown>) : { value: raw },
  };
}
```

在 `handleExecute` 中调用：
```typescript
const rawResult = await action.execute(data.payload, context);
const result = this.normalizeResult(rawResult);
this.socket?.emit("action:result", { requestId: data.requestId, result });
```

#### 1c. 连接成功后广播 CustomEvent

```typescript
// 在 client:connect ack success 时:
window.dispatchEvent(new CustomEvent("viben:connected", { detail: this }));
```

#### 1d. 增强 `actions.register()` — 支持裸函数简写

```typescript
// Action 定义类型：裸函数 或 完整对象
type ActionDefinition =
  | ((...args: any[]) => Promise<any>)
  | { description: string; inputSchema?: Record<string, unknown>; execute: (...args: any[]) => Promise<any> };

// 在 actions.register 内部标准化：裸函数 → { description: actionName, execute: fn }
register: (namespace: string, actions: Record<string, ActionDefinition>): (() => void) => {
  const actionsToRegister: Record<string, Omit<ActionDef, "execute">> = {};

  for (const [actionName, definition] of Object.entries(actions)) {
    const fullName = `${namespace}.${actionName}`;
    const normalizedAction = typeof definition === "function"
      ? { description: actionName, execute: definition }
      : { description: definition.description, inputSchema: definition.inputSchema, execute: definition.execute };

    this.registeredActions.set(fullName, {
      namespace,
      name: actionName,
      description: normalizedAction.description,
      inputSchema: normalizedAction.inputSchema,
      execute: normalizedAction.execute,
    });
    actionsToRegister[actionName] = {
      description: normalizedAction.description,
      inputSchema: normalizedAction.inputSchema,
    };
  }

  if (this._state === "connected") {
    this.socket?.emit("action:register", { namespace, actions: actionsToRegister });
  }

  return () => this.actions.unregister(namespace);
}
```

`data-page` 作为 `data-page-uid` 的简写（两者都支持）：
```typescript
const pageUid = sdkScriptElement?.dataset.page
  ?? sdkScriptElement?.dataset.pageUid
  ?? document.title.toLowerCase().replace(/\s+/g, "-");
```

#### 1e. 身份管理策略 — 灵活的优先级

身份来源优先级（从高到低）：
1. `window.__VIBEN_CONFIG__` 显式提供 → 完全用户控制
2. `<script>` 标签的 `data-client-id` / `data-public-key` / `data-private-key` 属性 → 部分控制
3. localStorage 缓存 (`viben_identity_{pageUid}`) → 回访用户
4. 自动生成新密钥对 → 首次访问

```typescript
private async resolveIdentity(pageUid: string): Promise<{clientId: string; publicKey: string; privateKey: string}> {
  const sdkScriptElement = document.querySelector(
    'script[src*="viben-page-sdk"]'
  ) as HTMLScriptElement | null;

  // 优先使用 data-* 属性（用户显式提供）
  if (sdkScriptElement?.dataset.clientId && sdkScriptElement?.dataset.publicKey && sdkScriptElement?.dataset.privateKey) {
    return {
      clientId: sdkScriptElement.dataset.clientId,
      publicKey: sdkScriptElement.dataset.publicKey,
      privateKey: sdkScriptElement.dataset.privateKey,
    };
  }

  // 其次 localStorage 缓存
  const storageKey = `viben_identity_${pageUid}`;
  const storedIdentity = localStorage.getItem(storageKey);
  if (storedIdentity) {
    try { return JSON.parse(storedIdentity); } catch {}
  }

  // 最后自动生成
  const identity = await VibenPageSDK.generateIdentity(pageUid);
  localStorage.setItem(storageKey, JSON.stringify(identity));
  return identity;
}
```

#### 1f. 导出静态工具函数 `generateIdentity()`

允许用户在外部预生成身份（例如服务端生成后注入）：

```typescript
// Public static utility — 可在 SDK 连接前独立使用
static async generateIdentity(pageUid?: string): Promise<{clientId: string; publicKey: string; privateKey: string}> {
  const privateKeyBytes = ed.utils.randomSecretKey();
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
  return {
    clientId: `${pageUid ?? "page"}-${Date.now().toString(36)}`,
    publicKey: bytesToHex(publicKeyBytes),
    privateKey: bytesToHex(privateKeyBytes),
  };
}
```

使用示例：
```javascript
// 用户可以手动生成并存储
const identity = await VibenPage.generateIdentity("my-page");
console.log(identity.publicKey); // 注册到服务端白名单

// 或在 script 标签中直接注入
// <script src="…" data-page="trading"
//         data-client-id="my-id"
//         data-public-key="abc..."
//         data-private-key="def..."></script>
```

#### 1e. Constructor 适配 async init

```typescript
constructor() {
  this.ready = new Promise((resolve, reject) => {
    this.readyResolve = resolve;
    this.readyReject = reject;
  });
  this.init().catch(err => {
    this.readyReject?.(err);
  });
}
```

### 2. 重写 Hook：`pages/0612-trading/app/hooks/use-viben-page.ts`（新文件名）

从 270 行 → ~55 行。直接使用 SDK 的 `expose()` API。

```typescript
"use client";
import { useEffect, useRef, useState } from "react";

// Action 定义与 SDK expose() 接受的格式一致
type ActionDefinition =
  | ((...args: any[]) => Promise<any>)
  | { description: string; inputSchema?: Record<string, unknown>; execute: (...args: any[]) => Promise<any> };

interface UseVibenPageOptions {
  gatewayUrl?: string;
  enabled?: boolean;
}

export function useVibenPage(
  pageUid: string,
  actions?: Record<string, ActionDefinition>,
  options?: UseVibenPageOptions
) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    ensureVibenSDKLoaded(options?.gatewayUrl, pageUid);

    let unsubscribeState: (() => void) | undefined;
    let unregisterActions: (() => void) | undefined;

    function bindToSDK(vibenPage: any) {
      setConnected(true);
      setClientId(vibenPage.clientId);
      unsubscribeState = vibenPage.onStateChange(
        (connectionState: string) => setConnected(connectionState === "connected")
      );
      if (actionsRef.current) {
        unregisterActions = vibenPage.actions.register(pageUid, actionsRef.current);
      }
    }

    const vibenPage = (window as any).VibenPage;
    if (vibenPage?.state === "connected") {
      bindToSDK(vibenPage);
    } else {
      const handleConnected = (event: Event) => bindToSDK((event as CustomEvent).detail);
      window.addEventListener("viben:connected", handleConnected, { once: true });
      return () => window.removeEventListener("viben:connected", handleConnected);
    }

    return () => { unsubscribeState?.(); unregisterActions?.(); };
  }, [pageUid, enabled]);

  return { connected, clientId };
}

function ensureVibenSDKLoaded(gatewayUrl?: string, pageUid?: string) {
  if ((window as any).VibenPage || document.querySelector("[data-viben-sdk]")) return;
  const resolvedGatewayUrl = gatewayUrl || process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18790";
  const scriptElement = document.createElement("script");
  scriptElement.src = `${resolvedGatewayUrl}/api/page/_sdk/v1/viben-page-sdk.js`;
  scriptElement.dataset.vibenSdk = "true";
  if (pageUid) scriptElement.dataset.page = pageUid;
  document.head.appendChild(scriptElement);
}
```

旧 `use-viben-actions.ts` **删除**（完全重构，不保留）。

#### Trading page 使用示例：`app/components/viben-action-provider.tsx`

直接调用 hook，hook 内部执行 `VibenPage.actions.register(pageUid, actions)`：

```tsx
"use client";
import { useVibenPage } from "@/app/hooks/use-viben-page";
import { useSessionState } from "@/app/context/session-state-context";

export function VibenActionProvider({ sessionId }: { sessionId: string }) {
  const { state } = useSessionState();

  useVibenPage("trading", {
    getSessionState: {
      description: "获取当前交易会话的完整状态（持仓、净值、配置等）",
      execute: async () => ({
        sessionId,
        status: state.status,
        positions: state.positions,
        metrics: state.metrics,
        currentCycle: state.current_cycle,
      })
    },
    getPositions: {
      description: "获取当前持仓列表",
      execute: async () => state.positions
    },
    getMetrics: {
      description: "获取交易绩效指标",
      execute: async () => state.metrics
    },
  });
  // 组件卸载时 hook 自动调用 VibenPage.actions.unregister("trading")

  return null;
}
```

### 3. 移除 `pages/0612-trading/package.json` 中 `@noble/ed25519`

### 4. 更新 `pages/SKILL.md` SDK 文档

精简为新 API，删除密钥对管理章节。

---

## 模式兼容

- **iframe 模式**（desktop 内嵌）：`__VIBEN_CONFIG__` 由父窗口注入，走 postMessage 路径，不受影响
- **显式 `__VIBEN_CONFIG__`**：仍然优先使用，不走 self-bootstrap
- **localStorage identity**：per-pageUid 隔离（`viben_identity_{pageUid}`），不同 page 独立身份

---

## 验证

1. `cd packages/core && pnpm build:page-sdk` — SDK 构建成功
2. 启动 gateway → 浏览器打开 trading page
3. 验证 localStorage 有 `viben_identity_trading`
4. Console: `VibenPage.state === "connected"`
5. Action 返回普通对象 → gateway 收到标准 ActionResult 格式
6. 刷新页面 → 同一 clientId 复用（不重新生成）
7. E2E page 仍正常工作（iframe 模式不受影响）
