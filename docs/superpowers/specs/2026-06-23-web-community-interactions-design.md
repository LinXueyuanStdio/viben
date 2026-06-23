# Web 社区通用互动层设计

## 目标

为新社区内容提供一套独立的通用互动层，覆盖评论、点赞和收藏，并优先服务公开发布页阅读场景：

- `/read/{user_slug}/{page_id}` 承载社区阅读页、评论、点赞、收藏等互动能力。
- `/page/{user_slug}/{page_id}` 继续保持 HTML 直出，不注入主站互动 UI，不改变已有发布页 iframe/HTML 展示职责。
- 新增 `community_entities`、`community_reactions`、`community_favorites`、`community_comments` 四组社区表，避免直接扩展旧 `comments`/`favorites` 表的 `entity_type` 枚举而破坏 marketplace。
- 互动 API 统一放在 `/api/community/*` 下，请求 query 和 body 全部使用 `snake_case`。
- 匿名用户可读取公开实体的评论和计数；登录用户可点赞、收藏、评论、回复；作者和版主拥有删除或隐藏评论的管理权限。
- 所有互动写操作在事务内同时写明细表和更新目标实体冗余计数，保证 UI 计数可快速读取且与明细最终一致。
- 第一阶段只服务 `published_page`、`moment`、`comment` 三类新社区实体；旧 `mcp`、`skill`、`collection` 后续通过迁移再接入。

## 非目标

- 不重构旧 marketplace 的 `comments`、`favorites`、`ratings` 表。
- 不修改 `apps/web/lib/services/social.ts` 的现有 mcp/skill 收藏计数逻辑。
- 不把 `/page/{user_slug}/{page_id}` 改造成 React 社区页。
- 不在第一阶段支持评分、打赏、转发、关注、举报队列和通知系统。
- 不要求评论富文本、Markdown 完整渲染或附件上传；第一阶段以纯文本评论为准。
- 不提供旧 mcp/skill/collection 数据到新社区表的自动迁移实现，只定义后续迁移策略。

## 现状

当前 `apps/web` 已存在 marketplace 社交表：

- `comments.entity_type` 只允许 `mcp`、`skill`、`collection`。
- `favorites.entity_type` 只允许 `mcp`、`skill`、`collection`。
- `ratings.entity_type` 只允许 `mcp`、`skill`。
- `lib/services/social.ts` 中 `toggleFavorite()` 的计数更新强绑定 `mcpPackages` 和 `skillPackages`，不适合直接服务发布页或社区动态。

发布页当前存在两条访问语义：

- `/page/{user_slug}/{page_id}`：公开 HTML 直出，面向嵌入、分享和最小展示链路。
- `/read/{user_slug}/{page_id}`：新社区阅读页入口，适合加载主站 Shell、作者信息、互动组件和相关推荐。

因此新互动层需要独立建模，避免通过给旧 enum 追加 `published_page` 的方式把 marketplace 服务、后台管理、SDK 生成和旧组件一起牵连进来。

## 实体边界

### 社区实体

`community_entities` 是互动层的目标实体注册表。评论、点赞和收藏都只指向 `community_entities.id`，不直接散落引用 `published_pages.id` 或未来业务表 id。

第一阶段支持的 `entity_type`：

- `published_page`：发布页阅读实体，对应 `published_pages.id`。
- `moment`：社区动态或短内容，预留给后续社区信息流。
- `comment`：评论实体，用于给评论本身点赞。

后续可扩展：

- `mcp`
- `skill`
- `collection`

旧 marketplace 不在第一阶段接入，避免同时维护两套计数写入路径。

### Target Key

`community_entities` 使用稳定业务定位字段：

- `entity_type`：实体类型。
- `entity_id`：目标业务表主键，如 `published_pages.id`、`community_comments.id`。
- `owner_user_id`：目标内容作者，用于权限判断和作者标识。
- `visibility`：`public`、`unlisted`、`private`。
- `status`：`active`、`deleted`、`hidden`。

唯一约束：

- `(entity_type, entity_id)` 唯一，保证同一业务对象只有一个社区实体。

`/read/{user_slug}/{page_id}` 进入时：

1. 用 `user_slug` 查询用户。
2. 用用户 id 和 `page_id` 查询 `published_pages`。
3. 确保存在 `community_entities(entity_type = 'published_page', entity_id = published_pages.id)`。
4. 读取该 `community_entity_id` 下的评论、点赞、收藏和冗余计数。

