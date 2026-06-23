# Web 社区关注、订阅与通知设计

## 背景

Web 社区页需要补齐围绕公开作者、公开页面和追更通知的基础能力：

- `/subscription` 是当前用户的订阅追更列表，聚合已关注作者和已订阅页面的更新。
- `/{user_slug}` 是公开作者主页，展示作者资料、公开页面列表和关注入口。
- `/read/{user_slug}/{page_id}` 是公开阅读页，提供订阅当前页面和关注作者入口。
- 页面发布和更新当前来自 `published_page_records` 与 publish API；未来需要在发布流程中生成标准化的 `page_update_events`，供订阅流和通知系统消费。

本设计只定义 Web 端社区关注、页面订阅、更新事件与通知的产品和后端契约，不包含实现代码。

## 目标

- 支持用户关注公开作者，并在作者主页和阅读页展示关注状态与 `followers_count`。
- 支持用户订阅有权限访问的公开页面，并在阅读页展示订阅状态与 `subscriber_count`。
- 支持 `/subscription` 基于关注作者和页面订阅生成追更流。
- 定义 `user_follows`、`page_subscriptions`、`page_update_events`、`notifications` 四类核心数据模型。
- 发布或更新页面时，产生可消费的页面更新事件，并按订阅关系生成通知。
- 支持通知列表的 cursor 分页、未读状态、已读推进和去重。
- 使用 `subscriber_count`、`followers_count` 冗余计数字段提升列表页查询性能，并提供回填策略。

## 非目标

- 不做站内私信、评论、点赞、收藏和推荐算法。
- 不做邮件、短信、移动端推送等站外通知渠道；本期仅定义站内通知。
- 不做复杂的作者动态流，作者关注只消费作者发布页面产生的 `page_update_events`。
- 不改变现有页面发布的 owner 权限模型。
- 不为私密页提供公开发现能力。
- 不实现页面版本差异对比、回滚 UI 或变更摘要自动生成。

## 用户体验

### 作者主页 `/{user_slug}`

- 未登录用户可以访问公开作者主页，查看作者公开资料和可公开访问的页面列表。
- 已登录用户可以点击「关注」或「取消关注」作者。
- 当前用户访问自己的作者主页时，不展示关注自己的入口；服务端也必须拒绝关注自己。
- 作者主页展示 `followers_count`。计数允许最终一致，但单次关注或取消关注后的当前用户状态必须准确。
- 页面列表只展示当前访问者有权限看到的页面；私密页不会出现在非授权用户的作者主页中。

### 阅读页 `/read/{user_slug}/{page_id}`

- 未登录用户可以阅读公开页面，但点击「关注作者」或「订阅页面」时需要登录。
- 已登录用户可以关注作者，也可以订阅当前页面。
- 如果当前页面是私密页，只有 owner 或被授权用户能访问和订阅；非授权用户不能通过 API 订阅私密页。
- 页面展示 `subscriber_count`，用于表达追更人数。
- 页面订阅入口支持通知级别：
  - `all`：页面发布和内容更新都通知。
  - `major`：只通知重要更新；如果发布 API 未提供重要性，默认不生成该级别通知。
  - `none`：保留订阅关系但不产生通知，只进入订阅流。

### 订阅追更页 `/subscription`

- 订阅追更页按时间倒序展示当前用户可见的页面更新。
- 数据来源包括：
  - 用户直接订阅的页面。
  - 用户关注的作者发布或更新的可见页面。
- 同一页面更新同时命中「关注作者」和「订阅页面」时，只展示一条更新，但保留命中原因，便于 UI 展示「来自已订阅页面」或「来自已关注作者」。
- 已读状态以页面订阅关系里的 `last_seen_version` 和通知里的 `read_at` 为准，追更流可以展示未读标记。

### 通知中心

- 通知中心展示当前用户的站内通知。
- 通知按 `created_at` 和稳定游标倒序分页。
- 页面更新通知点击后进入 `/read/{user_slug}/{page_id}`，并可带上版本或事件标识用于定位更新。
- 用户可以单条标记已读，也可以批量标记某个 cursor 之前的通知为已读。

