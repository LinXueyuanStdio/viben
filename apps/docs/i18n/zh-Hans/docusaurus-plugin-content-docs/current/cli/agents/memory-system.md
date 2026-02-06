---
sidebar_position: 4
title: "记忆系统"
description: "理解和管理 Viben 智能体记忆 - MEMORY.md 和每日日志"
---

# 记忆系统

Viben 智能体记忆系统为智能体知识和日常活动提供持久化、结构化的存储。本指南涵盖记忆架构和管理命令。

## 记忆架构

每个智能体都有一个 `memory/` 目录，包含两种类型的文件:

| 文件 | 用途 | 读取时机 |
|------|------|----------|
| `MEMORY.md` | 包含结构化知识的主记忆文件 | 每次会话启动 |
| `YYYY-MM-DD.md` | 每日日志 (append-only) | 会话启动时读取今天+昨天 |

### 目录结构

```
~/.viben/agents/<agent-id>/memory/
|-- MEMORY.md            # 主记忆文件 (结构化知识)
|-- 2024-01-13.md        # 每日日志 (3天前)
|-- 2024-01-14.md        # 每日日志 (2天前)
|-- 2024-01-15.md        # 每日日志 (昨天)
+-- 2024-01-16.md        # 每日日志 (今天)
```

## 主记忆 (MEMORY.md)

主记忆文件包含结构化、精选的知识，智能体应该始终可以访问。

### 用途

- **持久上下文**: 应该在所有会话中可用的信息
- **结构化知识**: 有组织的事实、偏好和项目上下文
- **精选内容**: 手动维护或智能体更新的重要信息

### 示例结构

```markdown
# 智能体记忆

## 用户偏好
- 偏好 TypeScript 而非 JavaScript
- 使用 VS Code 作为主要编辑器
- 遵循 conventional commits 格式

## 项目上下文
- 当前项目: Viben CLI
- 主要语言: TypeScript
- 框架: Commander.js

## 重要决策
- 2024-01-15: 决定使用 YAML 作为配置格式
- 2024-01-10: 选择 sqlite 作为本地存储

## 常见任务
- 代码审查: 关注类型安全和错误处理
- 提交: 使用 conventional commit 格式

## 备注
- API 密钥存储在环境变量中
- 测试使用 vitest 框架
```

### 何时更新 MEMORY.md

- 添加会话期间发现的新用户偏好
- 记录重要的项目决策
- 项目上下文变化时更新
- 删除过时的信息

## 每日日志 (YYYY-MM-DD.md)

每日日志是记录会话活动的 append-only 文件。

### 用途

- **会话历史**: 每次会话中做了什么
- **进度跟踪**: 已完成和待完成的任务
- **上下文连续性**: 帮助智能体记住最近的工作

### 格式

```markdown
# 2024-01-16

## 10:30 - 会话开始
- 正在处理功能 X
- 发现 Y 的问题

## 14:15 - 完成任务
- 修复了 Z 中的错误
- 更新了文档

## 17:00 - 会话结束
- 下一步: 审查 PR，部署到预发布环境
```

### 自动读取

会话开始时，智能体会自动读取:
- `MEMORY.md` (始终)
- 今天的每日日志 (如果存在)
- 昨天的每日日志 (如果存在)

这由 `.agentrc` 中的 `DAILY_LOG_DAYS` 设置控制:

```bash
# 读取今天+昨天 (默认)
DAILY_LOG_DAYS=2

# 只读取今天
DAILY_LOG_DAYS=1

# 读取今天+前2天
DAILY_LOG_DAYS=3
```

## 记忆管理命令

### 查看记忆

```bash
# 查看主记忆
viben agent memory show -n <agent-id>

# 查看特定日期
viben agent memory show -n <agent-id> --date 2024-01-16

# 查看所有记忆文件
viben agent memory show -n <agent-id> --all
```

**示例:**
```bash
viben agent memory show -n my-agent
```