## 数据模型

### community_entities

字段建议：

- `id`
- `entity_type`
- `entity_id`
- `owner_user_id`
- `visibility`
- `status`
- `title`
- `canonical_path`
- `reactions_count`
- `favorites_count`
- `comments_count`
- `created_at`
- `updated_at`

说明：

- `canonical_path` 对发布页为 `/read/{user_slug}/{page_id}`，用于通知、后台和分享入口。
- `reactions_count` 第一阶段表示默认点赞总数；如果未来支持多 reaction 类型，可增加按类型聚合表或 JSON 统计。
- `comments_count` 只统计未删除、未隐藏的可见评论。
- `favorites_count` 统计有效收藏。
- 计数字段为读取优化，不作为唯一事实源；明细表仍是事实源。

索引：

- 唯一索引 `(entity_type, entity_id)`。
- 普通索引 `(owner_user_id, created_at)`。
- 普通索引 `(entity_type, status, visibility)`。

### community_reactions

用于点赞和未来 emoji reaction。第一阶段前端只暴露点赞，后端保留 `reaction_type`。

字段建议：

- `id`
- `community_entity_id`
- `user_id`
- `reaction_type`
- `created_at`

约束：

- `community_entity_id` 外键到 `community_entities.id`，目标删除时级联删除或由服务软删除清理。
- `user_id` 外键到 `users.id`。
- 唯一约束 `(community_entity_id, user_id, reaction_type)`，保证同一用户对同一实体同一 reaction 只能有一条记录。

默认值：

- `reaction_type = 'like'`。

索引：

- `(community_entity_id, reaction_type)` 用于聚合。
- `(user_id, created_at)` 用于用户互动历史。

### community_favorites

用于登录用户收藏社区实体。

字段建议：

- `id`
- `community_entity_id`
- `user_id`
- `created_at`

约束：

- 唯一约束 `(community_entity_id, user_id)`。
- `community_entity_id` 外键到 `community_entities.id`。
- `user_id` 外键到 `users.id`。

索引：

- `(user_id, created_at)` 用于个人收藏列表。
- `(community_entity_id, created_at)` 用于实体收藏明细和计数修复。

### community_comments

用于社区评论和回复。

字段建议：

- `id`
- `community_entity_id`
- `parent_comment_id`
- `user_id`
- `content`
- `status`
- `depth`
- `replies_count`
- `reactions_count`
- `created_at`
- `updated_at`
- `deleted_at`
- `deleted_by_user_id`

约束：

- `community_entity_id` 外键到 `community_entities.id`。
- `parent_comment_id` 自引用 `community_comments.id`，允许为空。
- `user_id` 外键到 `users.id`。
- `status` 使用 `active`、`deleted`、`hidden`。
- `depth` 第一阶段限制为 `0` 或 `1`，即主评论 + 一层回复，避免无限嵌套 UI 和分页复杂度。

计数：

- 创建 active 评论时，事务内将目标 `community_entities.comments_count + 1`。
- 删除或隐藏 active 评论时，事务内将目标 `comments_count - 被影响的可见评论数`。
- 回复创建时，同时更新父评论 `replies_count + 1`。
- 评论作为可点赞目标时，需要为评论创建或复用 `community_entities(entity_type = 'comment', entity_id = community_comments.id)`，并将评论自身的 `reactions_count` 与该实体的 `reactions_count` 同步更新。

索引：

- `(community_entity_id, parent_comment_id, created_at)` 用于评论树分页。
- `(user_id, created_at)` 用于用户评论历史。
- `(status, created_at)` 用于后台审核列表。

### 可选 comment edits

第一阶段可以不做编辑历史，仅使用 `community_comments.updated_at` 表示评论被编辑过。

如果需要审计或版主管理，增加 `community_comment_edits`：

- `id`
- `comment_id`
- `editor_user_id`
- `previous_content`
- `new_content`
- `reason`
- `created_at`

策略：

- 用户编辑自己的 active 评论时写一条 edit 记录。
- 管理员或版主编辑时必须记录 `reason`。
- 对外接口默认只返回当前内容和 `edited` 布尔值，不暴露历史内容。

## API

所有路由放在 `/api/community/*` 下，字段统一 `snake_case`。

### 获取实体互动摘要

`GET /api/community/entities/summary`

Query：