## 数据模型

### `user_follows`

表示用户关注作者。

- `id`：主键。
- `follower_user_id`：关注者用户 id。
- `followee_user_id`：被关注作者用户 id。
- `notify_level`：关注作者产生通知的级别，默认 `all`，可选 `all`、`major`、`none`。
- `created_at`：关注时间。
- `updated_at`：通知级别等配置更新时间。

约束：

- 唯一约束：`follower_user_id + followee_user_id`。
- 检查约束：`follower_user_id != followee_user_id`，禁止关注自己。
- 删除用户时，相关关注关系应级联删除或由后台清理任务删除。

计数：

- `users.followers_count` 冗余保存被关注人数。
- 创建关注时递增 `followee_user_id` 对应用户的 `followers_count`。
- 取消关注时递减，且不得小于 0。
- 迁移上线时通过 `user_follows` 聚合回填。

### `page_subscriptions`

表示用户直接订阅某个发布页面。

- `id`：主键。
- `user_id`：订阅用户 id。
- `published_page_id`：发布页面 id。
- `notify_level`：页面通知级别，默认 `all`，可选 `all`、`major`、`none`。
- `last_seen_version`：用户已看到的最新页面版本号，默认订阅时的当前版本。
- `created_at`：订阅时间。
- `updated_at`：通知级别或已读版本更新时间。

约束：

- 唯一约束：`user_id + published_page_id`。
- 私密页订阅必须在写入前校验访问权限；非 owner、非授权用户不能订阅私密页。
- 如果页面从公开改为私密，已有非授权订阅不应再收到通知或出现在订阅流中；后续可由清理任务物理删除。
- owner 是否允许订阅自己的页面由产品决定；本期允许 owner 订阅自己的页面用于测试追更流，但不产生给自己的通知。

计数：

- `published_pages.subscriber_count` 冗余保存直接页面订阅人数；`published_page_records` 只保留发布历史事实，不承载当前订阅计数。
- 创建订阅时递增，取消订阅时递减，且不得小于 0。
- 迁移上线时通过 `page_subscriptions` 聚合回填。
- 关注作者不计入页面 `subscriber_count`，避免同一用户在关注作者后放大每个页面的订阅数。

### `page_update_events`

表示页面发布、更新产生的标准化追更事件，是订阅流和通知的核心事实表。

- `id`：主键。
- `published_page_id`：发布页面 id。
- `user_id`：页面 owner id。
- `user_slug`：作者 slug 快照，便于通知跳转和历史事件稳定展示。
- `page_id`：页面公开 id 或 uid 快照。
- `version`：页面版本号，与发布版本记录对应。
- `event_type`：事件类型，可选 `published`、`updated`、`republished`、`unpublished`。
- `importance`：重要性，可选 `normal`、`major`。
- `title`：页面标题快照。
- `description`：页面描述快照。
- `change_summary`：可选变更摘要，供订阅流展示。
- `visibility`：事件产生时的页面可见性快照。
- `created_at`：事件创建时间。

约束：

- 唯一约束：`published_page_id + version + event_type`，避免 publish API 重试时重复写入同一版本事件。
- 查询索引：`published_page_id + created_at`、`user_id + created_at`、`created_at + id`。
- 事件不可变；页面标题等字段后续变更不回写历史事件。

可见性：

- 追更流和通知查询不能只相信事件里的 `visibility` 快照，必须再校验当前页面访问权限。
- 如果事件产生时公开、后来改为私密，非授权用户不应再看到该事件。

### `notifications`

表示站内通知。

- `id`：主键。
- `recipient_user_id`：通知接收者。
- `actor_user_id`：触发通知的作者，页面更新场景为页面 owner。
- `type`：通知类型，本期至少包含 `page_published`、`page_updated`。
- `page_update_event_id`：关联页面更新事件。
- `published_page_id`：冗余页面 id，便于权限过滤和跳转。
- `title`：通知标题快照。
- `body`：通知正文快照。
- `read_at`：已读时间，未读为 null。
- `created_at`：通知创建时间。

约束：

