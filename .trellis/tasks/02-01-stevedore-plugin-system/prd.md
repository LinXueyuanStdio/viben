# Task: stevedore-plugin-system

## Overview

将 backend/browse-mcp 的 searcher 系统重构为基于 stevedore 的插件架构，实现自动发现和加载，支持第三方扩展。

## Requirements

### 核心功能

1. **使用 stevedore.NamedExtensionManager 管理插件**
   - 创建 `browse_mcp/plugin.py` 模块封装插件管理逻辑
   - 使用命名空间 `browse_mcp.searchers` 作为 entry points 命名空间
   - 支持按名称加载特定 searcher

2. **配置 Entry Points**
   - 在 `pyproject.toml` 中添加 stevedore 依赖
   - 定义所有 18 个现有 searcher 的 entry points
   - 格式: `[project.entry-points."browse_mcp.searchers"]`

3. **重构 __main__.py**
   - 移除所有硬编码的 searcher 导入
   - 移除手动维护的 ALL_SEARCHERS 字典
   - 使用插件管理器动态加载 searcher

4. **保持环境变量兼容**
   - 继续支持 `BROWSE_MCP_ENABLED_SOURCES` 环境变量
   - 继续支持 `BROWSE_MCP_DISABLED_SOURCES` 环境变量
   - 插件加载后根据环境变量过滤

### 插件加载特性

5. **处理 Searcher 变体**
   - 无 `__init__` 的简单 searcher (如 ArxivSearcher)
   - 带 session 管理的 searcher (如 SemanticSearcher, IACRSearcher)
   - 带特殊参数的 searcher (iacr: fetch_details, semantic: year)

6. **错误容忍**
   - 单个插件加载失败不应影响其他插件
   - 记录加载错误但继续运行
   - 在 MCP 工具调用时提供有意义的错误信息

### 扩展支持

7. **第三方开发者支持**
   - 第三方包可以定义相同命名空间的 entry points
   - 安装后自动被发现和加载
   - 文档说明如何创建第三方 searcher 插件

## Acceptance Criteria

- [ ] 添加 stevedore 依赖到 pyproject.toml
- [ ] 在 pyproject.toml 中定义所有 18 个 searcher 的 entry points
- [ ] 创建 browse_mcp/plugin.py 封装 stevedore 插件管理
- [ ] 重构 __main__.py 使用插件管理器而非硬编码导入
- [ ] 所有现有 MCP 工具 (paper_search, paper_download, paper_read) 功能正常
- [ ] 环境变量 BROWSE_MCP_ENABLED_SOURCES 仍然有效
- [ ] 环境变量 BROWSE_MCP_DISABLED_SOURCES 仍然有效
- [ ] 单个 searcher 加载失败时其他 searcher 正常工作
- [ ] 现有测试通过
- [ ] 插件加载过程有适当的日志输出

## Technical Notes

1. **Stevedore Manager 选择**: 使用 `stevedore.NamedExtensionManager`，支持按名称加载和自动发现

2. **Entry Points 命名空间**: `browse_mcp.searchers`
   ```toml
   [project.entry-points."browse_mcp.searchers"]
   arxiv = "browse_mcp.sources.arxiv:ArxivSearcher"
   semantic = "browse_mcp.sources.semantic:SemanticSearcher"
   # ... 其他 16 个
   ```

3. **Searcher 实例化差异**:
   - 部分 searcher 无 `__init__` (ArxivSearcher)
   - 部分需要 session 初始化 (SemanticSearcher, IACRSearcher)
   - 插件加载器必须统一处理两种模式

4. **特殊参数处理**: `iacr`, `semantic`, `crossref` 接受额外参数，插件系统需保留此能力

5. **向后兼容**: MCP 工具的参数验证、错误消息应与重构前完全一致

6. **18 个现有 Searcher**:
   - arxiv, pubmed, pmc, biorxiv, medrxiv, google_scholar
   - iacr, semantic, crossref, sciencedirect, springer, ieee
   - scopus, acm, wos, jstor, researchgate, core

## Out of Scope

- 修改 PaperSource 基类接口
- 修改任何现有 searcher 的业务逻辑
- 添加新的 searcher
- 修改 Paper 数据结构
- 修改 MCP 工具的对外接口
- 实现插件配置文件系统（仅使用环境变量）
