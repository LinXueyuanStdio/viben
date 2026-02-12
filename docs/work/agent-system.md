# WorkAny 智能体系统实现

## 概述

WorkAny 的智能体系统采用插件化架构，支持多种 AI 提供者 (Claude, Codex, DeepAgents)，通过统一的 `IAgent` 接口进行抽象。

## 核心接口

### IAgent 接口

**文件**: [`workany/src-api/src/core/agent/types.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/core/agent/types.ts) 行 184-218

```typescript
interface IAgent {
  /** 提供者名称 */
  readonly provider: AgentProvider;

  /** 直接执行模式 */
  run(prompt: string, options?: AgentOptions): AsyncGenerator<AgentMessage>;

  /** 规划阶段 (仅返回计划) */
  plan(prompt: string, options?: PlanOptions): AsyncGenerator<AgentMessage>;

  /** 执行已批准的计划 */
  execute(options: ExecuteOptions): AsyncGenerator<AgentMessage>;

  /** 停止执行 */
  stop(sessionId: string): Promise<void>;

  /** 获取存储的计划 */
  getPlan(planId: string): TaskPlan | undefined;

  /** 删除存储的计划 */
  deletePlan(planId: string): void;
}
```

### AgentProvider 类型

```typescript
type AgentProvider = 'claude' | 'codex' | 'deepagents' | 'custom';
```

---

## Agent Service 服务层

**文件**: [`workany/src-api/src/shared/services/agent.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/shared/services/agent.ts)

### 全局智能体实例管理

```typescript
// 行 30-31: 全局状态
let globalAgent: IAgent | null = null;
const activeSessions = new Map<string, { abortController: AbortController }>();
const globalPlanStore = new Map<string, TaskPlan>();

// 行 42-69: 获取或创建智能体实例
export function getAgent(config?: Partial<AgentConfig>): IAgent {
  // 如果提供了自定义配置，创建新实例 (不缓存)
  if (config && (config.apiKey || config.baseUrl || config.model)) {
    return createAgent({ provider: 'claude', ...config });
  }

  // 使用全局缓存的默认配置实例
  if (!globalAgent || config) {
    globalAgent = config
      ? createAgent({ provider: 'claude', ...config })
      : createAgentFromEnv();
  }
  return globalAgent;
}
```

### 会话管理

```typescript
// 行 74-88: 创建会话
export function createSession(
  phase: 'plan' | 'execute' = 'plan'
): AgentSession {
  const session: AgentSession = {
    id: Date.now().toString(),
    createdAt: new Date(),
    phase: phase === 'plan' ? 'planning' : 'executing',
    isAborted: false,
    abortController: new AbortController(),
  };
  activeSessions.set(session.id, {
    abortController: session.abortController,
  });
  return session;
}

// 行 109-117: 删除会话
export function deleteSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.abortController.abort();
    activeSessions.delete(sessionId);
    return true;
  }
  return false;
}
```

### 规划阶段执行

```typescript
// 行 148-165
export async function* runPlanningPhase(
  prompt: string,
  session: AgentSession,
  modelConfig?: { apiKey?: string; baseUrl?: string; model?: string }
): AsyncGenerator<AgentMessage> {
  const agent = getAgent(modelConfig);

  for await (const message of agent.plan(prompt, {
    sessionId: session.id,
    abortController: session.abortController,
  })) {
    // 拦截计划消息并保存到全局存储
    if (message.type === 'plan' && message.plan) {
      savePlan(message.plan);
    }
    yield message;
  }
}
```

### 执行阶段

