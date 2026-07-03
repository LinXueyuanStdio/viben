# Plan: `packages/api-client` — Web 平台统一接口层

## 架构诊断

### 现状：职责碎片化

`packages/api-client` 目前只是一个 HTTP 客户端（`VibenClient`），但"与 Viben Web 平台交互"这一职责散落在整个代码库中：

| 位置 | 内容 | 问题 |
|------|------|------|
| `core/src/gateway/routes/page.ts` | 5 个 page publish 代理路由 | web 平台逻辑泄漏到 core |
| `core/src/cli/commands/login.ts` | login/logout/whoami 命令 | web 平台的 CLI 在 core 里 |
| `core/src/auth/api.ts` | `verifyToken()` 重复了 VibenClient 的功能 | 重复实现 |
| `core/src/auth/token.ts` | token 文件读写 | 属于 api-client 职责 |
| `core/src/mcp/ops/registry.ts` | 用 VibenClient 访问 web registry | 依赖方向正确但 URL 硬编码 |
| `core/src/skill/ops/registry.ts` | 同上 | 同上 |
| `apps/desktop/src/lib/viben.ts` | 直接 new VibenClient，URL 硬编码 | 绕过 gateway，proxy 能力缺失 |
| `apps/desktop/src/stores/auth-store.ts` | 同上 | 同上 |

`VIBEN_WEB_URL = "https://viben-web.vercel.app"` 在 **6+ 处**独立硬编码。

### 目标：`packages/api-client` 成为 Web 平台的唯一接口

```
packages/api-client
  ├── HTTP Client (VibenClient)     → 程序化调用 (browser, Node.js)
  ├── Gateway Plugin (Fastify)      → 通过本地网关代理 (desktop 统一入口, proxy 支持)
  ├── CLI Commands                  → 终端交互 (auth, marketplace, collections, publish)
  └── Shared Utilities              → token 管理, 配置, 错误处理, 格式化
```

**核心原则**：
1. `api-client` **不依赖** `core`。`core` 消费 `api-client` 导出的 plugin 和 commands
2. `proxyFetch` 迁入 `api-client` — 它是 HTTP 通信基础设施
3. `VIBEN_WEB_URL` 在 `api-client` 中单一定义
4. token 管理（读/写/验证）迁入 `api-client/utils/token`
5. Gateway plugin 通过依赖注入接收 `fetch` 函数，避免循环依赖

---

## 实施计划

### Phase 1: 巩固 api-client 核心（VibenClient 补全 + 工具沉淀）

**1a. 补全 VibenClient 缺失方法**

当前 `VibenClient` 缺少网关层已经在用但未封装的 API 方法：

```ts
// pages — 从 gateway page.ts 的 proxyFetch 调用提取为正式 API
pages.publishStatus(userSlug: string, uid: string): Promise<PublishStatusResponse>
pages.publishHistory(uid: string): Promise<PublishHistoryResponse>
pages.publishVersion(uid: string, version: number): Promise<PublishVersionResponse>
pages.publishRollback(uid: string, version: number): Promise<PublishRollbackResponse>
pages.unpublish(uid: string): Promise<{ success: boolean }>
pages.listPublished(): Promise<PaginatedResponse<PublishedPage>>

// collections — 补全社区互动
collections.toggleFavorite(id: string): Promise<{ favorited: boolean }>
collections.comments(id: string): Promise<CommentsResponse>
collections.addComment(id: string, content: string): Promise<{ success: boolean }>

// mcp / skill — 补全分类查询
mcp.categories(): Promise<Category[]>
skill.categories(): Promise<Category[]>
```

**1b. 新建 `src/errors.ts`** — 结构化错误层级

```ts
export class ApiError extends Error { ... }        // 现有，保持
export class NetworkError extends ApiError { ... }  // 网络/超时
export class AuthError extends ApiError { ... }     // 401
export class RateLimitError extends ApiError { ... } // 429
export class ServerError extends ApiError { ... }   // 5xx
```

**1c. 新建 `src/utils/config.ts`** — 集中化配置

```ts
export const DEFAULT_WEB_URL = "https://viben-web.vercel.app";
export function getWebUrl(): string;           // env VIBEN_WEB_URL > default
export function resolveWebUrl(explicit?: string): string;
```

**1d. 新建 `src/utils/token.ts`** — 从 `core/src/auth/token.ts` 迁入

```ts
export const TOKEN_REGEX = /^bmcp_[a-zA-Z0-9]{8}_[a-zA-Z0-9]{24}$/;
export function readToken(): Promise<string | null>;     // env > ~/.viben/token
export function writeToken(token: string): Promise<void>; // chmod 0600
export function deleteToken(): Promise<void>;
export function validateTokenFormat(token: string): boolean;
```

