# Index Generator 设计文档

> 创建日期: 2026-03-11

## 概述

构建一个上下文索引生成系统，输出 Markdown 格式的索引文件到 `docs/index/`，供 AI Agent 和开发者使用。

### 目标

- 混合索引：同时索引代码结构和文档
- 多文件输出：`overview.md`, `code-index.md`, `docs-index.md`
- 混合方式：静态提取 + AI 增强重要文件
- 双触发：CLI 命令 `viben index generate` + `/index` 技能

---

## 整体架构

### 核心组件

```
packages/core/src/index-generator/
├── index.ts              # 导出入口
├── builder.ts            # IndexBuilder 主协调器
├── types.ts              # 类型定义
├── constants.ts          # 常量配置
├── analyzers/
│   ├── code-analyzer.ts  # 代码结构分析
│   └── docs-analyzer.ts  # 文档结构分析
├── formatters/
│   ├── code-formatter.ts # 生成 code-index.md
│   ├── docs-formatter.ts # 生成 docs-index.md
│   └── overview-formatter.ts # 生成 overview.md
└── enhancers/
    └── ai-enhancer.ts    # AI 增强描述（可选）
```

### 输出文件

```
docs/index/
├── overview.md      # 项目概览（技术栈、目录结构、模块关系）
├── code-index.md    # 代码索引（包/模块/关键文件）
└── docs-index.md    # 文档索引（按分类组织的文档清单）
```

---

## 代码分析器 (code-analyzer.ts)

### 职责

扫描项目代码结构，提取模块、包、关键文件信息。

### 数据结构

```typescript
interface CodeIndex {
  techStack: TechStack;
  packages: PackageInfo[];
  apps: AppInfo[];
  keyFiles: KeyFile[];
  directories: DirectoryTree;
}

interface TechStack {
  languages: string[];      // TypeScript, Python, etc.
  frameworks: string[];     // React, Tauri, FastAPI, etc.
  buildTools: string[];     // pnpm, turbo, etc.
}

interface PackageInfo {
  name: string;             // @viben/core
  path: string;             // packages/core
  description: string;      // 从 package.json 提取
  entryPoints: string[];    // src/index.ts
  exports: ExportInfo[];    // 主要导出
  dependencies: string[];   // 内部依赖
}

interface KeyFile {
  path: string;
  type: 'entry' | 'config' | 'core' | 'util';
  description: string;      // 静态提取或 AI 生成
  exports?: string[];       // 导出的函数/类/常量
  lineCount?: number;
  purpose?: string;         // AI 增强字段
}
```

### 分析逻辑

1. **技术栈检测** - 扫描 `package.json`、`tsconfig.json`、`pyproject.toml` 等
2. **包发现** - 遍历 `packages/`、`apps/` 目录，读取各 `package.json`
3. **关键文件识别** - 基于文件名模式：
   - 入口文件: `index.ts`, `main.ts`, `app.ts`
   - 配置文件: `*.config.ts`, `config/*.ts`
   - 核心文件: 导出数量 > 5 的文件
4. **导出提取** - 使用正则匹配 `export` 语句

### 过滤规则

```typescript
const SKIP_DIRS = [
  'node_modules', '.git', 'dist', 'build',
  '.next', '.turbo', '__pycache__', '.venv'
];

const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go'
];
```

---

## 文档分析器 (docs-analyzer.ts)

### 职责

扫描 `docs/` 目录，提取文档结构和元信息。

### 数据结构

```typescript
interface DocsIndex {
  categories: DocCategory[];
  totalCount: number;
  lastUpdated: string;
}

interface DocCategory {
  name: string;           // 'specs/frontend', 'specs/backend', 'plans'
  path: string;           // docs/specs/frontend
  description: string;    // 分类描述
  documents: DocInfo[];
}

interface DocInfo {
  path: string;           // docs/specs/frontend/core/design-system.md
  title: string;          // 从 # 标题提取
  description: string;    // 从首段或 AI 生成
  headings: string[];     // ## 二级标题列表
  wordCount: number;      // 字数估算
  lastModified: string;   // git 或 mtime
}
```

