# Test Refactor Plan - 测试重构计划

## 问题总结

经过 8 个并行 agent 对 65 个测试文件的 review，发现大量测试存在 "reward hacking" 问题：
- **测试通过但无法捕获真实 bug**
- 主要原因：过度 mock，只验证 mock 被调用，不验证实际行为

## 修复原则

1. **测试行为，不测实现** - 验证用户可观察的结果，而非内部函数调用
2. **少 mock，多集成** - 只 mock 外部依赖(网络/进程)，不 mock 被测代码
3. **真实文件系统** - 使用 temp 目录测试文件操作
4. **精确断言** - 验证具体值，避免 `stringContaining` 滥用

## Phase 1: P0 严重问题 (必须修复)

### 1.1 gateway/routes/channels.test.ts
**问题**: 测试直接调用 mock，完全绕过 HTTP routes
```typescript
// 错误做法
const channels = await channelManager.listChannels(); // 直接调 mock

// 正确做法
const response = await app.inject({
  method: 'GET',
  url: '/api/channels'
});
expect(response.statusCode).toBe(200);
```
**修复方案**:
- 使用 `fastify.inject()` 测试真实 HTTP routes
- 参考 `gateway/routes/history.test.ts` 的写法

### 1.2 gateway/routes/terminal.test.ts
**问题**: 测试只验证 mock 对象自身
```typescript
// 错误做法 - 测试测试本身
const connectedMsg = { type: "connected", sessionId };
expect(connectedMsg.type).toBe("connected"); // 永远通过
```
**修复方案**:
- 创建真实 Fastify 实例
- 测试 WebSocket 连接和消息流
- 验证 PTY 交互

### 1.3 executors/chat.test.ts
**问题**: 只测类型契约，无行为测试
```typescript
// 错误做法
expect(typeof executor.spawnChat).toBe("function"); // 只检查存在

// 正确做法
const child = executor.spawnChat({ prompt: "test" });
expect(spawnMock).toHaveBeenCalledWith("claude", ["--prompt", "test"]);
```
**修复方案**:
- Mock `child_process.spawn` 测试命令构建
- 验证环境变量、参数传递
- 测试不同 ChatOptions 组合

### 1.4 notifications/index.test.ts
**问题**: mock 核心功能，spawn 从不执行
**修复方案**:
- 分离测试: 命令构建(单元测试) vs 执行(集成测试)
- 测试 `escapeAppleScript`, `escapePS`, `escapeXml` 函数
- 验证 spawn 参数

### 1.5 cli/commands/task.test.ts
**问题**: 只测命令注册，不测命令执行
```typescript
// 错误做法
expect(subcommands).toContain("list"); // 只检查注册

// 正确做法
await runCommand(["task", "list"]);
expect(mockListTasks).toHaveBeenCalled();
expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Task 1/));
```
**修复方案**:
- 添加命令执行测试
- 验证输入参数处理
- 验证输出格式

### 1.6 cli/lib/viben-workspace.test.ts
**问题**: mock 整个被测模块
**修复方案**:
- 使用真实 temp 目录
- 测试实际 JSONL 读写
- 测试 git 命令执行

### 1.7 task/ops/context-files.test.ts
**问题**: mock 正在测试的函数
**修复方案**:
- 创建真实任务目录结构
- 验证 JSONL 文件内容
- 测试 removeContext 过滤逻辑

### 1.8 task/ops/lifecycle.test.ts
**问题**: mock 所有被测函数
**修复方案**:
- 集成测试真实文件操作
- 验证状态转换逻辑
- 测试 gh 命令构建

## Phase 2: P1 高风险问题

### 2.1 CLI 命令测试重构模式

所有 CLI 命令测试存在相同问题：完全 mock manager，只测 CLI 层。

