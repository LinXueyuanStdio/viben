# @viben/core

Viben 平台的核心共享库,为 CLI 和桌面应用提供统一的底层能力。

## 概述

`@viben/core` 是 Viben 平台所有前端应用 (`apps/*`) 使用底层能力的唯一边界。它提供了配置管理、智能体服务、会话管理、Gateway 服务、MCP 集成和执行器系统等核心功能。

### 设计理念

- **File-Native 范式**: 所有配置使用 YAML 格式存储在 `~/.viben/` 目录,不依赖数据库
- **单例模式**: 核心管理器提供全局单例,确保状态一致性
- **模块化设计**: 各功能模块独立导出,支持按需加载
- **CLI 作为 MVP**: 命令行工具 `viben` 作为功能验证入口

## 安装

```bash
# npm
npm install @viben/core

# pnpm
pnpm add @viben/core

# yarn
yarn add @viben/core
```

## 核心模块

### 1. 配置管理 (Config)

管理全局配置、Provider 配置和 Model 配置。

```typescript
import {
  ConfigManager,
  configManager,
  ProvidersConfigManager,
  providersConfigManager,
  ModelsConfigManager,
  modelsConfigManager,
  // Git 风格配置管理
  GitStyleConfigManager,
  gitConfigManager,
} from "@viben/core";

// 初始化配置
await configManager.initialize();

// 读取/更新全局配置
const config = await configManager.load();
await configManager.update({ theme: "dark", locale: "zh-CN" });

// 获取/设置默认 Agent
const defaultAgent = await configManager.getDefaultAgent();
await configManager.setDefaultAgent("my-agent");

// 获取/设置默认 Provider
const defaultProvider = await configManager.getDefaultProvider();
await configManager.setDefaultProvider("anthropic");

// Git 风格配置管理 (类似 git config)
const value = await gitConfigManager.get("user.name");
await gitConfigManager.set("user.email", "test@example.com");
const all = await gitConfigManager.list();
```

### 2. 智能体管理 (Agent)

管理 AI 智能体的创建、配置和生命周期。

```typescript
import {
  AgentManager,
  agentManager,
  TemplateManager,
  templateManager,
  MemoryManager,
  memoryManager,
} from "@viben/core";

// 初始化
await agentManager.initialize();

// 列出所有智能体
const agents = await agentManager.listAgents();

// 创建智能体
const agent = await agentManager.createAgent({
  name: "代码助手",
  description: "帮助编写和审查代码",
  model: "claude-sonnet-4-20250514",
  provider: "anthropic",
  executorType: "CLAUDE_CODE",
  systemPrompt: "你是一个专业的代码助手...",
});

// 获取智能体
const myAgent = await agentManager.getAgent("code-assistant");

// 更新智能体
await agentManager.updateAgent("code-assistant", {
  temperature: 0.7,
  maxTokens: 4096,
});

// 删除智能体
await agentManager.removeAgent("code-assistant");

// 设置默认智能体
await agentManager.setDefault("code-assistant");

// 模板管理
const templates = await templateManager.list();
await templateManager.create({
  name: "通用助手模板",
  systemPrompt: "...",
});

// 记忆管理
const memory = await memoryManager.getMemory("agent-id");
await memoryManager.appendMemory("agent-id", "新的学习内容...");
```

### 3. Provider 管理

管理 AI 服务提供商配置。

```typescript
import {
  ProviderManager,
  providerManager,
  DEFAULT_BASE_URLS,
  ENV_VAR_NAMES,
} from "@viben/core";

// 列出所有 Provider
const providers = await providerManager.listProviders();

// 创建 Provider
const provider = await providerManager.createProvider({
  type: "anthropic",
  name: "Anthropic",
  apiKey: "sk-ant-...",
  setAsDefault: true,
});

// 获取 Provider
const anthropic = await providerManager.getProvider("anthropic");

// 更新 Provider
await providerManager.updateProvider("anthropic", {
  apiKey: "new-api-key",
});

// 检查连接状态
const status = await providerManager.checkStatus("anthropic");

// 启用/禁用 Provider
await providerManager.setEnabled("anthropic", true);
```

