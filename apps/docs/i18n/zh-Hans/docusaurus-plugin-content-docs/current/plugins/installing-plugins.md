---
sidebar_position: 2
title: "安装插件"
description: "如何安装、更新和管理微本插件"
---

# 安装插件

本指南介绍如何安装、更新和管理微本插件。

## 安装方法

### 使用 pip

安装插件最简单的方法：

```bash
pip install browse-mcp-plugin-social-media
```

### 使用 uv

如果您使用 [uv](https://github.com/astral-sh/uv) 进行包管理：

```bash
uv pip install browse-mcp-plugin-social-media
```

或添加到您的项目：

```bash
uv add browse-mcp-plugin-social-media
```

### 从源码安装

用于开发或未发布的插件：

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd viben/backend/plugins/browse-mcp-plugin-social-media
pip install -e .
```

## 验证安装

安装插件后，通过检查服务器日志来验证它是否已加载：

```bash
browse-mcp --debug
```

您应该看到类似这样的输出：

```
INFO     Loading searcher plugins from namespace: browse_mcp.searchers
DEBUG    Loaded searcher plugin: arxiv (academic/arxiv)
DEBUG    Loaded searcher plugin: github (social/github)
DEBUG    Loaded searcher plugin: twitter (social/twitter)
INFO     Successfully loaded 15 searcher plugins: arxiv, github, twitter...
```

## 管理多个插件

### 安装多个插件

您可以一次安装多个插件：

```bash
pip install browse-mcp-plugin-social-media browse-mcp-plugin-news
```

### 列出已安装的插件

查看所有已安装的 browse-mcp 包：

```bash
pip list | grep browse-mcp
```

输出：

```
browse-mcp                    0.3.0
browse-mcp-plugin-social-media 0.1.0
browse-mcp-plugin-news        0.1.0
```

### 更新插件

更新特定插件：

```bash
pip install --upgrade browse-mcp-plugin-social-media
```

更新所有 browse-mcp 包：

```bash
pip install --upgrade browse-mcp browse-mcp-plugin-social-media
```

### 卸载插件

删除插件：

```bash
pip uninstall browse-mcp-plugin-social-media
```

## 插件依赖

### 自动依赖

插件在 `pyproject.toml` 中声明其依赖。当您安装插件时，其依赖会自动安装。

### 核心依赖

所有插件都依赖于 `browse-mcp` 核心：

```toml
[tool.poetry.dependencies]
browse-mcp = "*"
```

如果未安装 browse-mcp，安装插件时会自动安装它。

## 特定环境安装

### Claude Desktop 配置

使用 Claude Desktop 时，您可以在相同的 Python 环境中安装插件：

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {}
    }
  }
}
```

确保插件安装在 Claude Desktop 使用的 Python 环境中。

### 虚拟环境

如果您使用虚拟环境：

```bash
# 创建并激活 venv
python -m venv browse-mcp-env
source browse-mcp-env/bin/activate  # Windows: browse-mcp-env\Scripts\activate

# 安装核心和插件
pip install browse-mcp browse-mcp-plugin-social-media

# 在 MCP 客户端配置中使用 venv Python
```

### uv 内联依赖

使用 uv，您可以内联指定依赖：

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "uvx",
      "args": [
        "--with", "browse-mcp-plugin-social-media",
        "browse-mcp"
      ]
    }
  }
}
```

## 故障排除

### 插件未加载

如果插件未加载：

1. **检查安装**：
   ```bash
   pip show browse-mcp-plugin-social-media
   ```

2. **检查入口点**：
   ```bash
   python -c "from stevedore import ExtensionManager; print([e.name for e in ExtensionManager('browse_mcp.searchers')])"
   ```

3. **检查导入错误**：
   ```bash
   python -c "from social_media_searchers import GithubSearcher"
   ```

4. **启用调试日志**：
   ```bash
   browse-mcp --debug
   ```

### 版本冲突

如果您看到版本冲突：

1. **检查兼容性**：
   ```bash
   pip check
   ```

2. **升级所有包**：
   ```bash
   pip install --upgrade browse-mcp browse-mcp-plugin-social-media
   ```

3. **创建新环境**：
   ```bash
   python -m venv fresh-env
   source fresh-env/bin/activate
   pip install browse-mcp browse-mcp-plugin-social-media
   ```

### 缺少依赖

如果插件缺少依赖：

```bash
# 重新安装并包含依赖
pip install --force-reinstall browse-mcp-plugin-social-media
```

## 下一步

- [可用插件](./available-plugins) - 浏览官方和社区插件
- [社交媒体插件](./social-media-plugin) - 社交媒体插件详细指南
- [插件配置](./configuration) - 配置插件特定设置