**统一修复方案**:
```typescript
// 创建共享的 CLI 集成测试基础设施
// packages/core/src/test/helpers/cli-integration.ts

export async function createCliIntegrationContext() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'viben-test-'));

  // 设置真实环境
  process.env.VIBEN_HOME = tempDir;

  return {
    tempDir,
    run: async (args: string[]) => {
      const program = new Command();
      registerAllCommands(program);
      await program.parseAsync(['node', 'viben', ...args]);
    },
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true });
    }
  };
}
```

**受影响文件** (按相同模式修复):
- `cli/commands/service.test.ts`
- `cli/commands/model.test.ts`
- `cli/commands/executor.test.ts`
- `cli/commands/config.test.ts`
- `cli/commands/session.test.ts`
- `cli/commands/user.test.ts`
- `cli/commands/provider.test.ts`
- `cli/commands/mcp.test.ts`
- `cli/commands/context.test.ts`
- `cli/commands/agent.test.ts`
- `cli/commands/init.test.ts`

### 2.2 Gateway Routes 测试重构

**统一修复方案**:
```typescript
// packages/core/src/test/helpers/gateway-integration.ts

export async function createGatewayTestContext() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'viben-gateway-'));
  const app = fastify();

  // 注册真实 routes
  await app.register(channelRoutes);
  await app.register(modelRoutes);
  // ...

  return {
    app,
    inject: app.inject.bind(app),
    cleanup: async () => {
      await app.close();
      await fs.rm(tempDir, { recursive: true });
    }
  };
}
```

**受影响文件**:
- `gateway/routes/models.test.ts`
- `gateway/routes/executors.test.ts`
- `gateway/routes/agent-run.test.ts`

### 2.3 Task Ops 测试重构

**统一修复方案**:
```typescript
// packages/core/src/test/helpers/task-integration.ts

export async function createTaskTestContext() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'viben-task-'));
  const tasksDir = path.join(tempDir, '.viben', 'tasks');
  await fs.mkdir(tasksDir, { recursive: true });

  return {
    tempDir,
    tasksDir,
    createTask: async (name: string, data: Partial<TaskJson>) => {
      const taskDir = path.join(tasksDir, name);
      await fs.mkdir(taskDir, { recursive: true });
      await fs.writeFile(
        path.join(taskDir, 'task.json'),
        JSON.stringify({ id: name, name, ...data })
      );
      return taskDir;
    },
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true });
    }
  };
}
```

**受影响文件**:
- `task/ops/crud.test.ts`

## Phase 3: P2 中等风险问题

### 3.1 加强断言
将弱断言改为精确断言:
```typescript
// 错误
expect(consoleSpy).toHaveBeenCalled();

// 正确
expect(consoleSpy).toHaveBeenCalledWith(
  expect.stringMatching(/^Task "test-task" created/)
);
```

### 3.2 添加错误路径测试
每个功能至少测试:
- 正常路径
- 无效输入
- 外部依赖失败
- 并发操作

## 实施顺序

1. **Week 1**: 创建共享测试基础设施
   - `test/helpers/cli-integration.ts`
   - `test/helpers/gateway-integration.ts`
   - `test/helpers/task-integration.ts`

2. **Week 2**: 修复 P0 (8 个文件)
   - 每个文件约 2-4 小时

3. **Week 3-4**: 修复 P1 (15 个文件)
   - 使用新基础设施批量重构

4. **Week 5**: 修复 P2 (11 个文件)
   - 加强断言和覆盖

## 验收标准

- [ ] 所有测试使用真实文件系统或 fastify.inject
- [ ] 删除所有 "mock 被测模块" 的模式
- [ ] 每个测试验证实际结果，不只是 mock 调用
- [ ] 错误路径有明确测试
- [ ] 测试覆盖率保持 > 80%

## 参考好的测试

这些文件展示了正确的测试方式，可作为重构参考:
- `services/history.test.ts` - 真实 temp 目录 + 验证文件内容
- `group-chat/service.test.ts` - 真实 CRUD 操作
- `gateway/routes/history.test.ts` - fastify.inject
- `db/index.test.ts` - 真实 YAML 操作
- `skills/index.test.ts` - 真实 SkillsManager
