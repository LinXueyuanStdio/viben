---
sidebar_position: 6
---

# 代码质量指南

> Viben 项目代码质量标准

---

## 概述

本指南定义了 Viben 项目的代码质量标准，适用于 TypeScript 和 Python 代码。

---

## TypeScript 质量要求

### Linting & 格式化

| 工具 | 用途 | 命令 |
|------|------|------|
| ESLint | 代码检查 | `pnpm lint` |
| Prettier | 代码格式化 | `pnpm format` |
| TypeScript | 类型检查 | `pnpm typecheck` |

### 提交前检查

```bash
# 运行所有检查
pnpm lint
pnpm typecheck
pnpm build
```

### 类型安全

所有公共函数必须有类型标注：

```typescript
// 正确
function createAgent(config: AgentConfig): Promise<Agent> {
  // ...
}

// 错误 - 缺少类型
function createAgent(config) {
  // ...
}
```

使用 `unknown` 而非 `any`：

```typescript
// 正确
function handleData(data: unknown): void {
  if (typeof data === 'string') {
    // ...
  }
}

// 错误
function handleData(data: any): void {
  // ...
}
```

---

## Python 质量要求

### Linting & 格式化

| 工具 | 用途 | 命令 |
|------|------|------|
| ruff | Linting | `ruff check .` |
| ruff | 格式化 | `ruff format .` |
| mypy | 类型检查 | `mypy browse_mcp/` |

### 提交前检查

```bash
cd backend/browse-mcp
ruff check browse_mcp/
ruff format --check browse_mcp/
```

### 类型提示

所有公共函数必须有类型提示：

```python
from typing import List, Optional

# 正确
def search(query: str, max_results: int = 10) -> List[Paper]:
    pass

# 错误 - 缺少类型
def search(query, max_results=10):
    pass
```

### Docstring

使用 Google 风格 docstring：

```python
def search(query: str, max_results: int = 10) -> List[Paper]:
    """Search for papers.

    Args:
        query: Search query string.
        max_results: Maximum number of results to return.

    Returns:
        List of Paper objects matching the query.

    Raises:
        ValueError: If query is empty.
    """
    pass
```

---

## 代码指标

| 指标 | 限制 |
|------|------|
| 函数长度 | < 50 行 |
| 文件长度 | < 500 行 |
| 圈复杂度 | < 10 |
| 嵌套深度 | < 4 层 |

---

## 禁止的模式

### TypeScript

| 模式 | 原因 | 替代方案 |
|------|------|----------|
| `any` 类型 | 类型不安全 | 使用 `unknown` 或具体类型 |
| `console.log` | 不结构化 | 使用 `logger` |
| 硬编码路径 | 不可移植 | 使用配置或 path 模块 |
| `eval()` / `new Function()` | 安全风险 | 永不使用 |

### Python

| 模式 | 原因 | 替代方案 |
|------|------|----------|
| `except:` (裸) | 捕获所有异常 | `except Exception:` |
| `print()` | 不结构化 | `logger.info()` |
| 硬编码路径 | 不可移植 | 使用 `pathlib` 或配置 |
| `eval()` / `exec()` | 安全风险 | 永不使用 |

---

## 命名约定

### 文件名

| 类型 | TypeScript | Python |
|------|------------|--------|
| 组件 | `kebab-case.tsx` | - |
| 工具 | `kebab-case.ts` | `snake_case.py` |
| 类型 | `types.ts` | `types.py` |
| 测试 | `*.test.ts` | `test_*.py` |

### 变量和函数

| 类型 | TypeScript | Python |
|------|------------|--------|
| 变量 | `camelCase` | `snake_case` |
| 函数 | `camelCase` | `snake_case` |
| 常量 | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |
| 类 | `PascalCase` | `PascalCase` |

### API 参数

**重要**：所有 Gateway API 查询参数使用 **snake_case**：

```typescript
// 正确
workspace_path, include_global, session_id

// 错误
workspacePath, includeGlobal, sessionId
```

---

## 测试要求

### 测试文件位置

```
# TypeScript
packages/core/src/
├── agent/
│   ├── agent.ts
│   └── agent.test.ts

# Python
backend/browse-mcp/
├── browse_mcp/
│   └── sources/
│       └── arxiv.py
└── tests/
    └── test_arxiv.py
```

### 测试命名

```typescript
// TypeScript
describe('AgentService', () => {
  it('should create agent with valid config', () => {
    // ...
  });

  it('should throw error for invalid config', () => {
    // ...
  });
});
```

```python
# Python
def test_search_returns_papers():
    """Test that search returns list of papers."""
    pass

def test_search_empty_query_raises():
    """Test that empty query raises ValueError."""
    pass
```

---

## 代码审查清单

### 提交前自查

- [ ] 代码通过 lint 检查
- [ ] 代码通过类型检查
- [ ] 新功能有测试覆盖
- [ ] 公共 API 有文档
- [ ] 无硬编码敏感信息
- [ ] 错误有适当处理
- [ ] 无 `console.log` 或 `print`

### 审查重点

- 类型安全性
- 错误处理完整性
- 安全漏洞
- 性能问题
- 代码可读性

---

## 相关文档

- [目录结构](./directory-structure.md)
- [错误处理](./error-handling.md)
- [日志指南](./logging-guidelines.md)