```json
{
  "entity_type": "published_page",
  "entity_id": "published_page_uuid"
}
```

响应：

```json
{
  "entity": {
    "id": "community_entity_uuid",
    "entity_type": "published_page",
    "entity_id": "published_page_uuid",
    "visibility": "public",
    "reactions_count": 12,
    "favorites_count": 5,
    "comments_count": 3
  },
  "viewer": {
    "is_authenticated": true,
    "has_reacted": true,
    "has_favorited": false,
    "can_comment": true,
    "can_moderate": false
  }
}
```

### 获取评论列表

`GET /api/community/comments`

Query：

```json
{
  "entity_type": "published_page",
  "entity_id": "published_page_uuid",
  "parent_comment_id": null,
  "cursor": "opaque_cursor",
  "limit": 20
}
```

行为：

- 匿名用户可读取 `visibility = public` 且 `status = active` 实体的 active 评论。
- 默认返回主评论；传 `parent_comment_id` 时返回指定评论的一层回复。
- 回复分页独立于主评论分页。

响应：

```json
{
  "comments": [
    {
      "id": "comment_uuid",
      "content": "这个页面很好用",
      "status": "active",
      "depth": 0,
      "replies_count": 1,
      "reactions_count": 2,
      "viewer_has_reacted": false,
      "created_at": "2026-06-23T03:00:00.000Z",
      "updated_at": "2026-06-23T03:00:00.000Z",
      "author": {
        "id": "user_uuid",
        "user_slug": "alice",
        "display_name": "Alice",
        "avatar_url": null
      }
    }
  ],
  "next_cursor": null
}
```

### 创建评论

`POST /api/community/comments`

Body：

```json
{
  "entity_type": "published_page",
  "entity_id": "published_page_uuid",
  "parent_comment_id": null,
  "content": "这个页面很好用"
}
```

行为：

- 必须登录。
- `content` trim 后不能为空。
- 第一阶段限制长度，例如 1 到 2000 字符。
- `parent_comment_id` 存在时必须属于同一个 `community_entity_id`，且父评论为 active。
- 创建成功后事务内更新 `community_entities.comments_count` 和父评论 `replies_count`。

### 编辑评论

`PATCH /api/community/comments/{comment_id}`

Body：

```json
{
  "content": "更新后的评论"
}
```

行为：

- 评论作者可编辑自己的 active 评论。
- 版主可编辑或隐藏评论；如果启用 `community_comment_edits`，版主编辑必须写 `reason`。
- 已删除评论不可编辑。

### 删除或隐藏评论

`DELETE /api/community/comments/{comment_id}`

Body：

```json
{
  "mode": "delete"
}
```

行为：

- 评论作者可删除自己的评论。
- 目标实体作者和版主可删除或隐藏评论。
- 删除使用软删除：保留 id、作者和时间，清空或替换对外内容，`status = 'deleted'`。
- 删除主评论时，第一阶段建议同时隐藏其回复，避免孤儿回复语义复杂；计数扣减所有受影响的 active 评论。

### 点赞切换

`POST /api/community/reactions/toggle`

Body：

```json
{
  "entity_type": "published_page",
  "entity_id": "published_page_uuid",
  "reaction_type": "like"
}
```

响应：

```json
{
  "has_reacted": true,
  "reaction_type": "like",
  "reactions_count": 13
}
```

行为：

- 必须登录。
- `reaction_type` 第一阶段只接受 `like`。
- 若不存在则插入，若已存在则删除。
- 事务内更新 `community_entities.reactions_count`。
- 当目标是 `comment` 时，同步更新 `community_comments.reactions_count`。

### 收藏切换

`POST /api/community/favorites/toggle`

Body：

```json
{
  "entity_type": "published_page",
  "entity_id": "published_page_uuid"
}
```

响应：

```json
{
  "has_favorited": true,
  "favorites_count": 6
}
```

行为：

- 必须登录。
- 只允许收藏 `published_page` 和 `moment`；评论不进入收藏。
- 若不存在则插入，若已存在则删除。
- 事务内更新 `community_entities.favorites_count`。

### 我的收藏

`GET /api/community/favorites`

Query：

```json
{
  "entity_type": "published_page",
  "cursor": "opaque_cursor",
  "limit": 20
}
```

行为：

- 必须登录。
- 返回当前用户收藏的社区实体列表。
- 第一阶段可只返回实体摘要和 `canonical_path`，由前端按实体类型决定展示卡片。

