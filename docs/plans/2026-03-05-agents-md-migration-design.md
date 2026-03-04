# Agent 配置格式升级：config.yaml → AGENTS.md

## 概述

将 agent 配置文件从 `config.yaml` 升级为 `AGENTS.md`，与 Claude Code subagent 配置格式对齐，提升可读性。

## 新格式示例

```markdown
---
name: check
description: |
  Code quality check expert. Reviews code changes against specs and self-fixes issues.
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - mcp__exa__web_search_exa
model: opus
provider: anthropic
temperature: 0.7
maxTokens: 4096
executorType: CLAUDE_CODE
executorConfig:
  planMode: false
mcpServers:
  - filesystem
  - git
skills:
  - code-review
planMode: false
approvals: false
appendPrompt: |
  Always check twice before submitting.
createdAt: "2024-01-15T10:30:00Z"
updatedAt: "2024-01-15T10:30:00Z"
---

You are a code quality expert. Your job is to review code changes against specifications and fix issues.

## Guidelines

- Always read the spec first
- Check for common issues
- Self-fix when possible
```

## 变更总结

| 项目 | 旧格式 | 新格式 |
|------|--------|--------|
| 文件名 | `config.yaml` | `AGENTS.md` |
| systemPrompt | frontmatter 字段 | markdown body |
| tools | 不存在 | 新增 `string[]` 字段 |
| 其他字段 | YAML | frontmatter YAML |

## 迁移策略

**强制迁移，不考虑兼容**：直接切换到新格式，旧 `config.yaml` 文件将被忽略。

## 实现步骤

### 1. 添加依赖

```bash
pnpm add gray-matter --filter @viben/core
```

### 2. 新建 `src/config/markdown.ts`

```typescript
import matter from "gray-matter";
import { readFile, writeFile } from "node:fs/promises";
import { ensureDir } from "./yaml";
import { dirname } from "node:path";

export interface MarkdownConfig<T> {
  frontmatter: T;
  body: string;
}

export async function readMarkdownConfig<T>(path: string): Promise<MarkdownConfig<T> | null> {
  const content = await readFile(path, "utf-8");
  const { data, content: body } = matter(content);
  return { frontmatter: data as T, body: body.trim() };
}

export async function writeMarkdownConfig<T extends Record<string, unknown>>(
  path: string,
  frontmatter: T,
  body: string
): Promise<void> {
  await ensureDir(dirname(path));
  const content = matter.stringify(body, frontmatter);
  await writeFile(path, content, "utf-8");
}
```

### 3. 修改 `src/config/paths.ts`

```typescript
export function getAgentConfigPath(agentId: string): string {
  return join(getAgentDir(agentId), "AGENTS.md");
}
```

### 4. 修改 `src/agents/types.ts`

```typescript
export interface AgentConfigFile {
  name: string;
  description?: string;
  tools?: string[];  // 新增
  model?: string;
  provider?: string;
  // systemPrompt 移除，改为 body
  appendPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  executorType?: string;
  executorConfig?: Record<string, unknown>;
  mcpServers?: string[];
  skills?: string[];
  planMode?: boolean;
  approvals?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 5. 修改 `src/types/index.ts`

在以下接口中添加 `tools` 字段：
- `Agent`: `tools: string[]`
- `AgentConfig`: `tools?: string[]`
- `CreateAgentOptions`: `tools?: string[]`
- `AgentUpdate`: `tools?: string[]`

### 6. 修改 `src/agents/index.ts`

更新 AgentManager 的读写逻辑：
- `getAgent()` / `getAgentFromDir()` 改用 `readMarkdownConfig()`
- `createAgent()` / `updateAgent()` / `updateAgentInDir()` 改用 `writeMarkdownConfig()`
- `systemPrompt` 从 markdown body 读取/写入

## 影响范围

**需要修改：**
- `packages/core/src/config/paths.ts`
- `packages/core/src/config/markdown.ts` (新建)
- `packages/core/src/agents/types.ts`
- `packages/core/src/types/index.ts`
- `packages/core/src/agents/index.ts`

**不需要修改：**
- Gateway API 接口（底层存储变化，API 不变）
- CLI 命令
- Desktop 应用
