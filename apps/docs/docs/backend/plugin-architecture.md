---
sidebar_position: 3
---

# 插件架构

> Viben 可扩展数据源的可插拔 Provider 系统

---

## 概述

Viben 实现了可插拔架构，允许通过以下方式扩展数据源：

1. **内置 Provider**：`backend/browse-mcp` 中的核心学术/研究数据源
2. **插件 Provider**：`backend/plugins/*` 中的第三方扩展

系统使用 **stevedore** 通过 Python 入口点进行动态插件发现和加载。

---

## 架构组件

### 1. Provider 层级

所有数据源遵循层级命名约定：

```
provider/source_name
```

**示例：**
- `browse-mcp/arxiv` - 内置 arXiv 搜索器
- `browse-mcp/pubmed` - 内置 PubMed 搜索器
- `context7/web` - Context7 插件 web 搜索器
- `social-media/twitter` - 社交媒体插件 Twitter 搜索器

### 2. Provider 注册表

**位置：** `provider.index.json`（根目录）

此 JSON 文件按类别编目所有可用数据源：

```json
{
  "providers": {
    "academic": {
      "name": "Academic Sources",
      "description": "Research paper databases and preprint servers",
      "sources": {
        "arxiv": {
          "name": "arXiv",
          "description": "Open access preprint repository",
          "apiKey": "none",
          "documentation": "https://arxiv.org/help/api"
        }
      }
    }
  }
}
```

**类别：**
- `academic` - 研究数据库（arXiv、PubMed、Semantic Scholar 等）
- `publisher` - 出版商特定源（IEEE、Springer、ScienceDirect 等）
- `institutional` - 机构仓库（CORE、ResearchGate 等）
- `web` - 通用 web 源（Google Scholar、Sci-Hub 等）

---

## 内置 Provider

### 位置

```
backend/browse-mcp/browse_mcp/sources/
```

### 可用源（20+）

| 源 | 描述 | API Key |
|--------|-------------|---------|
| arxiv.py | arXiv 预印本服务器 | 无 |
| pubmed.py | PubMed/MEDLINE 数据库 | 无 |
| pmc.py | PubMed Central 全文 | 无 |
| biorxiv.py | bioRxiv 预印本服务器 | 无 |
| medrxiv.py | medRxiv 预印本服务器 | 无 |
| semantic.py | Semantic Scholar API | 可选 |
| core.py | CORE 聚合器 | 可选 |
| crossref.py | Crossref 元数据 | 无 |
| iacr.py | IACR 密码学电子版 | 无 |
| acm.py | ACM 数字图书馆 | 可选 |
| ieee.py | IEEE Xplore | 必需 |
| sciencedirect.py | ScienceDirect | 必需 |
| springer.py | SpringerLink | 必需 |
| scopus.py | Scopus | 必需 |
| google_scholar.py | Google Scholar | 无 |
| jstor.py | JSTOR | 必需 |
| researchgate.py | ResearchGate | 无 |
| wos.py | Web of Science | 必需 |
| sci_hub.py | Sci-Hub | 无 |
| hub.py | 通用 hub 搜索器 | 无 |

### 实现模式

所有内置搜索器继承自 `BaseSearcher` 并实现：

```python
from browse_mcp.base import BaseSearcher

class ArxivSearcher(BaseSearcher):
    def search(self, query: str, **kwargs) -> List[Dict]:
        """执行搜索并返回结果。"""
        pass

    def get_paper_details(self, paper_id: str) -> Dict:
        """获取论文的详细元数据。"""
        pass
```

---

## 插件 Provider

### 位置

```
backend/plugins/
├── browse-mcp-plugin-context7/
│   ├── pyproject.toml
│   ├── README.md
│   ├── CHANGELOG.md
│   └── browse_mcp_plugin_context7/
│       └── searcher.py
└── browse-mcp-plugin-social-media/
    ├── pyproject.toml
    ├── README.md
    ├── CHANGELOG.md
    └── browse_mcp_plugin_social_media/
        └── searcher.py
```

### 插件发现机制

插件通过 `pyproject.toml` 中的**入口点**注册其搜索器：

```toml
[tool.poetry.plugins."browse_mcp.searchers"]
context7_web = "browse_mcp_plugin_context7.searcher:Context7Searcher"
twitter = "browse_mcp_plugin_social_media.twitter:TwitterSearcher"
linkedin = "browse_mcp_plugin_social_media.linkedin:LinkedInSearcher"
```

**入口点命名空间：** `browse_mcp.searchers`

