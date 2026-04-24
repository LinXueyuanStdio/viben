# Mobile App Shell + QR 配对设计

> Phase 2 of 3: Mobile Multi-Device Support
>
> Date: 2026-04-14
> Depends on: Phase 1 (Gateway Mesh + Device Registry) — 已完成

## Overview

在 Phase 1 的 Gateway Mesh 基础设施之上，为移动端构建最小可用的 app shell。移动端作为瘦客户端，通过扫描桌面端 QR 码连接到 Gateway，获取设备列表，并提供简单的聊天界面。同时在桌面端新增设备配对页面。

**关键约束：**
- 移动端不运行自己的 Gateway
- 复用 apps/desktop 同一 Tauri 项目，运行时路由分流
- QR 扫码使用 tauri-plugin-barcode-scanner（原生 API）
- 不含跨设备 Agent 动作（Phase 3 范围）

## Background

### Phase 1 已完成

| 已有能力 | 位置 |
|---|---|
| Gateway mesh WebSocket 网络 | `packages/core/src/mesh/` |
| DeviceRegistryService | `packages/core/src/devices/` |
| mDNS 自动发现 + QR 码生成 | `packages/core/src/discovery/` |
| Mesh/Device REST 路由 | `packages/core/src/gateway/routes/mesh.ts`, `devices.ts` |
| Device Zustand store | `apps/desktop/src/stores/device-store.ts` |
| Device WebSocket hook | `apps/desktop/src/hooks/use-device-websocket.ts` |
| Gateway client device 方法 | `apps/desktop/src/lib/gateway/modules/devices.ts` |

### 当前桌面端架构

- Tauri v2（`tauri = "2"`），仅有 desktop target，`gen/` 目录未初始化
- BrowserRouter (react-router-dom v7)，~40 个路由
- AppLayout（sidebar + main）包裹所有桌面路由
- Zustand stores + TanStack Query 状态管理
- Rust 端：tray/gateway/screenshot 命令全部 desktop-only，需条件编译保护

### 阻塞项

| 问题 | 严重度 | 解决方案 |
|---|---|---|
| `gen/` 未初始化 | Blocker | 运行 `tauri android init` |
| Tray setup 在 `setup()` 中无条件执行 | Blocker | `#[cfg(desktop)]` 保护 |
| Gateway/Screenshot Rust 命令不支持 mobile | Blocker | `#[cfg(desktop)]` 条件编译 |
| `tauri-plugin-shell` mobile 不可用 | High | `#[cfg(desktop)]` 保护 |
| `externalBin` (sidecar) mobile 不支持 | Blocker | 仅 desktop 使用 |
| Capability 文件无平台限制 | Medium | 拆分 desktop.json / mobile.json |

## Architecture

### 运行时路由分流

```
App.tsx
  │
  ├─ isMobile()? ──→ <MobileLayout>           (底部 tab 导航)
  │                     ├─ /m/connect          (QR 扫码 + 手动输入)
  │                     ├─ /m/devices          (设备列表)
  │                     └─ /m/chat             (简单聊天)
  │
  └─ isDesktop()? ─→ <AppLayout>              (现有 sidebar 布局，不变)
                       ├─ ... (所有现有路由)
                       └─ /devices/pair        (新增：QR 展示 + 设备列表)
```

平台检测使用 `@tauri-apps/plugin-os` 的 `type()` 函数，返回 `"android"` | `"ios"` | `"linux"` | `"macos"` | `"windows"` 等。

### 共享代码

两端完全共享以下代码，零重复：
- `stores/device-store.ts` — Zustand device store
- `stores/connection-store.ts` — 新增，保存 Gateway 连接信息（persist）
- `hooks/use-device-websocket.ts` — WebSocket 设备事件订阅
- `lib/gateway/modules/devices.ts` — REST API 调用
- `lib/gateway/client.ts` — GatewayClient
- `lib/platform.ts` — 新增，平台检测工具

### 模块结构

