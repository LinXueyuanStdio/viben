# Web 社区 Moment 动态流设计

## 目标

在 Web 社区中新增 `/moment` 动态流页面，承载创作者的短内容、发布日志、想法流和页面更新记录。页面参考 Twitter Moment 的信息密度与时间线体验，但产品语气更偏创作过程、作品变更、灵感记录和社区协作动态，而不是泛社交广场。

本 spec 覆盖：

- 新增 `moments`，保存用户主动发布、系统自动生成、转发生成的动态主体。
- 新增 `moment_attachments`，将动态与发布页、合集、MCP、Skill、媒体等实体绑定。
- 新增 `moment_topics` 与 `moment_topic_items`，支持话题发现、话题聚合和动态归档。
- 新增或复用 `activity_events`，记录可形成动态流或通知的高价值活动事件。
- 定义 `/moment` 页面体验：动态输入框、Feed 切换、时间线、动态条目、附件卡片、话题入口。
- 定义 Feed API：`GET /api/moments/feed?feed_type=following|latest|recommended`。
- 定义 `POST /api/moments`、`PATCH /api/moments/{moment_id}`、`DELETE /api/moments/{moment_id}`。
- 明确页面更新自动动态来自 `page_update_events`，转发能力依赖 spec 4，互动能力依赖 spec 2。

## 非目标

- 不实现完整私信、群组、长文章编辑器或复杂社交网络。
- 不定义 spec 2 的点赞、评论、收藏、关注实现细节，只约定 Moment 对互动计数和权限的依赖。
- 不定义 spec 4 的转发完整数据模型，只约定转发进入 Moment Feed 的展示和依赖边界。
- 不实现复杂机器学习推荐；`recommended` 可以先使用规则排序和降级策略。
- 不把低价值行为全部写入动态流，尤其不把每一次点赞写成公开 `activity_events`。
- 不实现媒体二进制上传服务，只定义 Moment 附件对媒体实体的引用方式。

## 用户体验

### `/moment` 页面

`/moment` 是社区动态流主入口，页面首屏由三部分组成：

- 顶部动态输入框：已登录用户可发布想法、更新日志、作品说明，并可绑定附件和话题。
- Feed 切换：`Following`、`Latest`、`Recommended` 三个视图，对应 `feed_type=following|latest|recommended`。
- 时间线：按 Feed 排序展示动态条目，支持分页加载和新动态提示。

未登录用户：

- 可以浏览 `latest` 和 `recommended` 中公开可见的动态。
- 看到输入框的只读引导态，点击发布、互动、转发时进入登录流程。
- 不显示 `following` 为空白错误；可展示推荐创作者或最新动态作为降级内容。

已登录用户：

- 默认进入 `following`；若关注关系为空，则降级展示 `recommended`，并提示可关注创作者改善动态流。
- 可以从输入框创建动态，绑定已发布页面、合集、MCP、Skill 或媒体附件。
- 可以编辑和删除自己发布的普通动态。
- 可以查看自己页面更新触发的自动动态，但自动动态默认不支持手动编辑正文，只允许作者删除或隐藏。

### 动态输入框

输入框必须支持：

- 文本正文，适合短想法、发布日志和创作备注。
- 话题输入，如 `#agent-workflow`，服务端归一化为 `moment_topics.slug`。
- 附件绑定入口，可选择 `published_page`、`collection`、`mcp`、`skill`、`media`。
- 发布前预览附件卡片，展示标题、描述、封面或类型图标。

输入约束：

- 正文可以为空，但至少需要一个附件或转发引用。
- 纯文本动态需要非空正文。
- 单条动态附件数量需要限制，建议 MVP 限制为最多 4 个。
- 话题数量需要限制，建议 MVP 限制为最多 5 个。

### 动态条目

动态条目展示：

- 作者头像、名称、`user_slug`、发布时间。
- 动态来源标记：用户发布、页面更新、转发、系统导入。
- 正文内容，支持话题和用户公开主页链接。
- 附件卡片，按附件类型使用不同摘要样式。
- 互动区：评论数、转发数、点赞数、收藏或分享入口，具体能力依赖 spec 2 和 spec 4。
- 更多菜单：编辑、删除、复制链接、举报或隐藏。

页面更新自动动态需要展示变更语气，例如：

- “发布了新页面《X》”
- “更新了《X》到 v4”
- “为《X》新增了说明和封面”

这些文案由服务端根据 `page_update_events` 和发布页快照生成，不依赖客户端拼接关键业务语义。

## 数据模型

### `moments`

`moments` 是动态主体表，保存用户主动动态、自动动态和转发动态的统一记录。