支持的 Provider 类型:
- `openai` - OpenAI API
- `anthropic` - Anthropic Claude
- `azure` - Azure OpenAI
- `ollama` - 本地 Ollama
- `openrouter` - OpenRouter
- `google` - Google AI (Gemini)
- `custom` - 自定义 API 端点

### 4. Model 管理

管理 AI 模型配置和别名。

```typescript
import {
  ModelManager,
  modelManager,
  KNOWN_MODELS,
  DEFAULT_ALIASES,
  getKnownModel,
  // 模型发现
  discoverModels,
  discoverAllModels,
} from "@viben/core";

// 列出所有模型
const models = await modelManager.listModels();

// 获取特定 Provider 的模型
const anthropicModels = await modelManager.getModelsByProvider("anthropic");

// 创建自定义模型
const customModel = await modelManager.createModel({
  id: "my-custom-model",
  name: "自定义模型",
  provider: "openai",
  contextWindow: 8192,
  maxOutputTokens: 4096,
});

// 设置默认模型
await modelManager.setDefault("claude-sonnet-4-20250514");

// 别名管理
await modelManager.createAlias("sonnet", "claude-sonnet-4-20250514");
const resolvedModel = await modelManager.resolveAlias("sonnet");

// 设置 Fallback 链
await modelManager.setFallbacks([
  "claude-sonnet-4-20250514",
  "gpt-4o",
  "gemini-2.0-flash",
]);

// 模型发现 (从 Provider API 获取可用模型)
const discovered = await discoverModels("anthropic", apiKey);
```

### 5. 会话存储 (SessionStore)

管理智能体会话的持久化存储。

```typescript
import {
  SessionStoreService,
  sessionStoreService,
  createSessionConfig,
  createUserMessage,
  createAssistantMessage,
} from "@viben/core";

// 创建会话
const sessionConfig = createSessionConfig({
  id: "session-123",
  agentId: "my-agent",
  prompt: "帮我写一个 React 组件",
});
await sessionStoreService.saveSessionConfig(sessionConfig);

// 追加消息
await sessionStoreService.appendUIMessage("my-agent", "session-123", {
  id: "msg-1",
  type: "user",
  content: "帮我写一个按钮组件",
  timestamp: new Date().toISOString(),
});

// 读取会话消息
const messages = await sessionStoreService.readUIMessages("my-agent", "session-123");

// 获取会话统计
const stats = await sessionStoreService.getSessionStats("my-agent", "session-123");

// 列出所有会话
const sessions = await sessionStoreService.listSessions("my-agent");
```

### 6. Gateway 服务

HTTP/WebSocket 服务器,提供 REST API 和 SSE 事件流。

```typescript
import { createGateway, runGateway } from "@viben/core/gateway";

// 创建 Gateway 实例
const app = await createGateway({
  host: "127.0.0.1",
  port: 18790,
  cors: true,
  telemetry: true,
});

// 运行 Gateway
await runGateway({
  host: "127.0.0.1",
  port: 18790,
});
```

Gateway API 端点:
- `GET /health` - 健康检查
- `GET /api/agents` - 列出智能体
- `GET /api/sessions` - 列出会话
- `GET /api/tasks` - 列出任务
- `GET /api/cron` - 列出定时任务
- `GET /api/events` - SSE 事件流
- `WS /ws` - WebSocket 连接

### 7. MCP 集成

管理 Model Context Protocol 服务器。