### 加载机制

插件系统使用 **stevedore** 发现和加载入口点：

```python
from stevedore import extension

def load_plugins():
    """加载所有注册的搜索器插件。"""
    mgr = extension.ExtensionManager(
        namespace='browse_mcp.searchers',
        invoke_on_load=True,
    )
    return {ext.name: ext.obj for ext in mgr}
```

**参考：** `backend/browse-mcp/browse_mcp/plugin.py`

---

## 创建新插件

### 1. 包结构

按照命名约定创建新包：

```
backend/plugins/browse-mcp-plugin-{name}/
├── pyproject.toml
├── README.md
├── CHANGELOG.md
├── browse_mcp_plugin_{name}/
│   ├── __init__.py
│   └── searcher.py
└── dist/
```

### 2. 实现搜索器

创建继承自 `BaseSearcher` 的搜索器类：

```python
from browse_mcp.base import BaseSearcher
from typing import List, Dict

class MySearcher(BaseSearcher):
    """自定义数据源搜索器。"""

    def __init__(self):
        super().__init__(name="my_source")

    def search(self, query: str, **kwargs) -> List[Dict]:
        """搜索实现。"""
        # 你的搜索逻辑
        return results

    def get_paper_details(self, paper_id: str) -> Dict:
        """获取论文详情。"""
        # 你的详情获取逻辑
        return details
```

### 3. 注册入口点

在 `pyproject.toml` 中添加入口点：

```toml
[tool.poetry]
name = "browse-mcp-plugin-myname"
version = "0.1.0"

[tool.poetry.dependencies]
browse-mcp = "^0.1.0"

[tool.poetry.plugins."browse_mcp.searchers"]
my_searcher = "browse_mcp_plugin_myname.searcher:MySearcher"
```

### 4. 更新 Provider 注册表

将插件添加到 `provider.index.json`：

```json
{
  "providers": {
    "custom": {
      "name": "Custom Sources",
      "sources": {
        "my_source": {
          "name": "My Source",
          "description": "Description of my data source",
          "apiKey": "required",
          "documentation": "https://docs.mysource.com"
        }
      }
    }
  }
}
```

### 5. 安装插件

```bash
cd backend/plugins/browse-mcp-plugin-myname
poetry install
```

插件将在下次应用启动时自动被发现。

---

## 插件生命周期

### 发现

1. 应用启动
2. Stevedore 扫描 `browse_mcp.searchers` 命名空间
3. 发现所有注册的入口点
4. 加载并实例化插件

### 加载

```python
# 在 browse_mcp/plugin.py 中
from stevedore import extension

def discover_searchers():
    """发现所有可用的搜索器（内置 + 插件）。"""
    mgr = extension.ExtensionManager(
        namespace='browse_mcp.searchers',
        invoke_on_load=True,
        propagate_map_exceptions=True,
    )

    searchers = {}
    for ext in mgr:
        # ext.name 是入口点名称
        # ext.obj 是实例化的搜索器
        searchers[ext.name] = ext.obj

    return searchers
```

### 使用

```python
from browse_mcp.plugin import discover_searchers

# 加载所有搜索器
searchers = discover_searchers()

# 使用特定搜索器
arxiv = searchers['arxiv']
results = arxiv.search("quantum computing")

# 使用插件搜索器
context7 = searchers['context7_web']
results = context7.search("machine learning")
```

---

## 最佳实践

### 1. 命名约定

**入口点名称：**
- 使用小写加下划线：`my_source`、`web_searcher`
- 使用描述性名称：`twitter` 而非 `tw`，`semantic_scholar` 而非 `ss`

**包名：**
- 遵循模式：`browse-mcp-plugin-{name}`
- 使用连字符，而非下划线：`browse-mcp-plugin-context7`

**模块名：**
- 使用下划线：`browse_mcp_plugin_context7`

### 2. 错误处理

插件应优雅地处理错误：

```python
class MySearcher(BaseSearcher):
    def search(self, query: str, **kwargs) -> List[Dict]:
        try:
            # 搜索逻辑
            return results
        except APIError as e:
            self.logger.error(f"API error: {e}")
            return []
        except Exception as e:
            self.logger.exception(f"Unexpected error: {e}")
            raise
```

### 3. 配置

使用环境变量存储 API 密钥和配置：

```python
import os

class MySearcher(BaseSearcher):
    def __init__(self):
        super().__init__(name="my_source")
        self.api_key = os.getenv("MY_SOURCE_API_KEY")
        if not self.api_key:
            raise ValueError("MY_SOURCE_API_KEY not set")
```

