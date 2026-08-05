# Team Organization 功能设计

> 状态：设计完成，待评审

## 概述

在 apps/web 里实现类似于 GitHub 的 Organization 功能，允许用户自己创建 Team（对应 Organization）和 Project（对应 Organization 里的 Repo）。

**核心思路：** Team 作为 users 表中的虚拟用户（`type='team'`），slug 全局唯一，与普通 user 共享 `/[slug]` 路由。

---

## 1. 设计决策

### 决策 1：Team 作为 users 表的虚拟用户

Team 在 `users` 表中创建一条记录，通过新增的 `type` 字段区分：

```typescript
// users 表新增字段
type: text('type', { enum: ['user', 'team'] }).default('user').notNull(),
```

| 属性 | 说明 |
|------|------|
| `type = 'user'` | 普通用户 |
| `type = 'team'` | 团队账号 |
| `role` | 保持不变，team 的 role 设为 `'user'` |
| `email` | 复用创建者的 email |
| `username` / `userSlug` | 均为 team_slug |
| `displayName` | 团队的人类友好名称 |
| slug 唯一性 | 全局唯一，创建时校验不与任何 user_slug / team_slug 冲突 |

**为什么不复用 `role` 字段：** `role` 是层级权限系统（user/developer/moderator/admin…），与实体类型（人 vs 团队）是正交的两个维度。分离 `type` 和 `role` 保持职责清晰。

### 决策 2：团队内角色权限

只有两种角色：**Owner** 和 **Member**。

| 能力 | Owner | Member |
|------|-------|--------|
| 查看团队和 Project | ✅ | ✅ |
| 创建 Project | ✅ | ✅ |
| 管理团队设置（profile、API keys） | ✅ | ❌ |
| 管理成员（邀请、移除） | ✅ | ❌ |
| 删除团队 | ✅ | ❌ |
| 离开团队 | ✅（需先转移 Owner） | ✅ |
| 删除自己创建的 Project | ✅ | ✅ |
| 删除他人创建的 Project | ✅ | ❌ |

创建团队的人自动成为第一个 Owner。可以有多人同时是 Owner。

---

## 2. 数据库 Schema

### 2.1 修改 users 表

```sql
ALTER TABLE users ADD COLUMN type TEXT NOT NULL DEFAULT 'user'
  CHECK (type IN ('user', 'team'));
```

### 2.2 team_members 表

```sql
CREATE TABLE team_members (
  id         TEXT PRIMARY KEY,
  team_id    TEXT NOT NULL REFERENCES users(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  role       TEXT NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  joined_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);
```

### 2.3 projects 表

```sql
CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  team_id         TEXT NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  project_slug    TEXT NOT NULL,
  description     TEXT,
  default_page_id TEXT,
  created_by      TEXT NOT NULL REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, project_slug)
);
```

### 2.4 project_pages 表

```sql
CREATE TABLE project_pages (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_id    TEXT NOT NULL REFERENCES published_pages(id),
  added_by   TEXT NOT NULL REFERENCES users(id),
  added_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, page_id)
);
```

---

## 3. 路由设计

### 3.1 新增路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/account/teams/new` | 创建团队 | 表单 → 成功后跳转 `/team/{team_slug}/invite` |
| `/team/{team_slug}/invite` | 邀请成员 | 创建后的 onboarding |
| `/settings/teams` | 团队管理列表 | 在 settings sidebar 新增"团队"入口 |
| `/team/{team_slug}/projects` | 团队 Projects 列表 | |
| `/team/{team_slug}/members` | 团队成员管理 | |
| `/team/{team_slug}/settings` | 团队设置 | 等价于 `/team/{team_slug}/settings/profile` |

### 3.2 复用现有路由（修改）

| 路由 | 现状 | 改动 |
|------|------|------|
| `/[user_slug]` | 用户个人主页 | 改为 `/[slug]`，根据 `users.type` 渲染用户主页或团队 Overview |
| `/[user_slug]/[page_id]` | 发布页面 | 若 `slug` 是 team → 渲染 Project 详情；若 `slug` 是 user → 渲染 page |

### 3.3 路由解析逻辑

```
GET /{slug}
  → db.query users WHERE userSlug = slug
  → if type = 'team' → 渲染 Team Overview（Tablist: Overview/Projects/Members/Settings）
  → if type = 'user' → 渲染用户主页

GET /{slug}/{second_slug}
  → db.query users WHERE userSlug = slug
  → if type = 'team' → db.query projects WHERE team_id = ? AND project_slug = ? → 渲染 Project 详情
  → if type = 'user' → 现有逻辑：渲染发布页面
```

### 3.4 Header 入口改动

| 位置 | 改动 | 文件 |
|------|------|------|
| CreateDropdown (+) | 分割线后增加"创建团队" → `/account/teams/new` | `lib/navigation/create-menu-items.tsx` |
| UserMenu（头像弹窗） | "技能"下方增加"团队" → `/settings/teams` | `components/layout/user-menu.tsx` |

