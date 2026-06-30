# Admin 端功能完善设计

日期：2026-06-30

## 概述

完善 Viben Web 管理后台，实现三个方向的增强：
1. 用户管理增强（警告、封禁、角色管理）
2. 内容审核（评论管理、合集管理）
3. 管理员管理（super_admin 权限扩展）

---

## 一、数据库变更

### users 表新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `banned_at` | `timestamp` | NULL | 封禁时间，NULL 表示未封禁 |
| `banned_reason` | `text` | NULL | 封禁原因 |
| `warned_at` | `timestamp` | NULL | 上次警告时间 |
| `warned_reason` | `text` | NULL | 警告原因 |

全部 nullable，不影响现有功能。需执行 `cd apps/web && pnpm db:push`。

---

## 二、用户管理增强

### API 路由

#### `PATCH /api/admin/users/[id]/role`（扩展）
- 当前限制：仅允许 `user` ↔ `developer`
- 扩展后：`super_admin`/`admin` 可设置 `moderator`/`support`/`admin`
- 同级保护：不可修改其他 `super_admin`
- 自我保护：不可修改自己
- 权限：`users.ban`

#### `POST /api/admin/users/[id]/warn`（新增）
- Body：`{ reason: string }`
- 更新 `users.warned_at` + `users.warned_reason`
- 记录 moderationLogs（action=`warn`）
- 权限：`users.warn`

#### `POST /api/admin/users/[id]/ban`（新增）
- Body：`{ reason: string }`
- 更新 `users.banned_at` + `users.banned_reason`
- 记录 moderationLogs（action=`ban`）
- 权限：`users.ban`

#### `POST /api/admin/users/[id]/unban`（新增）
- 清空 `users.banned_at` + `users.banned_reason`
- 记录 moderationLogs（action=`unban`）
- 权限：`users.ban`

### UI 变更（UserTable 组件）

- 新增「状态」列：正常（灰）/ 已警告（黄）/ 已封禁（红）
- 操作栏按用户状态动态显示：
  - 正常普通用户：警告按钮 + 角色下拉 + 封禁按钮
  - 已封禁用户：解封按钮
  - 管理员用户（对 super_admin）：角色升降级下拉
- 封禁/警告操作弹出确认对话框填写原因

---

## 三、内容审核

### A. 评论审核（`/admin/comments`）

**页面：** `app/(admin)/admin/comments/page.tsx`

**组件：** `components/admin/comments/comment-moderation.tsx`

**筛选：**
- 按实体类型（全部 / MCP / 技能 / 合集）
- 按时间排序（最新 / 最早）
- 按内容搜索

**列表字段：** 用户（头像+名称）、内容（截断前50字）、所属实体、时间、操作

**操作：** 删除评论（确认对话框），记录 moderationLogs（action=`delete`）

**API：**
- `GET /api/admin/comments` — 分页列表，筛选参数 entityType/search/page/sort
- `DELETE /api/admin/comments/[id]` — 删除评论，记录日志

**权限：** `content.moderate`（查看），`content.delete`（删除）

### B. 合集审核（`/admin/collections`）

**页面：** `app/(admin)/admin/collections/page.tsx`

**组件：** `components/admin/collections/collection-moderation.tsx`

**筛选：**
- 按名称搜索
- 按可见性（全部 / 公开 / 私有）

**列表字段：** 名称、作者、条目数、收藏数、可见性、创建时间、操作

**操作：** 删除合集（确认对话框），记录 moderationLogs（action=`delete`）

**API：**
- `GET /api/admin/collections` — 分页列表，筛选参数 search/visibility/page
- `DELETE /api/admin/collections/[id]` — 删除合集，记录日志

**权限：** `content.moderate`（查看），`content.delete`（删除）

### 侧边栏更新

新增两个入口：
- 评论管理（`Flag` 图标，权限 `content.moderate`）
- 合集管理（`Layers` 图标，权限 `content.moderate`）

---

## 四、管理员管理

### 角色变更权限矩阵

| 操作者角色 | 可设置的目标角色 |
|-----------|----------------|
| `super_admin` / `admin` | `user`, `developer`, `support`, `moderator`, `admin` |
| `moderator` | `user`, `developer` |
| `support` | `user`, `developer` |

### 保护规则

- 不可修改同为 `super_admin` 的目标
- 不可修改自己的角色
- 所有角色变更记录 moderationLogs

### 实现

- 扩展 `PATCH /api/admin/users/[id]/role` 的 zod schema
- `UserTable` 根据当前 session 角色动态渲染可选角色列表

---

## 五、路由注册

route-registry.ts 新增：
- `/admin/comments` — 评论管理
- `/admin/collections` — 合集管理

---

## 六、不涉及

- 登录拦截（被封禁用户拒绝登录）— 属于 auth 中间件范畴，本 spec 不覆盖
- 邮件/通知系统 — 不在此范围内
