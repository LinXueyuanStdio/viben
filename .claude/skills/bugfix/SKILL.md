---
name: bugfix
description: "Autonomous bug fix with test validation loop - reproduces the bug with a test, iterates on fixes verifying against test suite, and only presents verified solutions. Use when user reports a bug, test failure, or unexpected behavior and wants an autonomous fix cycle rather than back-and-forth debugging."
---

# Autonomous Bug Fix

自主迭代修复循环：先复现，再修复，用测试验证，只呈现已验证的方案。

## 流程

### 1. 理解 Bug

从用户描述中提取：
- 预期行为
- 实际行为
- 复现条件（如有）
- 相关文件/模块

### 2. 复现（写测试）

**优先**找到或编写一个能复现问题的测试：

```bash
# 查找相关测试文件
find . -name "*.test.*" -path "*<module>*"
```

- 如果已有相关测试 → 添加一个失败用例
- 如果没有测试文件 → 创建最小化测试
- 运行确认测试失败：`pnpm test <test-file>`

如果无法用测试复现（UI 问题、环境依赖等），改用类型检查 + 手动验证作为成功标准。

### 3. 分析根因

在写修复代码之前：
- 追踪调用链
- 检查 git blame 了解变更历史
- 确认是 bug 还是 feature gap

### 4. 迭代修复（最多 3 次尝试）

每次尝试：

```
1. 实施修复
2. 运行测试：pnpm test <test-file>
3. 运行类型检查：pnpm typecheck
4. 如果通过 → 完成
5. 如果失败 → 分析原因，git checkout -- <files>，尝试不同方法
```

### 5. 结果

**成功时：**
```
✅ Bug 已修复
  根因：<一句话说明>
  修复：<做了什么>
  验证：所有测试通过 ✓
  修改文件：
    - path/to/file.ts (说明)
```

**3 次尝试后仍失败：**
```
⚠️ 未能自主修复，以下是发现：
  根因分析：<理解到的问题>
  尝试过的方法：
    1. ... → 失败原因
    2. ... → 失败原因
    3. ... → 失败原因
  建议：<需要用户提供的信息或方向>
```

## 关键约束

- 不要在没有验证的情况下声称"已修复"
- 每次尝试失败后必须 revert 变更再尝试下一个方法
- 如果需要用户提供架构方向（如 Dialog vs Sheet、browser vs Rust），在第一次尝试前就问
- 优先最小化修改，不要引入不必要的重构
