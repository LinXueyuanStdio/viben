# Assistant 本地开发配置

## 前提条件

- Viben 项目已正常启动（`pnpm dev`）
- PostgreSQL 数据库已配置（`POSTGRES_URL`）
- pnpm 已安装依赖（`pnpm install`）

## 环境变量

在 `apps/web/.env` 中追加以下配置：

### GitHub App（代码仓库操作所需）

```env
# GitHub App 配置
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
NEXT_PUBLIC_GITHUB_APP_SLUG=your-app-slug
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# GitHub OAuth（Better Auth → 已替换为 viben OAuth）
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

### Vercel Sandbox（可选，本地开发可暂不配置）

```env
VERCEL_SANDBOX_BASE_SNAPSHOT_ID=
VERCEL_PROJECT_PRODUCTION_URL=
NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL=
OPEN_AGENTS_RESOURCE_PROFILE=hobby
```

### 其他可选配置

```env
# Redis（Skills 缓存，不配置则用内存缓存）
REDIS_URL=

# ElevenLabs（语音转录）
ELEVENLABS_API_KEY=

# 模型 API keys（根据使用的 provider）
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

## 数据库初始化

```bash
# 生成 migration SQL
cd apps/web && pnpm db:generate

# 推送到本地数据库
cd apps/web && pnpm db:push
```

## 启动

```bash
cd apps/web && pnpm dev
```

## 验证

```bash
# 编译检查
cd apps/web && pnpm typecheck

# 访问页面
# http://localhost:3000/assistant
# http://localhost:3000/settings/assistant
# http://localhost:3000/settings/usage

# API 检查
curl http://localhost:3000/api/models
```