- 唯一约束：`recipient_user_id + page_update_event_id + type`，避免同一事件对同一用户重复通知。
- 不给事件作者本人生成通知。
- 通知查询必须按当前页面权限过滤；如果用户已失去私密页权限，通知应不展示或展示为不可访问状态，默认不展示。

## API

所有 query 参数和响应字段使用 snake_case。

### 作者关注

- `POST /api/users/{user_slug}/follow`
  - 登录必需。
  - body 可包含 `notify_level`。
  - 不能关注自己，违反时返回 400。
  - 成功后返回 `following: true` 和最新 `followers_count`。

- `DELETE /api/users/{user_slug}/follow`
  - 登录必需。
  - 幂等取消关注。
  - 成功后返回 `following: false` 和最新 `followers_count`。

- `PATCH /api/users/{user_slug}/follow`
  - 登录必需。
  - 更新 `notify_level`。

### 页面订阅

- `POST /api/read/{user_slug}/{page_id}/subscription`
  - 登录必需。
  - body 可包含 `notify_level`。
  - 服务端按 `user_slug + page_id` 查页面，并校验当前用户访问权限。
  - 私密页非授权用户返回 403，不创建订阅。
  - 默认 `last_seen_version` 设置为页面当前版本，避免订阅瞬间收到历史更新通知。
  - 成功后返回 `subscribed: true`、`subscriber_count`、`notify_level`、`last_seen_version`。

- `DELETE /api/read/{user_slug}/{page_id}/subscription`
  - 登录必需。
  - 幂等取消订阅。
  - 成功后返回 `subscribed: false` 和最新 `subscriber_count`。

- `PATCH /api/read/{user_slug}/{page_id}/subscription`
  - 登录必需。
  - 更新 `notify_level` 或 `last_seen_version`。
  - `last_seen_version` 只能前进，不能回退。

### 订阅流

- `GET /api/feed/subscriptions`
  - 登录必需。
  - query 参数：
    - `cursor`：上一页返回的游标。
    - `limit`：每页数量，默认 30，最大 100。
    - `include_seen`：是否包含已读更新，默认 true。
    - `source`：可选 `all`、`followed_authors`、`subscribed_pages`。
  - 返回字段：
    - `items`：追更事件列表。
    - `next_cursor`：下一页游标，没有更多数据时为 null。
    - `has_more`：是否还有更多。

单条 item 应包含：

- `event_id`
- `published_page_id`
- `user_slug`
- `page_id`
- `version`
- `event_type`
- `importance`
- `title`
- `description`
- `change_summary`
- `created_at`
- `source_reasons`：命中原因数组，可含 `followed_author`、`subscribed_page`。
- `is_seen`：是否已读。
- `url`：阅读页 URL。

### 通知

- `GET /api/notifications`
  - 登录必需。
  - 使用 cursor 分页。
  - query 参数：
    - `cursor`
    - `limit`，默认 30，最大 100。
    - `unread_only`，默认 false。
  - 返回 `items`、`next_cursor`、`has_more`、`unread_count`。

- `POST /api/notifications/{notification_id}/read`
  - 登录必需。
  - 只能操作自己的通知。
  - 幂等标记已读。

- `POST /api/notifications/read`
  - 登录必需。
  - body 可包含 `before_cursor` 或 `notification_ids`。
  - 用于批量标记已读。

cursor 规则：

- cursor 使用 `created_at + id` 组成稳定游标。
- 翻页条件为严格小于上一页最后一条的 `(created_at, id)`。
- 不使用 offset，避免新增通知导致重复或跳页。

## 权限

- 关注作者：
  - 必须登录。
  - 不能关注自己。
  - 被关注对象必须存在且未被禁用。

- 订阅页面：
  - 必须登录。
  - 页面必须存在。
  - 公开页可被任意登录用户订阅。
  - 私密页只能被 owner 或明确授权用户订阅。
  - 失去私密页权限后，不再出现在订阅流和通知列表中。

- 读取追更流：
  - 必须登录。
  - 每条事件返回前都要校验当前页面访问权限。
  - 关注作者只授予追更关系，不授予私密页访问权限。

- 读取通知：
  - 必须登录。
  - 只能读取自己的通知。
  - 通知关联页面不可访问时默认过滤。

