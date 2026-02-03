---
sidebar_position: 1
title: "browse_search"
description: "跨多个数据库搜索学术论文"
---

# browse_search

`browse_search` 工具可同时在多个平台上搜索学术论文。它支持查询 19+ 个学术数据库，并提供灵活的过滤选项。

## 基本用法

搜索单个平台：

```python
browse_search([
    {"searcher": "arxiv", "query": "machine learning", "max_results": 5}
])
```

同时搜索多个平台：

```python
browse_search([
    {"searcher": "arxiv", "query": "deep learning", "max_results": 5},
    {"searcher": "pubmed", "query": "cancer immunotherapy", "max_results": 3},
    {"searcher": "semantic", "query": "climate change", "max_results": 4}
])
```

搜索所有已启用的平台：

```python
browse_search([
    {"query": "quantum computing", "max_results": 10}
])
```

## 参数

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|-----------|------|----------|---------|-------------|
| `query` | string | 是 | - | 搜索查询（1-500 字符） |
| `searcher` | string | 否 | all | 要搜索的平台（省略则搜索所有平台） |
| `max_results` | integer | 否 | 10 | 结果数量（1-100） |
| `year` | string | 否 | - | 年份过滤（仅 Semantic Scholar） |
| `fetch_details` | boolean | 否 | true | 获取论文详情（仅 IACR） |
| `kwargs` | object | 否 | - | 附加参数（仅 CrossRef） |

## 可用搜索器

### 免费来源（无需 API 密钥）

| 搜索器 | 描述 |
|----------|-------------|
| `arxiv` | 物理、数学、计算机科学的预印本库 |
| `pubmed` | MEDLINE 生物医学文献 |
| `pmc` | PubMed Central 全文档案 |
| `biorxiv` | 生物学预印本服务器 |
| `medrxiv` | 健康科学预印本服务器 |
| `semantic` | Semantic Scholar AI 驱动搜索 |
| `crossref` | CrossRef DOI 元数据 |
| `google_scholar` | Google Scholar 搜索 |
| `core` | CORE 开放获取聚合器 |
| `iacr` | IACR 密码学预印本 |

### 高级来源（需要 API 密钥）

| 搜索器 | API 密钥变量 |
|----------|-----------------|
| `ieee` | `IEEE_API_KEY` |
| `scopus` | `SCOPUS_API_KEY` |
| `springer` | `SPRINGER_API_KEY` |
| `sciencedirect` | `SCIENCEDIRECT_API_KEY` |

## 搜索示例

### 单平台搜索

```python
# 在 arXiv 上搜索机器学习论文
browse_search([
    {"searcher": "arxiv", "query": "machine learning", "max_results": 5}
])

# 在 PubMed Central 上搜索生物医学论文
browse_search([
    {"searcher": "pmc", "query": "cancer treatment", "max_results": 5}
])

# 在 CORE 上搜索开放获取论文
browse_search([
    {"searcher": "core", "query": "climate change", "max_results": 5}
])
```

### 多平台搜索

```python
# 同时搜索多个平台
browse_search([
    {"searcher": "arxiv", "query": "deep learning", "max_results": 5},
    {"searcher": "pubmed", "query": "cancer immunotherapy", "max_results": 3},
    {"searcher": "pmc", "query": "diabetes treatment", "max_results": 3}
])
```

### 平台特定参数

**Semantic Scholar 带年份过滤：**

```python
browse_search([
    {"searcher": "semantic", "query": "climate change", "max_results": 4, "year": "2020-2023"}
])
```

年份过滤格式：
- 单个年份：`"2019"`
- 年份范围：`"2016-2020"`
- 从某年开始：`"2010-"`
- 到某年为止：`"-2015"`

**CrossRef 带附加过滤：**

```python
browse_search([
    {
        "searcher": "crossref",
        "query": "deep learning",
        "max_results": 5,
        "kwargs": {
            "filter": "from-pub-date:2020,has-full-text:true",
            "sort": "relevance",
            "order": "desc"
        }
    }
])
```

**IACR 不获取详情：**

```python
browse_search([
    {"searcher": "iacr", "query": "cryptography", "max_results": 10, "fetch_details": false}
])
```

### 高级来源

```python
# 搜索 IEEE Xplore（需要 IEEE_API_KEY）
browse_search([
    {"searcher": "ieee", "query": "neural networks", "max_results": 5}
])

# 搜索 Springer Link（需要 SPRINGER_API_KEY）
browse_search([
    {"searcher": "springer", "query": "quantum computing", "max_results": 5}
])

# 搜索 Scopus（需要 SCOPUS_API_KEY）
browse_search([
    {"searcher": "scopus", "query": "artificial intelligence", "max_results": 5}
])
```

## 响应格式

结果以格式化文本返回每篇论文：

```
Source: 'arxiv'
Paper ID: '2303.08774'
Title: GPT-4 Technical Report
Authors: OpenAI
Abstract: We report the development of GPT-4, a large-scale...
Published Date: 2023-03-15
URL: https://arxiv.org/abs/2303.08774
DOI: 10.48550/arXiv.2303.08774
Categories: cs.CL; cs.AI
```

## 输入验证

工具在搜索前会验证输入：

- **query**：必须是 1-500 字符，不能为空或仅空白
- **max_results**：必须在 1 到 100 之间
- **searcher**：如果指定，必须是启用的来源之一
- **year**：必须匹配格式 `YYYY`、`YYYY-YYYY`、`YYYY-` 或 `-YYYY`

:::tip 最佳实践
指定 `searcher` 参数以定向特定平台。省略它会搜索所有已启用的平台，这可能会更慢并返回超出所需的结果。
:::

## 错误处理

如果搜索失败，工具会继续其他搜索并返回部分结果。常见错误：

- **无效的搜索器**：返回可用搜索器列表
- **空查询**：返回验证错误
- **API 速率限制**：该来源返回错误，继续其他来源
- **网络超时**：该来源返回错误，继续其他来源

## 下一步

- [browse_download](./browse-download) - 下载论文 PDF
- [browse_read](./browse-read) - 从论文中提取文本
- [配置](../configuration) - 配置来源和 API 密钥
