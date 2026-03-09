# viben session

> 会话记录管理，追踪开发进度和知识积累。

## 概述

`viben session` 命令用于记录和管理开发会话。每次完成一项工作后，可以添加会话记录到 journal 文件，方便追踪进度和知识积累。

## 命令结构

```
viben session <subcommand> [options]
```

---

## 添加会话

### `viben session add`

记录一次开发会话。

```bash
viben session add --title "实现用户认证" --commit "abc1234" --summary "完成登录和注册功能"
viben session add -t "修复登录Bug" -c "def5678"
viben session add --title "重构代码" --content-file ./notes.md
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--title`, `-t` | 会话标题（必填） |
| `--commit`, `-c` | 关联的 commit hash（多个用逗号分隔） |
| `--summary`, `-s` | 会话摘要 |
| `--content-file` | 详细内容文件路径 |

**也支持从 stdin 读取内容**:
```bash
echo "详细内容..." | viben session add --title "Title" --commit "hash"
```

**输出**:
```
========================================
ADD SESSION
========================================

Session: 16
Title: 实现用户认证
Commit: abc1234

Current journal file: journal-1.md
Current lines: 1450
New content lines: 50
Total after append: 1500

[OK] Appended session to journal-1.md

Updating index.md for session 16...
  Title: 实现用户认证
  Commit: `abc1234`
  Active File: journal-1.md

[OK] Updated index.md successfully!

========================================
[OK] Session 16 added successfully!
========================================

Files updated:
  - journal-1.md
  - index.md
```

---

## 自动行为

1. **检测 Journal 行数**: 如果当前 journal 文件超过 2000 行，自动创建新文件
2. **创建新 Journal**: 命名格式为 `journal-N.md`，N 递增
3. **更新 index.md**: 更新会话计数、历史表、活跃文件信息

**Journal 超限示例**:
```
Current journal file: journal-1.md
Current lines: 1980
New content lines: 50
Total after append: 2030

[!] Exceeds 2000 lines, creating journal-2.md
Created: .viben/workspace/john/journal-2.md
[OK] Appended session to journal-2.md
```

---

## 列出会话

### `viben session list`

列出会话历史。

```bash
viben session list              # 当前用户的会话
viben session list --all        # 所有用户的会话
viben session list --limit 10   # 最近 10 条
viben session list --json       # JSON 输出
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--all` | 显示所有用户的会话 |
| `--limit`, `-n` | 限制显示条数 |
| `--json` | JSON 格式输出 |

**输出**:
```
=== Session History (john) ===

# | Date       | Task                | Commits
--|------------|---------------------|----------
16 | 2024-03-03 | 实现用户认证       | `abc1234`
15 | 2024-03-03 | 修复登录Bug        | `def5678`
14 | 2024-03-02 | 添加单元测试       | `ghi9012`
13 | 2024-03-02 | 重构代码           | -
12 | 2024-03-01 | 初始化项目         | `jkl3456`

Total: 16 sessions
```

---

## 存储结构

```
.viben/workspace/
├── index.md                    # 主索引（活跃开发者表）
└── {user}/
    ├── index.md                # 个人索引（含 @@@auto 标记）
    ├── journal-1.md            # 会话日志（限制 2000 行）
    ├── journal-2.md            # 第二个日志文件
    └── ...
```

---

## Journal 文件格式

### 文件头

```markdown
# Journal - john (Part 1)

> Started: 2024-03-01

---
```

### 会话条目

```markdown

## Session 16: 实现用户认证

**Date**: 2024-03-03
**Task**: 实现用户认证

### Summary

完成登录和注册功能

### Main Changes

- 添加 JWT token 验证
- 实现密码加密存储
- 创建登录/注册 API

### Git Commits

| Hash | Message |
|------|---------|
| `abc1234` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
```

### 续文件头

```markdown
# Journal - john (Part 2)

> Continuation from `journal-1.md` (archived at ~2000 lines)
> Started: 2024-03-03

---
```

---

## index.md 自动标记

index.md 使用 `@@@auto` 标记来标识自动更新区域：

```markdown
## Status

<!-- @@@auto:current-status -->
- **Active File**: `journal-2.md`
- **Total Sessions**: 16
- **Last Active**: 2024-03-03
<!-- @@@/auto:current-status -->

## Documents

<!-- @@@auto:active-documents -->
| File | Lines | Status |
|------|-------|--------|
| `journal-2.md` | ~50 | Active |
| `journal-1.md` | ~2000 | Archived |
<!-- @@@/auto:active-documents -->

## Session History

<!-- @@@auto:session-history -->
| # | Date | Task | Commits |
|---|------|------|---------|
| 16 | 2024-03-03 | 实现用户认证 | `abc1234` |
| 15 | 2024-03-03 | 修复登录Bug | `def5678` |
...
<!-- @@@/auto:session-history -->
```

---

## Python 脚本映射

| 命令 | 脚本 |
|------|------|
| `viben session add` | `add_session.py` |

**注意**: `viben session list` 需要新增脚本或从 index.md 解析。

---

## Acceptance Criteria

### session add
- [ ] `viben session add` 记录会话
- [ ] `--title` 必填验证
- [ ] `--commit` 支持多个 hash（逗号分隔）
- [ ] `--summary` 可选摘要
- [ ] `--content-file` 从文件读取详细内容
- [ ] 支持从 stdin 读取内容
- [ ] 自动检测 journal 行数
- [ ] 超过 2000 行自动创建新文件
- [ ] 更新 index.md 的自动区域

### session list
- [ ] `viben session list` 列出当前用户会话
- [ ] `--all` 列出所有用户会话
- [ ] `--limit` 限制显示条数
- [ ] `--json` JSON 格式输出

---

## Related Documents

- [user.md](./user.md) - 用户身份管理
- [context.md](./context.md) - 上下文获取
- [task.md](./task.md) - 任务管理