**1e. 新建 `src/client-factory.ts`** — "开箱即用"工厂

```ts
export function createClient(options?: Partial<VibenClientConfig>): VibenClient;
// 自动读取 token、解析 web URL、配置 proxyFetch
// desktop app 和 CLI commands 的统一入口
```

**1f. 复制 `src/proxy-fetch.ts`** — 从 `core/src/http/proxy.ts` 复制

行为完全不变。core 保留原文件不动。api-client 有一份独立的副本，未来 core 可改为从 api-client re-export。

**1g. 更新 `src/index.ts`** — 扩展导出

导出所有新增模块：`errors`, `utils/config`, `utils/token`, `client-factory`, `proxy-fetch`, `constants`

---

### Phase 2: Gateway Plugin — 全量代理路由

**设计决策**：

| 决策 | 选择 | 理由 |
|------|------|------|
| 插件模式 | `fastify-plugin` (fp) | 共享父实例的 logger、telemetry 装饰器 |
| 路由前缀 | 各域独立前缀 | `/api/page/*`, `/api/mcp-market/*`, `/api/skill-market/*`, `/api/user/*`, `/api/collections/*`, `/api/auth/*`, `/api/voice/*` — 语义清晰，无需重定向 |
| 向后兼容 | 自然兼容 | page publish 路由路径不变（`/api/page/publish`），零影响 |
| fetch 注入 | 通过 opts 传入 | 避免循环依赖，调用方注入 `proxyFetch` |
| 按域拆分 | 7 个路由子模块 | MCP、Skill、User、Pages、Collections、Auth、Voice |

**插件入口**：

```ts
// src/plugin/index.ts
import fp from "fastify-plugin";

interface WebProxyPluginOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  cacheTTL?: number;
}

async function webProxyPlugin(fastify: FastifyInstance, opts: WebProxyPluginOptions) {
  const baseUrl = opts.baseUrl ?? DEFAULT_WEB_URL;
  const fetcher = opts.fetch ?? fetch;

  registerMcpProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerSkillProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerUserProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerPagesProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerCollectionsProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerAuthProxyRoutes(fastify, { baseUrl, fetch: fetcher });
  registerVoiceProxyRoutes(fastify, { baseUrl, fetch: fetcher });
}

export default fp(webProxyPlugin, { name: "viben-web-proxy" });
```

**全量代理路由**（各域独立前缀）：

```
/api/page/                         # page 发布相关（现有路径，不变）
  ├── POST /publish
  ├── POST /publish-status
  ├── POST /publish-history
  ├── POST /publish-version
  └── POST /publish-rollback

/api/mcp-market/                   # MCP 市场
  ├── GET  /                       → mcp.list()
  ├── GET  /:id                    → mcp.get()
  ├── GET  /search                 → mcp.search()
  ├── GET  /categories             → mcp.categories()
  ├── GET  /:id/download           → mcp.download()           [streaming]
  ├── POST /:id/favorite           → mcp.toggleFavorite()
  ├── GET  /:id/comments           → mcp.comments()
  ├── POST /:id/comments           → mcp.addComment()
  └── POST /:id/rating             → mcp.rate()

/api/skill-market/                 # Skill 市场
  └── (同 mcp-market 结构)

/api/user/                         # 用户
  ├── GET  /me                     → user.me()
  ├── PATCH /me                    → user.update()
  ├── GET  /me/favorites           → user.favorites()
  ├── GET  /me/api-keys            → user.apiKeys()
  ├── POST /me/api-keys            → user.createApiKey()
  ├── DELETE /me/api-keys/:id      → user.deleteApiKey()
  └── GET  /:username              → user.profile()

/api/collections/                  # 合集
  ├── GET  /                       → collections.list()
  ├── POST /                       → collections.create()
  ├── GET  /:id                    → collections.get()
  ├── PATCH /:id                   → collections.update()
  ├── DELETE /:id                  → collections.delete()
  ├── POST /:id/items              → collections.addItem()
  ├── DELETE /:id/items/:eid       → collections.removeItem()
  ├── POST /:id/fork               → collections.fork()
  ├── POST /:id/favorite           → collections.toggleFavorite()
  ├── GET  /:id/comments           → collections.comments()
  └── POST /:id/comments           → collections.addComment()

/api/auth/                         # 认证代理
  ├── POST /login
  ├── POST /register
  ├── GET  /:provider
  ├── POST /callback/:provider
  ├── POST /refresh
  ├── POST /validate
  └── POST /logout

/api/voice/                        # 语音
  └── POST /token
```

