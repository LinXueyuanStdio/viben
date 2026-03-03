# Feature: viben context 命令实现

## 概述

实现 `viben context` 命令，用于获取当前开发上下文。底层调用现有 Python 脚本。

## 需求

### 命令

1. `viben context` - 显示完整上下文（文本格式）
2. `viben context --json` - JSON 格式输出

### 输出内容

- 用户身份
- 当前任务
- Git 状态（分支、未提交变更、最近 commit）
- 活跃任务列表
- Journal 文件状态

### 技术方案

1. 在 `packages/core/src/cli/commands/` 创建 `context.ts`
2. 调用 Python 脚本 `get_context.py`

### Python 脚本映射

| 命令 | 脚本 |
|------|------|
| `viben context` | `get_context.py` |
| `viben context --json` | `get_context.py --json` |

## 实现参考

### Python 脚本调用

复用 `user.ts` 中的 `runPythonScript` 函数，或创建共享工具。

建议创建 `packages/core/src/cli/lib/python-runner.ts`:

```typescript
export async function runVibenScript(
  scriptName: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string; code: number }>;
```

## Acceptance Criteria

- [ ] 创建 `packages/core/src/cli/commands/context.ts`
- [ ] 实现 `viben context`
- [ ] 实现 `viben context --json`
- [ ] 在 `commands/index.ts` 注册命令
- [ ] 创建或复用 Python 脚本运行工具
- [ ] 添加单元测试 `context.test.ts`
- [ ] `pnpm build` 编译通过

## 相关文件

- `.trellis/spec/modules/cli/context.md` - Spec 文档
- `packages/core/templates/viben/scripts/get_context.py` - Python 脚本
- `packages/core/templates/viben/scripts/common/git_context.py` - 核心实现
