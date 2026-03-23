---
sidebar_position: 5
title: "插件配置"
description: "使用环境变量和设置配置微本插件"
---

# 插件配置

本页介绍微本插件的配置选项，包括环境变量、来源控制和 API 密钥。

## 环境变量

### 核心变量

这些变量适用于所有来源（内置和插件）：

| 变量 | 描述 | 默认值 |
|----------|-------------|---------|
| `BROWSE_MCP_DOWNLOAD_PATH` | 下载内容的目录 | `./downloads` |
| `BROWSE_MCP_ENABLED_SOURCES` | 启用来源的逗号分隔列表 | 所有来源 |
| `BROWSE_MCP_DISABLED_SOURCES` | 禁用来源的逗号分隔列表 | 无 |

### 来源控制

#### 只启用特定来源

使用 `BROWSE_MCP_ENABLED_SOURCES` 创建白名单：

```bash
export BROWSE_MCP_ENABLED_SOURCES="arxiv,pubmed,github,twitter"
```

只有列出的来源可用。所有其他来源（包括插件中的）将被禁用。

#### 禁用特定来源

使用 `BROWSE_MCP_DISABLED_SOURCES` 创建黑名单：

```bash
export BROWSE_MCP_DISABLED_SOURCES="ieee,scopus,zhihu,xiaohongshu"
```

除了列出的来源外，所有来源都可用。

#### 优先级规则

1. 如果设置了 `BROWSE_MCP_ENABLED_SOURCES`，它优先（白名单模式）
2. 如果只设置了 `BROWSE_MCP_DISABLED_SOURCES`，它作为黑名单
3. 如果两者都未设置，所有已安装的来源都启用

### 插件特定 API 密钥

#### 社交媒体插件