```typescript
import { McpManager, mcpManager } from "@viben/core";

// 初始化
await mcpManager.initialize();

// 获取智能体的 MCP 服务器
const servers = await mcpManager.getAgentServers("my-agent");

// 添加 MCP 服务器
await mcpManager.setAgentServer("my-agent", {
  name: "filesystem",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
  enabled: true,
});

// 移除 MCP 服务器
await mcpManager.removeAgentServer("my-agent", "filesystem");

// 列出已安装的共享 MCP
const installed = await mcpManager.listInstalled();
```

### 8. 执行器系统 (Executors)

管理各种 AI 编码智能体执行器。

```typescript
import {
  createExecutor,
  EXECUTOR_TYPES,
  getAllExecutorsAvailability,
  // 具体执行器
  ClaudeCode,
  createClaudeCode,
  Gemini,
  createGemini,
  Codex,
  createCodex,
  // Chat 模式
  spawnChat,
  executorSupportsChat,
} from "@viben/core";

// 创建执行器
const claudeExecutor = createExecutor("CLAUDE_CODE", {
  workspacePath: "/path/to/workspace",
});

// 检查可用性
const availability = claudeExecutor.getAvailabilityInfo();
console.log(availability.status); // "LOGIN_DETECTED" | "INSTALLATION_FOUND" | "NOT_FOUND"

// 获取所有执行器可用性
const allAvailability = getAllExecutorsAvailability();

// 非交互式 Chat 模式
if (executorSupportsChat("CLAUDE_CODE")) {
  const result = await spawnChat("CLAUDE_CODE", {
    prompt: "帮我分析这段代码",
    cwd: "/path/to/project",
    format: "stream-json",
  });
}
```

支持的执行器类型:
- `CLAUDE_CODE` - Anthropic Claude Code
- `AMP` - Amp AI 助手
- `GEMINI` - Google Gemini
- `CODEX` - OpenAI Codex
- `OPENCODE` - 开源编码助手
- `CURSOR_AGENT` - Cursor AI
- `QWEN_CODE` - 阿里通义千问
- `COPILOT` - GitHub Copilot
- `DROID` - Droid AI

#### Executor 类型详细对比

下表列出了所有支持的 Executor 类型及其特性：

| Executor ID | CLI 命令 | 安装方式 | 认证方式 | Chat 支持 | 能力列表 |
|------------|----------|---------|---------|----------|---------|
| `CLAUDE_CODE` | `claude` | `npx -y @anthropic-ai/claude-code@latest` | `~/.claude.json` | ✅ | SESSION_FORK, CONTEXT_USAGE |
| `AMP` | `amp` | 官方安装器 | `~/.amp/config.json` | ❌ | SESSION_FORK |
| `GEMINI` | `gemini` | 官方安装器 | `~/.gemini/config.json` | ✅ | SESSION_FORK |
| `CODEX` | `codex` | `npx -y codex-cli@latest` | `~/.config/codex/config.json` | ✅ | SESSION_FORK, SETUP_HELPER, CONTEXT_USAGE |
| `OPENCODE` | `opencode` | 官方安装器 | `~/.opencode/config.json` | ❌ | SESSION_FORK, CONTEXT_USAGE |
| `CURSOR_AGENT` | `cursor` | Cursor IDE 内置 | Cursor 配置 | ❌ | SETUP_HELPER |
| `QWEN_CODE` | `qwen-code` | 官方安装器 | `~/.qwen-code/config.json` | ❌ | SESSION_FORK |
| `COPILOT` | `gh copilot` | GitHub CLI 扩展 | GitHub 认证 | ❌ | 无 |
| `DROID` | `droid` | 官方安装器 | `~/.droid/config.json` | ❌ | SESSION_FORK |

**能力说明**：
- `SESSION_FORK` - 支持 session 分支和恢复
- `CONTEXT_USAGE` - 支持上下文使用量追踪
- `SETUP_HELPER` - 提供设置和配置辅助

**Chat 支持说明**：
- ✅ 表示支持非交互式 Chat 模式（通过 `viben executor chat` 命令）
- ❌ 表示仅支持交互式会话模式

