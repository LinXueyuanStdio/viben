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
// 注意：使用 createChatProxy 替代已废弃的 spawnChat
import { createChatProxy } from "@viben/core";

if (executorSupportsChat("CLAUDE_CODE")) {
  const proxy = createChatProxy("CLAUDE_CODE");
  const result = await proxy.execute({
    prompt: "帮我分析这段代码",
    cwd: "/path/to/project",
    outputFormat: "text",
  });
  console.log(`Exit code: ${result.exitCode}`);
}
```

#### 执行器可用性检测

每个执行器都提供 `getAvailabilityInfo()` 方法来检测其安装和登录状态。该方法返回 `AvailabilityInfo` 对象,包含以下信息：

```typescript
interface AvailabilityInfo {
  status: AvailabilityStatus;    // 可用性状态
  lastAuthTimestamp?: number;    // 最后认证时间戳(仅 LOGIN_DETECTED)
  path?: string;                 // 可执行文件路径(如果找到)
}

type AvailabilityStatus =
  | "LOGIN_DETECTED"      // 已检测到登录(已认证)
  | "INSTALLATION_FOUND"  // 仅检测到安装(未认证)
  | "NOT_FOUND";          // 未找到安装
```

**三种状态说明**：

1. **`LOGIN_DETECTED`** - 已检测到登录
   - 执行器已安装且用户已完成认证
   - 可以直接使用执行器的所有功能
   - 包含 `lastAuthTimestamp` 和 `path` 信息

2. **`INSTALLATION_FOUND`** - 仅检测到安装
   - 执行器已安装但用户尚未登录
   - 需要用户完成认证流程后才能使用
   - 包含 `path` 信息,但没有 `lastAuthTimestamp`

3. **`NOT_FOUND`** - 未找到安装
   - 系统中未安装该执行器
   - 需要用户先安装执行器

**检测逻辑示例** (以 Claude Code 为例)：

```typescript
getAvailabilityInfo(): AvailabilityInfo {
  const authFile = join(homedir(), ".claude.json");
  const execPath = whichSync("claude");

  // 1. 检查认证文件存在 → LOGIN_DETECTED
  if (existsSync(authFile)) {
    return {
      status: "LOGIN_DETECTED",
      lastAuthTimestamp: Date.now(),
      path: execPath ?? undefined,
    };
  }

  // 2. 检查可执行文件存在 → INSTALLATION_FOUND
  if (execPath) {
    return {
      status: "INSTALLATION_FOUND",
      path: execPath,
    };
  }

  // 3. 都不存在 → NOT_FOUND
  return { status: "NOT_FOUND" };
}
```

**使用示例**：

```typescript
import { createExecutor } from "@viben/core";

const executor = createExecutor("CLAUDE_CODE");
const availability = executor.getAvailabilityInfo();

switch (availability.status) {
  case "LOGIN_DETECTED":
    console.log("✅ Claude Code 已就绪,可以使用");
    console.log(`路径: ${availability.path}`);
    console.log(`认证时间: ${new Date(availability.lastAuthTimestamp!)}`);
    break;

  case "INSTALLATION_FOUND":
    console.log("⚠️ Claude Code 已安装但未登录");
    console.log(`路径: ${availability.path}`);
    console.log("请运行 'claude login' 完成认证");
    break;

  case "NOT_FOUND":
    console.log("❌ 未找到 Claude Code");
    console.log("请访问 https://claude.ai 安装 Claude Code");
    break;
}
```

#### Chat 模式使用示例

Chat 模式支持两种数据格式：`text` (纯文本) 和 `stream-json` (JSON 流)。

##### 1. 纯文本格式 (text)

适用于简单的文本交互场景。

```typescript
import { createChatProxy, executorSupportsChat } from "@viben/core";

// 检查执行器是否支持 Chat 模式
if (!executorSupportsChat("CLAUDE_CODE")) {
  throw new Error("Executor does not support chat mode");
}

// 创建 Chat 代理
const chatProxy = createChatProxy("CLAUDE_CODE", false);