```
apps/desktop/src/
  lib/
    platform.ts                    (新增) 平台检测工具
  stores/
    connection-store.ts            (新增) Gateway 连接信息持久化
  pages/
    mobile/
      connect-page.tsx             (新增) QR 扫描 + 手动输入
      device-list-page.tsx         (新增) 设备列表
      chat-page.tsx                (新增) 简单聊天
    devices/
      pair-page.tsx                (新增) 桌面端配对页面
  components/
    mobile/
      mobile-layout.tsx            (新增) 底部 tab 布局
      mobile-header.tsx            (新增) 顶部状态栏
      qr-scanner.tsx               (新增) QR 扫描器封装
      gateway-connector.tsx        (新增) 连接状态管理
      manual-connect-dialog.tsx    (新增) 手动输入弹窗

apps/desktop/src-tauri/
  Cargo.toml                       (修改) 添加 barcode-scanner 插件
  capabilities/
    default.json                   (修改) 仅保留共用权限
    desktop.json                   (新增) desktop 专用权限
    mobile.json                    (新增) mobile 专用权限（barcode-scanner）
  src/
    lib.rs                         (修改) #[cfg(desktop)] 保护 desktop-only 代码

packages/core/src/
  gateway/routes/ws.ts             (修改) 新增 Register/Registered 消息类型
```

## Tauri Mobile 基础设施

### Rust 条件编译

`src-tauri/src/lib.rs` 需要：

1. 所有 tray 相关代码用 `#[cfg(desktop)]` 包裹
2. Gateway 进程管理命令用 `#[cfg(desktop)]` 包裹
3. Screenshot 命令用 `#[cfg(desktop)]` 包裹
4. `tauri-plugin-shell` 仅 desktop 注册
5. `tauri-plugin-barcode-scanner` 添加（mobile 端扫码用）
6. `setup()` 中的 tray 初始化和 gateway 自启动用 `#[cfg(desktop)]` 保护

```rust
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init());
    }

    #[cfg(mobile)]
    {
        builder = builder
            .plugin(tauri_plugin_barcode_scanner::init());
    }

    // Desktop-only invoke handlers
    #[cfg(desktop)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        tray_commands...,
        gateway_commands...,
        screenshot_commands...,
    ]);

    builder
        .setup(|app| {
            #[cfg(desktop)]
            {
                setup_tray(app)?;
                auto_start_gateway(app)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Capability 拆分

**default.json**（两端共用）：
```json
{
  "identifier": "default",
  "description": "Common capabilities",
  "permissions": [
    "core:default",
    "os:default",
    "notification:default",
    "deep-link:default"
  ]
}
```

**desktop.json**：
```json
{
  "identifier": "desktop",
  "description": "Desktop-only capabilities",
  "platforms": ["linux", "macOS", "windows"],
  "windows": ["main", "tray-popup"],
  "permissions": [
    "shell:default",
    "dialog:default",
    "fs:default",
    "opener:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus"
  ]
}
```

**mobile.json**：
```json
{
  "identifier": "mobile",
  "description": "Mobile-only capabilities",
  "platforms": ["android", "iOS"],
  "permissions": [
    "barcode-scanner:allow-scan",
    "barcode-scanner:allow-cancel"
  ]
}
```

### Cargo.toml 修改

新增依赖：
```toml
[dependencies]
tauri-plugin-barcode-scanner = "2"

[target.'cfg(desktop)'.dependencies]
tauri-plugin-shell = "2"
```

## 前端页面

### 平台检测

```typescript
// src/lib/platform.ts
import { type as osType } from "@tauri-apps/plugin-os";

let _platformType: string | null = null;

export function getPlatformType(): string {
  if (!_platformType) {
    _platformType = osType();
  }
  return _platformType;
}

export function isMobile(): boolean {
  const t = getPlatformType();
  return t === "android" || t === "ios";
}