### 分析逻辑

1. **目录扫描** - 递归遍历 `docs/` 下所有 `.md` 文件
2. **分类识别** - 基于目录结构自动分组：
   - `docs/specs/frontend/*` → 前端规范
   - `docs/specs/backend/*` → 后端规范
   - `docs/specs/modules/*` → 模块规范
   - `docs/plans/*` → 设计文档
3. **元信息提取**：
   - 标题: 第一个 `# ` 开头的行
   - 描述: 标题后的第一个非空段落（限 200 字符）
   - 二级标题: 所有 `## ` 开头的行
4. **排序** - 按 lastModified 降序排列

### 静态提取示例

```typescript
function extractDocInfo(filePath: string): DocInfo {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // 提取标题
  const titleLine = lines.find(l => l.startsWith('# '));
  const title = titleLine?.slice(2).trim() || path.basename(filePath);

  // 提取描述（标题后第一个非空段落）
  const titleIndex = lines.indexOf(titleLine);
  let description = '';
  for (let i = titleIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#')) {
      description = line.slice(0, 200);
      break;
    }
  }

  // 提取二级标题
  const headings = lines
    .filter(l => l.startsWith('## '))
    .map(l => l.slice(3).trim());

  return { path: filePath, title, description, headings, ... };
}
```

---

## AI 增强器 (ai-enhancer.ts)

### 职责

为重要文件生成更详细的描述，弥补静态提取的不足。

### 重要文件判定

参考 Auto-Claude 的方式，结合项目特点：

```typescript
interface ImportanceScore {
  path: string;
  score: number;        // 0-100
  reasons: string[];    // 为什么重要
}

function calculateImportance(file: KeyFile): number {
  let score = 0;

  // 入口文件 +30
  if (/index\.(ts|js)$/.test(file.path)) score += 30;
  if (/main\.(ts|js)$/.test(file.path)) score += 30;

  // 导出数量 +2/个，最多 +20
  score += Math.min((file.exports?.length || 0) * 2, 20);

  // 核心目录 +20
  if (file.path.includes('/core/')) score += 20;
  if (file.path.includes('/lib/')) score += 15;

  // 配置文件 +10
  if (file.type === 'config') score += 10;

  // 文件大小（行数 > 200）+10
  if (file.lineCount > 200) score += 10;

  return score;
}

const AI_THRESHOLD = 50;  // 分数 >= 50 的文件使用 AI 增强
```

### AI 增强流程

```typescript
interface EnhanceRequest {
  path: string;
  content: string;      // 文件内容（截取前 2000 字符）
  exports: string[];    // 已提取的导出
}

interface EnhanceResult {
  description: string;  // 1-2 句描述
  purpose: string;      // 这个文件的作用
  keyExports: Array<{
    name: string;
    description: string;
  }>;
}

async function enhanceWithAI(
  requests: EnhanceRequest[],
  options: { model?: string; maxConcurrent?: number }
): Promise<Map<string, EnhanceResult>> {
  // 批量处理，减少 API 调用
  // 单次请求处理 5-10 个文件
  // 使用简单 prompt，控制成本
}
```

### Prompt 模板

```
分析以下代码文件，为每个文件提供简短描述：

文件 1: {path}
```typescript
{content_preview}
```

文件 2: ...

请以 JSON 格式返回：
{
  "files": [
    {
      "path": "...",
      "description": "一句话描述这个文件的作用",
      "purpose": "为什么这个文件重要",
      "keyExports": [{"name": "...", "description": "..."}]
    }
  ]
}
```

### 降级策略

- AI 调用失败 → 使用静态提取的描述
- 超时（30s）→ 跳过 AI 增强
- 无 API Key → 纯静态模式