## 订阅流查询

订阅流以 `page_update_events` 为事实表，按当前用户的关系表过滤：

1. 找到当前用户直接订阅的 `published_page_id`，并读取每条订阅的 `last_seen_version`、`notify_level`。
2. 找到当前用户关注的 `followee_user_id`，并读取关注关系的 `notify_level`。
3. 查询 `page_update_events`：
   - `published_page_id` 在直接订阅集合中；或
   - `user_id` 在关注作者集合中。
4. 对候选事件按当前页面权限二次过滤。
5. 对同一 `event_id` 去重，合并 `source_reasons`。
6. 使用 `(created_at, id)` cursor 倒序分页。

已读判断：

- 直接订阅页面命中时，`event.version <= page_subscriptions.last_seen_version` 视为已读。
- 仅关注作者命中时，作者关注关系本身不记录每页已读版本；可结合通知 `read_at` 判断通知是否已读。
- 如果同一事件同时命中页面订阅和作者关注，任一来源未读即可展示未读。

性能策略：

- 第一版可以用关系子查询或 join 实现。
- 用户关注和订阅数量较大时，可分两路查询后在服务端合并去重。
- `page_update_events` 必须有按 `created_at + id` 的分页索引。
- 权限过滤导致一页不足 `limit` 时，服务端可以向后多取一批候选事件，但必须设置最大扫描窗口，避免极端用户拖慢接口。

## 通知策略

通知由 `page_update_events` 驱动生成。

生成对象：

- 直接订阅该页面、`notify_level != none` 的用户。
- 关注该作者、`notify_level != none` 的用户。
- 排除页面 owner 本人。
- 排除对该页面没有当前访问权限的用户。

通知级别：

- `all` 接收 `normal` 和 `major` 事件。
- `major` 只接收 `importance = major` 的事件。
- `none` 不生成通知，但关系仍参与订阅流。

去重：

- 同一用户既订阅页面又关注作者时，只生成一条通知。
- 以 `recipient_user_id + page_update_event_id + type` 唯一约束兜底。
- publish API 重试或后台任务重跑时，通知生成必须幂等。

未读数：

- `GET /api/notifications` 返回 `unread_count`。
- 未读数可实时聚合，也可后续在 `users` 或独立计数表中冗余。
- 如果采用冗余未读数，必须由通知创建、已读、删除三个动作维护，并提供回填脚本。

## 与发布 API 集成

发布 API 当前写入或更新 `published_page_records`。本设计要求发布流程在页面内容成功持久化后生成 `page_update_events`：

1. publish API 校验登录和页面 owner 权限。
2. 写入或更新 `published_page_records`，得到稳定的 `published_page_id` 和最新 `version`。
3. 判断事件类型：
   - 首次发布为 `published`。
   - 已发布页面内容、标题、描述或可见性发生有效变化为 `updated`。
   - 仅重复提交完全相同内容时，不生成新事件。
4. 插入 `page_update_events`。
5. 基于事件异步或同步生成 `notifications`。

一致性要求：

- 页面记录和页面更新事件应尽量在同一事务中完成。
- 如果通知生成失败，不应回滚页面发布；可以通过后台补偿任务按 `page_update_events` 重建缺失通知。
- 如果事件生成失败，publish API 应返回失败或至少记录可重试状态；不能长期出现页面已更新但没有对应追更事件的情况。
- 未来如果 `published_page_versions` 已作为版本事实表，`page_update_events.version` 应与版本号对齐。

重要性：

- publish API 可接受可选 `importance`，默认 `normal`。
- 只有作者主动标记或系统明确判断为重要更新时使用 `major`。

## 计数策略

需要维护两个冗余计数：

- `users.followers_count`：来自 `user_follows`。
- `published_pages.subscriber_count`：来自 `page_subscriptions`。

写入策略：

- 关注、取消关注、订阅、取消订阅必须使用事务或具备并发安全的原子更新。
- 重复关注或重复订阅不能重复递增。
- 幂等删除不能重复递减。
- 计数下限为 0。

回填策略：

