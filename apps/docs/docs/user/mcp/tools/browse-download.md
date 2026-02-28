---
sidebar_position: 2
title: "browse_download"
description: "从学术数据库下载论文 PDF"
---

# browse_download

`browse_download` 工具使用论文标识符从学术数据库下载论文 PDF。支持批量下载并返回下载文件的路径。

## 基本用法

下载单篇论文：

```python
browse_download([
    {"searcher": "arxiv", "paper_id": "2303.08774"}
])
```

下载多篇论文：

```python
browse_download([
    {"searcher": "arxiv", "paper_id": "2303.08774"},
    {"searcher": "pubmed", "paper_id": "32790614"},
    {"searcher": "pmc", "paper_id": "PMC7419405"}
])
```

## 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `searcher` | string | 是 | 下载来源平台 |
| `paper_id` | string | 是 | 论文标识符（1-200 字符）|

## 论文 ID 格式

每个平台使用不同的标识符格式：

| 搜索器 | ID 格式 | 示例 |
|--------|---------|------|
| `arxiv` | arXiv ID | `2303.08774` |
| `pubmed` | PubMed ID (PMID) | `32790614` |
| `pmc` | PMC ID | `PMC7419405` |
| `biorxiv` | bioRxiv DOI | `10.1101/2020.01.01.123456` |
| `medrxiv` | medRxiv DOI | `10.1101/2020.01.01.123456` |
| `iacr` | IACR 论文 ID | `2009/101` |
| `crossref` | DOI | `10.1038/s41586-020-2649-2` |
| `core` | CORE ID | `123456789` |
| `semantic` | Semantic Scholar ID | 见下方格式 |

### Semantic Scholar ID 格式

Semantic Scholar 接受多种标识符格式：

| 格式 | 示例 |
|------|------|
| Semantic Scholar ID | `649def34f8be52c8b66281af98ae884c09aef38b` |
| DOI 前缀 | `DOI:10.18653/v1/N18-3011` |
| arXiv 前缀 | `ARXIV:2106.15928` |
| MAG 前缀 | `MAG:112218234` |
| ACL 前缀 | `ACL:W12-3903` |
| PMID 前缀 | `PMID:19872477` |
| PMCID 前缀 | `PMCID:2323736` |
| URL 前缀 | `URL:https://arxiv.org/abs/2106.15928v1` |

## 下载示例

### 免费数据源

```python
# 从 arXiv 下载
browse_download([
    {"searcher": "arxiv", "paper_id": "2106.12345"}
])

# 从 PubMed 下载
browse_download([
    {"searcher": "pubmed", "paper_id": "32790614"}
])

# 从 PubMed Central 下载
browse_download([
    {"searcher": "pmc", "paper_id": "PMC7419405"}
])

# 从 bioRxiv 下载
browse_download([
    {"searcher": "biorxiv", "paper_id": "10.1101/2020.01.01.123456"}
])

# 从 Semantic Scholar 下载
browse_download([
    {"searcher": "semantic", "paper_id": "DOI:10.18653/v1/N18-3011"}
])

# 从 CORE 下载
browse_download([
    {"searcher": "core", "paper_id": "123456789"}
])
```

### 批量下载

```python
browse_download([
    {"searcher": "arxiv", "paper_id": "2106.12345"},
    {"searcher": "pubmed", "paper_id": "32790614"},
    {"searcher": "pmc", "paper_id": "PMC7419405"},
    {"searcher": "biorxiv", "paper_id": "10.1101/2020.01.01.123456"},
    {"searcher": "semantic", "paper_id": "DOI:10.18653/v1/N18-3011"}
])
```

## 响应格式

工具返回成功下载论文的文件路径列表：

```
[
  "./downloads/arxiv_2106.12345.pdf",
  "./downloads/pubmed_32790614.pdf",
  "./downloads/pmc_PMC7419405.pdf"
]
```

对于失败的下载，会包含错误信息：

```
[
  "./downloads/arxiv_2106.12345.pdf",
  "Error downloading paper 99999999 from pubmed: Paper not found"
]
```

## 下载路径

PDF 保存到 `BROWSE_MCP_DOWNLOAD_PATH` 环境变量指定的目录。默认是 `./downloads`。

要更改下载路径：

```json
{
  "env": {
    "BROWSE_MCP_DOWNLOAD_PATH": "/path/to/your/downloads"
  }
}
```

## 输入验证

- **searcher**：必须是启用的数据源之一
- **paper_id**：必须是 1-200 字符，不能为空

:::caution 付费数据源
付费数据源（IEEE、Springer、ScienceDirect、Scopus）需要机构访问权限或订阅才能下载 PDF。即使有 API 密钥，PDF 访问也取决于你的订阅级别。
:::

## 错误处理

常见错误：

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| 论文未找到 | 无效的论文 ID | 验证论文 ID 格式 |
| 访问被拒绝 | 没有订阅 | 使用免费数据源或检查订阅 |
| 网络错误 | 连接失败 | 重试下载 |
| 搜索器不可用 | 数据源未启用 | 在配置中启用该数据源 |

## 提示

- 使用 `browse_search` 结果中的论文 ID 以确保准确下载
- 批量下载会并发处理以获得更快的结果
- 如果文件不见了，检查下载路径

## 下一步

- [browse_read](./browse-read) - 提取已下载论文的文本
- [browse_search](./browse-search) - 搜索要下载的论文
- [MCP 配置](../configuration) - 配置下载路径
