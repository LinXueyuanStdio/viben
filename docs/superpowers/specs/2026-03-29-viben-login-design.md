# viben login 设计文档

> CLI 登录命令，复刻 HuggingFace login 流程

## 概述

实现 `viben login` 命令，让用户通过 API Token 认证到 apps/web 后端。Token 从 Web 界面生成，CLI 验证后本地保存。

## 命令设计

### viben login

```bash
viben login [options]
```

**选项:**
| 选项 | 说明 |
|------|------|
| `--token <token>` | 直接传入 token（非交互式） |
| `--no-browser` | 禁止自动打开浏览器 |
| `--force` | 覆盖已有 token，跳过确认 |

**交互流程:**

```
$ viben login
Opening https://viben-web.vercel.app/settings/tokens in your browser...
? Enter your token: █

Validating token...
✓ Logged in as john-doe (john@example.com)
  Token saved to ~/.viben/token
```

**非交互流程:**

```
$ viben login --token bmcp_abc12345_xxxxxxxxxxxx
Validating token...
✓ Logged in as john-doe (john@example.com)
  Token saved to ~/.viben/token
```

**无头环境 (浏览器打开失败):**

```
$ viben login
Could not open browser. Please visit:
  https://viben-web.vercel.app/settings/tokens

? Enter your token: █
```

**已登录时:**

```
$ viben login
You are already logged in as john-doe.
? Overwrite existing token? (y/N) █
```

### viben logout

```bash
viben logout
```

删除 `~/.viben/token` 文件。未登录时静默退出 (exit 0)。

### viben whoami

```bash
viben whoami [--json]
```

**正常输出:**
```
$ viben whoami
john-doe (john@example.com)
```

**JSON 输出:**
```
$ viben whoami --json
{"username":"john-doe","email":"john@example.com","id":"user_123"}
```

**未登录:**
```
$ viben whoami
Not logged in. Run "viben login" first.
```

## Token 存储

**文件路径:** `~/.viben/token`

**文件格式:** 纯文本，单行
```
bmcp_abc12345_xxxxxxxxxxxxxxxxxxxx
```

**Token 格式验证:** `/^bmcp_[a-zA-Z0-9]{8}_[a-zA-Z0-9]{24}$/`

**文件权限:** `0600` (仅所有者可读写)

**目录创建:** 如果 `~/.viben` 目录不存在，自动创建 (权限 0700)

**读取优先级:**
1. 环境变量 `VIBEN_TOKEN` (最高优先级)
2. 文件 `~/.viben/token`

## API 修改

### 扩展 requireAuth() 支持 Bearer Token

**文件:** `apps/web/lib/auth/middleware.ts`

**修改内容:**

```typescript
import { validateApiKey } from './api-key';

export async function requireAuth(request: NextRequest): Promise<Session> {
  // 1. 先检查 Bearer Token (API Key)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = await validateApiKey(token);
    if (user) {
      return {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role as Session['role'],
        expiresAt: 0, // API Key 不过期
      };
    }
    // Bearer token 无效时直接报错，不 fallthrough
    throw new AuthError('Invalid API key', 401);
  }

  // 2. 无 Bearer Token 时检查 Cookie Session
  const cookieToken = request.cookies.get('session')?.value;

  if (!cookieToken) {
    throw new AuthError('Unauthorized', 401);
  }

  const session = await decryptSession(cookieToken);

  if (!session) {
    throw new AuthError('Session expired', 401);
  }

  return session;
}
```

### CLI 调用验证

CLI 调用 `GET /api/users/me` 验证 token：

```
GET https://viben-web.vercel.app/api/users/me
Authorization: Bearer bmcp_abc12345_xxxxxxxxxxxx
```

**成功响应 (200):**
```json
{
  "user": {
    "id": "user_123",
    "username": "john-doe",
    "email": "john@example.com",
    "avatar_url": "https://..."
  }
}
```

**失败响应 (401):**
```json
{
  "error": "Invalid API key"
}
```

## 错误处理

| 场景 | 错误信息 | Exit Code |
|------|----------|-----------|
| Token 格式无效 | `Invalid token format. Token should start with "bmcp_"` | 1 |
| 网络错误 | `Could not connect to server. Check your internet connection.` | 1 |
| Token 无效/过期 | `Invalid or expired token. Generate a new one at https://viben-web.vercel.app/settings/tokens` | 1 |
| logout 时未登录 | `Not logged in.` | 0 |
| whoami 时未登录 | `Not logged in. Run "viben login" first.` | 1 |

## 文件结构

**CLI (packages/core):**
```
packages/core/src/cli/commands/
├── login.ts          # 新增
└── index.ts          # 修改: 注册命令

packages/core/src/config/
└── paths.ts          # 修改: 新增 getTokenPath()
```

**apps/web:**
```
apps/web/lib/auth/
└── middleware.ts     # 修改: requireAuth() 支持 Bearer Token
```

**用户配置:**
```
~/.viben/
└── token             # 新增
```

## 依赖

- `open` - 打开浏览器 (已在项目中使用)
- `@inquirer/prompts` - 交互式输入 (已在项目中使用)

## 安全考虑

1. Token 文件权限设为 0600
2. Token 不在命令行历史中暴露 (交互式输入)
3. 非交互式使用时建议通过环境变量传递
4. Token 本身由 apps/web 管理过期时间

## 配置

**Web App URL:** 硬编码为 `https://viben-web.vercel.app`

未来可通过 `~/.viben/config.yaml` 中的 `web_url` 字段覆盖。

## Token 页面

用户在 `https://viben-web.vercel.app/settings/tokens` 生成和管理 API Token。

该页面应已存在，使用现有的 `/api/users/me/api-keys` 端点。