| 变量 | 服务 | 获取方式 |
|----------|---------|------------|
| `GITHUB_TOKEN` | GitHub | [个人访问令牌](https://github.com/settings/tokens) |
| `TWITTER_BEARER_TOKEN` | Twitter/X | [Twitter 开发者门户](https://developer.twitter.com/) |
| `ZHIHU_API_KEY` | 知乎 | 联系平台 |
| `XIAOHONGSHU_API_KEY` | 小红书 | 联系平台 |

#### 学术来源

| 变量 | 服务 | 获取方式 |
|----------|---------|------------|
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar | [Semantic Scholar API](https://www.semanticscholar.org/product/api) |
| `CORE_API_KEY` | CORE | [CORE API](https://core.ac.uk/services/api) |
| `IEEE_API_KEY` | IEEE Xplore | [IEEE Developer](https://developer.ieee.org/) |
| `SCOPUS_API_KEY` | Scopus | [Elsevier Developer](https://dev.elsevier.com/) |
| `SPRINGER_API_KEY` | Springer Link | [Springer Developer](https://dev.springernature.com/) |
| `SCIENCEDIRECT_API_KEY` | Science Direct | [Elsevier Developer](https://dev.elsevier.com/) |

## 配置示例

### MCP 客户端配置

#### Claude Desktop

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_DOWNLOAD_PATH": "/Users/you/papers",
        "GITHUB_TOKEN": "ghp_your_token_here",
        "TWITTER_BEARER_TOKEN": "your_bearer_token",
        "SEMANTIC_SCHOLAR_API_KEY": "your_api_key"
      }
    }
  }
}
```

#### Claude Code

在 `~/.claude/mcp_settings.json` 中：

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads",
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

#### Cline (VS Code)

在 VS Code 设置中：

```json
{
  "cline.mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### 用例配置

#### 仅学术研究

禁用所有社交媒体来源：

```json
{
  "env": {
    "BROWSE_MCP_DISABLED_SOURCES": "github,twitter,zhihu,xiaohongshu",
    "SEMANTIC_SCHOLAR_API_KEY": "your-key",
    "BROWSE_MCP_DOWNLOAD_PATH": "./papers"
  }
}
```

#### 社交媒体重点

只启用社交媒体来源：

```json
{
  "env": {
    "BROWSE_MCP_ENABLED_SOURCES": "github,twitter,zhihu",
    "GITHUB_TOKEN": "ghp_your_token",
    "TWITTER_BEARER_TOKEN": "your_bearer_token",
    "BROWSE_MCP_DOWNLOAD_PATH": "./social-content"
  }
}
```

#### 全栈（学术 + 社交）

启用所有内容并使用适当的密钥：

```json
{
  "env": {
    "BROWSE_MCP_DOWNLOAD_PATH": "./content",
    "SEMANTIC_SCHOLAR_API_KEY": "your-key",
    "GITHUB_TOKEN": "ghp_your_token",
    "TWITTER_BEARER_TOKEN": "your_bearer_token"
  }
}
```

#### 计算机科学研究

专注于计算机科学相关来源：

```json
{
  "env": {
    "BROWSE_MCP_ENABLED_SOURCES": "arxiv,semantic,github,ieee,acm",
    "SEMANTIC_SCHOLAR_API_KEY": "your-key",
    "IEEE_API_KEY": "your-key",
    "GITHUB_TOKEN": "ghp_your_token",
    "BROWSE_MCP_DOWNLOAD_PATH": "./cs-research"
  }
}
```

## 层级来源名称

来源可以通过扁平或层级名称引用：

| 扁平名称 | 层级名称 | 提供者 |
|-----------|-------------------|----------|
| `arxiv` | `academic/arxiv` | academic |
| `pubmed` | `academic/pubmed` | academic |
| `github` | `social/github` | social |
| `twitter` | `social/twitter` | social |
| `ieee` | `publisher/ieee` | publisher |

在环境变量中，使用扁平名称：

```bash
# 正确
export BROWSE_MCP_ENABLED_SOURCES="arxiv,github,twitter"

# 也可以但不推荐
export BROWSE_MCP_ENABLED_SOURCES="academic/arxiv,social/github,social/twitter"
```

## 调试配置

### 检查已加载的来源

运行调试日志以查看已加载的来源：

```bash
browse-mcp --debug
```

输出显示：

```
INFO     Loading searcher plugins from namespace: browse_mcp.searchers
DEBUG    Loaded searcher plugin: arxiv (academic/arxiv)
DEBUG    Loaded searcher plugin: github (social/github)
INFO     Successfully loaded 15 searcher plugins: arxiv, github, pubmed...
INFO     Enabled sources: arxiv, github, pubmed...
```

### 检查环境变量

验证环境变量是否设置：

```bash
# Unix/macOS
echo $BROWSE_MCP_ENABLED_SOURCES
echo $GITHUB_TOKEN

# Windows PowerShell
echo $env:BROWSE_MCP_ENABLED_SOURCES
echo $env:GITHUB_TOKEN
```

### 测试 API 密钥

测试单个 API 密钥：

```python
# 测试 GitHub 令牌
import os
import httpx

token = os.getenv("GITHUB_TOKEN")
response = httpx.get(
    "https://api.github.com/user",
    headers={"Authorization": f"token {token}"}
)
print(response.json())
```

## 故障排除

### 来源不可用

1. **检查插件是否已安装**：
   ```bash
   pip show browse-mcp-plugin-social-media
   ```

2. **检查来源是否启用**：
   - 不在 `BROWSE_MCP_DISABLED_SOURCES` 中
   - 在 `BROWSE_MCP_ENABLED_SOURCES` 中（如果设置）

3. **检查加载错误**：
   ```bash
   browse-mcp --debug
   ```

### API 密钥不工作

1. **验证环境变量是否设置**：
   ```bash
   echo $GITHUB_TOKEN
   ```

2. **检查密钥权限**：
   - GitHub：确保令牌具有所需的权限范围
   - Twitter：验证应用具有正确的访问级别

3. **直接测试密钥**，使用简单的 API 调用

### 速率限制

如果您遇到速率限制：

1. 添加或升级 API 密钥
2. 减少查询中的 `max_results`
3. 在搜索之间添加延迟
4. 禁用不必要的来源

## 下一步

- [插件概述](./overview) - 了解插件系统
- [安装插件](./installing-plugins) - 安装指南
- [可用插件](./available-plugins) - 浏览可用插件
- [配置](../mcp/configuration.md) - 核心配置选项