## 权限

### 读取

- 匿名用户可读取 `visibility = public` 且 `status = active` 的实体摘要和评论。
- 登录用户读取规则同匿名；后续可扩展 private/unlisted 的作者和协作者读取。
- `hidden`、`deleted` 实体不对普通用户暴露互动明细。

### 写入

- 未登录用户不能点赞、收藏、评论、编辑和删除。
- 登录用户可对公开 active 实体点赞、收藏和评论。
- 用户只能编辑或删除自己创建的 active 评论。
- 目标实体作者可删除或隐藏该实体下任意评论，但不能伪造评论作者。
- 版主可删除、隐藏或恢复评论。

### 版主判断

第一阶段可复用现有用户角色或后台权限能力，抽象为服务层函数：

- `is_entity_owner(user_id, community_entity_id)`
- `can_moderate_community(user_id)`
- `can_manage_comment(user_id, comment_id)`

API handler 不直接散落角色判断，统一走 community service。

## 计数一致性

互动计数采用“明细表为事实源，目标实体冗余计数为读取优化”的策略。

写入规则：

- 点赞、取消点赞、收藏、取消收藏、创建评论、删除评论都必须在数据库事务内完成明细表变更和 `community_entities` 计数字段更新。
- 插入明细使用唯一约束防并发重复；删除明细以受影响行数决定是否更新计数。
- 计数更新使用数据库表达式做原子增减，并使用下限保护，避免并发下出现负数。
- 评论点赞目标为 `comment` 时，事务内同时更新 `community_entities.reactions_count` 和 `community_comments.reactions_count`。

修复规则：

- 提供后台或脚本级 reconcile 能力，按明细表重新计算 `reactions_count`、`favorites_count`、`comments_count`。
- reconcile 不作为用户请求链路的一部分，只用于运维修复和迁移校验。

失败规则：

- 事务中任一步失败则整体回滚。
- API 返回最新计数以事务后读取或 `returning` 结果为准，不信任客户端传入计数。

## 前端组件边界

`/read/{user_slug}/{page_id}` 是社区互动 UI 的宿主。`/page/{user_slug}/{page_id}` 不加载这些组件。

建议组件边界：

- `CommunityInteractionBar`：展示点赞、收藏、评论入口和计数。
- `CommunityCommentsPanel`：评论列表、分页、空状态、登录提示。
- `CommunityCommentForm`：新建评论和回复输入。
- `CommunityCommentItem`：单条评论、作者信息、时间、点赞、回复、编辑、删除。
- `CommunityFavoriteButton`：收藏按钮，可复用于卡片和详情页。
- `CommunityReactionButton`：点赞按钮，第一阶段固定 `like`。

数据边界：

- 前端组件只调用 `/api/community/*`。
- 请求字段和响应字段保持 `snake_case`，不在 API 层混用 `camelCase`。
- `/read` 页面负责把 `published_pages` 查询结果映射成 `entity_type = 'published_page'` 和 `entity_id = published_pages.id`。
- 组件不直接依赖旧 `CommentSection`、`FavoriteButton` 或 `lib/services/social.ts`，避免 marketplace 行为被社区需求牵引。

登录交互：

- 匿名用户可看到评论和计数。
- 匿名用户点击点赞、收藏、评论输入时引导登录。
- 登录后重新拉取 summary，避免本地乐观状态覆盖服务端事实。

## 迁移策略

### Phase 1：新社区表服务发布页

- 新增 `community_entities`、`community_reactions`、`community_favorites`、`community_comments`。
- `/read/{user_slug}/{page_id}` 使用新互动层。
- 发布页首次进入 `/read` 或发布成功时创建 `community_entities(published_page)`。
- 旧 `comments`、`favorites`、`ratings` 完全不变。
- 旧 marketplace 页面继续使用现有 `CommentSection`、`FavoriteButton` 和 `social.ts`。

### Phase 2：moment 接入

- 新增社区动态业务表时，创建 `community_entities(moment)`。
- 复用同一套 `/api/community/*` 和前端组件。
- 根据动态可见性实现 public/unlisted/private 的读取判断。

### Phase 3：评论点赞

- 创建评论时同步创建或懒创建 `community_entities(comment)`。
- `CommunityCommentItem` 调用 reaction toggle，目标为 `entity_type = 'comment'`。
- 评论点赞不影响父发布页 `reactions_count`，只影响评论自身 `reactions_count`。