### 9. 工作区管理 (Workspace)

管理 Viben 工作区的创建和配置。

```typescript
import {
  WorkspaceManager,
  workspaceManager,
  initWorkspace,
  WORKSPACE_DIR,
  WORKSPACE_CONFIG_FILE,
} from "@viben/core";

// 初始化工作区
const result = await initWorkspace({
  targetDir: "/path/to/project",
  name: "我的项目",
});

// 检测当前工作区
const currentWorkspace = await workspaceManager.getCurrentWorkspace();

// 列出所有已知工作区
const workspaces = await workspaceManager.listWorkspaces();

// 获取工作区信息
const info = await workspaceManager.getWorkspaceInfo("/path/to/project");

// 注册/取消注册工作区
await workspaceManager.registerWorkspace("/path/to/project", "项目名称");
await workspaceManager.unregisterWorkspace("/path/to/project");
```

### 10. 通知渠道 (Channels)

管理消息通知渠道。

```typescript
import {
  ChannelManager,
  channelManager,
  sendChannelMessage,
  testChannel,
  // 具体渠道
  sendTelegramMessage,
  sendDiscordMessage,
  sendFeishuMessage,
  sendSlackMessage,
  sendWebhookMessage,
} from "@viben/core";

// 创建渠道
await channelManager.createChannel({
  type: "telegram",
  name: "我的 Telegram",
  config: {
    botToken: "...",
    chatId: "...",
  },
});

// 发送消息
const result = await sendChannelMessage(channelConfig, {
  chatId: "123456",
  message: "任务完成!",
});

// 测试渠道
const testResult = await testChannel(channelConfig);
```

支持的渠道类型:
- `telegram` - Telegram Bot
- `discord` - Discord Webhook
- `feishu` - 飞书机器人
- `slack` - Slack App
- `whatsapp` - WhatsApp Business API
- `webhook` - 自定义 Webhook

### 11. 定时任务 (Cron)

管理定时执行的任务。

```typescript
import { CronService } from "@viben/core";

const cronService = new CronService();

// 启动调度器
await cronService.start();

// 创建定时任务
const job = await cronService.createJob({
  name: "每日代码审查",
  schedule: "0 9 * * *", // 每天早上 9 点
  type: "agent",
  config: {
    agentId: "code-reviewer",
    prompt: "检查昨天的代码提交",
  },
});

// 列出所有任务
const jobs = await cronService.listJobs();

// 暂停/恢复任务
await cronService.pauseJob(job.id);
await cronService.resumeJob(job.id);

// 关闭调度器
await cronService.shutdown();
```

### 12. 服务管理 (Service Manager)

管理后台服务进程。

```typescript
import { ServiceManager, serviceManager } from "@viben/core";

// 初始化
await serviceManager.initialize();

// 启动服务
await serviceManager.startService("gateway", {
  port: 18790,
});

// 获取服务状态
const status = await serviceManager.getStatus("gateway");

// 停止服务
await serviceManager.stopService("gateway");

// 监听服务日志
await serviceManager.watchLogs("gateway", {
  onData: (data) => console.log(data),
});
```

## CLI 使用

`@viben/core` 提供 `viben` 命令行工具:

```bash
# 初始化工作区
viben init

# 智能体管理
viben agent list
viben agent create --name "助手" --model "claude-sonnet-4-20250514"
viben agent run my-agent "帮我写代码"

# Provider 管理
viben provider list
viben provider add anthropic --api-key "sk-ant-..."

# Model 管理
viben model list
viben model alias sonnet claude-sonnet-4-20250514

# Gateway 服务
viben gateway start
viben gateway status
viben gateway stop

# 工作区管理
viben workspace list
viben workspace info

# MCP 服务器
viben mcp list
viben mcp add filesystem --command "npx" --args "-y @modelcontextprotocol/server-filesystem /path"

# 定时任务
viben cron list
viben cron create --name "daily-review" --schedule "0 9 * * *"

# 配置管理 (Git 风格)
viben config --list
viben config user.name "John"
viben config --get user.name
```

