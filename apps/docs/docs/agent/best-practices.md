---
sidebar_position: 6
title: Best Practices
description: Best Practices and Design Patterns for Agent Development
---

# Agent Development Best Practices

This document summarizes best practices and design patterns for Agent development, helping you create efficient and maintainable Agents.

## Architecture Design

### Single Responsibility Principle

Each Agent should focus on a specific domain or task:

```yaml
# Good: Focused Agent
name: code-review-agent
description: Specializes in code review and quality analysis

# Bad: Too broad
name: general-agent
description: Does everything - coding, research, writing, math...
```

**Principles**:
- One Agent focuses on one domain
- Split complex tasks into multiple specialized Agents
- Achieve complex functionality through Agent composition

### Modular Skills

Split complex functionality into independent Skills:

```yaml
# agent config
skills:
  enabled:
    - paper-search      # Search papers
    - paper-summarize   # Summarize papers
    - citation-format   # Format citations
    - bibliography      # Generate bibliography
```

**Benefits**:
- Skills are reusable
- Easy to test and maintain
- Compose as needed

### Memory Management

Use the Memory system wisely:

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

**Daily log format**:

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

## Configuration Management

### Environment Variables

Use environment variables for sensitive information:

```yaml
# agent.yaml
providers:
  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
  openai:
    api_key: ${OPENAI_API_KEY}

# MCP configuration
mcp:
  github:
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}
```

**Don't do this**:

```yaml
# Bad: Hardcoded keys
providers:
  anthropic:
    api_key: sk-ant-xxx-actual-key-here
```

### Reasonable Defaults

Provide sensible default configurations:

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

### Configuration Layering

Leverage the configuration merging mechanism:

```
~/.viben/agents/main/config.yaml     # Global Agent configuration
  ↓
<project>/.claude/                    # Project-level configuration override
  ↓
Command line parameters               # Runtime override
```

## Error Handling

### Graceful Degradation

Configure fallback models:

```yaml
# agent.yaml
fallbacks:
  - model: claude-3-opus      # Primary
  - model: claude-3-sonnet    # Fallback
  - model: gpt-4              # Last resort
```

### Retry Strategy

```yaml
# agent.yaml
retry:
  max_attempts: 3
  initial_delay: 1000
  backoff_multiplier: 2
  max_delay: 30000
```

### Error Logging

Use the Memory system to record errors:

```markdown
## 14:30 - Error encountered
- Error: Rate limit exceeded
- Context: During batch processing
- Resolution: Added retry with exponential backoff
- Prevention: Consider rate limiting in agent config
```

## Performance Optimization

### Caching Strategy

Enable response caching:

```yaml
# agent.yaml
cache:
  enabled: true
  ttl: 3600           # 1 hour
  max_size: 100       # Maximum cache entries
```

### Streaming Responses

Use streaming responses to improve user experience:

```yaml
# agent.yaml
streaming: true
```

CLI usage:

```bash
# Streaming output
viben agent chat -n my-agent -p "Write a long article" --output-format stream-json
```

### Token Optimization

- Keep system prompts concise
- Use structured output to reduce tokens
- Regularly clean session history

## Security Practices

### Input Validation

Validate input in Skills:

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

### Permission Control

Limit Agent capability scope:

```yaml
# agent.yaml
permissions:
  file_access: true       # File read/write
  network_access: true    # Network access
  exec_commands: false    # Disable command execution

type_config:
  dangerously_skip_permissions: false  # Don't skip permission checks
```

### MCP Security

Limit MCP access scope:

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

## Testing Strategy

### Unit Testing

Test Agent responses:

```bash
# Test basic response
viben agent chat -n my-agent -p "Hello" --json

# Verify output format
viben agent chat -n my-agent -p "Generate JSON" --json | jq .
```

### Integration Testing

Test complete workflows:

```bash
#!/bin/bash
# test-agent.sh

# Create test agent (from template)
viben agent create test-agent --from-template my-template

# Test basic functionality
response=$(viben agent chat -n test-agent -p "Test query" --json)

# Verify response
if echo "$response" | jq -e '.success == true' > /dev/null; then
    echo "Test passed"
else
    echo "Test failed"
    exit 1
fi

# Clean up
viben agent remove test-agent
```

### Skill Testing

```bash
# Test a single skill
viben skill test my-skill --input "test input"
```

## Documentation Standards

### Agent README

Each Agent should include documentation:

```markdown
# Agent Name

## Description
[Main functionality and use cases of the Agent]

## Installation
```bash
viben agent create my-agent --from-template template-name
```

## Configuration
[Configuration options description]

## Usage Examples
```bash
viben agent chat -n my-agent -p "Example query"
```

## Skills
- skill-1: Functionality description
- skill-2: Functionality description

## MCP Servers
- mcp-1: Purpose description
- mcp-2: Purpose description

## Limitations
[Known limitations and considerations]
```

### Changelog

Record important changes:

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

## Common Patterns

### Expert Agent Pattern

Create domain experts:

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

### Research Assistant Pattern

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

### DevOps Agent Pattern

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

## Checklist

### Pre-release Checklist

- [ ] Configuration file syntax is correct
- [ ] Environment variables are properly referenced
- [ ] Skills are correctly configured
- [ ] MCP Servers are available
- [ ] Memory system is working
- [ ] Documentation is complete
- [ ] Tests pass

### Runtime Checklist

```bash
# Check agent status
viben agent status -n my-agent

# Check executor availability
viben executor list

# Check MCP configuration
viben mcp list --agent my-agent

# Check skills
viben skill list --agent my-agent
```

## Related Documentation

- [Agent Development Guide](./index.md)
- [MCP Development Guide](./mcp-development.md)
- [Skill Development Guide](./skill-development.md)
- [CLI Integration Guide](./cli-integration.md)
- [Agent Template Guide](./templates/agent-templates.md)
