---
sidebar_position: 3
title: "browse_read"
description: "从论文和其他内容中提取和阅读文本内容"
---

# browse_read

`browse_read` 工具从论文和其他内容来源中提取和阅读文本内容。如果内容尚未下载，它会自动下载，然后提取文本。

## 基本用法

```python
browse_read(searcher="arxiv", paper_id="2303.08774")
```

## 参数

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|-----------|------|----------|---------|-------------|
| `searcher` | string | 是 | - | 读取来源 |
| `paper_id` | string | 是 | - | 内容标识符（1-200 字符） |
| `page` | integer | 否 | - | 要读取的特定页面（从 1 开始） |
| `start_page` | integer | 否 | - | 范围起始页（从 1 开始） |
| `end_page` | integer | 否 | - | 范围结束页（从 1 开始） |

## 分页

`browse_read` 工具支持从 PDF 文档中读取特定页面或页面范围。这对于以下场景很有用：

- 读取特定部分而不加载整个文档
- 高效浏览长论文
- 减少 AI 助手的上下文长度

### 分页参数

| 参数 | 描述 | 示例 |
|-----------|-------------|---------|
| `page` | 读取单个特定页面 | `page=3` 只返回第 3 页 |
| `start_page` | 页面范围起始（包含） | `start_page=1` 从第 1 页开始 |
| `end_page` | 页面范围结束（包含） | `end_page=5` 到第 5 页结束 |

### 分页行为

| 参数 | 结果 |
|------------|--------|
| 无 | 返回所有页面 |
| `page=3` | 只返回第 3 页 |
| `start_page=1, end_page=5` | 返回第 1-5 页 |
| `start_page=10` | 从第 10 页返回到末尾 |
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
--- Page 1 ---
Title: GPT-4 Technical Report

Abstract
We report the development of GPT-4, a large-scale, multimodal
model which can accept image and text inputs...

--- Page 2 ---
1 Introduction
This technical report presents GPT-4, a large multimodal model
capable of processing image and text inputs...
```

## 论文 ID 格式

每个平台使用不同的标识符格式。查看 [browse_download](./browse-download#论文-id-格式) 参考了解完整格式详情。

| 搜索器 | 示例 |
|----------|---------|
| `arxiv` | `2303.08774` |
| `pubmed` | `32790614` |
| `pmc` | `PMC7419405` |
| `biorxiv` | `10.1101/2020.01.01.123456` |
| `medrxiv` | `10.1101/2020.01.01.123456` |
| `iacr` | `2009/101` |
| `crossref` | `10.1038/s41586-020-2649-2` |
| `semantic` | `DOI:10.18653/v1/N18-3011` |
| `core` | `123456789` |

## 读取示例

### 从不同来源读取

```python
# 从 arXiv 读取
browse_read(searcher="arxiv", paper_id="2106.12345")

# 从 PubMed 读取
browse_read(searcher="pubmed", paper_id="32790614")

# 从 PubMed Central 读取
browse_read(searcher="pmc", paper_id="PMC7419405")

# 从 bioRxiv 读取
browse_read(searcher="biorxiv", paper_id="10.1101/2020.01.01.123456")

# 从 medRxiv 读取
browse_read(searcher="medrxiv", paper_id="10.1101/2020.01.01.123456")

# 从 IACR 读取
browse_read(searcher="iacr", paper_id="2009/101")

# 从 Semantic Scholar 读取
browse_read(searcher="semantic", paper_id="DOI:10.18653/v1/N18-3011")

# 从 CrossRef 读取
browse_read(searcher="crossref", paper_id="10.1038/s41586-020-2649-2")

# 从 CORE 读取
browse_read(searcher="core", paper_id="123456789")
```

### 从插件来源读取

如果您安装了社交媒体插件：

```python
# 从 GitHub 读取
browse_read(searcher="github", paper_id="owner/repo")

# 从 Twitter 读取
browse_read(searcher="twitter", paper_id="1234567890")

# 从知乎读取
browse_read(searcher="zhihu", paper_id="123456789")
```

## 工作原理

1. **检查本地缓存**：工具首先检查内容是否已下载
2. **需要时下载**：如果本地未找到，它会自动下载内容
3. **提取文本**：使用适当的解析（PDF、HTML 等）提取文本
4. **应用分页**：如果设置了分页参数，只提取请求的页面
5. **返回内容**：将提取的文本作为字符串返回

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
       是               v
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

- **searcher**：必须是启用的来源之一
- **paper_id**：必须是 1-200 字符，不能为空或仅空白
- **page**：必须是正整数（1 或更大）
- **start_page**：必须是正整数（1 或更大）
- **end_page**：必须是正整数，大于或等于 start_page

## 错误处理

常见错误及其含义：

| 错误 | 原因 | 解决方案 |
|-------|-------|----------|
| Searcher not available | 来源未启用 | 在配置中启用该来源 |
| Paper ID cannot be empty | ID 为空或仅空白 | 提供有效的论文 ID |
| Paper not found | 无效的论文 ID | 验证论文 ID 格式 |
| Error converting paper to text | PDF 解析失败 | 尝试重新下载或使用其他来源 |
| Invalid page number | 页码超出范围 | 使用有效的页码 |

## 提示

:::tip 工作流程
为获得最佳结果，首先使用 `browse_search` 查找论文，然后使用返回的论文 ID 与 `browse_read` 提取内容。
:::

:::tip 长论文分页
对于长论文，使用分页读取特定部分：
- `page=1` 用于摘要
- `start_page=1, end_page=3` 用于引言
- 仅在需要时读取完整论文
:::

- 工具会自动下载论文，因此您不需要先调用 `browse_download`
- 已下载的论文会被缓存，因此后续读取更快
- 文本提取质量取决于 PDF 结构（某些扫描的 PDF 可能提取效果不佳）
- 分页仅适用于 PDF 内容；其他内容类型返回完整文本

## 用例

### 研究摘要

询问您的 AI 助手：
> "从 arXiv 读取论文 2303.08774 的第 1 页并总结摘要"

### 文献综述

搜索后：
> "在 arXiv 上搜索关于 transformer 架构的论文，然后读取排名第一结果的第 1-5 页"

### 引用提取

> "读取这篇论文的最后 3 页以找到参考文献部分"

### 增量阅读

> "先读取第 1-5 页，如果我需要更多细节，再读取第 6-10 页"

## 下一步

- [browse_search](./browse-search) - 查找要阅读的论文
- [browse_download](./browse-download) - 下载论文以供离线访问
- [配置](../configuration) - 配置下载路径
- [插件](../../plugins/overview) - 使用更多内容来源扩展