export function isDesktop(): boolean {
  return !isMobile();
}
```

### MobileLayout

底部 3 个 tab：设备、连接、聊天。顶部 header 显示 Gateway 连接状态（连接中/已连接/断开）。

```
┌─────────────────────────────┐
│  Viben          ● 已连接     │  ← MobileHeader
├─────────────────────────────┤
│                             │
│       <Page Content>        │  ← Outlet
│                             │
├─────────────────────────────┤
│  📱 设备  │  🔗 连接  │  💬 聊天 │  ← Tab Bar
└─────────────────────────────┘
```

### ConnectPage（/m/connect）

两种连接方式：

1. **QR 扫码**（主要）：
   - 调用 `tauri-plugin-barcode-scanner` 的 `scan()` API
   - 解析 QR JSON payload，验证 `type === "viben-gateway"`
   - 尝试连接：优先 LAN 地址，失败则尝试 Tunnel 地址
   - 连接成功后保存到 connection-store，跳转到设备页

2. **手动输入**（备选）：
   - 弹窗输入 Gateway URL（如 `http://192.168.1.100:18790`）
   - GET /health 验证可达性
   - 连接后同上

### DeviceListPage（/m/devices）

- 使用 `useDeviceStore` + `useDeviceWebSocket` 获取实时设备列表
- 卡片式展示每个设备：名称、类型（gateway/client）、平台、在线状态
- Gateway 类型设备显示地址
- 下拉刷新重新 fetch

### MobileChatPage（/m/chat）

- 连接到当前活跃 Gateway 的 Agent 聊天（复用现有 `/api/sessions` 或 `/api/agent/chat` API）
- 简单的消息输入 + 消息列表
- MVP 不需要完整的 workspace chat 功能，只需要基本的 Agent 对话

### DevicePairPage（桌面端 /devices/pair）

- 左侧：QR 码展示（调用 `getDeviceQr()` API）
- 右侧：已连接设备列表（复用 `useDeviceStore`）
- 在 Sidebar 中添加"设备"入口（位于底部，Settings 附近）

## WebSocket Register 协议

### 协议扩展

在 `packages/core/src/gateway/routes/ws.ts` 的消息类型中新增：

```typescript
// ClientMessage 新增
| { type: "Register"; data: RegisterData }

interface RegisterData {
  name: string;              // 设备名称（如"iPhone of Alice"）
  platform: string;          // "mobile" | "desktop" | "web" | "cli"
  device_id?: string;        // 重连时携带，首次为空
  capabilities?: string[];   // 能力列表
}

// ServerMessage 新增
| { type: "Registered"; data: RegisteredData }

interface RegisteredData {
  device_id: string;         // 服务端生成或确认的 device_id
  gateway_id: string;        // 当前 Gateway ID
}
```

### 注册流程

1. 客户端连接 `/api/ws`（WebSocket）
2. 客户端发送 `{ type: "Register", data: { name, platform, ... } }`
3. 服务端调用 `DeviceRegistryService.registerClient(ws, info)`
4. 服务端回复 `{ type: "Registered", data: { device_id, gateway_id } }`
5. 服务端广播 `device_connected` 事件给所有 WS 客户端和 mesh peers
6. WS 关闭时，服务端调用 `DeviceRegistryService.unregisterClient(device_id)`
7. 服务端广播 `device_disconnected` 事件

### device_id 生成逻辑

- 首次连接（无 `device_id`）：服务端生成 UUID，返回给客户端
- 重连（带 `device_id`）：服务端验证该 ID 是否在注册表中
  - 若存在（离线状态）：重新激活，更新 last_seen
  - 若不存在：视为首次注册，用客户端提供的 ID

## 连接信息持久化

```typescript
// src/stores/connection-store.ts
interface GatewayConnection {
  gateway_id: string;
  name: string;
  lan_url?: string;
  tunnel_url?: string;
  device_id?: string;        // 注册后获得，重连时使用
  last_connected: string;    // ISO 时间戳
}

interface ConnectionState {
  // Data
  connections: GatewayConnection[];
  active_gateway_id: string | null;

  // Actions
  addConnection(conn: GatewayConnection): void;
  removeConnection(gatewayId: string): void;
  setActive(gatewayId: string): void;
  getActive(): GatewayConnection | undefined;
  updateDeviceId(gatewayId: string, deviceId: string): void;
}
```

