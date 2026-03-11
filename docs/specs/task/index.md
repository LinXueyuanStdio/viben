# Task System Specification

本目录包含 viben task 系统的完整规范文档。

## 目录

| 文档 | 说明 |
|------|------|
| [commands.md](./commands.md) | 命令速查表 |
| [lifecycle.md](./lifecycle.md) | 任务完整生命周期详解 |
| [example-avatar-upload.md](./example-avatar-upload.md) | 实际例子：用户头像上传功能 |

## 快速参考

### 任务状态流转

```
backlog → queue → in_progress → human_review → completed → archived
                       ↓              ↓
                    paused         rejected → backlog
                       ↓
                    failed → retry → queue
                       ↓
                   cancelled
```

### 常用命令速查

```bash
# 创建任务
viben task create "<title>" --slug <name>

# 配置上下文
viben task init-context <task> -t <type>
viben task add-context <task> <files...> -r "<reason>"

# 执行流程
viben task enqueue <task>    # 加入队列
viben task start <task>      # 开始执行
viben task status <task>     # 查看状态

# 审核流程
viben task review <task>     # 人工审核
viben task approve <task>    # 批准
viben task reject <task>     # 拒绝

# 完成流程
viben task finish <task>     # 清除当前任务
viben task archive <task>    # 归档
viben task create-pr <task>  # 创建 PR
```

## 相关文档

- [开发工作流](../../../.viben/workflow.md) - 完整开发工作流指南
- [后端规范](../backend/index.md) - 后端开发规范
- [前端规范](../frontend/index.md) - 前端开发规范