// 执行纯文本格式的 Chat
const result = await chatProxy.execute({
  prompt: "帮我写一个 TypeScript 函数来计算斐波那契数列",
  cwd: process.cwd(),
  inputFormat: "text",
  outputFormat: "text",
  verbose: true,
});

console.log(`Chat completed with exit code: ${result.exitCode}`);
if (result.sessionId) {
  console.log(`Session ID: ${result.sessionId}`);
}
```

##### 2. JSON 流格式 (stream-json)

适用于需要结构化数据的程序化场景，支持实时解析 SSE 事件流。

```typescript
import { createChatProxy } from "@viben/core";

const chatProxy = createChatProxy("CLAUDE_CODE", false);

// 执行 JSON 流格式的 Chat
const result = await chatProxy.execute({
  prompt: "分析这个项目的架构并给出改进建议",
  cwd: "/path/to/project",
  inputFormat: "stream-json",
  outputFormat: "stream-json",
  sessionId: "custom-session-123",
  model: "claude-sonnet-4-20250514",
  dangerouslySkipPermissions: false,
});

console.log(`Chat completed with exit code: ${result.exitCode}`);
```

**stream-json 格式说明**：

- **输入格式**：通过 stdin 发送 JSON 行，每行一个事件
  ```json
  {"type":"user","message":{"role":"user","content":"分析代码"}}
  ```

- **输出格式**：接收 SSE (Server-Sent Events) 格式的 JSON 流
  ```
  data: {"type":"text","content":"正在分析代码..."}

  data: {"type":"tool_use","name":"read_file","input":{"path":"src/main.ts"}}

  data: {"type":"result","exitCode":0,"sessionId":"abc123"}
  ```

##### 3. 恢复已有 Session

```typescript
import { createChatProxy } from "@viben/core";

const chatProxy = createChatProxy("CLAUDE_CODE");

// 恢复之前的会话并继续对话
const result = await chatProxy.execute({
  prompt: "继续上面的工作",
  resume: "previous-session-id",
  cwd: "/path/to/project",
});
```

##### 4. SDK 模式 vs Spawn 模式

Chat 代理支持两种执行策略：

- **SDK 模式** (`preferSdk: true`, 默认): 使用 Anthropic SDK 直接调用 API，支持更高级的功能（仅 CLAUDE_CODE）
- **Spawn 模式** (`preferSdk: false`): 通过子进程调用 CLI 命令，与命令行体验完全一致

```typescript
import { createChatProxy, isSdkAvailable } from "@viben/core";

