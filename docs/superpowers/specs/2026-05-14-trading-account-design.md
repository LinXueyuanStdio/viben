# 交易账户模块设计

## 概述

在 `packages/core` 新增 `account` 模块，提供交易所 API 账户的管理能力（CRUD + 连通性测试）。通过 CLI 命令和 Gateway Route 暴露，Desktop 设置页通过 Dialog 提供可视化管理界面。

## MVP 范围

- **支持的交易所**：OKX、Binance、Bitget、Bybit、Gate、KuCoin、Lighter（API Key 类）
- **不在范围**：Web3 钱包连接类（Hyperliquid、Aster）后续再加

---

## 1. 数据模型

### 类型定义

```typescript
// src/account/ops/types.ts

type ExchangeId = "okx" | "binance" | "bitget" | "bybit" | "gate" | "kucoin" | "lighter";

type CredentialField = "api_key" | "secret" | "passphrase";

interface Account {
  id: string;                      // nanoid(12), 短 ID 方便 CLI 使用
  exchange: ExchangeId;
  name: string;                    // 用户自定义名 "OKX #1"
  created_at: string;              // ISO timestamp
  updated_at: string;              // 凭证更新时刷新
}

interface TestResult {
  success: boolean;
  error?: string;
  latency_ms?: number;
}

// CRUD 结果类型
interface CreateAccountResult { success: boolean; account?: Account; error?: string; }
interface UpdateAccountResult { success: boolean; account?: Account; error?: string; }
interface ListAccountsResult { success: boolean; accounts: Account[]; error?: string; }
interface ViewAccountResult { success: boolean; account?: Account; masked_credentials?: Partial<Record<CredentialField, string>>; error?: string; }
interface RemoveAccountResult { success: boolean; error?: string; }
```

### 存储格式

**文件**：`~/.viben/accounts.yaml`（文件权限 `0600`）

凭证直接明文存储在 YAML 中，与项目现有 provider API key 存储方式一致。

```yaml
accounts:
  - id: "abc123"
    exchange: "okx"
    name: "OKX #1"
    api_key: "xxxxxxxx-xxxx-xxxx-xxxx"
    secret: "XXXXXXXXXXXXXXXX"
    passphrase: "myPassphrase"
    created_at: "2026-05-14T10:00:00Z"
    updated_at: "2026-05-14T10:00:00Z"
  - id: "def456"
    exchange: "binance"
    name: "Binance #1"
    api_key: "xxxxxxxxxxxxxxxx"
    secret: "XXXXXXXXXXXXXXXX"
    created_at: "2026-05-14T11:00:00Z"
    updated_at: "2026-05-14T11:00:00Z"
```

---

## 2. 模块结构

```
packages/core/src/account/
├── index.ts                    ← export * from "./ops"
└── ops/
    ├── index.ts                ← barrel export
    ├── types.ts                ← 所有类型定义
    ├── store.ts                ← YAML 读写（明文凭证 + atomic write）
    ├── crud.ts                 ← list, add, view, remove
    ├── test.ts                 ← testAccount 入口（调 exchange adapter）
    └── exchanges/              ← 适配器模式，每个文件自包含 meta + 签名逻辑
        ├── index.ts            ← getExchange(id) 工厂 + listExchanges()
        ├── types.ts            ← Exchange 接口（含 meta + adapter 方法）
        ├── okx.ts
        ├── binance.ts
        ├── bitget.ts
        ├── bybit.ts
        ├── gate.ts
        ├── kucoin.ts
        └── lighter.ts
```

---

## 3. Exchange 适配器模式

每个 exchange 文件自包含**静态 meta** + **签名/测试逻辑**，无需单独的 `registry.ts`。

```typescript
// src/account/ops/exchanges/types.ts

interface Credentials {
  api_key: string;
  secret: string;
  passphrase?: string;
}

interface SignParams {
  method: "GET" | "POST";
  path: string;
  params?: Record<string, string>;
  body?: string;
  timestamp: string;
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
  body?: string;
}

// Exchange = 静态 meta + adapter 方法，合为一体
interface Exchange {
  // --- 静态 meta ---
  id: ExchangeId;
  name: string;                    // 显示名 "OKX"
  fields: CredentialField[];       // 需要的凭证字段
  referral_url?: string;
  api_doc_url?: string;
  whitelist_ip?: string;

  // --- adapter 方法 ---
  sign(credentials: Credentials, params: SignParams): SignedRequest;
  testConnection(credentials: Credentials): Promise<TestResult>;  // 超时 10s
}
```