```typescript
// 行 170-217
export async function* runExecutionPhase(
  planId: string,
  session: AgentSession,
  originalPrompt: string,
  workDir?: string,
  taskId?: string,
  modelConfig?: ModelConfig,
  sandboxConfig?: SandboxConfig,
  skillsConfig?: SkillsConfig,
  mcpConfig?: McpConfig
): AsyncGenerator<AgentMessage> {
  const agent = getAgent(modelConfig);

  // 从全局存储获取计划
  const plan = getPlan(planId);
  if (!plan) {
    yield { type: 'error', message: `Plan not found: ${planId}` };
    yield { type: 'done' };
    return;
  }

  for await (const message of agent.execute({
    planId,
    plan,
    originalPrompt,
    sessionId: session.id,
    cwd: workDir,
    taskId,
    abortController: session.abortController,
    sandbox: sandboxConfig,
    skillsConfig,
    mcpConfig,
  })) {
    yield message;
  }
}
```

---

## Claude Agent 实现

**文件**: [`workany/src-api/src/extensions/agent/claude/index.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/extensions/agent/claude/index.ts)

### 类结构

```typescript
// 行 951-963
export class ClaudeAgent extends BaseAgent {
  readonly provider: AgentProvider = 'claude';

  constructor(config: AgentConfig) {
    super(config);
    console.log('[ClaudeAgent] Created with config:', {
      provider: config.provider,
      hasApiKey: !!config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      workDir: config.workDir,
    });
  }
}
```

### 自动安装 Claude Code

```typescript
// 行 72-102: 自动安装 Claude Code CLI
async function installClaudeCode(): Promise<boolean> {
  const os = platform();
  console.log('[Claude] Attempting to install Claude Code...');

  try {
    if (os === 'darwin') {
      // macOS: 优先使用 Homebrew
      try {
        execSync('brew install claude-code', {
          encoding: 'utf-8',
          stdio: 'inherit',
        });
        return true;
      } catch {
        console.log('[Claude] Homebrew failed, trying npm...');
      }
    }

    // 回退: 使用 npm (所有平台)
    execSync('npm install -g @anthropic-ai/claude-code', {
      encoding: 'utf-8',
      stdio: 'inherit',
    });
    return true;
  } catch (error) {
    console.error('[Claude] Failed to install Claude Code:', error);
    return false;
  }
}
```

### 查找 Claude Code 路径

```typescript
// 行 367-517: 路径查找优先级
function getClaudeCodePath(): string | undefined {
  // 优先级 1: 用户安装的 Claude Code (which/where)
  // 优先级 2: npm 全局安装路径
  // 优先级 3: 常见安装位置
  // 优先级 4: CLAUDE_CODE_PATH 环境变量
  // 优先级 5: 打包的 sidecar Claude Code
}
```

### 环境变量配置

```typescript
// 行 1000-1097: 构建环境配置
private buildEnvConfig(): Record<string, string> {
  const env: Record<string, string | undefined> = { ...process.env };

  // 扩展 PATH 以在打包应用中找到 node
  env.PATH = getExtendedPath();

  // 自定义 API 配置
  if (this.config.apiKey) {
    env.ANTHROPIC_AUTH_TOKEN = this.config.apiKey;
    delete env.ANTHROPIC_API_KEY;

    if (this.config.baseUrl) {
      env.ANTHROPIC_BASE_URL = this.config.baseUrl;
    } else {
      delete env.ANTHROPIC_BASE_URL;
    }
  }

  // 模型配置
  if (this.config.model) {
    env.ANTHROPIC_MODEL = this.config.model;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = this.config.model;
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = this.config.model;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = this.config.model;
  }

  // 自定义 API 时禁用非必要流量
  if (this.isUsingCustomApi()) {
    env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
    env.CLAUDE_CODE_SKIP_CONFIG = '1';
    env.API_TIMEOUT_MS = '600000';
    env.CLAUDE_CODE_SKIP_MODEL_VALIDATION = '1';
  }

  return filteredEnv;
}
```

### 直接执行模式 (run)

```typescript
// 行 1191-1490
async *run(
  prompt: string,
  options?: AgentOptions
): AsyncGenerator<AgentMessage> {
  const session = this.createSession('executing');
  yield { type: 'session', sessionId: session.id };

  const sessionCwd = getSessionWorkDir(
    options?.cwd || this.config.workDir,
    prompt,
    options?.taskId
  );
  await ensureDir(sessionCwd);

  // 处理图片附件
  let imageInstruction = '';
  if (options?.images && options.images.length > 0) {
    const imagePaths = await saveImagesToDisk(options.images, sessionCwd);
    // 生成图片分析指令...
  }

  // 格式化对话历史
  const conversationContext = this.formatConversationHistory(options?.conversation);

  // 增强提示词
  const enhancedPrompt = imageInstruction
    ? imageInstruction + prompt + '\n\n' + getWorkspaceInstruction(sessionCwd, sandboxOpts) + conversationContext
    : getWorkspaceInstruction(sessionCwd, sandboxOpts) + conversationContext + prompt;

  // 确保 Claude Code 已安装
  const claudeCodePath = await ensureClaudeCode();

  // 构建查询选项
  const queryOptions: Options = {
    cwd: sessionCwd,
    tools: { type: 'preset', preset: 'claude_code' },
    allowedTools: options?.allowedTools || ALLOWED_TOOLS,
    settingSources: this.buildSettingSources(options?.skillsConfig),
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    abortController: options?.abortController || session.abortController,
    env: this.buildEnvConfig(),
    model: this.config.model,
    pathToClaudeCodeExecutable: claudeCodePath,
    maxTurns: 200,
  };

  // 执行查询并流式返回结果
  for await (const message of query({
    prompt: enhancedPrompt,
    options: queryOptions,
  })) {
    if (session.abortController.signal.aborted) break;
    yield* this.processMessage(message, session.id, sentTextHashes, sentToolIds);
  }
}
```

### 规划阶段 (plan)

```typescript
// 行 1495-1611
async *plan(
  prompt: string,
  options?: PlanOptions
): AsyncGenerator<AgentMessage> {
  const session = this.createSession('planning');
  yield { type: 'session', sessionId: session.id };

  const sessionCwd = getSessionWorkDir(
    options?.cwd || this.config.workDir,
    prompt,
    options?.taskId
  );
  await ensureDir(sessionCwd);

  // 规划专用提示词
  const planningPrompt = workspaceInstruction + PLANNING_INSTRUCTION + prompt;

  const queryOptions: Options = {
    cwd: sessionCwd,
    settingSources: ['user', 'project'],
    allowedTools: [],  // 规划阶段不使用工具
    permissionMode: 'bypassPermissions',
    // ...
  };

  let fullResponse = '';
  for await (const message of query({ prompt: planningPrompt, options: queryOptions })) {
    if (message.type === 'assistant' && message.message?.content) {
      for (const block of message.message.content) {
        if ('text' in block) {
          fullResponse += block.text;
          yield { type: 'text', content: block.text };
        }
      }
    }
  }

  // 解析规划响应
  const planningResult = parsePlanningResponse(fullResponse);

  if (planningResult?.type === 'direct_answer') {
    // 简单问题 - 直接回答
    yield { type: 'direct_answer', content: planningResult.answer };
  } else if (planningResult?.type === 'plan' && planningResult.plan.steps.length > 0) {
    // 复杂任务 - 返回计划
    this.storePlan(planningResult.plan);
    yield { type: 'plan', plan: planningResult.plan };
  }
}
```

### 执行阶段 (execute)

```typescript
// 行 1617-1768
async *execute(options: ExecuteOptions): AsyncGenerator<AgentMessage> {
  const session = this.createSession('executing');
  yield { type: 'session', sessionId: session.id };

  const plan = options.plan || this.getPlan(options.planId);
  if (!plan) {
    yield { type: 'error', message: `Plan not found: ${options.planId}` };
    yield { type: 'done' };
    return;
  }

  // 格式化执行提示词
  const executionPrompt =
    formatPlanForExecution(plan, sessionCwd, sandboxOpts) +
    '\n\nOriginal request: ' +
    options.originalPrompt;

  // 添加沙箱 MCP 服务器 (如果启用)
  if (options.sandbox?.enabled) {
    mcpServers.sandbox = createSandboxMcpServer(options.sandbox.provider);
    queryOptions.allowedTools = [
      ...(options.allowedTools || ALLOWED_TOOLS),
      'sandbox_run_script',
      'sandbox_run_command',
    ];
  }

  // 执行并流式返回结果
  for await (const message of query({
    prompt: executionPrompt,
    options: queryOptions,
  })) {
    yield* this.processMessage(message, session.id, sentTextHashes, sentToolIds);
  }

  // 清理
  this.deletePlan(options.planId);
  this.sessions.delete(session.id);
  yield { type: 'done' };
}
```

---

## 沙箱 MCP 服务器

**文件**: [`workany/src-api/src/extensions/agent/claude/index.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/extensions/agent/claude/index.ts) 行 718-946