// 检查 SDK 是否可用
if (isSdkAvailable("CLAUDE_CODE")) {
  // 使用 SDK 模式（推荐）
  const sdkProxy = createChatProxy("CLAUDE_CODE", true);
  await sdkProxy.execute({ prompt: "你好" });
} else {
  // 降级到 Spawn 模式
  const spawnProxy = createChatProxy("CLAUDE_CODE", false);
  await spawnProxy.execute({ prompt: "你好" });
}
```

**差异对比**：

| 特性 | SDK 模式 | Spawn 模式 |
|------|---------|-----------|
| 可用性 | 仅 CLAUDE_CODE | 所有支持 Chat 的执行器 |
| 性能 | 更快（直接 API 调用） | 较慢（需启动子进程） |
| 功能 | 支持高级特性（如流式解析） | 基础功能 |
| 依赖 | 需要 @anthropic-ai/sdk | 需要安装对应 CLI |
| IO 处理 | 程序化处理 | 继承父进程 stdio |
| 推荐场景 | 生产环境、自动化 | 开发调试、CLI 使用 |

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

#### Executor 能力详解

Viben 定义了三种核心 Executor 能力，不同的 Executor 根据其底层 CLI 的特性支持不同的能力组合：

| 能力 | 说明 | 使用场景 |
|------|------|---------|
| **SESSION_FORK** | 支持从已有会话的某个消息节点创建分支，实现多路径对话探索 | 适用于需要从历史对话中某个决策点重新开始，探索不同解决方案的场景 |
| **CONTEXT_USAGE** | 能够追踪和报告 Token 使用量、上下文窗口占用等统计信息 | 用于成本控制、性能优化和配额管理，帮助用户了解 AI 调用的资源消耗 |
| **SETUP_HELPER** | 提供交互式设置向导，辅助用户完成初始配置（API Key、偏好设置等） | 简化首次使用体验，通过 CLI 引导用户完成必要的配置步骤 |

#### Executor 能力支持矩阵

| Executor | SESSION_FORK | CONTEXT_USAGE | SETUP_HELPER | 能力总览 |
|----------|--------------|---------------|--------------|---------|
| `CLAUDE_CODE` | ✅ | ✅ | ❌ | 支持会话分支和上下文追踪 |
| `CODEX` | ✅ | ✅ | ✅ | **全能力支持**，提供完整的会话管理和配置辅助 |
| `OPENCODE` | ✅ | ✅ | ❌ | 支持会话分支和上下文追踪 |
| `CURSOR_AGENT` | ❌ | ❌ | ✅ | 仅提供配置辅助功能 |
| `AMP` | ✅ | ❌ | ❌ | 仅支持会话分支 |
| `GEMINI` | ✅ | ❌ | ❌ | 仅支持会话分支 |
| `QWEN_CODE` | ✅ | ❌ | ❌ | 仅支持会话分支 |
| `DROID` | ✅ | ❌ | ❌ | 仅支持会话分支 |
| `COPILOT` | ❌ | ❌ | ❌ | 无额外能力支持 |

**能力说明**：
- `SESSION_FORK` - 支持 session 分支和恢复，允许从历史对话的任意消息节点创建新的对话分支
- `CONTEXT_USAGE` - 支持上下文使用量追踪，提供 Token 消耗、上下文窗口占用等统计数据
- `SETUP_HELPER` - 提供设置和配置辅助，通过交互式向导帮助用户完成初始配置

**Chat 支持说明**：
- ✅ 表示支持非交互式 Chat 模式（通过 `viben executor chat` 命令）
- ❌ 表示仅支持交互式会话模式

#### Executor 安装指南

每个 Executor 需要单独安装。以下是各 Executor 的安装方式和前置条件：

##### CLAUDE_CODE (Anthropic Claude Code)

**安装方式**：
```bash
# 方式一：通过 npx 自动安装（推荐）
npx -y @anthropic-ai/claude-code@latest --version

# 方式二：全局安装
npm install -g @anthropic-ai/claude-code
```

**前置条件**：
- Node.js 18.0.0 或更高版本
- Anthropic API Key（从 https://console.anthropic.com/ 获取）

**认证配置**：
```bash
# 首次运行时会自动提示登录
claude
# 或者手动配置
export ANTHROPIC_API_KEY="sk-ant-..."
```

**配置文件位置**：`~/.claude.json`

**验证安装**：
```bash
claude --version
```

---

##### AMP (Sourcegraph Amp)

**安装方式**：
```bash
# macOS
brew install sourcegraph/amp/amp

# Linux
curl -fsSL https://sourcegraph.com/.api/get-amp | sh

# Windows
# 下载安装器：https://about.sourcegraph.com/amp
```

**前置条件**：
- 无需 API Key（使用 Sourcegraph 账号）

**认证配置**：
```bash
# 首次运行时会打开浏览器登录
amp auth login
```

**配置文件位置**：`~/.amp/config.json`

**验证安装**：
```bash
amp --version
```

---

##### GEMINI (Google Gemini CLI)

**安装方式**：
```bash
# 通过 pip 安装（Python 3.8+）
pip install google-generativeai-cli

# 或通过 npm 安装
npm install -g @google/generativeai-cli
```

**前置条件**：
- Google Cloud 项目
- Gemini API Key（从 https://makersuite.google.com/app/apikey 获取）

**认证配置**：
```bash
# 设置 API Key
export GOOGLE_API_KEY="your-api-key"

# 或使用 gcloud 认证
gcloud auth application-default login
```

**配置文件位置**：`~/.gemini/config.json`

**验证安装**：
```bash
gemini --version
```

---

##### CODEX (OpenAI Codex CLI)

**安装方式**：
```bash
# 通过 npx 安装
npx -y codex-cli@latest --version