- 上线迁移新增计数字段时，默认值为 0。
- 通过聚合 `user_follows` 回填 `followers_count`。
- 通过聚合 `page_subscriptions` 回填 `subscriber_count`。
- 回填后增加数据校验任务，对比冗余计数和真实关系数量。
- 如果校验发现不一致，以关系表为准修正冗余计数。

展示策略：

- 列表页、作者主页、阅读页优先读取冗余计数。
- 管理或诊断接口可以返回实时聚合值，用于排查计数漂移。

## 迁移风险

- 现有 `published_page_records` 可能缺少稳定版本号，导致 `last_seen_version` 和 `page_update_events.version` 无法准确对齐；需要先确认版本来源。
- 旧页面没有历史事件，只能从上线后的发布开始进入订阅流；如需补齐，可用现有最新记录生成一次 `published` 事件。
- 私密页权限模型若尚未统一，订阅和通知过滤可能依赖多个入口，容易出现越权展示。
- 冗余计数在并发关注或订阅时可能漂移，需要唯一约束和原子更新共同保证。
- 通知生成如果放在 publish API 同步路径，可能增加发布延迟；如果异步生成，需要补偿任务和幂等约束。
- `/{user_slug}` 与其他顶层路由可能冲突，路由解析需要保留 `/subscription`、`/read`、`/api` 等系统路径优先级。
- 用户修改 `user_slug` 后，历史事件里的 `user_slug` 快照可能与最新主页不一致；跳转时应优先通过页面 id 查当前 slug，快照仅用于展示兜底。

## 测试验收

- 关注作者：
  - 已登录用户可以关注和取消关注其他作者。
  - 关注自己返回 400，且不写入 `user_follows`。
  - 重复关注不重复增加 `followers_count`。
  - 取消不存在的关注关系不导致 `followers_count` 变为负数。

- 页面订阅：
  - 已登录用户可以订阅公开页面。
  - 非授权用户订阅私密页返回 403。
  - 订阅时写入 `notify_level` 和初始 `last_seen_version`。
  - `last_seen_version` 只能前进。
  - 重复订阅不重复增加 `subscriber_count`。

- 订阅流：
  - `GET /api/feed/subscriptions` 返回直接订阅页面的更新。
  - `GET /api/feed/subscriptions` 返回已关注作者的公开页面更新。
  - 同一事件同时命中页面订阅和作者关注时只返回一条。
  - cursor 分页稳定，不因新事件插入导致重复或跳页。
  - 用户失去私密页权限后，对应事件不再返回。

- 通知：
  - 页面发布或更新后，为符合 `notify_level` 的订阅者和关注者生成通知。
  - 不给页面 owner 本人生成通知。
  - 同一用户同时关注作者和订阅页面时只生成一条通知。
  - `GET /api/notifications` 支持 cursor 分页和 `unread_only`。
  - 单条已读和批量已读只影响当前用户自己的通知。

- 发布集成：
  - 首次发布生成 `published` 事件。
  - 更新内容生成 `updated` 事件。
  - 重复提交相同内容不生成重复事件。
  - publish API 重试不会生成重复 `page_update_events` 或重复通知。

- 计数与回填：
  - 迁移回填后的 `followers_count` 与 `user_follows` 聚合一致。
  - 迁移回填后的 `subscriber_count` 与 `page_subscriptions` 聚合一致。
  - 并发关注、取消关注、订阅、取消订阅后计数仍正确。

## 依赖

- 用户公开身份能力：`users.user_slug` 必须唯一、稳定，并能支撑 `/{user_slug}` 路由。
- 页面发布能力：publish API 和 `published_page_records` 必须提供可判断首次发布、更新和当前版本的字段。
- 页面访问权限能力：需要统一函数判断当前用户是否可以访问某个发布页面，供阅读页、订阅 API、订阅流和通知查询复用。
- 页面版本能力：`last_seen_version` 和 `page_update_events.version` 依赖稳定的页面版本号。
- Web 登录态：关注、订阅、订阅流和通知接口均依赖当前用户 session。
- 后台任务能力：用于通知补偿生成、计数回填、计数一致性校验和失效私密订阅清理。
