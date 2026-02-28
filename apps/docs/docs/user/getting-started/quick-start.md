---
sidebar_position: 2
title: "快速入门"
description: "2 分钟上手 Viben"
---

# 快速入门

本指南帮助你在 2 分钟内上手使用 Viben。

## 方式一：使用桌面应用

### 第一步：下载安装

1. 访问 [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)
2. 下载对应平台的安装包
3. 安装并启动 Viben

### 第二步：添加工作空间

1. 点击侧边栏的 **+** 按钮
2. 选择"打开现有文件夹"或"创建新文件夹"
3. 按向导完成工作空间配置

### 第三步：管理智能体

1. 在工作空间中查看检测到的智能体（Claude Code、Cursor 等）
2. 点击智能体查看和编辑 MCP 服务器配置
3. 添加或移除 MCP 服务器

### 第四步：开始使用

- 使用看板管理任务
- 与智能体聊天
- 配置 MCP 服务器

---

## 方式二：使用 MCP 服务器

如果你只需要为 Claude Desktop 或其他 AI 助手添加学术搜索能力：

### 第一步：安装 MCP 服务器

```bash
pip install browse-mcp
```

### 第二步：配置 Claude Desktop

打开 Claude Desktop 配置文件：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

添加以下配置：

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

:::tip 最小配置
这个配置启用所有免费数据源（arXiv、PubMed 等），无需 API 密钥。你可以稍后添加 API 密钥以使用付费数据源。
:::

### 第三步：重启 Claude Desktop

完全退出并重新打开 Claude Desktop 以使配置生效。

### 第四步：搜索你的第一篇论文

在 Claude Desktop 中尝试提问：

> "在 arXiv 上搜索关于大语言模型的最新论文"

或者更具体的查询：

> "搜索 2023 年发表的关于 transformer 架构的论文"

### 示例响应

Claude 会使用 `browse_search` 工具并返回类似结果：

```
Source: 'arxiv'
Paper ID: '2303.08774'
Title: GPT-4 Technical Report
Authors: OpenAI
Abstract: We report the development of GPT-4, a large-scale...
Published Date: 2023-03-15
URL: https://arxiv.org/abs/2303.08774
```

---

## 方式三：使用 CLI 工具

### 第一步：安装 CLI

```bash
npm install -g viben
```

### 第二步：启动 Gateway

```bash
viben gateway start
```

Gateway 会在端口 18790 启动，提供 API 服务。

### 第三步：管理智能体

```bash
# 列出智能体
viben agent list

# 查看智能体详情
viben agent show <agent-name>
```

### 第四步：管理 MCP 服务器

```bash
# 列出 MCP 服务器
viben mcp list

# 添加 MCP 服务器
viben mcp add
```

---

## 更多操作

### 下载论文

> "下载 arXiv 论文 2303.08774"

### 阅读论文内容

> "阅读 arXiv 论文 2303.08774 的内容"

### 搜索多个数据源

> "在 PubMed 和 bioRxiv 上搜索关于 CRISPR 基因编辑的论文"

---

## 工作原理

当你让 Claude 搜索论文时：

1. Claude 识别意图并调用 `browse_search` 工具
2. Viben 向指定的内容源发送查询
3. 结果以标准化格式返回
4. Claude 将信息展示给你

```
用户提问 → Claude 解析 → browse_search 工具 → 数据源 API
                                      ↓
                              标准化结果返回
                                      ↓
                              Claude 展示结果
```

---

## 下一步

- [客户端配置](./client-configuration) - 配置 Cline、Zed 等其他客户端
- [桌面应用功能](../desktop/features) - 探索完整功能
- [browse_search 工具](../mcp/tools/browse-search) - 学习高级搜索选项
- [MCP 配置](../mcp/configuration) - 配置 API 密钥启用付费数据源