# 或全局安装
npm install -g codex-cli
```

**前置条件**：
- OpenAI API Key（从 https://platform.openai.com/api-keys 获取）
- Codex 模型访问权限

**认证配置**：
```bash
# 设置 API Key
export OPENAI_API_KEY="sk-..."

# 或通过命令配置
codex config set api-key "sk-..."
```

**配置文件位置**：`~/.config/codex/config.json`

**验证安装**：
```bash
codex --version
```

---

##### OPENCODE (开源 Coding Agent)

**安装方式**：
```bash
# 通过 pip 安装
pip install opencode-cli

# 或从源码构建
git clone https://github.com/opencode-ai/opencode
cd opencode && pip install -e .
```

**前置条件**：
- Python 3.9 或更高版本
- 支持 OpenAI 兼容 API 的模型（本地或远程）

**认证配置**：
```bash
# 配置 API 端点
opencode config set api-url "https://api.openai.com/v1"
opencode config set api-key "sk-..."
```

**配置文件位置**：`~/.opencode/config.json`

**验证安装**：
```bash
opencode --version
```

---

##### CURSOR_AGENT (Cursor IDE)

**安装方式**：
- 下载 Cursor IDE：https://cursor.sh/
- Cursor IDE 内置 Agent 功能，无需单独安装 CLI

**前置条件**：
- Cursor IDE 安装
- Cursor 账号（支持 GitHub 登录）

**认证配置**：
- 在 Cursor IDE 中登录账号即可

**配置文件位置**：
- macOS: `~/Library/Application Support/Cursor/User/settings.json`
- Linux: `~/.config/Cursor/User/settings.json`
- Windows: `%APPDATA%\Cursor\User\settings.json`

**验证安装**：
```bash
# Cursor CLI（如果已安装）
cursor --version
```

---

##### QWEN_CODE (阿里通义千问)

**安装方式**：
```bash
# 通过 pip 安装（官方推荐）
pip install qwen-code-cli
```

**前置条件**：
- 阿里云账号
- 通义千问 API Key（从 https://dashscope.aliyun.com/ 获取）

**认证配置**：
```bash
# 设置 API Key
export DASHSCOPE_API_KEY="sk-..."

# 或通过命令配置
qwen-code config set api-key "sk-..."
```

**配置文件位置**：`~/.qwen-code/config.json`

**验证安装**：
```bash
qwen-code --version
```

---

##### COPILOT (GitHub Copilot)

**安装方式**：
```bash
# 安装 GitHub CLI
brew install gh  # macOS
# 或其他平台：https://cli.github.com/

# 安装 Copilot 扩展
gh extension install github/gh-copilot
```

**前置条件**：
- GitHub 账号
- GitHub Copilot 订阅（付费或学生免费）

**认证配置**：
```bash
# 登录 GitHub
gh auth login

# 验证 Copilot 访问权限
gh copilot --version
```

**配置文件位置**：使用 GitHub CLI 的认证配置

**验证安装**：
```bash
gh copilot --version
```

---

##### DROID (Droid AI)

**安装方式**：
```bash
# 通过官方安装脚本
curl -fsSL https://droid.ai/install.sh | sh

# 或通过 npm
npm install -g @droid/cli
```

**前置条件**：
- Droid 账号
- 支持的 LLM API（OpenAI、Anthropic 等）

**认证配置**：
```bash
# 首次运行时会提示登录
droid auth login

# 配置 LLM API
droid config set provider openai
droid config set api-key "sk-..."
```

**配置文件位置**：`~/.droid/config.json`

**验证安装**：
```bash
droid --version
```

---

**注意事项**：

1. **API Key 安全**：不要在代码中硬编码 API Key，使用环境变量或配置文件
2. **网络要求**：某些 Executor（如 Gemini、Claude）需要访问国际网络
3. **模型选择**：不同 Executor 支持的模型列表不同，请参考各自文档
4. **费用说明**：大部分 API 服务按使用量计费，请注意控制成本
5. **Viben 发现机制**：Viben 会自动检测已安装的 Executor，无需手动注册

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