**特殊处理**：
- **Download**：流式传输，pipe 响应体而不缓冲
- **OAuth**：透明代理，redirect_uri 原样传递
- **Caching**：GET 公共端点缓存 5 分钟，`POST/PUT/DELETE` 自动使缓存失效

---

### Phase 3: CLI Commands — 完整终端界面

**设计模式**：每个命令模块导出 `register*Command(program: Command): void`，遵循 core 的 lazy-loading 契约。内部使用 `createClient()` 获取配置好的 `VibenClient`。

**命令清单**（完整覆盖 web 平台所有功能）：

| 命令 | 说明 |
|------|------|
| `viben auth login` | 登录（token / OAuth） |
| `viben auth logout` | 登出 |
| `viben auth whoami` | 当前用户 |
| `viben auth status` | 验证 token 有效性 |
| `viben auth register` | 注册新账户 |
| `viben profile` | 查看个人资料 |
| `viben profile update` | 更新个人资料 |
| `viben profile view <user>` | 查看公开资料 |
| `viben api-key list` | API key 列表 |
| `viben api-key create <name>` | 创建 API key |
| `viben api-key delete <id>` | 删除 API key |
| `viben mcp-market list` | MCP 包列表 | — |
| `viben mcp-market search <query>` | 搜索 MCP | `viben mcp search` 保留兼容，底层委托 mcp-market ops |
| `viben mcp-market view <id>` | 查看 MCP 详情 | — |
| `viben mcp-market download <id>` | 下载 MCP | — |
| `viben mcp-market favorite <id>` | 收藏/取消收藏 | — |
| `viben mcp-market rate <id> <1-5>` | 评分 | — |
| `viben mcp-market comments <id>` | 查看评论 | — |
| `viben mcp-market comment <id> <text>` | 添加评论 | — |
| `viben skill-market list` | Skill 包列表 |
| `viben skill-market search <q>` | 搜索 Skill |
| `viben skill-market view <id>` | 查看 Skill 详情 |
| `viben skill-market download <id>` | 下载 Skill |
| `viben skill-market favorite <id>` | 收藏/取消收藏 |
| `viben skill-market rate <id> <1-5>` | 评分 |
| `viben skill-market comments <id>` | 查看评论 |
| `viben skill-market comment <id> <text>` | 添加评论 |
| `viben collection list` | 合集列表 |
| `viben collection view <id>` | 查看合集 |
| `viben collection create <name>` | 创建合集 |
| `viben collection update <id>` | 更新合集 |
| `viben collection delete <id>` | 删除合集 |
| `viben collection add <id> <entity>` | 添加项目 |
| `viben collection remove <id> <entity>` | 移除项目 |
| `viben collection fork <id>` | Fork 合集 |
| `viben favorites` | 查看收藏 |
| `viben page publish` | 发布页面 |
| `viben page publish-status <uid>` | 查看发布状态 |
| `viben page publish-history <uid>` | 版本历史 |
| `viben page publish-version <uid> <v>` | 查看特定版本 |
| `viben page publish-rollback <uid> <v>` | 回滚版本 |
| `viben voice token` | 获取语音 token |

**文件结构**（遵循现有 `packages/core/src/*/ops/` 领域模式）：

```
src/
  ├── client.ts            # VibenClient
  ├── types.ts             # 共享类型
  ├── index.ts             # barrel export
  ├── constants.ts         # VIBEN_WEB_URL
  ├── errors.ts            # ApiError 层级
  ├── proxy-fetch.ts       # proxyFetch（从 core 复制，core 中保留原文件）
  ├── client-factory.ts    # createClient() 工厂
  ├── mcp-market/
  │   ├── types.ts         # MCP 市场类型
  │   ├── ops.ts           # 核心逻辑（调用 VibenClient）
  │   └── index.ts         # 导出
  ├── skill-market/
  │   ├── types.ts
  │   ├── ops.ts
  │   └── index.ts
  ├── auth/
  │   ├── types.ts
  │   ├── ops.ts
  │   └── index.ts
  ├── user/
  │   ├── types.ts
  │   ├── ops.ts
  │   └── index.ts
  ├── collections/
  │   ├── types.ts
  │   ├── ops.ts
  │   └── index.ts
  ├── pages/
  │   ├── types.ts
  │   ├── ops.ts
  │   └── index.ts
  ├── voice/
  │   ├── types.ts
  │   ├── ops.ts
  │   └── index.ts
  ├── utils/
  │   ├── token.ts         # token 读写
  │   └── config.ts        # URL 配置
  ├── routes/
  │   ├── index.ts         # Fastify 插件入口
  │   ├── mcp-market.ts    # MCP 代理路由
  │   ├── skill-market.ts  # Skill 代理路由
  │   ├── user.ts          # 用户代理路由
  │   ├── pages.ts         # 页面代理路由
  │   ├── collections.ts   # 合集代理路由
  │   ├── auth.ts          # 认证代理路由
  │   └── voice.ts         # 语音代理路由
  └── commands/
      ├── index.ts         # barrel: 导出所有 register*Command
      ├── auth.ts          # registerAuthCommand
      ├── profile.ts       # registerProfileCommand
      ├── api-key.ts       # registerApiKeyCommand
      ├── mcp-market.ts    # registerMcpMarketCommand
      ├── skill-market.ts  # registerSkillMarketCommand
      ├── collections.ts   # registerCollectionsCommand
      ├── favorites.ts     # registerFavoritesCommand
      ├── pages-publish.ts # registerPagesPublishCommand
      └── voice.ts         # registerVoiceCommand
```