建议字段：

- `id`：主键。
- `uid`：公开短 id，适合 URL 和分享。
- `author_user_id`：作者用户 id。
- `kind`：动态类型，建议枚举为 `post`、`page_update`、`repost`、`system`。
- `body`：正文文本，可空。
- `body_format`：正文格式，MVP 使用 `plain_text`，后续可扩展 `markdown`。
- `visibility`：可见性，建议枚举为 `public`、`unlisted`、`private`。
- `source_event_id`：可空，关联 `activity_events.id`，用于自动动态或系统事件追溯。
- `source_page_update_event_id`：可空，关联 `page_update_events.id`，用于页面更新自动动态去重。
- `repost_of_moment_id`：可空，转发原动态 id，具体写入规则依赖 spec 4。
- `reply_to_moment_id`：可空，若 spec 2 将评论建模为 Moment，可用于串联；MVP 可为空。
- `like_count`：点赞计数缓存，来自 spec 2。
- `comment_count`：评论计数缓存，来自 spec 2。
- `repost_count`：转发计数缓存，来自 spec 4。
- `attachment_count`：附件数量缓存。
- `topic_count`：话题数量缓存。
- `is_pinned`：作者是否置顶，默认 `false`。
- `is_deleted`：软删除标记，默认 `false`。
- `deleted_at`：软删除时间，可空。
- `created_at`、`updated_at`。

约束：

- `uid` 全局唯一。
- `author_user_id + source_page_update_event_id` 对非空页面更新事件唯一，避免同一次页面更新重复生成动态。
- `kind = page_update` 时必须存在 `source_page_update_event_id` 或可追溯的 `source_event_id`。
- `kind = repost` 时必须存在 `repost_of_moment_id`，且转发行为的权限与结构由 spec 4 定义。
- `is_deleted = true` 的动态不进入普通 Feed，但作者本人管理视图可看到删除状态。
- 删除使用软删除，不物理删除正文、附件和话题关系，以便审计、通知一致性和计数修复。

### `moment_attachments`

`moment_attachments` 保存动态附件关系，不保存被绑定实体本身。

建议字段：

- `id`：主键。
- `moment_id`：关联 `moments.id`。
- `attachment_type`：附件类型，枚举为 `published_page`、`collection`、`mcp`、`skill`、`media`。
- `attachment_id`：被绑定实体的内部 id 或稳定 uid。
- `attachment_uid`：可空，保存公开 uid 快照，便于列表快速展示和历史追溯。
- `title_snapshot`：附件标题快照。
- `description_snapshot`：附件描述快照，可空。
- `cover_url_snapshot`：封面 URL 快照，可空。
- `metadata`：扩展 JSON，可保存版本号、页面 URL、媒体尺寸等摘要。
- `sort_order`：同一动态内附件排序。
- `created_at`。

附件类型语义：

- `published_page`：绑定已发布页面，用于发布日志、页面更新自动动态和手动分享页面。
- `collection`：绑定合集，用于分享一组页面、模板或作品。
- `mcp`：绑定 MCP 能力或服务条目，用于展示工具能力更新。
- `skill`：绑定 Skill 条目，用于展示创作者发布或更新技能。
- `media`：绑定媒体资源，如图片、视频、封面或截图。

约束：

- 同一 `moment_id` 下 `sort_order` 稳定递增。
- 服务端必须校验作者是否有权限绑定目标附件；不能通过附件关系泄露私有页面、私有合集或不可见资源。
- 附件绑定的是引用和快照；目标实体删除或变为私有后，Feed 展示必须降级为不可见附件或隐藏该附件。

### `moment_topics`

`moment_topics` 是话题表，用于归一化用户输入的话题并支持话题页。

建议字段：

- `id`：主键。
- `slug`：话题公开标识，唯一，小写归一化。
- `display_name`：展示名，可保留用户输入的首个合理写法。
- `description`：话题说明，可空。
- `moment_count`：公开未删除动态计数缓存。
- `last_moment_at`：最近公开动态时间。
- `is_featured`：是否精选。
- `is_blocked`：是否被屏蔽。
- `created_at`、`updated_at`。

约束：

- `slug` 不包含 `#`。
- `slug` 使用小写英文、数字、连字符或下划线；中文话题可在后续通过转写或独立字段扩展。
- `is_blocked = true` 的话题不进入推荐和话题页，但历史动态正文不需要被强制改写。

### `moment_topic_items`

`moment_topic_items` 是动态与话题的多对多关系表。

建议字段：