---

## 输出格式 (Formatters)

### overview.md 格式

```markdown
# Project Overview

> 自动生成于 2026-03-11，请勿手动编辑

## 技术栈

| 类型 | 技术 |
|------|------|
| 语言 | TypeScript, Python |
| 前端 | React, Tailwind CSS |
| 桌面 | Tauri |
| 构建 | pnpm, Turborepo |

## 项目结构

\`\`\`
viben/
├── apps/
│   ├── desktop/     # Tauri 桌面应用
│   └── web/         # Next.js Web 应用
├── packages/
│   ├── core/        # 核心库（CLI、Gateway、Agent）
│   ├── kanban/      # 看板组件库
│   └── ui/          # 共享 UI 组件
└── docs/
    ├── specs/       # 规范文档
    └── plans/       # 设计文档
\`\`\`

## 模块依赖

\`\`\`
desktop ─→ core ─→ ui
web ────→ core ─→ kanban
\`\`\`

## 快速导航

- [代码索引](./code-index.md)
- [文档索引](./docs-index.md)
```

### code-index.md 格式

```markdown
# Code Index

> 自动生成于 2026-03-11

## Packages

### @viben/core

**路径**: `packages/core`
**描述**: 核心库，包含 CLI、Gateway、Agent 系统

**入口文件**:
- `src/index.ts` - 主导出
- `src/cli/index.ts` - CLI 命令入口

**关键模块**:
| 模块 | 路径 | 描述 |
|------|------|------|
| CLI | `src/cli/` | 命令行工具实现 |
| Gateway | `src/gateway/` | 本地 API 网关 |
| Agent | `src/agent/` | AI Agent 运行时 |

**主要导出**:
- `startGateway()` - 启动 Gateway 服务
- `runAgent()` - 运行 Agent
- `VibenConfig` - 配置类型

---

### @viben/kanban
...
```

### docs-index.md 格式

```markdown
# Documentation Index

> 自动生成于 2026-03-11 | 共 85 篇文档

## 规范文档 (specs/)

### 前端规范 (frontend/)

| 文档 | 描述 |
|------|------|
| [design-system.md](../specs/frontend/core/design-system.md) | 设计系统规范 |
| [chat-integration.md](../specs/frontend/features/chat-integration.md) | 聊天集成方案 |

### 后端规范 (backend/)

| 文档 | 描述 |
|------|------|
| [database-guidelines.md](../specs/backend/patterns/database-guidelines.md) | 数据库使用规范 |
| [error-handling.md](../specs/backend/patterns/error-handling.md) | 错误处理模式 |

## 设计文档 (plans/)

| 文档 | 日期 | 描述 |
|------|------|------|
| [task-status-commands-design.md](../plans/2026-03-11-task-status-commands-design.md) | 2026-03-11 | 任务状态命令设计 |
```

---

## CLI 命令与技能

### CLI 命令设计

```typescript
// packages/core/src/cli/commands/index-cmd.ts

import { Command } from 'commander';

export function createIndexCommand(): Command {
  const cmd = new Command('index')
    .description('生成项目上下文索引');

  cmd
    .command('generate')
    .description('生成或更新索引文件')
    .option('--no-ai', '禁用 AI 增强，仅使用静态提取')
    .option('--output <dir>', '输出目录', 'docs/index')
    .option('--verbose', '显示详细日志')
    .action(async (options) => {
      const { IndexBuilder } = await import('../../index-generator');

      const builder = new IndexBuilder({
        projectDir: process.cwd(),
        outputDir: options.output,
        enableAI: options.ai !== false,
        verbose: options.verbose,
      });

      await builder.generate();
    });

  return cmd;
}
```

### 命令行使用

```bash
# 基本用法
viben index generate

# 禁用 AI 增强（快速模式）
viben index generate --no-ai

# 指定输出目录
viben index generate --output docs/my-index

# 详细日志
viben index generate --verbose
```

