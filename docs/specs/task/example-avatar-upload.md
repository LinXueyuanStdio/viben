# 实际例子：添加用户头像上传功能

本文档以「用户头像上传功能」为例，演示 viben task 的完整生命周期流程。

## 需求背景

为用户设置页面添加头像上传功能，支持：
- 图片选择和预览
- 裁剪和压缩
- 上传到服务器

---

## 1. 创建任务

```bash
# 创建任务目录
viben task create "用户头像上传功能" --slug avatar-upload

# 输出示例:
# ✓ Created task: .viben/tasks/03-12-avatar-upload/
# ✓ Task ID: avatar-upload
# ✓ Status: backlog

# 查看创建的任务
viben task view avatar-upload
```

---

## 2. 配置上下文

```bash
# 初始化空上下文文件
viben task init-context avatar-upload

# 输出示例:
# ✓ Created implement.jsonl
# ✓ Created check.jsonl
# ✓ Created fix.jsonl

# 添加相关的 code-spec 文件
viben task add-context avatar-upload \
  docs/specs/frontend/component-guidelines.md \
  -r "组件规范"

viben task add-context avatar-upload \
  docs/specs/frontend/hook-guidelines.md \
  -r "Hook 规范"

# 查看已配置的上下文
viben task list-context avatar-upload

# 输出示例:
# implement.jsonl:
#   - docs/specs/frontend/index.md (default)
#   - docs/specs/frontend/component-guidelines.md (组件规范)
#   - docs/specs/frontend/hook-guidelines.md (Hook 规范)

# 设置 Git 分支
viben task set-branch avatar-upload -b feat/avatar-upload

# 设置 PR 目标分支
viben task set-base avatar-upload -b main

# 验证上下文文件
viben task validate-context avatar-upload

# 输出示例:
# ✓ All context files exist
```

---

## 3. 生成 PRD

使用 Plan Agent 分析需求并生成 PRD（上下文配置后，Plan Agent 可以参考 code-spec 生成更准确的 PRD）：

```bash
# 启动 Plan Agent 生成 PRD
viben task plan

# 输出示例:
# ✓ Starting Plan Agent...
# ✓ Loading context from implement.jsonl...
# ✓ Analyzing requirements...
# ✓ Generated PRD: .viben/tasks/03-12-avatar-upload/prd.md

# 查看生成的 PRD
cat .viben/tasks/03-12-avatar-upload/prd.md
```

Plan Agent 会通过对话收集需求，生成的 PRD 示例：

```markdown
# 用户头像上传功能

## Goal
为用户设置页面添加头像上传功能

## Requirements
- 支持 JPG/PNG/GIF 格式
- 最大文件大小 5MB
- 支持图片裁剪（1:1 比例）
- 上传前压缩到 200KB 以内

## Acceptance Criteria
- [ ] 用户可以点击头像区域选择图片
- [ ] 选择后显示裁剪界面
- [ ] 裁剪确认后自动压缩并上传
- [ ] 上传成功后更新显示
- [ ] 错误情况有友好提示

## Technical Notes
- 使用 react-image-crop 进行裁剪
- 使用 browser-image-compression 进行压缩
- API: POST /api/user/avatar
```

---

## 4. 加入队列

```bash
# 将任务加入执行队列
viben task enqueue avatar-upload

# 输出示例:
# ✓ Task avatar-upload moved to queue
# ✓ Status: backlog → queue

# 查看任务列表，确认状态
viben task list

# 输出示例:
# ID              STATUS   TITLE
# avatar-upload   queue    用户头像上传功能
```

---

## 5. 执行任务

```bash
# 启动智能体执行任务
viben task start avatar-upload

# 输出示例:
# ✓ Starting task: avatar-upload
# ✓ Branch: feat/avatar-upload
# ✓ Agent: default
# ✓ Status: queue → in_progress
# ...智能体开始工作...

# 监控执行状态
viben task status avatar-upload

# 输出示例:
# Task: avatar-upload
# Status: in_progress
# Progress: Implementing AvatarUpload component...
# Files modified:
#   - apps/desktop/src/components/user/avatar-upload.tsx
#   - apps/desktop/src/hooks/use-avatar-upload.ts

# 如需暂停（例如需要人工介入）
viben task pause avatar-upload

# 输出示例:
# ✓ Task paused
# ✓ Status: in_progress → paused

# 恢复执行
viben task resume avatar-upload

# 输出示例:
# ✓ Task resumed
# ✓ Status: paused → queue
```

---

## 6. 人工审核

任务执行完成后自动进入 review 状态。

