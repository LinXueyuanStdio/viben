# Team Organization 需求文档

> 自然语言需求描述，来自产品讨论。

## 背景

我们要在 apps/web 里实现类似于 GitHub 的 Organization 功能，允许用户自己创建 Team（对应 GitHub 的 Organization）和 Project（对应 Organization 里的 Repo）。

Team 本质是一个协作空间，Project 是一个可扩展的发布物容器（目前类似于 page，后续会扩展支持挂载网盘、日历等应用）。

---

## 1. 首页 Header 入口

### 1.1 右上角 "+" 下拉框

在 header 右上角的 "+" 下拉菜单中增加一个分割线，添加"创建团队"选项。点击跳转到 `/account/teams/new`。

### 1.2 头像弹窗

在 header 右上角头像弹窗里，在"技能"这个 item 的下面增加一个 item："团队"。点击跳转到 `/settings/teams`。

---

## 2. 团队管理页面

**路由：** `/settings/teams`

参考 GitHub 的 Organization 管理页面布局：

```
【Teams】                    【New Team】

【icon  name  (Member)          [Leave]】
【icon  name  (Owner)           [Settings] [Leave]】
...
```

- 列表展示用户所属的所有团队
- 每行显示：图标、团队名、角色（Member/Owner）、操作按钮（Leave/Settings）
- `[Settings]` 跳转到 `/team/{team_slug}/settings`

---

## 3. 创建团队

**路由：** `/account/teams/new`

### 3.1 表单页面

```
Tell us about your team

# Set up your team

Team name
[             ] ← 输入框，下方异步检查 team slug 是否合法
  如果非法：The name 'xxx' is already taken.

This will be the name of your account on Viben.
Your URL will be: https://viben-web.vercel.app/{team-slug}.

[checkbox] I hereby accept the [Terms of Service]. For more information
about Viben's privacy practices, see the [Viben Privacy Statement].

[    Next    ]
```

- Team name 输入框下方实时异步校验 slug 合法性（debounce）
- slug 非法时显示错误提示 "The name 'xxx' is already taken."
- 下方实时预览 URL 格式：`https://viben-web.vercel.app/{team-slug}`
- 需勾选 Terms of Service 复选框才能继续
- 点击 Next 创建团队，成功后跳转到邀请页面

### 3.2 邀请页面

创建成功后跳转到 `/team/{team_slug}/invite`

```
Start collaborating

# Welcome to {team_slug}

Add team members
Team members will be able to view projects.

Search by username, full name or email address
[             ] ← 搜索输入框

[    Complete Setup    ] → 跳转到 /{team_slug}
Skip this step          → 跳转到 /{team_slug}
```

- 搜索用户（按 username / full name / email）
- Complete Setup 和 Skip this step 都跳转到团队主页 `/{team_slug}`

---

## 4. 团队主页

**路由：** `/{team_slug}`

顶部居中 Tabs: **[Overview]** **[Projects]** **[Members]** **[Settings]**

### 面包屑

左上角面包屑（参考 `components/layout/page-switcher-popover.tsx` 的 ChevronsUpDown 下拉模式）：

**团队主页 `/{team_slug}`：**
```
icon / [{team_slug} ^v]
```

**Project 详情 `/{team_slug}/{project_slug}`：**
```
icon / [{team_slug} ^v] / [{project_slug} ^v]
```

- `icon` 仅 Viben Logo（无文字），点击回首页
- `^v` 是 `ChevronsUpDown` 图标，点击弹出 Popover
- **Team switcher** 下拉：用户所属团队列表（去重、最多 10 个）+ 末尾 "View all teams" → `/settings/teams` + "Create new team" → `/account/teams/new`
- **Project switcher** 下拉：当前团队下的 projects 列表 + 搜索框
- 参考实现：`components/layout/page-switcher-popover.tsx`（搜索、loading、空态、选中态）

### URL 映射

| Tab | URL |
|-----|-----|
| Overview | `/{team_slug}` |
| Projects | `/team/{team_slug}/projects` |
| Members | `/team/{team_slug}/members` |
| Settings | `/team/{team_slug}/settings`（等价于 `/team/{team_slug}/settings/profile`）|

### Overview

引导用户创建 Project。展示 project 卡片列表 + 创建 project 按钮。

### Settings

团队设置页面，默认展示 profile 子页。`/team/{team_slug}/settings` 和 `/team/{team_slug}/settings/profile` 等价，参考 `/settings` 和 `/settings/profile` 的关系。初期只有一个页面，不需要 sidebar 或者两栏布局，直接单列。

两个卡片：

**Profile 卡片：** 团队名称、slug、描述、头像等信息。

**API Key 卡片：** 团队的 API Key 管理。
- 第一行：API Keys + 【Create New API Key】按钮
- 第二行：列表。name、key、created_at、操作按钮（icon Revoke）

---

## 5. Project 详情页

**路由：** `/{team_slug}/{project_slug}`

这个路由不会和现有的 `/[user_slug]/[page_id]` 冲突，因为 Team 是在 users 表里用 `type` 字段区分的。路由解析时先查 users 表判断是 user 还是 team。

Topbar 顶部居中 Tablist: **[Overview]** **[Pages]** **[Settings]**

### Overview

展示默认 page（在 Settings 里配置）。如果没有配置默认 page，展示引导页提示用户创建第一个 page。

展示方式：HTML iframe，与现有 page 发布后的展示方式一致。

### Pages

该 Project 下的所有 pages 列表，可以创建和管理 pages。

### Settings

Project 设置（具体内容待补充）。

---

## 6. 关键设计决策

### 6.1 Team 在 user 表里是一个虚拟用户

会在 `users` 表里创建一个类型为 team 的虚拟用户，通过新增 `type` 字段区分（`'user'` | `'team'`），而不是复用 `role` 字段。role 保持不变。

- Team 的 email 复用创建者的 email
- Team 的 username = userSlug = team_slug
- Team 的 displayName 是人类友好名称
- slug 全局唯一：创建团队时校验不与任何 user_slug 冲突

### 6.2 团队角色

只有 Owner 和 Member 两种角色，比较简单。创建团队的人自动成为第一个 Owner。可以有多人同时是 Owner。

Member 可以删除自己创建的 Project，但只有 Owner 能删除他人创建的 Project。

### 6.3 创建 Project

创建 Project 的表单可以直接复用现在 page 的创建表单，从 page 表那边抄过来，初期先简单一点。