```typescript
// src/account/ops/exchanges/index.ts

function getExchange(id: ExchangeId): Exchange;
function listExchanges(): Exchange[];
```

```typescript
// src/account/ops/exchanges/okx.ts （示例）

export const okxExchange: Exchange = {
  id: "okx",
  name: "OKX",
  fields: ["api_key", "secret", "passphrase"],
  referral_url: "https://okx.com/join/...",
  api_doc_url: "https://okx.com/account/my-api",

  sign(credentials, params) { /* HMAC-SHA256 + Base64 */ },
  async testConnection(credentials) { /* GET /api/v5/account/balance */ },
};
```

### 各交易所测试端点

| 交易所 | 测试端点 | 签名方式 |
|--------|----------|----------|
| OKX | `GET /api/v5/account/balance` | HMAC-SHA256 + Base64, passphrase 参与 |
| Binance | `GET /api/v3/account` | HMAC-SHA256, query string 签名 |
| Bitget | `GET /api/v2/spot/account/info` | HMAC-SHA256 + Base64, passphrase 参与 |
| Bybit | `GET /v5/account/wallet-balance` | HMAC-SHA256, header 签名 |
| Gate | `GET /api/v4/spot/accounts` | HMAC-SHA512, header 签名 |
| KuCoin | `GET /api/v1/accounts` | HMAC-SHA256 + Base64, passphrase 参与 |
| Lighter | 待确认 | HMAC-SHA256（暂定） |

---

## 4. 存储层

```typescript
// src/account/ops/store.ts

// 纯 YAML 读写，凭证明文存储（与 providers.yaml 一致）
// 文件权限 0600，仅用户可读写

function getAccountsFilePath(): string;              // 使用 getStateDir() + "accounts.yaml"
function readAccounts(): AccountRecord[];            // 含凭证的完整记录
function writeAccounts(accounts: AccountRecord[]): void; // atomic write (write tmp + rename)
function ensureAccountsFile(): void;                 // 创建文件 + chmod 600

// AccountRecord = Account + 凭证字段
interface AccountRecord extends Account {
  api_key: string;
  secret: string;
  passphrase?: string;   // 仅 OKX/Bitget/KuCoin
}
```

**安全措施**：
- 文件权限 `0600`（创建时设置）
- Gateway GET 接口返回 masked 凭证（`"****xxxx"` 后4位），不暴露原始值
- 写入使用 atomic write（先写 tmp 再 rename），防止并发损坏

---

## 5. CLI 命令

```bash
viben account list                    # 列出所有账户
viben account add                     # 交互式添加（也支持 --exchange --name --api-key --secret [--passphrase] 非交互模式）
viben account view <id|name>          # 查看详情（凭证 masked）
viben account update <id|name>        # 更新凭证（轮换 API key）
viben account remove <id|name>        # 删除账户
viben account test <id|name>          # 测试 API 连通性
```

### 账户查找规则

`<id|name>` 参数的解析逻辑：
1. 先尝试按 `id` 精确匹配
2. 再按 `name` 精确匹配（区分大小写）
3. 若 name 匹配到多个账户，报错提示用户使用 ID

### 输入校验

- `api_key`、`secret`、`passphrase`：非空，去除首尾空白，最大长度 256 字符
- `name`：非空，最大长度 64 字符

### 注册方式

```typescript
// src/cli/commands/account.ts
export function registerAccountCommand(program: Command): void {
  const account = program.command("account").description("Trading account management");

  account.command("list")...
  account.command("add")...
  account.command("view")...
  account.command("update")...
  account.command("remove")...
  account.command("test")...
}
```

在 `src/cli/commands/index.ts` 中注册：
```typescript
import { registerAccountCommand } from "./account";
registerAccountCommand(program);
```

---

## 6. Gateway Routes

```
GET    /api/exchanges             → 返回交易所注册表（静态 meta，无需鉴权）
GET    /api/accounts              → 列出所有账户（不含凭证）
POST   /api/accounts              → 创建账户
GET    /api/accounts/:id          → 查看单个账户（凭证 masked）
PUT    /api/accounts/:id          → 更新账户凭证（轮换 API key）
DELETE /api/accounts/:id          → 删除账户
POST   /api/accounts/:id/test     → 测试连通性（超时 10s）
```

注意：将 exchanges 注册表提升为顶级路由 `/api/exchanges`，避免与 `/api/accounts/:id` 参数路由冲突。

### 注册方式

```typescript
// src/gateway/routes/accounts.ts
export function registerAccountsRoutes(fastify: FastifyInstance): void { ... }
```

在 `src/gateway/routes/index.ts` 中注册。