## 配置文件格式

所有配置存储在 `~/.viben/` 目录:

```
~/.viben/
├── config.yaml              # 全局配置
├── providers.yaml           # Provider 配置
├── models.yaml              # Model 配置
├── channels.yaml            # 通知渠道配置
├── workspaces.yaml          # 已知工作区列表
├── agents/                  # 智能体目录
│   └── <agent-id>/
│       ├── config.yaml      # 智能体配置
│       ├── mcp_servers.json # MCP 服务器配置
│       ├── memory/          # 智能体记忆
│       │   ├── CLAUDE.md    # 长期记忆
│       │   └── logs/        # 日志
│       └── .agent_sessions/ # 会话数据
│           └── <session-id>/
│               ├── config.yaml
│               ├── messages.ui.jsonl
│               ├── messages.rollout.jsonl
│               └── messages.agent.jsonl
├── agent-templates/         # 智能体模板
├── mcp/                     # 共享 MCP 服务器
├── skills/                  # 共享技能
└── templates/
    └── workspace/           # 工作区模板
```

### config.yaml

```yaml
# 全局配置
theme: system        # light | dark | system
locale: zh-CN
defaultAgent: my-agent
defaultProvider: anthropic
defaultModel: claude-sonnet-4-20250514
```

### providers.yaml

```yaml
default: anthropic
providers:
  anthropic:
    provider_type: anthropic
    name: Anthropic
    api_key: sk-ant-...
    base_url: https://api.anthropic.com
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
  openai:
    provider_type: openai
    name: OpenAI
    api_key: sk-...
    enabled: true
```

### models.yaml

```yaml
default: claude-sonnet-4-20250514
aliases:
  sonnet: claude-sonnet-4-20250514
  opus: claude-opus-4-20250514
  haiku: claude-3-5-haiku-20241022
  gpt4: gpt-4o
fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4o
  - gemini-2.0-flash
configs:
  claude-sonnet-4-20250514:
    temperature: 0.7
    maxTokens: 4096
custom_models: {}
disabled_models: []
```

### 智能体 config.yaml

```yaml
name: 代码助手
description: 帮助编写和审查代码
model: claude-sonnet-4-20250514
provider: anthropic
systemPrompt: |
  你是一个专业的代码助手,擅长:
  - 代码编写和优化
  - 代码审查
  - 技术问题解答
temperature: 0.7
maxTokens: 4096
executorType: CLAUDE_CODE
mcpServers:
  - filesystem
skills:
  - code-review
planMode: false
approvals: false
createdAt: "2024-01-01T00:00:00Z"
updatedAt: "2024-01-01T00:00:00Z"
```

## API 概览

### 导出入口

```typescript
// 主入口
import { ... } from "@viben/core";

// 子模块
import { ... } from "@viben/core/shared";
import { ... } from "@viben/core/agents";
import { ... } from "@viben/core/providers";
import { ... } from "@viben/core/models";
import { ... } from "@viben/core/config";
import { ... } from "@viben/core/cli";
```

### 初始化

```typescript
import { initializeCore } from "@viben/core";

// 一次性初始化所有核心管理器
await initializeCore();
```

### 错误类型

```typescript
import {
  VibenError,
  NotFoundError,
  AlreadyExistsError,
  ValidationError,
  ExecutorError,
  DatabaseError,
  CronError,
  SessionStoreError,
  GatewayError,
  ServiceError,
} from "@viben/core";
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VIBEN_STATE_DIR` | 配置目录路径 | `~/.viben` |
| `VIBEN_TELEMETRY` | 是否启用遥测 | `true` |
| `LOG_LEVEL` | 日志级别 | `info` |

## 许可证

MIT
