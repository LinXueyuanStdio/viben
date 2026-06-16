---
name: commit
description: "Semantic group commit - analyze all uncommitted changes, categorize by purpose (feat/fix/refactor/chore/docs), and create separate atomic commits with conventional commit messages. Use when user asks to 'group commit', 'batch commit', 'organize commits', 'semantic commit', or wants to commit all pending changes in a structured way."
---

# Semantic Group Commit

将所有未提交的变更按语义分组，创建独立的原子提交。

## 流程

### 1. 收集变更

```bash
git status
git diff --stat
git diff --stat --cached
```

### 2. 分析并分组

将变更按以下类别分组（按提交顺序）：

| 优先级 | 类型 | 前缀 | 说明 |
|--------|------|------|------|
| 1 | 基础设施/配置 | `🔧 [config]` | 依赖、构建配置、CI/CD |
| 2 | 重构 | `♻️ [refactor]` | 代码重构，不改变行为 |
| 3 | 功能 | `✨ [feat]` | 新功能 |
| 4 | 修复 | `🐛 [fix]` | Bug 修复 |
| 5 | 文档 | `📝 [docs]` | 文档变更 |
| 6 | 样式/UI | `💄 [style]` | 样式、UI 调整 |
| 7 | 测试 | `✅ [test]` | 测试相关 |

### 3. 分组规则

- **永远不要**混合功能变更和格式化/重构
- **相关测试**和其实现放在同一提交
- **配置变更**独立提交
- 如果一个文件的变更属于多个组，使用 `git add -p` 按 hunk 分别暂存
- 基础变更先提交，依赖它们的功能后提交

### 4. 执行提交

对每个分组：

```bash
git add <files>
git commit -m "<emoji> [<type>] <description>"
```

提交信息格式：
- 首行 ≤ 72 字符
- 使用中文描述
- 简洁明了，说明"做了什么"而非"怎么做的"

### 5. 报告

提交完成后展示摘要：

```
✅ 已创建 N 个提交：
  1. 🔧 [config] ...
  2. ✨ [feat] ...
  3. 🐛 [fix] ...
```

## 关键约束

- 不需要用户确认即可执行（用户调用此 skill 即表示授权）
- 不要 push 到远程
- 如果没有变更，直接告知用户
- 如果变更全部属于同一类别，创建单个提交即可
