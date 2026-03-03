# Feature: viben session 命令实现

## 概述

实现 `viben session` 命令，用于会话记录管理。底层调用现有 Python 脚本。

## 需求

### 命令

1. `viben session add` - 添加会话记录
   - `--title, -t` - 会话标题（必填）
   - `--commit, -c` - 关联的 commit hash
   - `--summary, -s` - 会话摘要
   - `--content-file` - 详细内容文件路径

2. `viben session list` - 列出会话历史（需要新增）
   - `--all` - 所有用户的会话
   - `--limit, -n` - 限制显示条数
   - `--json` - JSON 格式输出

### 技术方案

1. 在 `packages/core/src/cli/commands/` 创建 `session.ts`
2. 调用 Python 脚本

### Python 脚本映射

| 命令 | 脚本 |
|------|------|
| `viben session add` | `add_session.py` |
| `viben session list` | 需要新增 `list_session.py` 或从 index.md 解析 |

## 实现参考

### session add 实现

```bash
# Python 脚本调用示例
python3 add_session.py --title "Title" --commit "hash" --summary "Summary"
```

### session list 实现

由于没有现成脚本，有两个方案：

**方案 A**: 在 TypeScript 中直接解析 `.viben/workspace/{user}/index.md`
- 解析 `@@@auto:session-history` 区域
- 提取会话列表

**方案 B**: 新增 Python 脚本 `list_session.py`
- 保持与其他命令一致的实现方式

建议：先用方案 A 实现，后续可迁移到方案 B。

## Acceptance Criteria

- [ ] 创建 `packages/core/src/cli/commands/session.ts`
- [ ] 实现 `viben session add --title --commit --summary`
- [ ] 实现 `viben session list`
- [ ] 实现 `viben session list --json`
- [ ] 在 `commands/index.ts` 注册命令
- [ ] 添加单元测试 `session.test.ts`
- [ ] `pnpm build` 编译通过

## 相关文件

- `.trellis/spec/modules/cli/session.md` - Spec 文档
- `packages/core/templates/viben/scripts/add_session.py` - Python 脚本