### 输出示例

```
$ viben index generate

🔍 Analyzing project structure...
   Found 3 apps, 5 packages

📄 Scanning documentation...
   Found 85 markdown files

🤖 Enhancing with AI (12 important files)...
   ✓ packages/core/src/index.ts
   ✓ packages/core/src/cli/index.ts
   ... (10 more)

📝 Generating index files...
   ✓ docs/index/overview.md
   ✓ docs/index/code-index.md
   ✓ docs/index/docs-index.md

✅ Index generated successfully!
   Output: docs/index/
   Files: 3
   Time: 4.2s
```

### 技能定义

```yaml
# .claude/skills/index.md
name: index
description: 生成或更新项目上下文索引
triggers:
  - "生成索引"
  - "更新索引"
  - "/index"
```

---

## IndexBuilder 主协调器

### 职责

协调各分析器和格式化器，完成索引生成流程。

### 实现

```typescript
// packages/core/src/index-generator/builder.ts

import { CodeAnalyzer } from './analyzers/code-analyzer';
import { DocsAnalyzer } from './analyzers/docs-analyzer';
import { AIEnhancer } from './enhancers/ai-enhancer';
import { OverviewFormatter } from './formatters/overview-formatter';
import { CodeFormatter } from './formatters/code-formatter';
import { DocsFormatter } from './formatters/docs-formatter';

interface IndexBuilderOptions {
  projectDir: string;
  outputDir: string;
  enableAI: boolean;
  verbose: boolean;
}

export class IndexBuilder {
  private codeAnalyzer: CodeAnalyzer;
  private docsAnalyzer: DocsAnalyzer;
  private aiEnhancer: AIEnhancer | null;
  private options: IndexBuilderOptions;

  constructor(options: IndexBuilderOptions) {
    this.options = options;
    this.codeAnalyzer = new CodeAnalyzer(options.projectDir);
    this.docsAnalyzer = new DocsAnalyzer(options.projectDir);
    this.aiEnhancer = options.enableAI ? new AIEnhancer() : null;
  }

  async generate(): Promise<void> {
    const { projectDir, outputDir, verbose } = this.options;

    // 1. 分析代码结构
    this.log('🔍 Analyzing project structure...');
    const codeIndex = await this.codeAnalyzer.analyze();
    this.log(`   Found ${codeIndex.apps.length} apps, ${codeIndex.packages.length} packages`);

    // 2. 分析文档结构
    this.log('📄 Scanning documentation...');
    const docsIndex = await this.docsAnalyzer.analyze();
    this.log(`   Found ${docsIndex.totalCount} markdown files`);

    // 3. AI 增强（可选）
    if (this.aiEnhancer) {
      const importantFiles = this.findImportantFiles(codeIndex);
      this.log(`🤖 Enhancing with AI (${importantFiles.length} important files)...`);

      const enhanced = await this.aiEnhancer.enhance(importantFiles);
      this.applyEnhancements(codeIndex, enhanced);
    }

    // 4. 生成输出文件
    this.log('📝 Generating index files...');
    await fs.mkdir(outputDir, { recursive: true });

    const overview = new OverviewFormatter(codeIndex, docsIndex);
    await this.writeFile('overview.md', overview.format());

    const codeFormatter = new CodeFormatter(codeIndex);
    await this.writeFile('code-index.md', codeFormatter.format());

    const docsFormatter = new DocsFormatter(docsIndex);
    await this.writeFile('docs-index.md', docsFormatter.format());

    this.log('✅ Index generated successfully!');
  }

  private findImportantFiles(codeIndex: CodeIndex): KeyFile[] {
    return codeIndex.keyFiles
      .map(f => ({ file: f, score: calculateImportance(f) }))
      .filter(({ score }) => score >= AI_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)  // 最多 20 个文件
      .map(({ file }) => file);
  }

  private applyEnhancements(
    codeIndex: CodeIndex,
    enhanced: Map<string, EnhanceResult>
  ): void {
    for (const file of codeIndex.keyFiles) {
      const result = enhanced.get(file.path);
      if (result) {
        file.description = result.description;
        file.purpose = result.purpose;
      }
    }
  }

  private async writeFile(name: string, content: string): Promise<void> {
    const filePath = path.join(this.options.outputDir, name);
    await fs.writeFile(filePath, content, 'utf-8');
    this.log(`   ✓ ${filePath}`);
  }

  private log(message: string): void {
    if (this.options.verbose || !message.startsWith('   ')) {
      console.log(message);
    }
  }
}
```

