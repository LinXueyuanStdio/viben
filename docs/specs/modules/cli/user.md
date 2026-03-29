# viben user

> 用户身份管理，支持多开发者/多智能体协作。

## 概述

`viben user` 命令用于管理用户身份。每个开发者（人类或智能体）都需要初始化身份才能使用任务管理和会话记录功能。

## 命令结构

```
viben user <subcommand> [options]
```

---

## 初始化身份

### `viben user init`

初始化用户身份。

```bash
viben user init <name>
```

**命名建议**:
| 类型 | 示例 |
|------|------|
| 人类开发者 | `john`, `alice`, `zhang-san` |
| Claude Code 智能体 | `claude-agent`, `claude-task-001` |
| Cursor 智能体 | `cursor-agent` |
| Gemini 智能体 | `gemini-agent` |

**创建文件**: `.viben/.developer`（gitignored）

**创建目录**: `.viben/workspace/<name>/`

**示例**:
```bash
viben user init john
viben user init claude-agent
```

**输出**:
```
[INFO] Creating developer workspace...
[SUCCESS] Developer initialized: john
[INFO] Created: .viben/.developer
[INFO] Created: .viben/workspace/john/index.md
[INFO] Created: .viben/workspace/john/journal-1.md
```

**注意**: 如果已初始化，会提示当前用户并退出：
```
Developer already initialized: john

To reinitialize, remove .viben/.developer first
```

---

## 获取身份

### `viben user get`

获取当前用户身份。

```bash
viben user get           # 输出用户名
viben user get --json    # JSON 格式输出
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |

**示例**:
```bash
viben user get
# 输出: john

viben user get --json
# 输出: {"user": "john"}
```

**未初始化时**:
```
Developer not initialized
```

---

## 存储结构

```
.viben/
├── .developer                    # 用户身份文件（gitignored）
│                                 # 内容: name=john
└── workspace/
    ├── index.md                  # 主索引（活跃开发者表）
    └── john/                     # 用户工作空间
        ├── index.md              # 个人索引
        └── journal-1.md          # 会话日志
```

### .developer 文件格式

```
name=john
```

### workspace/index.md 格式

```markdown
# Viben Workspace Index

## Active Developers

| Name | Last Active | Sessions |
|------|-------------|----------|
| john | 2024-03-03  | 15       |
```

### workspace/{user}/index.md 格式

```markdown
# Workspace - john

## Status

<!-- @@@auto:current-status -->
- **Active File**: `journal-1.md`
- **Total Sessions**: 15
- **Last Active**: 2024-03-03
<!-- @@@/auto:current-status -->

## Documents

<!-- @@@auto:active-documents -->
| File | Lines | Status |
|------|-------|--------|
| `journal-1.md` | ~1500 | Active |
<!-- @@@/auto:active-documents -->

## Session History

<!-- @@@auto:session-history -->
| # | Date | Task | Commits |
|---|------|------|---------|
| 15 | 2024-03-03 | Add user auth | `abc1234` |
| 14 | 2024-03-02 | Fix bug | `def5678` |
<!-- @@@/auto:session-history -->
```

---

## 实现说明

实现方式: **原生 TypeScript** (不依赖 Python)

对应 Python 脚本参考:

| 命令 | 参考脚本 |
|------|----------|
| `viben user init` | `init_developer.py` |
| `viben user get` | `get_developer.py` |

实现文件:
- `packages/core/src/cli/commands/user.ts`
- `packages/core/src/cli/commands/user.test.ts`

---

## Acceptance Criteria

- [x] `viben user init <name>` 初始化用户身份
- [x] 创建 `.viben/.developer` 文件
- [x] 创建 `.viben/workspace/<name>/` 目录结构
- [x] 创建 `index.md` 和 `journal-1.md`
- [x] 已初始化时提示当前用户
- [x] `viben user get` 获取当前用户
- [x] `viben user get --json` JSON 输出
- [x] 未初始化时输出错误信息

---

## Related Documents

- [session.md](./session.md) - 会话记录管理
- [context.md](./context.md) - 上下文获取
- [task.md](./task.md) - 任务管理