**输出:**
```
Memory: my-agent

MEMORY.md (2.3 KB, modified 2h ago)
----------------------------------------
# 智能体记忆

## 用户偏好
- 偏好 TypeScript 而非 JavaScript
...

Daily Logs:
  2024-01-16.md  1.1 KB  今天
  2024-01-15.md  3.2 KB  昨天
  2024-01-14.md  2.8 KB  2天前
```

### 追加到每日日志

将内容添加到今天的每日日志:

```bash
viben agent memory append -n <agent-id> "要追加的内容"
```

**示例:**
```bash
viben agent memory append -n my-agent "## 14:30 - 代码审查完成
- 审查了 PR #123
- 发现3个问题，全部已解决"
```

这会追加到 `memory/2024-01-16.md` (今天的日期)。

### 编辑主记忆

在默认编辑器中打开主记忆文件:

```bash
viben agent memory edit -n <agent-id>
```

**示例:**
```bash
viben agent memory edit -n my-agent
```

这会在通过 `settings.editor` 或 `EDITOR` 环境变量配置的编辑器中打开 `~/.viben/agents/my-agent/memory/MEMORY.md`。

### 编辑特定日期

```bash
viben agent memory edit -n <agent-id> --date 2024-01-15
```

## 记忆最佳实践

### MEMORY.md 组织

1. **使用清晰的章节**: 将内容分为逻辑章节
2. **保持简洁**: 专注于基本信息
3. **定期更新**: 删除过时的信息
4. **使用 Markdown**: 利用标题、列表和格式

### 每日日志

1. **时间戳条目**: 每个条目以时间开始
2. **具体明确**: 包含可操作的细节
3. **记录阻碍**: 记录问题和解决方案
4. **计划下一步**: 以下一步行动结束会话

### 记忆清理

```bash
# 定期清理旧的每日日志 (保留最近30天)
viben agent memory cleanup -n my-agent --keep-days 30

# 归档旧日志
viben agent memory archive -n my-agent --before 2024-01-01
```

## 记忆流程图

```
会话开始
     |
     v
+----------------+
| 加载 MEMORY.md |  <-- 始终加载
+----------------+
     |
     v
+------------------+
| 加载今天的日志   |  <-- 如果存在
+------------------+
     |
     v
+----------------------+
| 加载昨天的日志       |  <-- 基于 DAILY_LOG_DAYS
+----------------------+
     |
     v
+----------------+
| 智能体上下文   |
| 准备就绪       |
+----------------+
     |
     | (会话期间)
     v
+------------------+
| 追加到           |  <-- 智能体或用户添加条目
| 今天的日志       |
+------------------+
     |
     | (如果需要)
     v
+----------------+
| 更新           |  <-- 重要发现
| MEMORY.md      |
+----------------+
```

## 配置

### 在 .agentrc 中

```bash
# 启动时加载的记忆文件
MEMORY_FILES="MEMORY.md"

# 要读取的每日日志数量 (今天 + N-1 天前)
DAILY_LOG_DAYS=2
```

### 在 config.yaml 中

```yaml
memory:
  main_file: MEMORY.md
  daily_log_days: 2
  auto_cleanup: true
  cleanup_keep_days: 30
```

## 故障排除

### 记忆未加载

```bash
# 检查记忆文件是否存在
ls -la ~/.viben/agents/my-agent/memory/

# 验证文件权限
chmod 644 ~/.viben/agents/my-agent/memory/*
```

### 每日日志未创建

每日日志在首次追加时自动创建。手动创建:

```bash
viben agent memory append -n my-agent "# $(date +%Y-%m-%d)

## 会话开始"
```

### 记忆过大

如果 MEMORY.md 变得过大:

1. 将旧章节归档到单独的文件
2. 总结详细内容
3. 将项目特定信息移至工作区配置

```bash
# 检查记忆大小
viben agent memory show -n my-agent --stats
```

**输出:**
```
Memory Stats: my-agent
  MEMORY.md: 15.2 KB (建议: < 10 KB)
  Daily logs: 23 files, 45.6 KB total
  Total: 60.8 KB
```

## 下一步

- [会话](./sessions) - 管理智能体会话
- [智能体配置](./agent-configuration) - 配置记忆设置
- [模板](./templates) - 创建带有记忆结构的模板
