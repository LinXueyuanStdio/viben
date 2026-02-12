# Agent 开发最佳实践

> Agent 开发的最佳实践和设计模式。

---

## 架构设计

### 单一职责

每个 Agent 应专注于特定领域或任务：

```yaml
# Good: 专注的 Agent
name: research-agent
description: Helps with academic research and paper analysis

# Bad: 过于宽泛
name: general-agent
description: Does everything
```

### 模块化 Skill

将复杂功能拆分为独立 Skill：

```yaml
skills:
  - paper-search      # 搜索论文
  - paper-summarize   # 总结论文
  - citation-format   # 格式化引用
```

## 配置管理

### 环境变量

敏感信息使用环境变量：

```yaml
# agent.yaml
providers:
  openai:
    api_key: ${OPENAI_API_KEY}
```

### 默认值

提供合理的默认配置：

```yaml
model:
  name: gpt-4
  temperature: 0.7
  max_tokens: 4096
```

## 错误处理

### 优雅降级

```yaml
fallbacks:
  - model: gpt-4
  - model: gpt-3.5-turbo
  - model: claude-3-sonnet
```

### 重试策略

```yaml
retry:
  max_attempts: 3
  initial_delay: 1000
  backoff_multiplier: 2
```

## 性能优化

### 缓存

启用响应缓存减少 API 调用：

```yaml
cache:
  enabled: true
  ttl: 3600
```

### 流式响应

使用流式响应提升用户体验：

```yaml
streaming: true
```

## 安全实践

### 输入验证

验证所有用户输入：

```python
def validate_input(query: str) -> str:
    if len(query) > 10000:
        raise ValueError("Query too long")
    return sanitize(query)
```

### 权限控制

限制 Agent 能力范围：

```yaml
permissions:
  file_access: false
  network_access: true
  exec_commands: false
```

## 测试策略

### 单元测试

```python
def test_agent_response():
    agent = load_agent("my-agent")
    response = agent.chat("Hello")
    assert response is not None
```

### 集成测试

```bash
viben agent test my-agent --integration
```

## 文档规范

### README 模板

```markdown
# Agent Name

## 功能描述

## 安装

## 配置

## 使用示例

## 限制
```

## 相关文档

- [架构概览](../shared/architecture/overview.md)
- [跨层思维指南](../shared/guides/cross-layer-thinking.md)