---

### Phase 4: 接入 `packages/core`

**4a. Gateway 注册插件**

```ts
// core/src/gateway/routes/index.ts
import webProxyPlugin from "@viben/api-client/routes";
import { proxyFetch } from "@viben/api-client/proxy-fetch";

export async function registerRoutes(fastify, state) {
  // 注册 web 平台代理插件，各域路由自带语义前缀
  await fastify.register(webProxyPlugin, { fetch: proxyFetch });
  // ... 其余本地路由 ...
}
```

插件内部各域路由使用绝对路径（`/api/mcp-market/...`, `/api/page/publish` 等），注册时无需传 prefix，各域自带语义前缀。

**4b. 注册 CLI 命令**

```ts
// core/src/cli/commands/index.ts COMMANDS 数组替换/新增：
{ name: "auth", ...,
  loader: () => import("@viben/api-client/commands").then(m => ({ register: m.registerAuthCommand })) },
{ name: "profile", ...,
  loader: () => import("@viben/api-client/commands").then(m => ({ register: m.registerProfileCommand })) },
{ name: "keys", ...,
  loader: () => import("@viben/api-client/commands").then(m => ({ register: m.registerKeysCommand })) },
// ... mcp (扩展原有 mcp 命令), skill marketplace, collection, favorites, voice ...
```

**4c. 清理 core 冗余代码**

| 操作 | 文件 |
|------|------|
| 删除 | `core/src/cli/commands/login.ts` |
| 改为 re-export | `core/src/auth/token.ts` → from `@viben/api-client/utils/token` |
| 改为 re-export | `core/src/auth/api.ts` → `verifyToken` 改为用 `VibenClient.user.me()` |
| 精简 | `core/src/gateway/routes/page.ts` → 移除 5 个代理路由和 `VIBEN_WEB_URL` |

**4d. 更新 `apps/desktop`**

| 文件 | 变更 |
|------|------|
| `src/lib/viben.ts` | `VIBEN_WEB_URL` → from `@viben/api-client`；用 `createClient()` 替代手动 new |
| `src/lib/api-client.ts` | 同上 |
| `src/stores/auth-store.ts` | 同上 |

---

## 依赖设计

```
packages/api-client
  dependencies:     commander
  peerDependencies: fastify, fastify-plugin (仅类型)
  devDependencies:  fastify, fastify-plugin (本地 typecheck)
  ↑
  │  import { VibenClient, createClient, proxyFetch, VIBEN_WEB_URL } from "@viben/api-client"
  │  import webProxyPlugin from "@viben/api-client/routes"
  │  import { registerAuthCommand, ... } from "@viben/api-client/commands"
  │
packages/core
  │
  v
apps/cli, apps/desktop, apps/web
```

- **无循环依赖**：plugin 通过 opts 接收 `fetch` 函数；commands 使用同包的 `createClient()`
- **core 只消费 api-client**，不反向依赖

---

## 验证

1. **Typecheck + Build**（遵循 CLAUDE.md 逐包检查）
   ```bash
   cd packages/api-client && pnpm typecheck && pnpm build
   cd packages/core && pnpm typecheck && pnpm build
   cd apps/desktop && pnpm typecheck
   ```

2. **Gateway 路由验证**
   ```bash
   pnpm gateway:restart
   # 新路径
   curl http://127.0.0.1:18790/api/page/publish-status \
   # 旧路径兼容
   curl -X POST http://127.0.0.1:18790/api/page/publish-status \
     -H "Content-Type: application/json" \
     -d '{"access_token":"test","user_slug":"test","uid":"test"}'
   ```

3. **CLI 命令**
   ```bash
   viben auth --help
   viben mcp search "git"
   viben collection list
   ```

4. **现有测试不退化**
   ```bash
   cd packages/core && pnpm test -- --testPathPattern="page-publish"
   ```
