---
sidebar_position: 6
title: 最佳实践
description: Agent 开发的最佳实践和设计模式
---

# Agent 开发最佳实践

本文档总结了 Agent 开发的最佳实践和设计模式，帮助你创建高效、可维护的 Agent。

## 架构设计

### 单一职责原则

每个 Agent 应专注于特定领域或任务：

```yaml
# Good: 专注的 Agent
name: code-review-agent
description: Specializes in code review and quality analysis

# Bad: 过于宽泛
name: general-agent
description: Does everything - coding, research, writing, math...
```

**原则**：
- 一个 Agent 专注一个领域
- 复杂任务拆分为多个专业 Agent
- 通过 Agent 组合实现复杂功能

### 模块化 Skill

将复杂功能拆分为独立的 Skill：

```yaml
# agent config
skills:
  enabled:
    - paper-search      # 搜索论文
    - paper-summarize   # 总结论文
    - citation-format   # 格式化引用
    - bibliography      # 生成参考文献
```

**好处**：
- 技能可复用
- 便于测试和维护
- 按需组合

### Memory 管理

合理使用 Memory 系统：

```markdown
<!-- memory/MEMORY.md -->

# Agent Knowledge Base

## Project Context
- Current project: viben
- Tech stack: TypeScript, React, Node.js

## Learned Patterns
- Use snake_case for API parameters
- Follow conventional commits

## Important Files
- CLAUDE.md: Project guidelines
- .trellis/: Development workflow
```

**每日日志格式**：

```markdown
# 2024-01-16

## 10:30 - Session started
- Task: Implement workspace wizard
- Context: Desktop app feature

## 14:15 - Progress update
- Completed step 1 component
- Issue: Dialog positioning on small screens

## 17:00 - Session ended
- Committed changes
- Next: Implement step 2 and 3
```

## 配置管理

### 环境变量

敏感信息使用环境变量：

```yaml
# agent.yaml
providers:
  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
  openai:
    api_key: ${OPENAI_API_KEY}

# MCP 配置
mcp:
  github:
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}
```

**不要这样做**：

```yaml
# Bad: 硬编码密钥
providers:
  anthropic:
    api_key: sk-ant-xxx-actual-key-here
```

### 合理的默认值

提供合理的默认配置：

```yaml
# agent.yaml
model:
  name: claude-3-sonnet
  temperature: 0.7
  max_tokens: 4096

type_config:
  plan: true
  dangerously_skip_permissions: false
```

### 配置分层

利用配置合并机制：

```
~/.viben/agents/main/config.yaml     # 全局 Agent 配置
  ↓
<project>/.claude/                    # 项目级配置覆盖
  ↓
命令行参数                             # 运行时覆盖
```

## 错误处理

### 优雅降级

配置 fallback 模型：

```yaml
# agent.yaml
fallbacks:
  - model: claude-3-opus      # 首选
  - model: claude-3-sonnet    # 备选
  - model: gpt-4              # 最后备选
```

### 重试策略

```yaml
# agent.yaml
retry:
  max_attempts: 3
  initial_delay: 1000
  backoff_multiplier: 2
  max_delay: 30000
```

### 错误日志

使用 Memory 系统记录错误：

```markdown
## 14:30 - Error encountered
- Error: Rate limit exceeded
- Context: During batch processing
- Resolution: Added retry with exponential backoff
- Prevention: Consider rate limiting in agent config
```

## 性能优化

### 缓存策略

启用响应缓存：

```yaml
# agent.yaml
cache:
  enabled: true
  ttl: 3600           # 1 小时
  max_size: 100       # 最大缓存条目
```

### 流式响应

使用流式响应提升用户体验：

```yaml
# agent.yaml
streaming: true
```

CLI 使用：

```bash
# 流式输出
viben agent chat -n my-agent -p "Write a long article" --output-format stream-json
```

### Token 优化

- 精简系统提示词
- 使用结构化输出减少 token
- 定期清理会话历史

## 安全实践

### 输入验证

在 Skill 中验证输入：

```yaml
# skill.yaml
input_schema:
  type: object
  properties:
    query:
      type: string
      maxLength: 1000
    limit:
      type: integer
      minimum: 1
      maximum: 100
  required:
    - query
```

