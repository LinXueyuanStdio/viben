---
sidebar_position: 2
title: "快速开始"
description: "2 分钟内快速上手 Viben"
---

# 快速开始

2 分钟内让 Viben 与 Claude Desktop 协同工作。

## 步骤 1：安装 Viben

```bash
pip install browse-mcp
```

## 步骤 2：配置 Claude Desktop

打开您的 Claude Desktop 配置文件：

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
这个最小配置启用了所有免费来源（arXiv、PubMed 等），无需任何 API 密钥。您可以稍后为高级来源添加 API 密钥。
:::

## 步骤 3：重启 Claude Desktop

完全退出并重新打开 Claude Desktop，使配置生效。

## 步骤 4：搜索您的第一篇论文

在 Claude Desktop 中，尝试询问：

> "在 arXiv 上搜索关于大语言模型的最新论文"

或者更具体一些：

> "查找 2023 年发表的关于 transformer 架构的论文"

## 示例响应

Claude 将使用 `browse_search` 工具并返回如下结果：

```
Source: 'arxiv'
Paper ID: '2303.08774'
Title: GPT-4 Technical Report
Authors: OpenAI
Abstract: We report the development of GPT-4, a large-scale...
Published Date: 2023-03-15
URL: https://arxiv.org/abs/2303.08774
```

## 尝试更多功能

### 下载论文

> "下载 arXiv ID 为 2303.08774 的论文"

### 阅读论文内容

> "从 arXiv 阅读论文 2303.08774 的内容"

### 搜索多个来源

> "在 PubMed 和 bioRxiv 上搜索关于 CRISPR 基因编辑的论文"

## 发生了什么？

当您要求 Claude 搜索论文时：

1. Claude 识别意图并调用 `browse_search` 工具
2. Viben 查询指定的学术数据库
3. 结果以标准化格式返回
4. Claude 将信息呈现给您

## 下一步

- [客户端配置](./client-configuration) - 配置其他客户端（Cline、Zed）
- [browse_search 工具](../mcp-server/tools/browse-search) - 了解高级搜索选项
- [配置](../mcp-server/configuration) - 使用 API 密钥启用高级来源
