# Feature: viben swarm 命令实现

## 概述

实现 `viben swarm` 命令，用于智能体集群调度。底层调用现有 Python 脚本。

## 需求

### 子命令清单

#### 列出
- `viben swarm list [--json]`

#### 启动智能体
- `viben swarm start <task> [--executor] [--detach] [--resume] [--session]`

#### 停止智能体
- `viben swarm stop <task> [--force]`
- `viben swarm stop --all [--force]`

#### 状态监控
- `viben swarm status [--running] [--stopped] [--json]`
- `viben swarm status <task> [--detail] [--watch] [--log]`

#### 注册表
- `viben swarm registry [--json]`

#### 清理
- `viben swarm cleanup <branch> [--keep-branch] [--yes]`
- `viben swarm cleanup --merged [--yes]`
- `viben swarm cleanup --all [--yes]`
- `viben swarm cleanup --list`

### 技术方案

1. 在 `packages/core/src/cli/commands/` 创建 `swarm.ts`
2. 调用 Python 脚本

### Python 脚本映射

| 命令 | 脚本 |
|------|------|
| `viben swarm list` | `multi_agent/cleanup.py --list` |
| `viben swarm start` | `multi_agent/start.py` |
| `viben swarm stop` | 需要新增 `multi_agent/stop.py` |
| `viben swarm status` | `multi_agent/status.py` |
| `viben swarm registry` | `multi_agent/status.py --registry` |
| `viben swarm cleanup` | `multi_agent/cleanup.py` |

### stop 命令实现

由于没有现成的 stop 脚本，有两个方案：

**方案 A**: 在 TypeScript 中直接实现
- 读取 registry.json 获取 PID
- 使用 `process.kill()` 发送信号

```typescript
import { readFileSync } from 'fs';

function stopAgent(taskId: string, force: boolean): void {
  const registry = JSON.parse(readFileSync('.viben/agents/registry.json', 'utf-8'));
  const agent = registry.agents.find(a => a.id === taskId || a.task_dir.includes(taskId));

  if (agent && agent.pid) {
    process.kill(agent.pid, force ? 'SIGKILL' : 'SIGTERM');
  }
}
```

**方案 B**: 新增 Python 脚本 `multi_agent/stop.py`

建议：先用方案 A 实现，后续可迁移到方案 B。

### Executor ID 映射

CLI 使用大写 ID，脚本使用小写：

| CLI | 脚本 |
|-----|------|
| `CLAUDE_CODE` | `claude` |
| `CURSOR` | `cursor` |
| `GEMINI_CLI` | `gemini` (待确认) |

## Acceptance Criteria

- [ ] 创建 `packages/core/src/cli/commands/swarm.ts`
- [ ] 实现 `viben swarm list`
- [ ] 实现 `viben swarm start` (含 --resume)
- [ ] 实现 `viben swarm stop` (含 --all)
- [ ] 实现 `viben swarm status` (完整功能)
- [ ] 实现 `viben swarm registry`
- [ ] 实现 `viben swarm cleanup` (所有模式)
- [ ] 在 `commands/index.ts` 注册命令
- [ ] 添加单元测试 `swarm.test.ts`
- [ ] `pnpm build` 编译通过

## 相关文件

- `.trellis/spec/modules/cli/swarm.md` - Spec 文档
- `packages/core/templates/viben/scripts/multi_agent/start.py` - 启动脚本
- `packages/core/templates/viben/scripts/multi_agent/status.py` - 状态脚本
- `packages/core/templates/viben/scripts/multi_agent/cleanup.py` - 清理脚本