```typescript
function createSandboxMcpServer(sandboxProvider?: string) {
  return createSdkMcpServer({
    name: 'sandbox',
    version: '1.0.0',
    tools: [
      tool(
        'sandbox_run_script',
        `Run a script file in an isolated sandbox container...`,
        {
          filePath: z.string().describe('Absolute path to the script file'),
          workDir: z.string().describe('Working directory'),
          args: z.array(z.string()).optional(),
          packages: z.array(z.string()).optional(),
          timeout: z.number().optional(),
        },
        async (args) => {
          const response = await fetch(
            `${SANDBOX_API_URL}/sandbox/run/file`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...args, provider: sandboxProvider }),
            }
          );
          // 处理响应...
        }
      ),
      tool(
        'sandbox_run_command',
        `Execute a shell command in an isolated sandbox container...`,
        // ...
      ),
    ],
  });
}
```

---

## 对话历史管理

**文件**: [`workany/src-api/src/extensions/agent/claude/index.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/extensions/agent/claude/index.ts) 行 1103-1186

```typescript
// Token 感知的历史格式化
private formatConversationHistory(
  conversation?: ConversationMessage[]
): string {
  if (!conversation || conversation.length === 0) {
    return '';
  }

  const maxHistoryTokens = this.config.providerConfig?.maxHistoryTokens as number || 2000;
  const minMessagesToKeep = 3;

  // 格式化所有消息
  const allFormattedMessages = conversation.map((msg) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    let messageContent = `${role}: ${msg.content}`;

    // 包含图片引用
    if (msg.imagePaths && msg.imagePaths.length > 0) {
      const imageRefs = msg.imagePaths
        .map((p, i) => `  - Image ${i + 1}: ${p}`)
        .join('\n');
      messageContent += `\n[Attached images...]\n${imageRefs}`;
    }

    return messageContent;
  });

  // Token 估算 (1 token ≈ 4 字符)
  const messageTokens = allFormattedMessages.map(msg => ({
    content: msg,
    tokens: Math.ceil(msg.length / 4)
  }));

  // 从最新消息开始选择，保证至少保留 minMessagesToKeep 条
  let totalTokens = 0;
  const selectedMessages: string[] = [];

  for (let i = messageTokens.length - 1; i >= 0; i--) {
    const message = messageTokens[i];
    if (totalTokens + message.tokens <= maxHistoryTokens) {
      selectedMessages.unshift(message.content);
      totalTokens += message.tokens;
    } else {
      break;
    }
  }

  return `## Previous Conversation Context\n${selectedMessages.join('\n\n')}\n\n---\n## Current Request\n`;
}
```

---

## 允许的工具列表

```typescript
// 行 699-712
const ALLOWED_TOOLS = [
  'Read',
  'Edit',
  'Write',
  'Glob',
  'Grep',
  'Bash',
  'WebSearch',
  'WebFetch',
  'Skill',
  'Task',
  'LSP',
  'TodoWrite',
];
```

## 原始文件引用

- 智能体类型: [`workany/src-api/src/core/agent/types.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/core/agent/types.ts)
- 智能体服务: [`workany/src-api/src/shared/services/agent.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/shared/services/agent.ts)
- Claude 实现: [`workany/src-api/src/extensions/agent/claude/index.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/extensions/agent/claude/index.ts)