- `id`：主键。
- `moment_id`：关联 `moments.id`。
- `topic_id`：关联 `moment_topics.id`。
- `source`：话题来源，枚举为 `body`、`attachment`、`system`。
- `created_at`。

约束：

- 唯一键：`moment_id + topic_id`。
- 软删除动态时不删除关系，但话题计数聚合必须排除 `moments.is_deleted = true`。
- 私有或未列出动态不计入公开话题计数。

### `activity_events`

`activity_events` 保存可被通知、Feed、审计或聚合消费的高价值活动事件。Moment 不应该把所有互动都展开为公开活动事件。

建议字段：

- `id`：主键。
- `actor_user_id`：行为发起用户，可空，系统事件可为空。
- `event_type`：事件类型。
- `entity_type`：主实体类型，如 `moment`、`published_page`、`collection`、`mcp`、`skill`。
- `entity_id`：主实体 id。
- `target_user_id`：事件目标用户，可空。
- `metadata`：事件上下文 JSON。
- `created_at`。

与 Moment 相关的事件类型建议：

- `moment.created`：用户创建动态。
- `moment.updated`：用户编辑动态。
- `moment.deleted`：用户软删除动态。
- `moment.reposted`：用户转发动态，依赖 spec 4。
- `page.published`：页面首次发布，可生成 `kind = page_update` 动态。
- `page.updated`：页面更新，可生成 `kind = page_update` 动态。

降噪要求：

- 不要为每一次点赞写入公开 `activity_events`，避免点赞噪声污染动态流和通知流。
- 点赞、收藏等高频互动应由 spec 2 的互动表和计数缓存承载。
- 评论、转发、页面发布、页面更新这类高意图行为可以进入 `activity_events`。
- 若后续需要通知“有人点赞了你”，应走通知聚合或批量摘要，而不是把点赞作为公开 Feed 事件。

## API

### `GET /api/moments/feed?feed_type=following|latest|recommended`

读取 Moment Feed。

查询参数：

- `feed_type`：必填，取值为 `following`、`latest`、`recommended`。
- `cursor`：可选，分页游标。
- `limit`：可选，默认 20，最大建议 50。
- `topic`：可选，按话题 `slug` 过滤。
- `author_user_slug`：可选，读取某个作者的公开动态。

响应应包含：

- `items`：动态条目数组。
- `next_cursor`：下一页游标，可空。
- `feed_type`：实际返回的 feed 类型。
- `fallback_feed_type`：当 `following` 降级为 `recommended` 时返回。

动态条目字段建议：

- `moment`：动态主体，包括 `uid`、`kind`、`body`、`visibility`、计数字段和时间。
- `author`：作者公开信息。
- `attachments`：附件摘要数组。
- `topics`：话题数组。
- `viewer_state`：当前用户是否已点赞、是否已收藏、是否可编辑、是否可删除，依赖 spec 2 的查询能力。
- `repost_context`：转发上下文，依赖 spec 4。

可见性过滤：

- 未登录用户只能读取 `visibility = public` 且 `is_deleted = false` 的动态。
- 登录用户读取公开 Feed 时同样不展示其他人的 `private` 或 `unlisted` 动态。
- 作者本人访问自己的管理视图可以读取 `private`、`unlisted` 和软删除状态，但该能力不属于公开 Feed 默认行为。

### `POST /api/moments`

创建动态。

请求体字段：

- `body`：正文，可空。
- `visibility`：可选，默认 `public`。
- `attachments`：可选，附件数组，包含 `attachment_type`、`attachment_id`、`sort_order`。
- `topics`：可选，话题 slug 或展示名数组。
- `repost_of_moment_id`：可选；存在时按 spec 4 的转发规则创建转发动态。

校验规则：

- 必须登录。
- `body`、`attachments`、`repost_of_moment_id` 至少有一个有效内容。
- 客户端不能提交 `author_user_id`、计数字段、`kind = page_update` 或 `source_event_id`。
- 普通发布默认为 `kind = post`。
- 附件必须逐个做权限校验。

成功响应返回创建后的动态完整摘要，便于前端乐观插入时间线顶部。

### `PATCH /api/moments/{moment_id}`

编辑动态。

允许修改：

- `body`。
- `visibility`。
- `attachments`，仅对 `kind = post` 的普通动态开放。
- `topics`。

限制：

- 只有作者本人或具备管理权限的用户可以编辑。
- `kind = page_update` 的自动动态默认不允许编辑正文和附件，只允许作者通过删除或隐藏控制展示。
- `kind = repost` 的转发动态是否允许编辑转发附言由 spec 4 决定。
- 已软删除动态不允许普通编辑。

### `DELETE /api/moments/{moment_id}`

删除动态。

