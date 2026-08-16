# 双 Token 会话架构设计（Access Token + Refresh Token）

> 状态：设计稿（待评审）
> 目标：用「短命 Access Token + 长命 Refresh Token（可轮换、可吊销）」替代当前「单一长命 JWE session」，对齐互联网大厂标准做法。

## 1. 背景与现状问题

当前登录态是**单一 JWE token**：

- `lib/auth/jwe.ts` 用 `dir + A256GCM` 把整个 `Session`（含 `userId`、`role`、`email` 等）加密成一个 token；
- 该 token 放在 `httpOnly` 的 `session` cookie，`maxAge = 7 天`；
- `getSession()` / `getServerSession()` / `requireAuth()` 各自 `decryptSession()` 得到会话。

它带来的问题：

| 问题 | 说明 |
|---|---|
| 无法撤销 | JWT/JWE 一旦签发就无法「作废」，封禁/删除用户只要 token 没过期就仍有效 |
| 无设备维度 | 没有「单设备登出」「查看所有会话」能力，token 泄露后无法定点清除 |
| 长命 token 暴露面大 | 7 天有效期内被盗走即可长期冒充，没有短周期止损 |
| 滑动续期难落地 | 想「活跃用户永不过期」只能靠 middleware 每请求解密/续期，负载重、且会让 token 无限续（纯滑动的安全反模式） |

## 2. 目标架构

采用业界标准「双 token + refresh 轮换」：

```
登录 ──► 签发 Access Token(15min) + Refresh Token(30d)
            │                        │
            │ httpOnly cookie         │ httpOnly cookie (path=/api/auth/refresh)
            ▼                        ▼
        每个请求鉴权             Access 过期时调 /api/auth/refresh
        (本地验签，不查库)         ──► 校验 refresh → 轮换(旧作废) → 签发新 Access
                                    └─► Refresh 复用被检测 → 吊销整个会话家族
```

- **Access Token**：短命（15 分钟）、无状态、本地验签、不查库，限制被盗后的爆破半径。
- **Refresh Token**：长命（30 天）、不透明随机串、**哈希后存数据库**，是唯一可撤销的凭据。

## 3. 详细设计

### 3.1 Token 结构

**Access Token（JWT，HS256 签名）**——最小化 payload，不含敏感字段：

```ts
interface AccessTokenPayload {
  userId: string;    // 用户 ID
  role: string;      // 角色（放进来省一次查询，但属于非敏感）
  sessionId: string; // 关联 sessions 表，支持「单设备吊销」
  iat: number;
  exp: number;       // 15 分钟
}
```

- 签名密钥：**新增 `ACCESS_TOKEN_SECRET`**（32 字节随机，与 `JWE_SECRET` 分离）。签名用 `jose` 的 `SignJWT` / `jwtVerify`（HS256）。
- 不放进 `email` 等敏感信息——用户资料走 `/api/users/me` 查库。

**Refresh Token（opaque 随机串）**：

- `crypto.randomBytes(32).toString('base64url')`；
- 服务端只存它的 **SHA-256 哈希**（防 DB 泄露后直接用）；
- 30 天滑动过期：每次 refresh **轮换**（旧的立即作废），新 token 重新计时 30 天。活跃用户（30 天内 refresh 过）不会被登出。

### 3.2 Cookie 设计

| Cookie | httpOnly | Secure | SameSite | Path | maxAge |
|---|---|---|---|---|---|
| `access_token` | ✅ | prod | Lax | `/` | 15 min |
| `refresh_token` | ✅ | prod | Lax | `/api/auth/refresh` | 30 d |

- `refresh_token` 的 `Path` 限定到 `/api/auth/refresh`，浏览器只在 refresh 端点才发送它，缩小 XSS/CSRF 暴露面。
- 都不进 `localStorage`（XSS 可读）。

### 3.3 数据库 `sessions` 表（Postgres / Drizzle）

```ts
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),           // 关联 users.id
  refreshTokenHash: text('refresh_token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),  // 30 天绝对过期
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),         // 上次 refresh 时间
  revokedAt: timestamp('revoked_at'),            // 吊销时间（软删除）
  userAgent: text('user_agent'),
  ip: text('ip'),
}, (t) => [
  index('sessions_user_id_idx').on(t.userId),
]);
```