### 安全原则

- POST 创建时接收明文凭证，写入 YAML 后丢弃内存中的请求体
- GET 返回凭证永远是 masked（`"****xxxx"` 后4位），前端无法读取原始值
- `test` 接口从 YAML 读凭证、验证后只返回 `{success, error?, latency_ms?}`
- Gateway 绑定 `127.0.0.1`（localhost only），accounts 路由不暴露到 tunnel

---

## 7. Desktop UI

### 入口

设置页新增 section `trading-accounts`，图标 `ArrowLeftRight`（Lucide）。Section 内容区显示已添加账户概览 + 「管理交易账户」按钮。

### Dialog 结构

```
Dialog (max-w-4xl, h-[70vh])
├── 左侧面板 (w-56, border-r, overflow-y-auto)
│   └── 交易所列表（从 GET /api/accounts/exchanges）
│       每项显示: 图标 + 名称 + 已添加账户数 badge
│       选中态: 背景高亮 + 右侧 ✓
│
└── 右侧面板 (flex-1, overflow-y-auto, p-6)
    ├── 顶部链接: [注册(手续费折扣)] [创建API]
    │
    ├── 已有账户列表（如有）
    │   └── 卡片: 名称 + 创建时间 + [测试] [删除]
    │
    ├── 添加新账户表单
    │   ├── 账户名称 Input (默认 "{Exchange} #{N+1}")
    │   ├── API 密钥 Input (type=password, 带 eye toggle)
    │   ├── 密钥 Input (type=password, 带 eye toggle)
    │   ├── Passphrase Input (仅 OKX/Bitget/KuCoin)
    │   └── 白名单 IP 提示 (仅 Binance): "195.135.193.235 [复制]"
    │
    └── 底部: [取消] [保存配置]
```

### 数据流

```
Dialog mount → GET /api/accounts/exchanges（左侧列表）
           → GET /api/accounts（已有账户按 exchange 分组）
保存配置   → POST /api/accounts → 成功后刷新 + toast
测试      → POST /api/accounts/:id/test → 成功/失败 toast
删除      → DELETE /api/accounts/:id → 确认弹窗后刷新
```

---

## 8. 各 Exchange 静态 Meta（分散在 exchanges/*.ts 中）

| 交易所 | fields | 特殊字段 |
|--------|--------|----------|
| OKX | api_key, secret, passphrase | — |
| Binance | api_key, secret | whitelist_ip: "195.135.193.235" |
| Bitget | api_key, secret, passphrase | — |
| Bybit | api_key, secret | — |
| Gate | api_key, secret | — |
| KuCoin | api_key, secret, passphrase | — |
| Lighter | api_key, secret | — |

每个 exchange 文件（如 `okx.ts`）导出一个 `Exchange` 对象，包含上述 meta + `sign()` / `testConnection()` 方法。`exchanges/index.ts` 收集所有 exchange 并提供 `getExchange()` / `listExchanges()`。

---

## 9. 调用链路总览

```
Desktop (Tauri) ──HTTP──→ Gateway (Fastify) ──→ account/ops ──→ ~/.viben/accounts.yaml
CLI (viben account) ─────────────────────────→ account/ops ──→ ~/.viben/accounts.yaml
```

Gateway 是 Desktop 操作账户的唯一入口。ops 层被 CLI 和 Gateway 共享。

---

## 10. 依赖

| 依赖 | 用途 | 新增？ |
|------|------|--------|
| `nanoid` | 生成 account ID（12字符） | 已有 |
| `js-yaml` | YAML 读写 | 已有 |
| `node:crypto` | HMAC 签名 | 内置 |
| `node:fetch` / 内置 fetch | 调交易所 API 测试 | 已有 |

无新增第三方依赖。

---

## 11. 已知限制

- **并发写入**：CLI 和 Gateway 同时写 YAML 可能丢失更新（atomic write 防损坏但不防丢失）。当前与 `idea/ops` 行为一致，后续可加文件锁。
- **Lighter 端点待确认**：签名方式暂定 HMAC-SHA256，实现时需验证官方文档。若无法确认，可从 MVP 中移除。

---

## 12. 后续扩展点

- Web3 钱包连接（Hyperliquid、Aster）：新增 exchange 类型，UI 右侧切换为钱包连接流程
- 账户余额/持仓查看：复用 exchange adapter 的签名能力，添加新方法
- 多工作区账户隔离：从 `~/.viben/accounts.yaml` 迁移到 workspace 级别
- 凭证加密存储：后续可引入 SecretStore 抽象层，支持 OS keyring 或加密文件
