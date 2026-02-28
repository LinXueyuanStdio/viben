---
sidebar_position: 4
title: "社交媒体插件"
description: "从 GitHub、Twitter、知乎和小红书搜索和获取内容"
---

# 社交媒体插件

社交媒体插件为 Viben 添加了从流行社交平台搜索和获取内容的支持。本页提供每个支持的数据源的详细文档。

## 安装

```bash
pip install browse-mcp-plugin-social-media
```

## 支持的平台

| 数据源 | 说明 | 状态 |
|--------|------|------|
| `github` | GitHub 仓库和代码 | 可用 |
| `twitter` | Twitter/X 帖子 | 需要 API |
| `zhihu` | 知乎问答文章 | 参考实现 |
| `xiaohongshu` | 小红书帖子 | 参考实现 |

:::note 实现状态
此插件是**参考实现**，展示插件架构。GitHub 搜索器使用公共 API。其他数据源有占位符实现，需要完成实际的 API 集成。
:::

## GitHub

搜索 GitHub 仓库、代码和 Issues。

### 配置

| 变量 | 必需 | 说明 |
|------|------|------|
| `GITHUB_TOKEN` | 可选 | 获得更高速率限制的个人访问令牌 |

无令牌时，GitHub 允许每小时 60 个请求。有令牌时，你可以获得每小时 5,000 个请求。

创建令牌：
1. 前往 [GitHub 设置 > 开发者设置 > 个人访问令牌](https://github.com/settings/tokens)
2. 生成带 `repo` 权限的新令牌
3. 设置环境变量

### 使用

```python
# 搜索仓库
browse_search([
    {"searcher": "github", "query": "machine learning python", "max_results": 10}
])

# 带特定过滤器搜索
browse_search([
    {"searcher": "github", "query": "language:python stars:>1000", "max_results": 5}
])
```

### 响应格式

```
Platform: github
Post ID: owner/repo-name
Title: Repository Name
Author: owner
Content: Repository description...
Published: 2024-01-15 10:30:00
URL: https://github.com/owner/repo-name
Engagement: 1234 likes, 56 comments
Tags: python, machine-learning, deep-learning
```

### GitHub 搜索语法

GitHub 支持高级搜索语法：

| 查询 | 说明 |
|------|------|
| `language:python` | 按语言过滤 |
| `stars:>1000` | 最小星标数 |
| `forks:>100` | 最小 fork 数 |
| `created:>2023-01-01` | 创建日期之后 |
| `pushed:>2023-01-01` | 最后推送日期之后 |
| `topic:machine-learning` | 按主题过滤 |

示例：
```python
browse_search([{
    "searcher": "github",
    "query": "transformer language:python stars:>500 topic:nlp",
    "max_results": 10
}])
```

## Twitter/X

搜索 Twitter 帖子和主题。

### 配置

| 变量 | 必需 | 说明 |
|------|------|------|
| `TWITTER_BEARER_TOKEN` | 是 | Twitter API v2 Bearer Token |

获取令牌：
1. 申请 [Twitter 开发者账户](https://developer.twitter.com/)
2. 创建项目和应用
3. 生成 Bearer Token

### 使用

```python
# 搜索推文
browse_search([
    {"searcher": "twitter", "query": "#MachineLearning", "max_results": 20}
])

# 带操作符搜索
browse_search([
    {"searcher": "twitter", "query": "from:OpenAI GPT", "max_results": 10}
])
```

### 响应格式

```
Platform: twitter
Post ID: 1234567890
Title: Tweet Preview...
Author: @username
Content: Full tweet content...
Published: 2024-01-15 10:30:00
URL: https://twitter.com/username/status/1234567890
Engagement: 500 likes, 100 comments, 50 shares
Tags: #MachineLearning, #AI
```

### Twitter 搜索操作符

| 操作符 | 说明 |
|--------|------|
| `from:username` | 来自用户的推文 |
| `to:username` | 回复给用户 |
| `#hashtag` | 包含标签 |
| `@mention` | 提及用户 |
| `lang:en` | 语言过滤 |
| `is:retweet` | 包含转推 |
| `-is:retweet` | 排除转推 |

## 知乎

搜索知乎问题、回答和文章。

### 配置

| 变量 | 必需 | 说明 |
|------|------|------|
| `ZHIHU_API_KEY` | 可选 | 获得更高速率限制的 API 密钥 |

### 使用

```python
# 搜索知乎内容
browse_search([
    {"searcher": "zhihu", "query": "机器学习", "max_results": 10}
])

# 搜索中文内容
browse_search([
    {"searcher": "zhihu", "query": "深度学习入门", "max_results": 5}
])
```

### 响应格式

```
Platform: zhihu
Post ID: 123456789
Title: 问题标题
Author: 作者名称
Content: 回答或文章内容...
Published: 2024-01-15 10:30:00
URL: https://www.zhihu.com/question/123456789
Engagement: 1000 likes, 50 comments
Tags: machine-learning, artificial-intelligence
```

## 小红书

搜索小红书笔记和帖子。

### 配置

| 变量 | 必需 | 说明 |
|------|------|------|
| `XIAOHONGSHU_API_KEY` | 可选 | 访问 API 的密钥 |

### 使用

```python
# 搜索小红书内容
browse_search([
    {"searcher": "xiaohongshu", "query": "科技测评", "max_results": 10}
])
```

### 响应格式

```
Platform: xiaohongshu
Post ID: 123456789
Title: 帖子标题
Author: @username
Content: 帖子内容...
Published: 2024-01-15 10:30:00
URL: https://www.xiaohongshu.com/explore/123456789
Engagement: 500 likes, 30 comments
Tags: 科技, 测评, 数码
Media: 3 attachment(s)
```

## SocialPost 类型

所有社交媒体数据源返回 `SocialPost` 对象：

```python
@dataclass
class SocialPost:
    # 核心字段
    post_id: str        # 唯一标识符
    title: str          # 帖子标题或预览
    content: str        # 主要内容
    author: str         # 作者名称/用户名
    platform: str       # 平台名称
    url: str            # 直接链接
    published_date: datetime

    # 互动指标
    likes: int = 0
    comments: int = 0
    shares: int = 0

    # 可选字段
    tags: List[str]
    media_urls: List[str]
    extra: Dict
```

## 启用/禁用数据源

控制哪些社交媒体数据源处于活动状态：

```bash
# 仅启用特定数据源
export BROWSE_MCP_ENABLED_SOURCES="arxiv,github,twitter"

# 或禁用特定数据源
export BROWSE_MCP_DISABLED_SOURCES="zhihu,xiaohongshu"
```

## 速率限制

每个平台有不同的速率限制：

| 平台 | 未认证 | 已认证 |
|------|--------|--------|
| GitHub | 60/小时 | 5,000/小时 |
| Twitter | 不可用 | 根据层级不同 |
| 知乎 | 取决于实现 | 取决于实现 |
| 小红书 | 取决于实现 | 取决于实现 |

插件内部处理速率限制。如果达到限制，考虑：

- 添加 API 密钥以获得更高限制
- 减少每个查询的 `max_results`
- 在搜索之间添加延迟

## 贡献

社交媒体插件是开源的。要贡献：

1. Fork 仓库
2. 实现或改进搜索器
3. 添加测试
4. 提交 Pull Request

优先领域：

- 完成 Twitter API 集成
- 添加知乎 API 集成
- 添加小红书 API 集成
- 添加新平台（LinkedIn、Reddit 等）

## 下一步

- [插件概述](./overview) - 了解插件架构
- [安装插件](./installing-plugins) - 安装指南
- [插件配置](./configuration) - 高级配置
