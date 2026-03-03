# Feature: viben user 命令实现

## 概述

实现 `viben user` 命令，用于用户身份管理。底层调用现有 Python 脚本。

## 需求

### 命令

1. `viben user init <name>` - 初始化用户身份
2. `viben user get` - 获取当前用户身份
3. `viben user get --json` - JSON 格式输出

### 技术方案

1. 在 `packages/core/src/cli/commands/` 创建 `user.ts`
2. 使用 `child_process` 调用 Python 脚本
3. 脚本路径: `packages/core/templates/viben/scripts/`

### Python 脚本映射

| 命令 | 脚本 |
|------|------|
| `viben user init` | `init_developer.py` |
| `viben user get` | `get_developer.py` |

## 实现参考

### 现有 CLI 命令结构

参考 `packages/core/src/cli/commands/init.ts`:
- 使用 Commander.js
- 导出 `registerUserCommand(program: Command)` 函数

### Python 脚本调用

```typescript
import { spawn } from 'child_process';
import path from 'path';

function runPythonScript(scriptName: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const scriptsDir = path.join(__dirname, '../../templates/viben/scripts');
  const scriptPath = path.join(scriptsDir, scriptName);

  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [scriptPath, ...args]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });
    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
}
```

## Acceptance Criteria

- [ ] 创建 `packages/core/src/cli/commands/user.ts`
- [ ] 实现 `viben user init <name>`
- [ ] 实现 `viben user get`
- [ ] 实现 `viben user get --json`
- [ ] 在 `commands/index.ts` 注册命令
- [ ] 添加单元测试 `user.test.ts`
- [ ] `pnpm build` 编译通过

## 相关文件

- `.trellis/spec/modules/cli/user.md` - Spec 文档
- `packages/core/templates/viben/scripts/init_developer.py` - Python 脚本
- `packages/core/templates/viben/scripts/get_developer.py` - Python 脚本
- `packages/core/src/cli/commands/init.ts` - 参考实现