### Phase 4：旧 marketplace 迁移

旧 `mcp`、`skill`、`collection` 不在第一阶段直接迁移。后续迁移需要单独 spec，建议策略：

- 先为 marketplace 包创建 `community_entities(mcp|skill|collection)`。
- 双读或后台校验旧新计数差异。
- 再逐步将旧 UI 组件切到 `/api/community/*`。
- 最后冻结旧 `comments`/`favorites` 写入，保留历史查询或一次性迁移数据。

迁移前不得把旧 enum 直接扩成所有社区类型，也不得让新社区 API 调用 `lib/services/social.ts`。

## 错误处理

通用错误：

- `400`：字段缺失、类型不合法、`entity_type` 不支持、内容为空、长度超限。
- `401`：需要登录的写操作未登录。
- `403`：无权访问私有实体、无权编辑/删除评论、无版主权限。
- `404`：实体不存在、发布页不存在、评论不存在。
- `409`：并发写入冲突且无法通过幂等逻辑恢复。
- `429`：评论或互动频率限制命中。

响应格式：

```json
{
  "error": {
    "code": "comment_not_found",
    "message": "评论不存在"
  }
}
```

错误码建议：

- `community_entity_not_found`
- `unsupported_entity_type`
- `comment_not_found`
- `comment_content_empty`
- `comment_content_too_long`
- `login_required`
- `permission_denied`
- `rate_limited`

删除评论的对外展示：

- 普通用户看到已删除评论时，返回占位状态，不返回原始 `content`。
- 作者和版主是否可查看删除前内容由后台审核能力决定，普通 `/api/community/comments` 不暴露。

## 测试验收

数据库：

- `community_entities` 对 `(entity_type, entity_id)` 有唯一约束。
- `community_reactions` 对 `(community_entity_id, user_id, reaction_type)` 有唯一约束。
- `community_favorites` 对 `(community_entity_id, user_id)` 有唯一约束。
- `community_comments` 支持主评论和一层回复，并通过索引按实体分页查询。

API：

- 匿名用户可以读取公开发布页的 summary 和评论。
- 匿名用户点赞、收藏、评论返回 `401`。
- 登录用户点赞同一实体两次表现为 toggle，计数加一再减一。
- 登录用户收藏同一实体两次表现为 toggle，计数加一再减一。
- 创建评论后 `comments_count` 增加，删除评论后 `comments_count` 扣减。
- 回复只能挂到同实体 active 父评论下。
- 评论作者可以编辑和删除自己的评论。
- 非作者不能编辑或删除他人评论。
- 发布页作者和版主可以删除或隐藏该发布页下的评论。
- 所有 query/body 字段使用 `snake_case`，测试覆盖 `entity_type`、`entity_id`、`parent_comment_id`。

计数一致性：

- 并发点赞同一实体不会产生重复明细，也不会把计数加多次。
- 并发取消点赞不会把计数减成负数。
- 事务失败时明细和冗余计数都不落库。
- reconcile 能从明细表重建 `community_entities` 计数。

前端：

- `/read/{user_slug}/{page_id}` 展示互动条和评论区。
- `/page/{user_slug}/{page_id}` 仍然只负责 HTML 直出，不出现评论、点赞、收藏 UI。
- 匿名用户可浏览评论，点击互动出现登录引导。
- 登录后互动状态按服务端 summary 刷新。

回归：

- mcp/skill/collection marketplace 页面收藏、评论和评分不受影响。
- `lib/services/social.ts` 旧服务行为不变。
- 旧 `comments`、`favorites` 表不需要迁移即可继续工作。

## 依赖关系

- 依赖发布页用户 slug 设计：`/read/{user_slug}/{page_id}` 和 `/page/{user_slug}/{page_id}` 都需要稳定 `user_slug`。
- 依赖 `published_pages` 的 `(user_id, uid)` 唯一定位能力。
- 依赖 apps/web 登录态和用户表，写操作必须能拿到当前 `user_id`。
- 依赖权限系统提供作者和版主判断；如果版主角色尚未稳定，第一阶段可只实现作者删除，版主入口保留服务层接口。
- 依赖后续社区首页或动态系统定义 `moment` 表；本 spec 只预留互动层实体类型。
- 不依赖 packages/core，也不改变 Desktop 发布链路。