- 一行 = 一台设备的一个会话，支持多设备登录、单设备登出、批量吊销。
- `revokedAt` 用软删除（保留记录用于复用检测，见 §4）。

### 3.4 端点设计

**`POST /api/auth/refresh`**（核心，无 CSRF 风险因为是只读换发 + cookie）：

1. 读 `refresh_token` cookie；缺失 → 401。
2. `sha256(token)` 查 `sessions` 表；不存在 → 401。
3. 校验 `revokedAt == null && expiresAt > now`；否则 → 401。
4. **复用检测**（§4）：若这条记录的 `lastUsedAt` 表明 token 已被轮换过，却再次出现 → 判定被盗，吊销该用户**全部** session → 401。
5. **轮换**：生成新 refresh token，`update` 该行 `refreshTokenHash` / `expiresAt` / `lastUsedAt`（原子 compare-and-set，见 §4）。
6. 签发新 access token，设置两个 cookie，返回 `{ success: true }`。

**登录（email/password + Google One Tap）**：登录成功后：
- 生成 `sessionId` + refresh token，`insert` 一条 `sessions`；
- 签发 access token；
- 设置两个 cookie。

**登出**：`update` 该 session 的 `revokedAt = now`（或 `delete`），清两个 cookie。

### 3.5 前端流程

- 登录后两个 cookie 由后端设置，前端无感。
- **刷新触发**：见 §3.6。
- **并发刷新保护**：前端维护一个共享的 refresh Promise + flag，多个 401 并发时只发起一次 refresh（避免「两 tab 同时刷新」导致 refresh 轮换竞争）。
- **refresh 失败**：清 cookie、跳登录，不做无限重试。

### 3.6 刷新触发策略（关键决策）

这是本方案与「middleware 每请求续期」的分水岭。给出两个选项：

**选项 A：轻量 middleware 自动刷新（推荐，SSR 友好）**

`middleware.ts` 只做两件事：
1. 读 `access_token` → **JWT 验签**（快、纯内存、不查库）。有效 → 透传。
2. 过期/缺失 → 读 `refresh_token` → 调 refresh（**此时才查库**）→ 设置新 cookie → 透传。

关键澄清：**「查库」只在 access token 过期时发生（约 15 分钟/用户一次），不是每请求**。每请求的开销只是一次 HS256 验签（微秒级），与之前「每请求解密 JWE + 续期」完全不同。

- 优点：SSR 页面（Server Component）永远能读到新鲜 access token，不会出现「页面请求时 token 刚好过期 → 误登出」。
- 缺点：仍有一个 middleware（但负载可控）。

**选项 B：无 middleware，纯前端驱动**

前端在 access token 快过期时（用一个非 httpOnly 的提示 cookie 或本地计时）主动调 `/api/auth/refresh`。

- 优点：彻底去掉 middleware。
- 缺点：SSR 页面请求在 access token 过期到前端刷新之间的窗口内，Server Component 读不到用户 → 会短暂「未登录」/闪烁，体验差，且刷新时机不可靠。

**结论**：选 **A**。它的「查库频率」已经满足「天级别/低频」诉求（access 15 分钟才查一次库，refresh 本身 30 天），不会打挂数据库。

## 4. 安全设计

- **轮换 + 复用检测**：每次 refresh 原子换新；旧 token 再次出现 → 判为泄露，吊销该用户全部 session（清掉被盗链）。原子性用 `UPDATE ... WHERE refresh_token_hash = :old`（影响行数为 0 说明已被轮换/竞争失败）。
- **并发 refresh 竞争**：多 tab 同时刷新时，用 compare-and-set 语义，只有一个能成功，其余返回可重试错误（前端 queue+flag 合并请求）。
- **吊销面**：
  - 单设备登出 → 吊销对应 `sessionId`；
  - 改密码 / 触发风控 → 吊销该用户全部 session（除当前）。
