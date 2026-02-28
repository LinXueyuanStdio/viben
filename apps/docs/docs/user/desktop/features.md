---
sidebar_position: 3
title: "功能介绍"
description: "Viben 桌面应用完整功能列表"
---

# 功能介绍

Viben Desktop 提供全面的多智能体工作空间管理功能。

---

## 工作空间管理

### 多工作空间支持

管理多个项目工作空间：

- **全局工作空间**：默认存在，代表 `~` 目录下的全局配置，不可删除
- **自定义工作空间**：用户添加的项目目录，可以添加和移除

### 添加工作空间

通过向导式流程添加工作空间：

1. **选择方式**
   - 打开现有文件夹 - 选择已有的项目目录
   - 创建新文件夹 - 在指定位置创建新目录

2. **配置选项**
   - 工作空间名称
   - 存储位置
   - 初始化 Git 仓库（如果不存在）
   - 初始化 .viben 配置

3. **高级选项**
   - 开发者名称
   - 项目类型（全栈/前端/后端）
   - 包含 Cursor 配置

### 智能检测

系统会自动检测：
- 已有的 `.git` 目录 - 隐藏"初始化 Git"选项
- 已有的 `.viben` 目录 - 显示警告和"重新初始化"选项

---

## 智能体管理

### 自动检测

Viben 自动检测工作空间中的智能体配置：

| 智能体 | 检测目录 | 配置文件 |
|--------|----------|----------|
| **Claude Code** | `.claude/` | `mcp.json`、`settings.json` |
| **Cursor** | `.cursor/` | `mcp.json` |
| **Codex** | `.codex/` | `config.json` |

### 全局 vs 项目配置

| 范围 | 位置 | 说明 |
|------|------|------|
| **全局** | `~/.claude/`、`~/.cursor/` | 系统级配置 |
| **项目** | `<project>/.claude/` | 项目特定配置，覆盖全局 |

---

## MCP 服务器管理

### 添加 MCP 服务器

为智能体添加 MCP 服务器：
- 服务器名称
- 执行命令
- 命令参数
- 环境变量

### 编辑和删除

- 编辑现有服务器配置
- 删除不需要的服务器（带确认）
- 启用/禁用服务器

### 配置示例

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## MCP 市场

### 浏览和搜索

- 浏览官方和社区 MCP 服务器
- 按类别筛选
- 搜索特定功能

### 一键安装

- 查看 MCP 服务器详情
- 一键添加到工作空间
- 自动配置

---

## Skills 管理

### Skills 概念

Skills 是可复用的能力包，可以为智能体添加特定功能。

### 来源

- **市场 Skills**：从 Skills 市场安装
- **本地 Skills**：自定义的本地能力包

### 管理操作

- 添加 Skills
- 查看已安装的 Skills
- 移除 Skills

---

## 任务看板

### 看板功能

集成看板系统管理开发任务：

- **列管理**：自定义任务列（待办、进行中、已完成等）
- **卡片拖拽**：拖拽卡片在列间移动
- **优先级**：设置任务优先级
- **标签**：为任务添加标签分类

### 任务详情

每个任务卡片支持：
- 标题和描述
- 负责人分配
- 截止日期
- 子任务管理
- 依赖关系
- 评论和活动记录

---

## AI 聊天

### 智能体对话

与工作空间中的智能体进行对话：
- 选择智能体
- 发送消息
- 接收流式响应

### Provider 支持

支持多种 AI Provider：

| Provider | 说明 |
|----------|------|
| **OpenAI** | GPT-4、GPT-3.5 等 |
| **Anthropic** | Claude 3、Claude 2 等 |
| **Ollama** | 本地模型 |
| **自定义** | OpenAI 兼容 API |

### 模型配置

- 选择模型
- 调整温度、最大 Token 等参数
- 查看 Token 使用情况

### 会话管理

- 创建新会话
- 查看历史会话
- 删除会话

---

## 用户界面

### 深色模式

完整支持浅色和深色主题：
- 自动跟随系统主题
- 手动切换主题
- 所有组件样式一致

### 键盘快捷键

| 操作 | macOS | Windows/Linux |
|------|-------|---------------|
| 新建搜索 | Cmd + K | Ctrl + K |
| 设置 | Cmd + , | Ctrl + , |
| 退出 | Cmd + Q | Alt + F4 |

### 多语言支持

- 英文 (English)
- 中文 (简体)

### 辅助功能

- 屏幕阅读器支持
- 键盘导航
- 高对比度模式

---

## 隐私与安全

### 本地优先

- 所有数据存储在本地
- 无需账户
- 无遥测或追踪

### 安全通信

- API 请求使用 HTTPS
- 凭证不以明文存储

### 敏感数据

- 支持环境变量引用（如 `${GITHUB_TOKEN}`）
- 不在日志中显示 API 密钥

---

## 数据存储

### 存储位置

| 平台 | 位置 |
|------|------|
| macOS | `~/Library/Application Support/com.viben.app` |
| Windows | `%APPDATA%\com.viben.app` |
| Linux | `~/.config/viben` |

### Viben 配置

全局配置存储在 `~/.viben/`：

```
~/.viben/
├── agents/              # 全局智能体配置
├── providers/           # Provider 配置
├── models.yaml          # 模型配置
├── channels.yaml        # 通道配置
└── sessions/            # 会话存储
```

### 工作空间配置

每个工作空间的配置存储在 `<project>/.viben/`：

```
<project>/.viben/
├── agents/              # 工作空间智能体
├── group-chats/         # 群聊
└── config.yaml          # 工作空间配置
```

---

## 即将推出

以下功能正在计划中：

- **自动更新** - 应用自动更新
- **插件系统** - 通过插件扩展功能
- **引用导出** - 导出各种格式的引用（BibTeX、RIS 等）
- **PDF 标注** - 在 PDF 上高亮和标注
- **云同步** - 可选的设置和收藏云同步

---

## 功能请求

有功能建议？在 [GitHub](https://github.com/LinXueyuanStdio/viben/issues/new?template=feature_request.md) 上提交 Issue。
