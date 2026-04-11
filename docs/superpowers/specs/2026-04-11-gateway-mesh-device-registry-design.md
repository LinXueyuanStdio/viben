# Gateway Mesh + Device Registry Design

> Phase 1 of 3: Mobile Multi-Device Support
>
> Date: 2026-04-11

## Overview

为 Viben 构建多设备协作能力的基础设施层。多个桌面端运行各自的 Gateway，通过 WebSocket 组成 mesh 网络，实现设备发现、注册和跨设备消息传递。

本设计是三阶段计划的第一阶段：

| Phase | Scope | Dependency |
|---|---|---|
| **Phase 1** (本文档) | Gateway Mesh + 设备注册 | 无 |
| Phase 2 | Tauri Mobile + QR 配对 | Phase 1 |
| Phase 3 | 跨设备 Agent 动作 | Phase 1 + 2 |

## Background

### 当前状态

- Gateway 运行在 `127.0.0.1:18790`，仅服务本地客户端
- WebSocket 基础设施已就绪：`/api/ws`（通用频道订阅），`/api/agent/ws`（Agent 交互）
- `EventService` 广播类型化的 `GatewayEvent` 对象
- 无多设备、mesh 或跨设备通信能力

### 目标

1. Gateway 之间通过 WebSocket 建立 mesh 连接
2. 局域网内通过 mDNS 自动发现，远程通过 QR/手动配对
3. 统一的设备注册表，追踪 mesh 中所有设备
4. 跨设备消息传递原语（为 Phase 3 的 Agent 动作打基础）

### 设计决策

| 决策 | 选择 | 原因 |
|---|---|---|
| 网络模型 | LAN + Cloudflare Tunnel | 局域网优先，远程兼容 |
| Mesh 拓扑 | 部分 mesh，WebSocket 直连 | 简单，复用现有 Fastify WS 基础设施 |
| 发现机制 | mDNS (LAN) + QR/手动 (远程) | 局域网零配置，远程可控 |
| 安全模型 | 无认证 (MVP) | 信任局域网，Tunnel URL 作为隐式认证 |
| 移动端角色 | 瘦客户端 | 不运行 Gateway，连接桌面端 Gateway |

## Architecture

### 拓扑

```
                    ┌─────────────┐
                    │  Gateway A  │
                    │ (Desktop 1) │
                    └──┬──────┬───┘
          WebSocket    │      │   WebSocket
       ┌───────────────┘      └──────────────┐
       │                                      │
┌──────┴──────┐                        ┌──────┴──────┐
│  Gateway B  │───── WebSocket ────────│  Gateway C  │
│ (Desktop 2) │                        │ (Desktop 3) │
└─────────────┘                        └─────────────┘
       │
       │  /api/ws (client connection)
       │
┌──────┴──────┐
│   Mobile    │
│ (thin client)│
└─────────────┘
```

**关键区分：**
- **Peer 连接**（Gateway ↔ Gateway）：新的 `/api/mesh/ws` 端点，双向对等
- **Client 连接**（Mobile → Gateway）：现有 `/api/ws` 端点，客户端订阅频道
- 一个 Gateway 同时支持多个 Peer 和多个 Client

### 新增模块

| 模块 | 路径 | 职责 |
|---|---|---|
| `mesh/` | `packages/core/src/mesh/` | Peer 连接、协议、消息转发 |
| `discovery/` | `packages/core/src/discovery/` | mDNS 广播 + QR 码生成 |
| `devices/` | `packages/core/src/devices/` | 设备注册表、在线状态追踪 |

### 新增 Gateway 路由

| 路由 | 类型 | 用途 |
|---|---|---|
| `/api/mesh/ws` | WebSocket | Peer 间 Gateway 连接 |
| `/api/mesh/peers` | REST | 查看/管理已知 Peer |
| `/api/mesh/connect` | REST | 主动连接到某个 Peer |
| `/api/devices` | REST | 列出 mesh 中所有设备 |
| `/api/devices/:id` | REST | 查看单个设备详情 |
| `/api/devices/qr` | REST | 生成配对 QR 码 |
| `/api/devices/message` | REST | 发送跨设备消息 |

## Mesh WebSocket Protocol

### 端点

`/api/mesh/ws` — 新的 WebSocket 端点，专用于 Gateway 间的对等连接。

### 握手

当 Gateway A 连接到 Gateway B 的 `/api/mesh/ws`：

```
A → B: { type: "Hello", data: { gateway_id, name, version, capabilities, address } }
B → A: { type: "Welcome", data: { gateway_id, name, version, capabilities, peers: [...] } }
```

`Welcome` 包含 B 当前的 peer 列表，让 A 发现更广泛的 mesh。

### 消息类型

