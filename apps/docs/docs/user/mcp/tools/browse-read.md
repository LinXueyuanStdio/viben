---
sidebar_position: 3
title: "browse_read"
description: "提取和阅读论文及其他内容的文本"
---

# browse_read

`browse_read` 工具从论文和其他内容源提取并阅读文本内容。如果内容尚未下载，会自动下载后再提取文本。

## 基本用法

```python
browse_read(searcher="arxiv", paper_id="2303.08774")
```

## 参数

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `searcher` | string | 是 | - | 来源平台 |
| `paper_id` | string | 是 | - | 内容标识符（1-200 字符）|
| `page` | integer | 否 | - | 读取特定页面（从 1 开始）|
| `start_page` | integer | 否 | - | 页面范围起始（从 1 开始）|
| `end_page` | integer | 否 | - | 页面范围结束（从 1 开始）|

## 分页

`browse_read` 工具支持从 PDF 文档读取特定页面或页面范围。适用于：

- 只读取特定章节而不加载整个文档
- 高效浏览长篇论文
- 减少 AI 助手的上下文长度

### 分页参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `page` | 读取单个特定页面 | `page=3` 仅返回第 3 页 |
| `start_page` | 页面范围起始（包含）| `start_page=1` 从第 1 页开始 |
| `end_page` | 页面范围结束（包含）| `end_page=5` 到第 5 页结束 |

### 分页行为

| 参数 | 结果 |
|------|------|
| 无 | 返回所有页面 |
| `page=3` | 仅返回第 3 页 |
| `start_page=1, end_page=5` | 返回第 1-5 页 |
| `start_page=10` | 从第 10 页到结尾 |
| `end_page=5` | 返回第 1-5 页 |

### 分页示例

```python
# 只读取摘要（通常是第 1 页）
browse_read(searcher="arxiv", paper_id="2303.08774", page=1)

# 读取引言（第 1-3 页）
browse_read(searcher="arxiv", paper_id="2303.08774", start_page=1, end_page=3)

# 从方法部分开始读取（假设从第 5 页开始）
browse_read(searcher="arxiv", paper_id="2303.08774", start_page=5)

# 读取到结论为止（前 10 页）
browse_read(searcher="arxiv", paper_id="2303.08774", end_page=10)
```

### 分页响应格式

使用分页时，响应包含页面标记：

```
--- 第 1 页 ---
Title: GPT-4 Technical Report

Abstract
We report the development of GPT-4, a large-scale, multimodal
model which can accept image and text inputs...

--- 第 2 页 ---
1 Introduction
This technical report presents GPT-4, a large multimodal model
capable of processing image and text inputs...
```

## 论文 ID 格式

