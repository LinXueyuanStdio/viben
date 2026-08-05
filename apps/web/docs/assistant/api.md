# Assistant API 路由参考

## 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 创建对话消息，启动 Agent |
| GET | `/api/chat/[chatId]/stream` | SSE 流式接收 Agent 响应 |
| POST | `/api/chat/[chatId]/stop` | 停止 Agent 执行 |

## 会话

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 获取用户会话列表 |
| POST | `/api/sessions` | 创建新会话 |
| GET | `/api/sessions/[sessionId]` | 获取单个会话 |
| PATCH | `/api/sessions/[sessionId]` | 更新会话 |
| DELETE | `/api/sessions/[sessionId]` | 删除会话 |
| GET | `/api/sessions/[sessionId]/chats` | 获取会话下的对话列表 |
| POST | `/api/sessions/[sessionId]/chats` | 创建新对话 |
| PATCH | `/api/sessions/[sessionId]/chats/[chatId]` | 更新对话 |
| DELETE | `/api/sessions/[sessionId]/chats/[chatId]` | 删除对话 |
| GET | `/api/sessions/[sessionId]/chats/[chatId]/messages` | 获取对话消息 |
| POST | `/api/sessions/[sessionId]/chats/[chatId]/read` | 标记已读 |
| POST | `/api/sessions/[sessionId]/chats/[chatId]/share` | 创建分享链接 |
| DELETE | `/api/sessions/[sessionId]/chats/[chatId]/share` | 删除分享 |
| POST | `/api/sessions/[sessionId]/chats/[chatId]/fork` | 分叉对话 |

## 文件与 Diff

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions/[sessionId]/files` | 列出工作区文件 |
| GET | `/api/sessions/[sessionId]/files/content` | 读取文件内容 |
| GET | `/api/sessions/[sessionId]/diff` | 获取代码变更 |
| GET | `/api/sessions/[sessionId]/diff/patch` | 获取 patch 格式 |
| GET | `/api/sessions/[sessionId]/diff/cached` | 获取缓存 diff |

## Sandbox

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sandbox` | 创建 Sandbox |
| GET | `/api/sandbox/status` | 查询 Sandbox 状态 |
| POST | `/api/sandbox/activity` | 更新活动时间 |
| POST | `/api/sandbox/extend` | 延长生命周期 |
| POST | `/api/sandbox/reconnect` | 重连 Sandbox |
| POST | `/api/sandbox/snapshot` | 创建快照 |

## GitHub

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/github/user` | GitHub 用户信息 |
| GET | `/api/github/connection-status` | 连接状态 |
| GET | `/api/github/installations` | 安装列表 |
| GET | `/api/github/installations/repos` | 安装的仓库 |
| GET | `/api/github/branches` | 仓库分支列表 |
| POST | `/api/github/create-repo` | 创建仓库 |
| GET | `/api/github/orgs` | 组织列表 |
| POST | `/api/github/webhook` | Webhook 处理 |
| GET | `/api/github/app/callback` | GitHub App OAuth 回调 |

## 模型与设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/models` | 获取可用模型列表 |
| GET | `/api/settings/preferences` | 获取用户偏好 |
| PUT | `/api/settings/preferences` | 更新用户偏好 |
| GET | `/api/settings/model-variants` | 获取模型变体 |
| PUT | `/api/settings/model-variants` | 更新模型变体 |

## 用量

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/usage` | 获取个人用量数据 |
| GET | `/api/usage/rank` | 获取用量排名 |

## 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/generate-pr` | AI 生成 PR 描述 |
| POST | `/api/generate-title` | AI 生成会话标题 |
| POST | `/api/transcribe` | 语音转录（ElevenLabs） |
| GET | `/api/shared/[shareId]/status` | 分享状态 |
| GET | `/api/shared/[shareId]/markdown` | 分享 Markdown 导出 |

所有 API 使用 viben cookie-based session 认证。