行为：

- 使用软删除：设置 `is_deleted = true`、`deleted_at = now()`。
- 不物理删除 `moment_attachments` 和 `moment_topic_items`。
- Feed 立即不再展示该动态。
- 话题计数、作者动态数、附件计数可异步修正，但用户刷新后不得再看到已删除动态。

权限：

- 作者本人可以删除自己的动态。
- 管理员或审核系统可以隐藏动态，但隐藏语义应与作者删除在审计字段上区分；MVP 可先只实现作者软删除。

## 权限

Moment 权限由动态可见性、附件可见性、作者状态和当前用户身份共同决定。

动态可见性：

- `public`：可进入公开 Feed、话题页和作者公开主页。
- `unlisted`：不进入公开 Feed 和话题页，但持有链接且有权限时可访问。
- `private`：仅作者本人和未来授权对象可见。

附件权限：

- 动态可见不代表附件一定可见。
- 如果附件对应的发布页、合集、MCP 或 Skill 后续变为私有，Feed 应隐藏附件详情或显示“内容不可见”。
- 自动动态绑定的 `published_page` 必须使用页面的公开访问规则；私有页面更新不应生成公开 Moment。

操作权限：

- 未登录用户只能读公开动态。
- 登录用户可以发布、互动、转发，具体互动能力依赖 spec 2 和 spec 4。
- 作者可以编辑或删除自己的普通动态。
- 系统生成动态必须可追溯到事件，不允许客户端伪造。

## Feed 排序

### `following`

`following` 展示当前用户关注对象的公开动态。

排序建议：

- 主要按 `created_at desc`。
- 置顶动态只在作者主页生效，不应跨作者污染关注 Feed。
- 自动页面更新动态可以正常进入关注 Feed，但需要服务端去重和节流，避免同一页面短时间连续发布刷屏。

降级：

- 未登录访问 `following` 返回 401 或降级元信息，前端可引导登录。
- 已登录但没有关注关系时，可以返回 `fallback_feed_type = recommended` 和推荐动态。

### `latest`

`latest` 展示全站最新公开动态。

排序建议：

- 严格按 `created_at desc`。
- 排除软删除、私有、未列出和附件完全不可见的动态。
- 对同一作者短时间大量自动动态可做合并或节流，避免页面更新事件占满最新流。

### `recommended`

`recommended` 展示推荐动态。

MVP 可使用规则排序：

- 最近 7 天公开动态优先。
- 有附件的创作动态优先于纯文本闲聊。
- 页面发布、Skill、MCP、合集类动态可获得轻微加权。
- 互动计数作为弱信号，但不把点赞事件本身写入 `activity_events`。
- 当前用户已关注作者、已互动话题、最近访问页面相关话题可作为个性化信号。

推荐必须可降级：

- 无个性化数据时返回近期高质量公开动态。
- 数据不足时混合最新动态。

## 附件与话题

附件和话题是 Moment 区分普通微博式短文本与 Viben 创作社区动态的核心。

附件展示规则：

- `published_page`：展示页面标题、作者、描述、封面、阅读或浏览计数，并链接到阅读壳或直出页面。
- `collection`：展示合集标题、条目数、封面集合或默认图标。
- `mcp`：展示 MCP 名称、能力摘要、发布者和状态。
- `skill`：展示 Skill 名称、说明、适用场景和安装或查看入口。
- `media`：展示图片、视频或截图预览；媒体权限和转码由媒体系统负责。

话题规则：

- 用户输入 `#topic` 后服务端归一化并写入 `moment_topics`。
- 每条动态通过 `moment_topic_items` 关联话题。
- 话题页展示该话题下公开未删除动态，默认按最新排序，可后续增加热门排序。
- 自动动态可以从页面分类、标签或事件 metadata 中生成系统话题，但必须限制数量，避免污染。

## 自动动态

自动动态来自 `page_update_events`，用于把页面发布和更新自然沉淀到 Moment 时间线。

触发场景：

- 页面首次公开发布：生成 `kind = page_update` 动态。
- 页面公开版本更新：生成 `kind = page_update` 动态。
- 页面从私有变为公开：可生成公开动态。
- 页面元数据更新，如标题、描述、封面、分类变化：可根据产品策略生成动态或合并到最近一次更新。

不触发或需要降噪：

- 私有页面更新不生成公开动态。
- 同一页面短时间内多次保存不应生成多条公开动态；应以发布成功事件为准，而不是编辑草稿事件。
- 仅统计变化、点赞变化、浏览量变化不生成自动动态。

去重规则：