每个平台使用不同的标识符格式。完整格式详情请参阅 [browse_download](./browse-download#论文-id-格式)。

| 搜索器 | 示例 |
|--------|------|
| `arxiv` | `2303.08774` |
| `pubmed` | `32790614` |
| `pmc` | `PMC7419405` |
| `biorxiv` | `10.1101/2020.01.01.123456` |
| `medrxiv` | `10.1101/2020.01.01.123456` |
| `iacr` | `2009/101` |
| `crossref` | `10.1038/s41586-020-2649-2` |
| `semantic` | `DOI:10.18653/v1/N18-3011` |
| `core` | `123456789` |

## 阅读示例

### 从不同数据源阅读

```python
# 从 arXiv 阅读
browse_read(searcher="arxiv", paper_id="2106.12345")

# 从 PubMed 阅读
browse_read(searcher="pubmed", paper_id="32790614")

# 从 PubMed Central 阅读
browse_read(searcher="pmc", paper_id="PMC7419405")

# 从 bioRxiv 阅读
browse_read(searcher="biorxiv", paper_id="10.1101/2020.01.01.123456")

# 从 medRxiv 阅读
browse_read(searcher="medrxiv", paper_id="10.1101/2020.01.01.123456")

# 从 IACR 阅读
browse_read(searcher="iacr", paper_id="2009/101")

# 从 Semantic Scholar 阅读
browse_read(searcher="semantic", paper_id="DOI:10.18653/v1/N18-3011")

# 从 CrossRef 阅读
browse_read(searcher="crossref", paper_id="10.1038/s41586-020-2649-2")

# 从 CORE 阅读
browse_read(searcher="core", paper_id="123456789")
```

### 从插件数据源阅读

如果安装了社交媒体插件：

```python
# 从 GitHub 阅读
browse_read(searcher="github", paper_id="owner/repo")

# 从 Twitter 阅读
browse_read(searcher="twitter", paper_id="1234567890")

# 从知乎阅读
browse_read(searcher="zhihu", paper_id="123456789")
```

## 工作原理

1. **检查本地缓存**：工具首先检查内容是否已下载
2. **如需则下载**：如果本地没有，自动下载内容
3. **提取文本**：使用适当的解析器（PDF、HTML 等）提取文本
4. **应用分页**：如果设置了分页参数，只提取请求的页面
5. **返回内容**：返回提取的文本字符串

```
browse_read(searcher, paper_id, page?, start_page?, end_page?)
        |
        v
+------------------+
| 检查本地文件     |
+------------------+
        |
   找到? 否 -----> 下载内容
        |               |
       是              v
        |          保存到磁盘
        |               |
        v               v
+------------------+
| 从内容中         |
| 提取文本         |
+------------------+
        |
        v
+------------------+
| 应用分页         |
| （如果指定）     |
+------------------+
        |
        v
  返回文本内容
```

## 响应格式

工具返回提取的文本内容：

```
Title: GPT-4 Technical Report

Abstract
We report the development of GPT-4, a large-scale, multimodal
model which can accept image and text inputs and produce text
outputs. While less capable than humans in many real-world
scenarios, GPT-4 exhibits human-level performance on various
professional and academic benchmarks...

1 Introduction
This technical report presents GPT-4, a large multimodal model
capable of processing image and text inputs and producing text
outputs...

[完整论文文本继续...]
```

## 输入验证

- **searcher**：必须是启用的数据源之一
- **paper_id**：必须是 1-200 字符，不能为空或仅空白
- **page**：必须是正整数（1 或更大）
- **start_page**：必须是正整数（1 或更大）
- **end_page**：必须是正整数，大于或等于 start_page

## 错误处理

常见错误及含义：

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| 搜索器不可用 | 数据源未启用 | 在配置中启用该数据源 |
| 论文 ID 不能为空 | 空或仅空白 ID | 提供有效的论文 ID |
| 论文未找到 | 无效的论文 ID | 验证论文 ID 格式 |
| 转换论文为文本时出错 | PDF 解析失败 | 尝试重新下载或使用其他数据源 |
| 无效页码 | 页码超出范围 | 使用有效的页码 |

## 提示

:::tip 工作流程
为获得最佳结果，先使用 `browse_search` 搜索论文，然后使用返回的论文 ID 配合 `browse_read` 提取内容。
:::

:::tip 长论文分页
对于长篇论文，使用分页阅读特定章节：
- `page=1` 获取摘要
- `start_page=1, end_page=3` 获取引言
- 只在需要时阅读完整论文
:::

- 工具会自动下载论文，所以你不需要先调用 `browse_download`
- 已下载的论文会被缓存，后续阅读更快
- 文本提取质量取决于 PDF 结构（某些扫描版 PDF 可能提取效果不佳）
- 分页仅对 PDF 内容有效；其他内容类型返回完整文本

## 使用场景

### 研究摘要

让你的 AI 助手：
> "从 arXiv 阅读论文 2303.08774 的第 1 页并总结摘要"

### 文献综述

搜索后：
> "在 arXiv 搜索关于 transformer 架构的论文，然后阅读排名第一结果的第 1-5 页"

### 引用提取

> "阅读这篇论文的最后 3 页以查找参考文献部分"

### 渐进阅读

> "先阅读第 1-5 页，如果需要更多细节，再阅读第 6-10 页"

## 下一步

- [browse_search](./browse-search) - 搜索要阅读的论文
- [browse_download](./browse-download) - 下载论文以离线访问
- [MCP 配置](../configuration) - 配置下载路径
- [插件](../../plugins/overview) - 扩展更多内容源