| 方向 | Type | 用途 |
|---|---|---|
| 双向 | `Ping` / `Pong` | 心跳（复用现有 30s 间隔） |
| 双向 | `Hello` / `Welcome` | 初始握手 |
| 双向 | `PeerJoined` | 向现有 peer 宣告新 peer 加入 |
| 双向 | `PeerLeft` | 宣告 peer 断开 |
| 双向 | `DeviceMessage` | 跨设备命令/响应转发 |
| 双向 | `DeviceEvent` | 广播设备状态变更 |

### DeviceMessage 格式

跨设备消息传递的核心原语：

```typescript
interface DeviceMessage {
  type: "DeviceMessage"
  data: {
    id: string              // 唯一消息 ID（用于关联响应）
    from_gateway: string    // 源 Gateway ID
    to_gateway: string      // 目标 Gateway ID（"*" 表示广播）
    from_device?: string    // 源客户端设备（可选）
    to_device?: string      // 目标客户端设备（可选）
    action: string          // 如 "navigate", "execute_tool", "notify"
    payload: unknown        // action 相关的数据
    reply_to?: string       // 用于响应关联
  }
}
```

### 消息路由

当 Gateway A 收到目标为 Gateway C 的 `DeviceMessage`，但 A 未直接连接 C（仅连接 B）：
1. A 检查 B 的 peer 列表（`Welcome` 中共享的）
2. 若 B 知道 C，A 将消息转发给 B
3. B 转发给 C

MVP 场景（2-5 个 Gateway）下，1-hop 转发已足够。

### 连接生命周期

1. 发起方连接目标的 `/api/mesh/ws`
2. 交换 `Hello` / `Welcome`
3. 通过 `Ping` / `Pong` 维持心跳（30s）
4. 断开时：向剩余 peer 广播 `PeerLeft`，指数退避重连（1s, 2s, 4s... 最大 60s）

## mDNS Discovery

### 服务广告

```
Service type: _viben-gateway._tcp.local
Port: 18790（或配置端口）
TXT records:
  gateway_id=<uuid>
  name=<用户配置的名称>
  version=<gateway 版本>
```

### 实现

使用 `bonjour-service` npm 包（纯 JS，无原生依赖）。

**Gateway 启动时：**
1. 广告 `_viben-gateway._tcp` 服务
2. 浏览网络中的其他 `_viben-gateway._tcp` 服务
3. 发现新 Gateway 时，自动发起 WebSocket 连接到 `/api/mesh/ws`

**Gateway 关闭时：**
- 取消发布服务（mDNS goodbye 包）

### 模块结构

```
packages/core/src/discovery/
  index.ts          # DiscoveryService - 管理 mDNS + QR
  mdns.ts           # mDNS 广告/浏览（使用 bonjour-service）
  qr.ts             # QR 码生成（Gateway 连接信息）
  types.ts          # ServiceInfo, DiscoveryEvent 类型
```

### QR 码内容

用于手动配对 / 移动端连接：

```json
{
  "type": "viben-gateway",
  "gateway_id": "uuid",
  "name": "My Desktop",
  "lan": "http://192.168.1.100:18790",
  "tunnel": "https://abc123.trycloudflare.com"
}
```

通过 `qrcode` npm 包生成 data URL。桌面端在配对页面展示，移动端扫描提取连接 URL。

## Device Registry

### 数据模型

```typescript
interface Device {
  id: string                    // 唯一设备 ID
  type: "gateway" | "client"   // Peer Gateway 或已连接客户端
  name: string                 // 用户友好名称
  gateway_id: string           // 设备所属的 Gateway
  platform: "desktop" | "mobile" | "web" | "cli"
  status: "online" | "offline"
  address?: string             // 连接地址（LAN 或 Tunnel）
  capabilities: string[]       // Phase 1: "navigate" | "notify" | "ping"; Phase 3 扩展: "execute_tool"
  connected_at: string         // ISO 时间戳
  last_seen: string            // ISO 时间戳（心跳更新）
}
```

### 存储

- **内存中**存储在每个 Gateway 的 `AppState`（不持久化到磁盘）
- 每个 Gateway 追踪：直连客户端 + 所有 Peer Gateway + Peer 的客户端（通过 mesh 同步）
- Peer 连接时共享设备列表；客户端连接/断开时广播 `DeviceEvent` 给所有 Peer

### Service API

```typescript
class DeviceRegistryService {
  // 本地设备（直接连接的客户端）
  registerClient(ws: WebSocket, info: ClientInfo): Device
  unregisterClient(deviceId: string): void

  // Peer 设备（来自 mesh）
  registerPeer(peerId: string, info: GatewayInfo): Device
  unregisterPeer(peerId: string): void
  syncPeerDevices(peerId: string, devices: Device[]): void

  // 查询
  getAllDevices(): Device[]
  getDevice(id: string): Device | undefined
  getDevicesByGateway(gatewayId: string): Device[]
  getOnlineGateways(): Device[]
}
```

### REST 端点

| Method | Path | Response |
|---|---|---|
| GET | `/api/devices` | Mesh 中所有设备 |
| GET | `/api/devices/:id` | 单个设备详情 |
| GET | `/api/devices/qr` | 配对 QR 码 data URL |

