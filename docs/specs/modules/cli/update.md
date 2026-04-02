# viben update

> 更新 Viben 工作区组件 (模板文件)。

## 概述

`viben update` 用于更新工作区中的模板文件，包括：
- `docs/idea-types/` - Idea 类型模板 (用于 `viben idea generate`)
- `docs/reward-types/` - Reward 类型模板 (用于 `viben evo reward`)

这些模板文件会随着 Viben 版本更新而改进，使用此命令可以获取最新版本。

---

## 命令

```bash
# 更新 idea-types 模板
viben update --idea-types

# 更新 reward-types 模板
viben update --reward-types

# 同时更新两者
viben update --idea-types --reward-types

# 指定目标目录
viben update --idea-types <target-dir>
viben update --idea-types ./my-project

# 强制覆盖现有文件
viben update --idea-types --force

# 跳过已存在的文件
viben update --idea-types --skip-existing

# JSON 输出
viben update --idea-types --json
```

---

## 参数说明

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `--idea-types` | * | - | 更新 docs/idea-types/ 模板 |
| `--reward-types` | * | - | 更新 docs/reward-types/ 模板 |
| `[target-dir]` | - | `.` (当前目录) | 目标目录路径 |
| `--force, -f` | - | `false` | 强制覆盖现有文件 |
| `--skip-existing, -s` | - | `false` | 跳过已存在的文件 |
| `--json` | - | `false` | JSON 格式输出 |

*至少需要指定一个更新选项 (`--idea-types` 或 `--reward-types`)

---

## 更新的文件

### docs/idea-types/

用于 `viben idea generate` 命令的 Idea 类型模板：

```
docs/idea-types/
├── code_improvements.md        # 代码改进建议
├── code_quality.md             # 代码质量提升
├── documentation_gaps.md       # 文档缺失发现
├── performance_optimizations.md # 性能优化建议
├── security_hardening.md       # 安全加固建议
└── ui_ux_improvements.md       # UI/UX 改进建议
```

### docs/reward-types/

用于 `viben evo reward` 命令的 Reward 类型模板：

```
docs/reward-types/
├── code_correctness.md    # 代码正确性评估
├── code_quality.md        # 代码质量评估
├── documentation.md       # 文档完整性评估
├── performance.md         # 性能评估
├── security.md            # 安全性评估
└── test_coverage.md       # 测试覆盖率评估
```

---

## 输出示例

**`viben update --idea-types` (Human)**:
```
Updating Viben workspace...
  Target: /path/to/project

  Updating idea-types templates...

✓ Workspace updated successfully!

Updated 6 files:
  docs/idea-types/code_improvements.md
  docs/idea-types/code_quality.md
  docs/idea-types/documentation_gaps.md
  docs/idea-types/performance_optimizations.md
  docs/idea-types/security_hardening.md
  docs/idea-types/ui_ux_improvements.md
```

**`viben update --idea-types --reward-types` (同时更新)**:
```
Updating Viben workspace...
  Target: /path/to/project

  Updating idea-types templates...
  Updating reward-types templates...

✓ Workspace updated successfully!

Updated 12 files:
  docs/idea-types/code_improvements.md
  docs/idea-types/code_quality.md
  ...
  docs/reward-types/code_correctness.md
  docs/reward-types/code_quality.md
  ...
```

**`viben update --idea-types --json`**:
```json
{
  "success": true,
  "data": {
    "path": "/path/to/project",
    "files": [
      "docs/idea-types/code_improvements.md",
      "docs/idea-types/code_quality.md",
      "docs/idea-types/documentation_gaps.md",
      "docs/idea-types/performance_optimizations.md",
      "docs/idea-types/security_hardening.md",
      "docs/idea-types/ui_ux_improvements.md"
    ],
    "count": 6
  }
}
```

**错误: 未指定更新选项**:
```
Error: No update option specified.

Available options:
  --idea-types     Update idea-types templates in docs/idea-types/
  --reward-types   Update reward-types templates in docs/reward-types/

Example:
  viben update --idea-types
  viben update --reward-types
```

**文件已存在 (默认行为)**:
```
Updating Viben workspace...
  Target: /path/to/project

  Updating idea-types templates...

✓ Workspace updated successfully!

No files were updated (all files already exist).
```

---

## 文件覆盖策略

| 选项 | 文件已存在时的行为 |
|------|-------------------|
| (默认) | 跳过，不报错 |
| `--force` | 覆盖现有文件 |
| `--skip-existing` | 跳过，不报错 (与默认行为相同) |

---

## 与 viben init 的关系

`viben init` 在初始化工作区时会自动创建 `docs/idea-types/` 和 `docs/reward-types/` 目录。

`viben update` 用于在 Viben 升级后更新这些模板到最新版本，而不影响工作区的其他配置。

---

## Acceptance Criteria

### 基本更新
- [x] `viben update --idea-types` 更新 idea-types 模板
- [x] `viben update --reward-types` 更新 reward-types 模板
- [x] 可以同时指定多个更新选项
- [x] 未指定选项时报错并显示帮助

### 文件处理
- [x] 默认跳过已存在的文件
- [x] `--force` 覆盖现有文件
- [x] `--skip-existing` 明确跳过已存在的文件

### 输出格式
- [x] 默认输出人类可读格式
- [x] `--json` 输出 JSON 格式
- [x] 返回更新的文件列表
- [x] 返回更新的文件数量

---

## Related Documents

- [init.md](./init.md) - 工作区初始化
- [idea.md](./idea.md) - Idea 生成与管理
- [evo.md](./evo.md) - FileEvo 自我进化