- **限流**：`/api/auth/refresh` 按 IP 限流（复用现有 `lib/rate-limit`）；登录接口恢复按 IP + email 双维度限流。
- **哈希 + 不落盘明文**：refresh token 只存 SHA-256，DB dump 不泄露可用凭据。
- **过期是正常状态**：refresh 过期/吊销一律 401，不区分「token 错误」与「会话过期」避免信息泄露。

## 5. 与现有代码的映射

| 现有 | 处置 |
|---|---|
| `middleware.ts`（滑动续期） | **删除**，替换为选项 A 的轻量 refresh middleware |
| `lib/auth/jwe.ts` | 保留（JWE 不再作为会话 token，若其他用途复用则保留；否则退役） |
| `lib/auth/types.ts` 的 `Session` | 拆分：`AccessTokenPayload`（新）+ 保留 `UserSession` 给服务端 |
| `lib/auth/cookies.ts` | 重写：`setAccessTokenCookie` / `setRefreshTokenCookie` / `clearSessionCookies` |
| `lib/auth/middleware.ts` 的 `requireAuth` | 改为验签 access token（可加：必要时查库校验用户状态） |
| `lib/session/get-server-session.ts` | 改为验签 access token 得到 `{ userId, role, sessionId }`，需要 email/name 时再查库 |
| `app/api/auth/login` / `google/one-tap` | 登录成功后同时签发 access + refresh 并写 sessions 表 |
| `app/api/auth/logout` | 吊销 session + 清 cookie |
| `app/api/auth/refresh`（新） | 轮换 refresh + 签发 access |
| `lib/db/schema.ts` | 新增 `sessions` 表 + 迁移 |
| `components/layout/app-shell-wrapper.tsx` | cache 字段改为 `expiresAt`（绝对过期，不再 ts 刷新），配合新登出逻辑 |

## 6. 迁移计划

分阶段，避免一次性大爆炸：

1. **DB**：新增 `sessions` 表 + drizzle 迁移（`db:generate` / `db:push`）。
2. **token 层**：新增 access token 签发/验签（HS256）+ refresh token 生成/哈希（可单测）。
3. **登录/登出/refresh**：三个端点改造，签发双 token、写 sessions。
4. **鉴权层**：`getSession` / `getServerSession` / `requireAuth` 改为验签 access token。
5. **middleware**：选项 A 的轻量 refresh。
6. **前端**：`app-shell-wrapper` cache 字段 + 401 刷新兜底 + 并发 refresh 合并。
7. **清理**：删除旧的 `session` cookie 逻辑、退役 JWE 会话路径。

每阶段独立可测，旧会话在 access token 过期后自然失效（无需强制全员重登，但可接受「升级后需重登一次」）。

## 7. 关键决策（已按大厂标准确定）

- **Access Token 时长**：15 分钟。
- **Refresh Token 时长**：30 天滑动（每次 refresh 轮换重新计时）；不加绝对上限——非高安全平台 30 天滑动足够，如需更强可后续加 `absoluteExpiresAt` 字段。
- **刷新策略**：选项 A（轻量 middleware 自动刷新，仅在 access 过期时查库）。
- **旧 `session` cookie / JWE 会话路径**：web 会话 cookie 退役；`encryptSession`/`decryptSession` 保留给 desktop client 的 bearer token（`requireAuth` 的 1b 分支），desktop 是否也迁 refresh 后续单独评估。
- **`email` 不进 access token**：payload 仅 `userId` / `role` / `sessionId`，用户资料通过 `/api/users/me` 查库。
- **多设备**：sessions 表天然支持多设备；提供「吊销单设备 / 吊销全部」API（登出即吊销单设备）；「会话管理 UI」作为后续可选迭代。

## 8. 参考

- [Session Management: JWTs vs Opaque Tokens — CIAM Compass](https://guptadeepak.com/ciam-compass/guides/session-management-jwts-vs-opaque-tokens/)
- [nebula-token — RFC 9700 opaque rotating refresh tokens](https://github.com/nebula-token/nebula-token)
- [OAuth 2.0 for Browser-Based Apps — refresh token rotation](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps-16)
- [Sliding vs Absolute session timeout — Stack Overflow](https://stackoverflow.com/revisions/3fbb93f8-a1d9-41b7-a57e-f0b66695d1fa/view-source)
