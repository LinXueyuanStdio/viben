# Viben Web

Agent Swarm × Code Evolution - 智能体集群与代码进化平台。基于 Next.js 15 构建，提供 MCP 服务和技能的市场平台、用户认证、包管理等功能。

## 技术栈

- **框架**: [Next.js 15](https://nextjs.org/) (App Router)
- **运行时**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **数据库**: [PostgreSQL](https://www.postgresql.org/) (Neon)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **认证**: GitHub OAuth + JWE Session
- **样式**: [Tailwind CSS 3](https://tailwindcss.com/)
- **UI 组件**: [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/)
- **存储**: [HuggingFace Hub](https://huggingface.co/) (包文件存储)
- **测试**: [Vitest](https://vitest.dev/)

## 功能模块

### 用户认证

| 页面/API | 路径 | 说明 |
|----------|------|------|
| 登录 | `/login` | 用户登录 (支持 GitHub OAuth) |
| 注册 | `/register` | 用户注册 |
| GitHub OAuth | `/api/auth/github` | GitHub 授权跳转 |
| OAuth 回调 | `/api/auth/github/callback` | GitHub 授权回调 |

### 市场和包管理

| 页面 | 路径 | 说明 |
|------|------|------|
| MCP 服务列表 | `/mcp-market` | 浏览 MCP 服务 |
| MCP 详情 | `/mcp-market/:id` | MCP 服务详情 |
| 官方 MCP | `/mcp-market/official/:name` | 官方 MCP 服务 |
| 技能列表 | `/skill-market` | 浏览技能 |
| 技能详情 | `/skill-market/:id` | 技能详情 |
| 合集列表 | `/collections` | 浏览合集 |
| 合集详情 | `/collections/:id` | 合集详情 |

### 创作者中心

| 页面 | 路径 | 说明 |
|------|------|------|
| 发布 | `/publish` | 发布 MCP 服务或技能 |
| 我的包 | `/my-packages` | 管理已发布的包 |
| 分析 | `/analytics` | 下载和使用统计 |
| MCP 分析 | `/mcp-market/:id/analytics` | 单个 MCP 的详细分析 |
| 技能分析 | `/skill-market/:id/analytics` | 单个技能的详细分析 |

### 用户中心

| 页面 | 路径 | 说明 |
|------|------|------|
| 个人资料 | `/profile` | 用户个人资料 |
| 账户设置 | `/profile/settings` | 账户设置 |
| 工作区 | `/workspaces` | 工作区列表 |
| 组织 | `/orgs` | 组织管理 |

### 管理后台

| 页面 | 路径 | 说明 |
|------|------|------|
| 后台首页 | `/admin` | 管理后台概览 |
| 包管理 | `/admin/packages` | 所有包的管理 |
| MCP 管理 | `/admin/packages/mcp-market` | MCP 服务审核和管理 |
| 技能管理 | `/admin/packages/skill-market` | 技能审核和管理 |

## API 路由

### 认证 API

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/github` - GitHub OAuth 授权
- `GET /api/auth/github/callback` - GitHub OAuth 回调

### 用户 API

- `GET /api/users/me` - 获取当前用户信息
- `GET /api/users/:username` - 获取用户公开信息
- `GET /api/users/me/api-keys` - 获取 API 密钥列表
- `POST /api/users/me/api-keys` - 创建 API 密钥
- `DELETE /api/users/me/api-keys/:id` - 删除 API 密钥
- `GET /api/users/me/favorites` - 获取收藏列表

### MCP 服务 API

- `GET /api/mcp` - 获取 MCP 列表
- `GET /api/mcp/:id` - 获取 MCP 详情
- `GET /api/mcp/search` - 搜索 MCP
- `GET /api/mcp/categories` - 获取分类列表
- `POST /api/mcp/:id/favorite` - 收藏/取消收藏
- `GET /api/mcp/:id/comments` - 获取评论
- `POST /api/mcp/:id/comments` - 发表评论
- `POST /api/mcp/:id/rating` - 评分

### 技能 API

- `GET /api/skill` - 获取技能列表
- `GET /api/skill/:id` - 获取技能详情
- `GET /api/skill/search` - 搜索技能
- `POST /api/skill/:id/favorite` - 收藏/取消收藏
- `GET /api/skill/:id/comments` - 获取评论
- `POST /api/skill/:id/comments` - 发表评论
- `POST /api/skill/:id/rating` - 评分

### 包管理 API

- `POST /api/packages/mcp` - 上传 MCP 包
- `GET /api/packages/mcp/:id/download` - 下载 MCP 包
- `POST /api/packages/skills` - 上传技能包
- `GET /api/packages/skills/:id/download` - 下载技能包
- `GET /api/packages/:id/releases` - 获取版本历史

### 合集 API

- `GET /api/collections` - 获取合集列表
- `GET /api/collections/:id` - 获取合集详情
- `POST /api/collections/:id/fork` - Fork 合集
- `POST /api/collections/:id/items` - 添加项目到合集
- `DELETE /api/collections/:id/items/:itemId` - 从合集移除项目

### 管理员 API

- `GET /api/admin/packages` - 获取待审核包列表
- `GET /api/admin/stats` - 获取统计数据
- `POST /api/admin/packages/:id/approve` - 审核通过
- `POST /api/admin/packages/:id/reject` - 审核拒绝
- `POST /api/admin/packages/:id/feature` - 设为精选

## 环境变量

复制 `.env.example` 到 `.env.local` 并配置：

```bash
cp .env.example .env.local
```

### 必需变量

| 变量 | 说明 |
|------|------|
| `POSTGRES_URL` | PostgreSQL 数据库连接字符串 |
| `JWE_SECRET` | 32 字节的 JWE 加密密钥 |
| `ENCRYPTION_KEY` | 32 字节的数据加密密钥 |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | GitHub OAuth 客户端 ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth 客户端密钥 |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth 客户端 ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 客户端密钥 |

### 可选变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `HF_TOKEN` | HuggingFace API Token | - |
| `HF_NAMESPACE` | HuggingFace 命名空间 | - |
| `NEXT_PUBLIC_APP_URL` | 应用 URL | `http://localhost:3000` |
| `NODE_ENV` | 环境 | `development` |

## 开发

### 环境要求

- Node.js 20+
- pnpm 9+
- PostgreSQL 数据库 (推荐使用 [Neon](https://neon.tech/))

### 安装依赖

```bash
# 在项目根目录
pnpm install
```

### 配置数据库

1. 创建 PostgreSQL 数据库
2. 配置 `POSTGRES_URL` 环境变量
3. 推送数据库 schema：

```bash
cd apps/web
pnpm db:push
```

### 启动开发服务器

```bash
# 在项目根目录
pnpm web:dev

# 或在 apps/web 目录
pnpm dev
```

开发服务器将在 `http://localhost:3000` 启动 (使用 Turbopack)。

### 数据库命令

```bash
# 推送 schema 变更 (交互式)
pnpm db:push

# 生成迁移文件
pnpm db:generate

# 运行迁移
pnpm db:migrate

# 打开 Drizzle Studio (数据库可视化)
pnpm db:studio
```

### 运行测试

```bash
# 运行测试
pnpm test

# 运行测试 (单次)
pnpm test:run

# 生成覆盖率报告
pnpm test:coverage
```

## 构建

```bash
pnpm build
```

## 部署

### 生产环境启动

```bash
pnpm start
```

### Vercel 部署

项目可直接部署到 Vercel，确保配置所有必需的环境变量。

## 项目结构

```
apps/web/
├── app/
│   ├── (admin)/       # 管理后台页面
│   ├── (auth)/        # 认证页面 (登录/注册)
│   ├── (dashboard)/   # 主要功能页面
│   ├── api/           # API 路由
│   ├── layout.tsx     # 根布局
│   ├── page.tsx       # 首页
│   └── globals.css    # 全局样式
├── components/
│   ├── ui/            # 基础 UI 组件
│   ├── shared/        # 共享组件
│   ├── skills/        # 技能相关组件
│   ├── collections/   # 合集相关组件
│   ├── publish/       # 发布相关组件
│   └── providers/     # Context Providers
├── lib/
│   ├── auth/          # 认证相关工具
│   ├── db/            # 数据库配置和 schema
│   │   ├── schema.ts  # Drizzle schema 定义
│   │   ├── migrations/# 迁移文件
│   │   └── index.ts   # 数据库连接
│   ├── services/      # 业务服务
│   ├── storage/       # 文件存储 (HuggingFace/本地)
│   └── validations/   # Zod 验证 schema
├── drizzle.config.ts  # Drizzle ORM 配置
├── next.config.ts     # Next.js 配置
└── package.json
```

## Assistant（助手）模块

AI 编码助手，从 [open-agents](https://github.com/vercel-labs/open-agents) 移植。

### 页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 会话列表 | `/assistant` | 查看和管理编码会话 |
| 对话页 | `/assistant/[sessionId]/[chatId]` | 核心 AI 对话界面 |
| CodeSpace | `/assistant/[sessionId]/codespace` | 代码空间 |
| 助手设置 | `/settings/assistant` | 模型、偏好、连接配置 |
| 用量统计 | `/settings/usage` | Token 消耗和费用估算 |
| 订阅管理 | `/settings/subscription` | 订阅计划管理 |

### Assistant 环境变量

```env
# GitHub App（代码仓库操作）
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
NEXT_PUBLIC_GITHUB_APP_SLUG=
GITHUB_WEBHOOK_SECRET=

# Vercel Sandbox（可选）
VERCEL_SANDBOX_BASE_SNAPSHOT_ID=

# Redis（Skills 缓存，可选）
REDIS_URL=

# ElevenLabs（语音转录，可选）
ELEVENLABS_API_KEY=

# 资源模式（hobby = Hobby 兼容）
OPEN_AGENTS_RESOURCE_PROFILE=hobby
```

详细文档：[docs/assistant/](./docs/assistant/README.md)

## 相关文档

- [Next.js 文档](https://nextjs.org/docs)
- [Drizzle ORM 文档](https://orm.drizzle.team/docs/overview)
- [Neon 文档](https://neon.tech/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