```bash
# 查看任务详情
viben task review avatar-upload

# 输出示例:
# ═══════════════════════════════════════════
# Task: avatar-upload
# Title: 用户头像上传功能
# Status: review
# Branch: feat/avatar-upload
# ═══════════════════════════════════════════
#
# Files Changed:
#   + apps/desktop/src/components/user/avatar-upload.tsx
#   + apps/desktop/src/hooks/use-avatar-upload.ts
#   M apps/desktop/src/pages/settings/profile.tsx
#
# Commits:
#   abc1234 feat(desktop): add AvatarUpload component
#   def5678 feat(desktop): implement image crop and compress
#
# PRD Checklist:
#   ✓ 用户可以点击头像区域选择图片
#   ✓ 选择后显示裁剪界面
#   ✓ 裁剪确认后自动压缩并上传
#   ✓ 上传成功后更新显示
#   ✓ 错误情况有友好提示
# ═══════════════════════════════════════════

# 运行测试验证
pnpm test apps/desktop/src/components/user/avatar-upload.test.tsx
pnpm lint

# 如果满意，批准任务
viben task approve avatar-upload

# 输出示例:
# ✓ Task approved
# ✓ Status: review → completed

# 如果需要修改，拒绝任务
viben task reject avatar-upload -r "缺少文件大小校验的错误提示"

# 输出示例:
# ✓ Task rejected
# ✓ Reason: 缺少文件大小校验的错误提示
# ✓ Status: review → backlog
```

---

## 7. 创建 PR

```bash
# 从任务创建 Pull Request
viben task create-pr avatar-upload

# 输出示例:
# ✓ Creating PR for task: avatar-upload
# ✓ Branch: feat/avatar-upload → main
# ✓ Title: feat(desktop): 用户头像上传功能
#
# PR created: https://github.com/org/repo/pull/123
```

### PR 内容示例

```markdown
## Summary
- 新增 AvatarUpload 组件，支持图片选择、裁剪、压缩
- 新增 useAvatarUpload hook 处理上传逻辑
- 集成到用户设置页面

## Changes
- `avatar-upload.tsx` - 头像上传组件
- `use-avatar-upload.ts` - 上传逻辑 hook
- `profile.tsx` - 集成到设置页面

## Test Plan
- [x] 选择 JPG/PNG/GIF 图片正常显示
- [x] 超过 5MB 显示错误提示
- [x] 裁剪功能正常
- [x] 上传成功更新头像
- [x] 网络错误有友好提示
```

---

## 8. 归档任务

```bash
# 清除当前任务标记
viben task finish avatar-upload

# 归档已完成的任务
viben task archive avatar-upload

# 输出示例:
# ✓ Task archived to: .viben/tasks/archive/2026-03/03-12-avatar-upload/

# 查看归档列表
viben task list-archive

# 输出示例:
# 2026-03:
#   03-12-avatar-upload  用户头像上传功能  completed
```

---

## 9. 记录会话

```bash
# 记录本次开发会话
viben task add-session \
  --title "实现用户头像上传" \
  --commit "abc1234" \
  --summary "完成头像上传组件，支持裁剪和压缩"

# 输出示例:
# ✓ Session added to journal-1.md
# ✓ Updated workspace/viben/index.md
```

---

## 异常情况处理

### 任务执行失败

```bash
# 查看失败原因
viben task status avatar-upload --verbose

# 输出示例:
# Status: failed
# Error: TypeScript compilation error in avatar-upload.tsx
# Line 45: Property 'onCrop' does not exist on type...

# 重试任务
viben task retry avatar-upload

# 输出示例:
# ✓ Retrying task: avatar-upload
# ✓ Status: failed → queue
```

### 需求变更取消任务

```bash
# 取消任务
viben task cancel avatar-upload -r "需求变更，改用第三方头像服务"

# 输出示例:
# ✓ Task cancelled
# ✓ Reason: 需求变更，改用第三方头像服务
# ✓ Status: * → cancelled
```

### 误加入队列

```bash
# 从队列移回 backlog
viben task dequeue avatar-upload

# 输出示例:
# ✓ Task dequeued
# ✓ Status: queue → backlog
```

---

## 完整流程时间线

```
Day 1 上午
├── 09:00 创建任务 (backlog)
├── 09:15 配置上下文
├── 09:30 生成 PRD (viben task plan)
└── 09:45 加入队列 (queue)

Day 1 下午
├── 14:00 启动执行 (in_progress)
├── 14:30 暂停 (paused) - 等待 API 确认
├── 15:00 恢复执行 (in_progress)
└── 17:00 执行完成 (review)

Day 2 上午
├── 09:00 人工审核
├── 09:30 发现问题，拒绝 (backlog)
├── 10:00 修复后重新排队 (queue)
├── 10:15 重新执行 (in_progress)
└── 11:00 执行完成 (review)

Day 2 下午
├── 14:00 审核通过 (completed)
├── 14:15 创建 PR
├── 15:00 PR 合并
└── 15:15 归档任务 (archived)
```

---

## 相关文档

- [lifecycle.md](./lifecycle.md) - 完整生命周期指令
- [../frontend/component-guidelines.md](../frontend/component-guidelines.md) - 组件规范
- [../frontend/hook-guidelines.md](../frontend/hook-guidelines.md) - Hook 规范