### 4. 测试

每个插件应包含测试：

```python
# tests/test_searcher.py
import pytest
from browse_mcp_plugin_myname.searcher import MySearcher

def test_search():
    searcher = MySearcher()
    results = searcher.search("test query")
    assert len(results) > 0
    assert "title" in results[0]
```

### 5. 文档

在 `README.md` 中包含：
- 用途和支持的数据源
- API 密钥要求
- 安装说明
- 使用示例
- 速率限制和限制

---

## 禁用模式

### 硬编码 API Key

```python
# 错误
class MySearcher(BaseSearcher):
    api_key = "sk-1234567890abcdef"
```

```python
# 正确
class MySearcher(BaseSearcher):
    def __init__(self):
        self.api_key = os.getenv("MY_SOURCE_API_KEY")
```

### 不通过入口点直接导入

```python
# 错误 - 绕过插件系统
from browse_mcp_plugin_myname.searcher import MySearcher
searcher = MySearcher()
```

```python
# 正确 - 使用插件发现
from browse_mcp.plugin import discover_searchers
searchers = discover_searchers()
searcher = searchers['my_searcher']
```

### 无异步的阻塞操作

```python
# 错误 - 阻塞 I/O
def search(self, query: str) -> List[Dict]:
    response = requests.get(url)  # 阻塞线程
    return response.json()
```

```python
# 正确 - 异步 I/O
async def search(self, query: str) -> List[Dict]:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()
```

---

## 故障排除

### 插件未找到

**症状：** 插件未出现在已加载的搜索器中

**解决方案：**
1. 验证 `pyproject.toml` 中的入口点：
   ```bash
   poetry show browse-mcp-plugin-myname
   ```

2. 检查入口点注册：
   ```python
   from stevedore import extension
   mgr = extension.ExtensionManager('browse_mcp.searchers')
   print([ext.name for ext in mgr])
   ```

3. 重新安装插件：
   ```bash
   cd backend/plugins/browse-mcp-plugin-myname
   poetry install
   ```

### 导入错误

**症状：** 加载插件时出现 `ModuleNotFoundError`

**解决方案：**
1. 确保插件包已安装
2. 检查入口点定义中的导入路径
3. 验证所有包目录中存在 `__init__.py` 文件

### API Key 问题

**症状：** `ValueError: API_KEY not set`

**解决方案：**
1. 设置环境变量：
   ```bash
   export MY_SOURCE_API_KEY="your-key-here"
   ```

2. 添加到 `.env` 文件：
   ```
   MY_SOURCE_API_KEY=your-key-here
   ```

3. 检查插件代码中的密钥加载

---

## 示例

### 示例 1：Context7 插件

```python
# browse_mcp_plugin_context7/searcher.py
from browse_mcp.base import BaseSearcher

class Context7Searcher(BaseSearcher):
    def __init__(self):
        super().__init__(name="context7")
        self.api_key = os.getenv("CONTEXT7_API_KEY")

    def search(self, query: str, **kwargs) -> List[Dict]:
        # Context7 API 搜索实现
        pass
```

```toml
# pyproject.toml
[tool.poetry.plugins."browse_mcp.searchers"]
context7_web = "browse_mcp_plugin_context7.searcher:Context7Searcher"
```

### 示例 2：社交媒体插件

```python
# browse_mcp_plugin_social_media/twitter.py
from browse_mcp.base import BaseSearcher

class TwitterSearcher(BaseSearcher):
    def __init__(self):
        super().__init__(name="twitter")
        self.bearer_token = os.getenv("TWITTER_BEARER_TOKEN")

    def search(self, query: str, **kwargs) -> List[Dict]:
        # Twitter API v2 搜索实现
        pass
```

```toml
# pyproject.toml
[tool.poetry.plugins."browse_mcp.searchers"]
twitter = "browse_mcp_plugin_social_media.twitter:TwitterSearcher"
linkedin = "browse_mcp_plugin_social_media.linkedin:LinkedInSearcher"
```

---

## 参考

- **Stevedore 文档**: https://docs.openstack.org/stevedore/latest/
- **插件实现**: `backend/browse-mcp/browse_mcp/plugin.py`
- **基类搜索器**: `backend/browse-mcp/browse_mcp/base.py`
- **Provider 注册表**: `provider.index.json`
- **示例插件**: `backend/plugins/`

---

**最后更新：** 2026-02-28