### Gateway 事件

通过 SSE + mesh 广播：

```typescript
type DeviceEvent =
  | { type: "device_connected", device: Device }
  | { type: "device_disconnected", device_id: string }
  | { type: "device_updated", device: Device }
```

## Cross-Device Messaging

### 消息流（Mobile → Desktop 动作）

```
Mobile (thin client)                Gateway A              Gateway B (target)          Desktop B UI
       │                               │                         │                         │
       │  POST /api/devices/message    │                         │                         │
       │  {to_gateway: "gateway-b",   │                         │                         │
       │   action: "navigate",         │                         │                         │
       │   payload: {path: "/settings"}}│                        │                         │
       │──────────────────────────────→│                         │                         │
       │                               │   DeviceMessage (ws)   │                         │
       │                               │────────────────────────→│                         │
       │                               │                         │  SSE: device_action     │
       │                               │                         │────────────────────────→│
       │                               │                         │                         │ navigate("/settings")
       │                               │                         │  action_completed       │
       │                               │                         │←────────────────────────│
       │                               │   DeviceMessage reply   │                         │
       │                               │←────────────────────────│                         │
       │  SSE: action_result           │                         │                         │
       │←──────────────────────────────│                         │                         │
```

### REST API

```
POST /api/devices/message
{
  "to_gateway": "gateway-b-id",   // 目标 Gateway（"*" 广播）
  "to_device": "device-id",       // 可选：目标 Gateway 上的特定客户端
  "action": "navigate",            // 动作类型
  "payload": { "path": "/settings" }  // 动作数据
}

Response: { "message_id": "uuid", "status": "sent" }
```

### Phase 1 动作类型

基础原语，Phase 3 会扩展更多：

| Action | Payload | 描述 |
|---|---|---|
| `ping` | `{}` | 检查设备是否可达 |
| `navigate` | `{ path: string }` | 在目标桌面端打开路由 |
| `notify` | `{ title, body }` | 在目标设备显示通知 |

### 响应关联

每条消息有唯一 `id`。响应方发送 `reply_to: id` 的回复。Gateway 追踪待响应消息并路由回复给发起方。超时：30s。

### 桌面端处理

桌面端前端订阅新的 `"device_actions"` WebSocket 频道。收到动作后执行（如通过 `useNavigate()` 跳转页面），并发送完成响应回 Gateway。

## Error Handling

| 场景 | 行为 |
|---|---|
| Peer 断开 | 广播 `PeerLeft`，指数退避重连（1s, 2s, 4s... 最大 60s） |
| 消息发送给离线 Peer | 立即返回 `{ status: "error", error: "peer_offline" }` |
| 消息超时（30s） | 返回 `{ status: "error", error: "timeout" }` |
| mDNS 失败 | 记录警告，继续运行（手动配对仍可用） |
| 重复 Peer 连接 | 拒绝并返回 `{ type: "Error", error: "already_connected" }` |
| Gateway 重启 | 启动时尝试重连所有已知 Peer |

### Peer 持久化

已知 Peer 地址持久化到 `~/.viben/mesh/peers.yaml`，Gateway 重启后可尝试重连：

```yaml
peers:
  - gateway_id: "uuid-1"
    name: "Desktop B"
    lan: "192.168.1.101:18790"
    tunnel: "https://abc.trycloudflare.com"
    last_seen: "2026-04-11T10:00:00Z"
```

## Testing Strategy

| 层 | 方法 |
|---|---|
| Mesh 协议 | 单元测试：mock WebSocket，验证握手、消息路由、心跳 |
| mDNS 发现 | 集成测试：两个 Gateway 实例在 localhost 不同端口 |
| 设备注册表 | 单元测试：注册/注销、同步、查询 |
| 跨设备消息 | 集成测试：两个 Gateway，发送消息，验证送达 + 响应 |
| E2E | 手动测试：同一局域网两台桌面端，验证自动发现 + 跨设备导航 |

## New Dependencies

| Package | Purpose | Size |
|---|---|---|
| `bonjour-service` | mDNS advertise/browse | ~50KB |
| `qrcode` | QR code generation | ~100KB |

两者均为纯 JS，无原生依赖。

## Phase 2 & 3 Preview

### Phase 2: Tauri Mobile + QR 配对

- 为 `apps/desktop` 添加 Tauri mobile 构建目标
- 移动端特定路由（设备列表、QR 扫描、Agent 聊天）
- 桌面端 QR 码展示页面
- 移动端扫描后自动连接到 Gateway

### Phase 3: 跨设备 Agent 动作

- Agent tool：`send_to_device`（跨设备消息发送工具）
- 桌面端动作处理器（接收跨设备命令，执行 MCP 工具，返回结果）
- 多目标消歧（多个桌面端时请求用户选择）
- 完成反馈闭环