- `moments.author_user_id + moments.source_page_update_event_id` 唯一。
- 消费 `page_update_events` 时必须幂等。
- 自动动态创建失败可以重试，但不能重复生成多条相同动态。

自动动态内容：

- 正文可由模板生成，如“发布了新页面《title》”或“更新了《title》到 v{version}”。
- 附件必须绑定对应 `published_page`。
- 话题可来自页面标签、分类或系统推断。

## 移动端行为

移动端 `/moment` 应保持时间线优先：

- 顶部使用紧凑输入入口，点击后进入全屏发布面板或底部抽屉。
- Feed 切换使用固定顶部 tabs，滚动时保持可达。
- 动态条目的附件卡片单列展示，媒体附件保持稳定宽高比，避免布局跳动。
- 话题、作者、附件入口都应有足够点击面积。
- 编辑、删除、举报等操作收纳到更多菜单。
- 新动态提示以顶部轻量提示显示，点击后滚动到顶部并刷新。

移动端发布：

- 附件选择应分步完成，先选类型再选实体。
- 输入框不应因为键盘弹出遮挡发布按钮。
- 网络较差时允许草稿停留在本地 UI 状态，但服务端未成功前不得假定动态已发布。

## 错误处理

Feed 读取：

- `feed_type` 非法返回 400。
- 未登录读取 `following` 可返回 401，前端展示登录引导；也可以返回空 items 和明确错误码，具体实现需统一。
- 游标过期或非法返回 400，前端回退到首屏刷新。
- 后端推荐服务不可用时，`recommended` 降级到最新公开动态。

发布：

- 未登录返回 401。
- 正文、附件和转发引用均为空返回 400。
- 附件不存在或无权绑定返回 403 或 404；对非公开资源优先返回 404，避免泄露存在性。
- 话题非法、数量超限、附件数量超限返回 400。
- 自动动态重复消费时返回幂等成功或跳过，不向用户暴露重复错误。

编辑与删除：

- 非作者编辑或删除返回 403。
- 动态不存在、已不可见或已删除返回 404。
- 已删除动态重复删除应幂等成功或返回明确已删除状态。

## 测试验收

数据模型：

- 创建 `moments`、`moment_attachments`、`moment_topics`、`moment_topic_items`、`activity_events` 相关迁移。
- 验证动态软删除后 Feed 不再返回，但附件和话题关系仍保留。
- 验证同一 `page_update_events` 只能生成一条自动动态。
- 验证话题唯一归一化和 `moment_id + topic_id` 唯一约束。

API：

- `GET /api/moments/feed?feed_type=latest` 返回公开未删除动态，按时间倒序分页。
- `GET /api/moments/feed?feed_type=following` 只返回关注作者动态，并在无关注时可降级。
- `GET /api/moments/feed?feed_type=recommended` 在无推荐数据时可返回降级结果。
- `POST /api/moments` 可创建纯文本动态、带 `published_page` 附件动态、带话题动态。
- `PATCH /api/moments/{moment_id}` 只允许作者编辑普通动态。
- `DELETE /api/moments/{moment_id}` 执行软删除，刷新 Feed 后不可见。

自动动态：

- 页面首次发布产生一条 `kind = page_update` 动态。
- 页面更新产生一条绑定 `published_page` 附件的自动动态。
- 私有页面更新不进入公开 Feed。
- 重复消费同一个 `page_update_events` 不重复生成 Moment。

互动与活动事件：

- 点赞动态只更新 spec 2 的互动状态和计数，不写入公开 `activity_events`。
- 评论、转发、页面发布、页面更新可以写入 `activity_events`。
- 转发动态能在 Feed 中展示原动态上下文，具体结构按 spec 4。

前端：

- `/moment` 展示动态输入框、Feed tabs、时间线和动态条目。
- 未登录用户可以读公开 Feed，但发布和互动会进入登录流程。
- 移动端输入、附件预览、Feed 切换和更多菜单可正常使用。
- 附件不可见时前端有降级展示，不导致整条时间线崩溃。

## 依赖

- 依赖 spec 2 提供互动能力，包括点赞、评论、收藏、计数缓存和 `viewer_state`。
- 依赖 spec 4 提供转发能力，包括 `repost_of_moment_id` 的语义、转发权限、原动态上下文和转发计数。
- 依赖页面发布与版本系统提供 `published_pages`、`published_page_versions` 和 `page_update_events`。
- 依赖用户与关注关系，用于 `following` Feed 和作者公开信息。
- 依赖媒体或资源系统提供 `media` 附件的元信息与访问权限。
- 依赖合集、MCP、Skill 的公开实体模型，用于 `collection`、`mcp`、`skill` 附件解析。
