---
sidebar_position: 2
title: "快速入门"
description: "快速上手微本 - Agent 集群 × 代码进化"
---

# 快速入门

本指南帮助你快速上手使用微本。

:::tip 核心概念
开始之前，建议先了解 [核心概念](./concepts)，理解 FileEvo、任务系统、智能体与执行器的区别。
:::

## 方式一：使用桌面应用（推荐）

桌面应用提供完整的图形界面，适合日常开发使用。

### 第一步：下载安装

1. 访问 [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)
2. 下载对应平台的安装包
3. 安装并启动微本

### 第二步：添加工作空间

1. 点击侧边栏的 **+** 按钮
2. 选择"打开现有文件夹"或"创建新文件夹"
3. 按向导完成工作空间配置

### 第三步：创建任务

1. 打开任务看板
2. 创建新任务卡片
3. 设置任务优先级和标签

### 第四步：开始优化

- 使用 FileEvo 自动发现代码改进点
- 查看生成的 Idea 列表
- 将 Idea 转化为可执行任务

---

## 方式二：使用 CLI 工具

CLI 工具适合自动化脚本和高级用户。

:::info CLI 文档
完整的 CLI 命令参考请查看 [CLI 文档](/cli/)。
:::

### 第一步：安装 CLI

```bash
npm install -g viben
```

或直接运行：

```bash
npx viben
```

### 第二步：初始化开发者身份

```bash
# 检查是否已初始化
viben user get

# 初始化（首次使用）
viben user init <your-name>
```

### 第三步：创建任务

```bash
# 创建任务
viben task create "Add user authentication" --slug auth

# 查看任务列表
viben task list
```

### 第四步：启动任务执行

```bash
# 启动任务（自动执行 plan → implement → check）
viben task start auth

# 或在 worktree 中隔离执行
viben task start auth --worktree
```

### 第五步：监控执行

```bash
# 实时监控 Agent 状态
viben swarm status --watch

# 查看任务状态
viben task view auth
```

### 第六步：审核与完成

```bash
# 审核任务
viben task review auth

# 批准完成
viben task approve auth
```

---

## 方式三：使用 FileEvo 优化代码

FileEvo 通过迭代优化自动提升代码质量。

### 第一步：生成 Idea

```bash
# 生成代码改进建议
viben idea generate --types code_improvements security_hardening

# 查看生成的 Idea
viben idea list
```

### 第二步：选择并执行

```bash
# 将 Idea 转为任务并启动
viben idea promote ci-001 --start --worktree
```

### 第三步：监控优化循环

```bash
# 查看 FileEvo 状态
viben evo status <name>

# 实时监控
viben swarm status --watch
```

### 第四步：选择最佳方案

```bash
# 从多个候选中选择最佳
viben reward select <tasks...>

# 批准合并
viben task approve <task>
```

---

## 方式四：使用 MCP 服务器

为 Claude Desktop 或其他 AI 助手添加学术搜索能力。

### 第一步：安装 MCP 服务器

```bash
pip install browse-mcp
```

### 第二步：配置 Claude Desktop

打开配置文件：
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

添加配置：

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

### 第三步：使用

重启 Claude Desktop，然后尝试：

> "在 arXiv 上搜索关于大语言模型的最新论文"

---

## 常用命令速查

### 任务管理

```bash
viben task create "<title>" --slug <name>   # 创建任务
viben task list                              # 列出任务
viben task start <task>                      # 启动任务
viben task approve <task>                    # 批准完成
```

### FileEvo

```bash
viben idea generate --types <types>          # 生成 Idea
viben idea promote <id> --start              # Idea 转任务
viben evo status <name>                   # 查看状态
viben reward select <tasks...>               # 选择最佳
```

### 监控

```bash
viben swarm status --watch                   # 实时监控
viben task view <task>                       # 查看详情
```

---

## 下一步

- [核心概念](./concepts) - 理解 FileEvo、任务系统等核心概念
- [桌面应用功能](../desktop/features) - 探索完整功能
- [CLI 文档](/cli/) - 命令行工具参考
- [MCP 配置](../mcp/configuration) - 配置 API 密钥启用付费数据源