### 权限控制

限制 Agent 能力范围：

```yaml
# agent.yaml
permissions:
  file_access: true       # 文件读写
  network_access: true    # 网络访问
  exec_commands: false    # 禁止执行命令

type_config:
  dangerously_skip_permissions: false  # 不跳过权限检查
```

### MCP 安全

限制 MCP 访问范围：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/safe/directory"],
      "env": {}
    }
  }
}
```

## 测试策略

### 单元测试

测试 Agent 响应：

```bash
# 测试基本响应
viben agent chat -n my-agent -p "Hello" --json

# 验证输出格式
viben agent chat -n my-agent -p "Generate JSON" --json | jq .
```

### 集成测试

测试完整流程：

```bash
#!/bin/bash
# test-agent.sh

# 创建测试 agent
viben agent create -n test-agent -f my-template

# 测试基本功能
response=$(viben agent chat -n test-agent -p "Test query" --json)

# 验证响应
if echo "$response" | jq -e '.success == true' > /dev/null; then
    echo "Test passed"
else
    echo "Test failed"
    exit 1
fi

# 清理
viben agent remove -n test-agent
```

### Skill 测试

```bash
# 测试单个 skill
viben skill test my-skill --input "test input"
```

## 文档规范

### Agent README

每个 Agent 应包含文档：

```markdown
# Agent Name

## 功能描述
[Agent 的主要功能和适用场景]

## 安装
```bash
viben agent create -n my-agent -f template-name
```

## 配置
[配置选项说明]

## 使用示例
```bash
viben agent chat -n my-agent -p "Example query"
```

## Skills
- skill-1: 功能描述
- skill-2: 功能描述

## MCP Servers
- mcp-1: 用途说明
- mcp-2: 用途说明

## 限制
[已知限制和注意事项]
```

### 变更日志

记录重要变更：

```markdown
# Changelog

## [1.1.0] - 2024-01-16
### Added
- New skill: code-format
- Support for Python projects

### Changed
- Improved error messages
- Updated default model to claude-3-sonnet

### Fixed
- Fixed memory loading issue
```

## 常见模式

### 专家 Agent 模式

创建领域专家：

```yaml
# code-review-agent.yaml
name: Code Review Expert
description: Expert in code review and quality assurance

type: claude-code
type_config:
  append_prompt: |
    You are a senior code reviewer with expertise in:
    - Clean code principles
    - Design patterns
    - Security best practices
    - Performance optimization

    Always provide:
    1. Summary of findings
    2. Specific issues with line numbers
    3. Suggestions for improvement
    4. Positive feedback where appropriate

skills:
  enabled:
    - code-analysis
    - security-scan
    - performance-check
```

### 研究助手模式

```yaml
# research-agent.yaml
name: Research Assistant
description: Academic research and paper analysis

type: gemini
skills:
  enabled:
    - paper-search
    - summarize
    - citation

mcp:
  enabled:
    - arxiv
    - pubmed
    - semantic-scholar
```

### DevOps Agent 模式

```yaml
# devops-agent.yaml
name: DevOps Assistant
description: CI/CD and infrastructure automation

type: claude-code
skills:
  enabled:
    - docker-compose
    - kubernetes
    - ci-config

mcp:
  enabled:
    - filesystem
    - git
    - docker
```

## 检查清单

### 发布前检查

- [ ] 配置文件语法正确
- [ ] 环境变量正确引用
- [ ] Skills 正确配置
- [ ] MCP Servers 可用
- [ ] Memory 系统正常
- [ ] 文档完整
- [ ] 测试通过

### 运行时检查

```bash
# 检查 agent 状态
viben agent status -n my-agent

# 检查 executor 可用性
viben executor list

# 检查 MCP 配置
viben mcp list --agent my-agent

# 检查 skills
viben skill list --agent my-agent
```

## 相关文档

- [Agent 开发指南](./index.md)
- [MCP 开发指南](./mcp-development.md)
- [Skill 开发指南](./skill-development.md)
- [CLI 集成指南](./cli-integration.md)
- [Agent 模板指南](./templates/agent-templates.md)