### 错误处理

```typescript
async generate(): Promise<void> {
  try {
    // ... 主流程
  } catch (error) {
    if (error instanceof AIEnhancerError) {
      // AI 失败不阻塞，降级到静态模式
      console.warn('⚠️ AI enhancement failed, using static analysis only');
      this.aiEnhancer = null;
      return this.generate(); // 重试
    }
    throw error;
  }
}
```

---

## 实现计划

### 文件清单

需要创建的文件：

```
packages/core/src/index-generator/
├── index.ts                          # 导出入口
├── builder.ts                        # IndexBuilder 主协调器
├── types.ts                          # 类型定义
├── constants.ts                      # 常量配置
├── analyzers/
│   ├── code-analyzer.ts              # 代码分析器
│   └── docs-analyzer.ts              # 文档分析器
├── formatters/
│   ├── overview-formatter.ts         # overview.md 生成
│   ├── code-formatter.ts             # code-index.md 生成
│   └── docs-formatter.ts             # docs-index.md 生成
└── enhancers/
    └── ai-enhancer.ts                # AI 增强器

packages/core/src/cli/commands/
└── index-cmd.ts                      # CLI 命令

.claude/skills/
└── index.md                          # 技能定义
```

### 实现顺序

| 阶段 | 任务 | 依赖 |
|------|------|------|
| 1 | `types.ts` + `constants.ts` | 无 |
| 2 | `code-analyzer.ts` | 阶段 1 |
| 3 | `docs-analyzer.ts` | 阶段 1 |
| 4 | `code-formatter.ts` | 阶段 2 |
| 5 | `docs-formatter.ts` | 阶段 3 |
| 6 | `overview-formatter.ts` | 阶段 2, 3 |
| 7 | `ai-enhancer.ts` | 阶段 1 |
| 8 | `builder.ts` + `index.ts` | 阶段 4-7 |
| 9 | `index-cmd.ts` | 阶段 8 |
| 10 | 技能文件 + 测试 | 阶段 9 |

### 测试策略

```typescript
// packages/core/src/index-generator/builder.test.ts

describe('IndexBuilder', () => {
  it('should generate all three index files', async () => {
    const builder = new IndexBuilder({
      projectDir: fixtures.projectDir,
      outputDir: tmpDir,
      enableAI: false,
      verbose: false,
    });

    await builder.generate();

    expect(fs.existsSync(path.join(tmpDir, 'overview.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'code-index.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs-index.md'))).toBe(true);
  });

  it('should work without AI enhancement', async () => {
    // --no-ai 模式测试
  });

  it('should handle empty docs directory gracefully', async () => {
    // 边界情况测试
  });
});
```

### 验收标准

- [ ] `viben index generate` 命令可正常执行
- [ ] 生成的三个 md 文件格式正确
- [ ] `--no-ai` 模式可跳过 AI 调用
- [ ] 空目录、权限错误等边界情况有友好提示
- [ ] 技能 `/index` 可正常调用

---

## 参考

- Auto-Claude ideation 模块: `/Users/lxy/Documents/GitHub/others/Auto-Claude/apps/backend/ideation/`
- Auto-Claude context 模块: `/Users/lxy/Documents/GitHub/others/Auto-Claude/apps/backend/context/`