使用 Zustand `persist` middleware 保存到 `localStorage`。移动端可保存多个 Gateway 连接（家/公司），同一时间只连接一个。

## 连接流程（完整）

```
Mobile                                 Desktop Gateway
  │                                           │
  │  1. 用户打开 ConnectPage                    │
  │     点击"扫描 QR 码"                        │
  │     → barcode-scanner.scan()               │
  │                                           │
  │  2. 解析 QR payload                        │
  │     { type: "viben-gateway",              │
  │       gateway_id, name, lan, tunnel }      │
  │                                           │
  │  3. GET {lan}/health                      │
  │─────────────────────────────────────────→ │
  │  ← 200 { status: "ok" }                  │
  │     (如果失败，尝试 {tunnel}/health)        │
  │                                           │
  │  4. 保存到 connection-store                 │
  │     设为 active gateway                    │
  │                                           │
  │  5. WebSocket {base}/api/ws               │
  │══════════════════════════════════════════→ │
  │                                           │
  │  6. { type: "Register",                   │
  │       data: { name: "iPhone",             │
  │               platform: "mobile" }}        │
  │─────────────────────────────────────────→ │
  │                                           │  → registerClient()
  │  ← { type: "Registered",                 │  → broadcast device_connected
  │       data: { device_id, gateway_id }}    │
  │                                           │
  │  7. 保存 device_id 到 connection-store     │
  │                                           │
  │  8. { type: "Subscribe",                  │
  │       data: { channels: ["devices"] }}    │
  │─────────────────────────────────────────→ │
  │                                           │
  │  9. 跳转到 /m/devices                      │
  │     实时显示设备列表                         │
```

## Error Handling

| 场景 | 行为 |
|---|---|
| QR 内容非 viben-gateway | Toast 提示"无效的 QR 码，请扫描 Viben 桌面端的二维码" |
| QR 扫描取消 | 回到连接页面，无操作 |
| Gateway 不可达（LAN + Tunnel 都失败）| Toast 提示"无法连接到桌面端，请确认在同一网络" |
| WebSocket 断连 | 自动重连（指数退避 1s→60s），UI 顶部显示"重连中..." |
| Register 消息超时（5s） | 关闭 WS，提示连接失败 |
| 桌面端重启 | 移动端自动重连，重新 Register（带 device_id） |
| 相机权限被拒 | 提示需要相机权限，提供"手动输入"替代方案 |

## Testing Strategy

| 层 | 方法 |
|---|---|
| WS Register 协议 | 单元测试：mock WS，发送 Register 消息，验证 Registered 回复 + DeviceRegistry 调用 |
| WS disconnect 清理 | 单元测试：验证 WS 关闭时 unregisterClient 被调用 |
| 平台检测 | 单元测试：mock `osType()` 返回不同值，验证 `isMobile()` / `isDesktop()` |
| connection-store | 单元测试：验证 add/remove/setActive/persist 行为 |
| 连接流程 | 集成测试：启动真实 Gateway，WS 客户端发送 Register，验证设备出现在 /api/devices |
| QR 解析 | 单元测试：验证有效/无效 QR payload 的解析 |
| Mobile 页面 | 手动测试（Android/iOS 模拟器） |
| Desktop 配对页面 | 手动测试 |

## New Dependencies

| Package | Side | Purpose |
|---|---|---|
| `tauri-plugin-barcode-scanner` | Rust + JS | 原生 QR 扫描（iOS/Android） |
| `@tauri-apps/plugin-barcode-scanner` | JS | Tauri barcode scanner JS 绑定 |

## Phase 2 不包含

- 跨设备 Agent 动作（Phase 3）
- mDNS 移动端自动发现
- 移动端运行 Gateway
- 推送通知
- 离线模式
- 完整 workspace 功能
- iOS/Android 原生构建（仅做到代码可编译 + 模拟器可运行的程度）
