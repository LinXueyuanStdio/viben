# Viben MCP OAuth 2.1 授权服务设计

## 背景

`mcp-handler` v1.1.0 已内置 OAuth 保护资源能力：
- `withMcpAuth` — Bearer Token 验证中间件（返回 401 + `WWW-Authenticate` 挑战头）
- `protectedResourceHandler` — 服务 RFC 9728 保护资源元数据端点
- AuthInfo 通过 `req.auth` 传递给下游 handler

我们目前用 `AsyncLocalStorage` + `extractSession` 手动提取 API Key / JWE token，**绕过了 RFC 9728 标准流程**。MCP 客户端（Claude Code 等）无法通过浏览器 OAuth 登录。

## 目标

让 Claude Code / Codex 等客户端执行 `claude mcp add --transport http viben https://...` 后弹出浏览器、在 viben 登录、授权——就和 alphaXiv 一样。

## 架构概览

```
浏览器                              MCP 客户端 (Claude Code)
  │                                       │
  │  1. GET /api/oauth/authorize          │  MCP 客户端发现无 token
  │     → 重定向到 viben 登录页            │  → 收到 401 + WWW-Authenticate
  │                                       │  → 解析授权服务器 URL
  │  2. 用户在 viben 登录                  │  → 打开浏览器
  │     → session cookie 已存在            │
  │                                       │
  │  3. 用户确认授权                        │
  │     → 生成 authorization_code         │
  │     → 重定向回 MCP 客户端 callback      │
  │                                       │
  │                                       │  4. POST /api/oauth/token
  │                                       │     → code → access_token
  │                                       │         + refresh_token
  │                                       │
  │                                       │  5. POST /api/mcp/v1
  │                                       │     Authorization: Bearer <access>
  │                                       │     → withMcpAuth 验证通过
```

## 实现分步

### Step 1: OAuth 授权服务器端点

新建 `app/api/oauth/` 路由组：

```
app/api/oauth/
  authorize/route.ts       # GET — 浏览器登录 + 授权确认页
  token/route.ts           # POST — 授权码 → access token
  revoke/route.ts          # POST — 吊销 token
  .well-known/oauth-authorization-server/route.ts  # GET — RFC 8414 元数据
```

#### `GET /.well-known/oauth-authorization-server`

返回 RFC 8414 元数据，告诉 MCP 客户端去哪里授权：

```json
{
  "issuer": "https://viben.app",
  "authorization_endpoint": "https://viben.app/api/oauth/authorize",
  "token_endpoint": "https://viben.app/api/oauth/token",
  "revocation_endpoint": "https://viben.app/api/oauth/revoke",
  "response_types_supported": ["code"],
  "code_challenge_methods_supported": ["S256"],
  "grant_types_supported": ["authorization_code", "refresh_token"]
}
```

#### `GET /api/oauth/authorize`

1. 检查 viben session cookie → 已登录则继续，未登录重定向到 `/login?redirect=/api/oauth/authorize?...`
2. 渲染授权确认页（Server Component 或 API 返回 HTML）
3. 用户点击"允许" → 生成 `authorization_code`（一次性，5 分钟过期）
4. 重定向到 `redirect_uri?code=xxx&state=yyy`

#### `POST /api/oauth/token`

接收 `grant_type=authorization_code`，验证 `code_verifier`（PKCE S256）。
返回 `{ access_token, refresh_token, expires_in, token_type: "Bearer" }`。

#### `POST /api/oauth/revoke`

接收 `token`，标记为已吊销。

### Step 2: 数据库

新建一张 oauth 相关表（也可考虑用更简单的方案——自包含 JWT）

```sql
CREATE TABLE oauth_grants (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,       -- 授权码（一次性）
  code_challenge TEXT,             -- PKCE S256 challenge
  code_challenge_method TEXT,      -- "S256"
  client_id TEXT,
  redirect_uri TEXT,
  user_id TEXT REFERENCES users(id),
  scopes TEXT,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE oauth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  client_id TEXT,
  scopes TEXT,
  token_hash TEXT UNIQUE NOT NULL, -- bcrypt hash of access_token
  refresh_token_hash TEXT UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Step 3: 集成到 MCP 端点

修改 `app/api/mcp/v1/route.ts`：

```typescript
import { createMcpHandler, withMcpAuth, protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler";

// 1. Token 验证回调
async function verifyToken(req: Request, bearerToken?: string) {
  if (!bearerToken) return undefined;
  // 先检查 API Key（bmcp_ 前缀）
  if (bearerToken.startsWith("bmcp_")) {
    const user = await validateApiKey(bearerToken);
    if (!user) return undefined;
    return { userId: user.id, clientId: "api-key", scopes: [] };
  }
  // 再检查 OAuth access token
  return verifyOAuthToken(bearerToken); // 查 DB / JWT 验证
}

// 2. 保护资源元数据
const metadataHandler = protectedResourceHandler({
  authServerUrls: ["https://viben.app"],
});

// 3. 创建 MCP handler（与现在相同）
const mcpHandler = createMcpHandler((server) => { /* tools */ }, {
  serverInfo: { name: "viben", version: "1.0.0" },
}, {
  streamableHttpEndpoint: "/api/mcp/v1",
});

// 4. 包装认证层
const protectedHandler = withMcpAuth(mcpHandler, verifyToken, {
  required: false, // 公开工具不需要认证
  resourceUrl: APP_URL,
});

// 5. 路由分发
async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // RFC 9728 元数据端点
  if (url.pathname === "/api/mcp/v1/.well-known/oauth-protected-resource") {
    return metadataHandler(req);
  }
  // OPTIONS 预检
  if (req.method === "OPTIONS") {
    return metadataCorsOptionsRequestHandler()();
  }
  // MCP 请求（认证可选）
  return protectedHandler(req);
}
```

### Step 4: 授权确认页 UI

最小可用版本——纯 HTML 表单，沿用 viben 现有 UI 组件：

```tsx
// GET /api/oauth/authorize 返回的页面
// 显示："Viben 请求访问你的账户" + 客户端信息 + [允许] [拒绝]
```

## 简化方案：跳过客户端注册

alphaXiv 目前是 OAuth 2.1 而非 MCP 完整的 DCR/CIMD。我们也可以简化：
- **不实现客户端注册 API** — MCP 客户端通过 `code_challenge`（PKCE）即可
- **不区分 client_id** — 所有客户端共享同一授权服务器
- **scope 简化** — 初始版本只支持 `read` + `write` 两个 scope

## 优先级

| 优先级 | 组件 | 工作量 |
|--------|------|--------|
| P0 | `GET /.well-known/oauth-authorization-server` | 小 |
| P0 | `GET /api/oauth/authorize`（授权确认页） | 中 |
| P0 | `POST /api/oauth/token` | 中 |
| P0 | token 验证集成到 `withMcpAuth` | 小 |
| P1 | `POST /api/oauth/revoke` | 小 |
| P1 | `GET /api/mcp/v1/.well-known/oauth-protected-resource` | 小（mcp-handler 内置） |
| P1 | PKCE S256 验证 | 小 |
| P2 | refresh_token 轮换 | 中 |
| P2 | oauth_tokens 表 + 定期清理 | 中 |

## 产出

完成后，以下命令将弹出浏览器授权：

```bash
# 交互式 OAuth（弹出浏览器，在 viben 登录）
claude mcp add --transport http viben https://viben.app/api/mcp/v1

# 或继续用 API Key（无交互）
claude mcp add --transport http viben https://viben.app/api/mcp/v1 \
  --header "Authorization: Bearer bmcp_xxx"
```