---

## 4. 页面设计

### 4.1 创建团队 — `/account/teams/new`

- 参考现有 `(auth)` layout 样式（居中、简单）
- Team name 输入框 → 实时 debounce 校验 slug 可用性
- 下方实时预览 URL：`https://viben-web.vercel.app/{slug}`
- Terms of Service checkbox
- Next 按钮 → 创建成功 → 跳转 `/team/{slug}/invite`

### 4.2 邀请成员 — `/team/{slug}/invite`

- 搜索输入框按 username / full name / email 搜索用户
- Complete Setup / Skip this step → 都跳转 `/{slug}`

### 4.3 我的团队 — `/settings/teams`

- 在 settings layout 下，SettingsSidebar 新增"团队"入口
- 列表：icon + name + 角色标签 (Owner/Member) + Leave/Settings 按钮
- 顶部 New Team 按钮

### 4.4 团队主页 — `/{team_slug}`

- 左上角面包屑：Viben logo → team_slug（带下拉：切换团队 + Create new team）
- 顶部居中 Tablist：**[Overview]** **[Projects]** **[Members]** **[Settings]**

**Overview tab：** Project 卡片列表 + 创建 Project 按钮（引导用户创建第一个 Project）

**Projects tab：** 团队下所有 projects 列表（路由 `/team/{team_slug}/projects`）

**Members tab：** 成员列表 + 邀请按钮（Owner 可见）（路由 `/team/{team_slug}/members`）

**Settings tab：** 单列布局，两个卡片（路由 `/team/{team_slug}/settings`）：
- Profile 卡片：团队名称、slug、描述、头像
- API Key 卡片：列表 + Create New API Key + Revoke 按钮

### 4.5 Project 详情 — `/{team_slug}/{project_slug}`

- Topbar 顶部居中 Tablist：**[Overview]** **[Pages]** **[Settings]**

**Overview tab：** iframe 展示默认 page（在 Settings 里配置），无默认 page 时显示引导页

**Pages tab：** 该 Project 下的所有 pages 列表，可创建和管理 pages

**Settings tab：** Project 设置（具体内容待补充）

---

## 5. API 设计

所有 query 参数使用 **snake_case**（遵循项目 API 命名规范）。

### 5.1 团队

| Method | Endpoint | 说明 |
|--------|----------|------|
| `GET` | `/api/teams/check-slug?slug=xxx` | 校验 team slug 是否可用 |
| `POST` | `/api/teams` | 创建团队 → 建 users 记录（type=team）+ team_members 加创建者为 owner |
| `GET` | `/api/teams` | 获取当前用户所属的团队列表 |
| `GET` | `/api/teams/{team_slug}` | 获取团队详情 + 当前用户 role |
| `PATCH` | `/api/teams/{team_slug}` | 更新团队设置（需 owner） |
| `DELETE` | `/api/teams/{team_slug}` | 删除团队（需 owner） |

### 5.2 成员

| Method | Endpoint | 说明 |
|--------|----------|------|
| `POST` | `/api/teams/{team_slug}/members` | 邀请成员（需 owner） |
| `DELETE` | `/api/teams/{team_slug}/members/{user_slug}` | 移除成员（需 owner） |
| `PUT` | `/api/teams/{team_slug}/members/{user_slug}/role` | 修改成员角色（需 owner） |
| `POST` | `/api/teams/{team_slug}/leave` | 离开团队 |

### 5.4 团队 API Key

复用现有 `api_keys` 表，关联到 team 的 users 记录（`user_id` 指向 team 的 user id）。团队成员使用团队 API key 时可鉴权为 team。

### 5.5 项目

| Method | Endpoint | 说明 |
|--------|----------|------|
| `GET` | `/api/teams/{team_slug}/projects` | 获取团队下的 projects 列表 |
| `POST` | `/api/teams/{team_slug}/projects` | 创建 Project |
| `GET` | `/api/teams/{team_slug}/projects/{project_slug}` | 获取 Project 详情 |
| `PATCH` | `/api/teams/{team_slug}/projects/{project_slug}` | 更新 Project（需 owner 或创建者） |
| `DELETE` | `/api/teams/{team_slug}/projects/{project_slug}` | 删除 Project（需 owner 或创建者） |
| `GET` | `/api/teams/{team_slug}/projects/{project_slug}/pages` | 获取 Project 下的 pages |
| `POST` | `/api/teams/{team_slug}/projects/{project_slug}/pages` | 添加 page 到 Project |

---

## 6. 实现顺序

建议分 4 个阶段实现：

| 阶段 | 内容 |
|------|------|
| Phase 1 | DB schema + API（teams CRUD + 成员管理） |
| Phase 2 | 创建流程（`/account/teams/new` + `/team/{slug}/invite`）+ Header 入口 |
| Phase 3 | 团队主页（`/{slug}` 路由解析 + Tablist + Settings） |
| Phase 4 | Project CRUD + Project 详情页 |
