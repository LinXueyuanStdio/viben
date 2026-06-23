# Web 社区榜单与推荐排序设计

## 背景

Web 社区需要在 `/leaderboard` 提供热门榜单，并在首页 `/` 与 `/web` 提供 Feeds、分类推荐、横向列表和「换一换」能力。数据输入来自前序社区能力：

- `published_pages`：页面目录化、可见性、审核状态、分类、标签、累计计数与当前版本。
- `entity_stats_daily`：按天聚合的页面浏览、去重浏览、点赞、收藏、评论、转发等行为统计。
- `page_update_events` 与订阅关系：提供追更、关注作者、订阅页面等弱个性化信号。
- moments、评论、点赞、收藏、转发等互动系统：提供热度排序和首页推荐的行为输入。

首页和榜单不能在请求时实时扫描 `entity_stats_daily`、`published_pages`、moments 或互动关系大表。所有公开榜单与首页推荐都必须读取预生成快照或轻量索引，并在请求阶段只做权限过滤、少量补齐和分页。

## 目标

- 定义 `ranking_snapshots` 与 `ranking_items`，作为榜单和首页推荐的预计算读取层。
- 定义 `GET /api/rankings*` 系列公开读取接口，支持 `/leaderboard`、首页横向列表、分类推荐和「换一换」。
- 定义 `POST /api/admin/rankings/rebuild` 管理接口，用于手动或补偿重建榜单快照。
- 明确 `pages_hot` 排序公式：近 7 天 `unique_views + likes * 4 + favorites * 6 + comments * 3 + reposts * 8`，并叠加时间衰减。
- 保证只有 `public + approved` 的公开审核通过内容可以进入公开榜单和首页推荐。
- 为首页 Feeds、分类推荐、横向列表和「换一换」定义 cursor/seed 语义，所有 query 参数和响应字段使用 snake_case。
- 明确冷启动、快照生成、审核过滤、迁移风险和测试验收边界。

## 非目标

- 不实现个性化推荐模型、向量召回、协同过滤或机器学习排序。
- 不定义 moments、评论、点赞、收藏、转发的完整数据模型；本 spec 只消费这些系统产出的聚合信号。
- 不替代订阅追更流 `/api/feed/subscriptions`；订阅流仍以用户关注和页面订阅为事实来源。
- 不定义审核后台、举报流程、反作弊检测的完整实现。
- 不要求首页每一次刷新都返回完全实时的数据；榜单允许按分钟级或小时级延迟更新。
- 不写实现代码、SQL migration 或前端组件代码。

## 用户体验

### `/leaderboard`

`/leaderboard` 是公开热门榜单页，默认展示 `pages_hot`：

- 支持切换榜单类型，例如热门页面、最新发布、分类热门。
- 支持按时间窗口查看，例如 `7d`、`30d`、`all`；首期 `pages_hot` 使用 `7d` 作为默认窗口。
- 榜单项展示排名、标题、作者、封面、分类、标签、摘要、关键计数、热度分和更新时间。
- 榜单分页必须稳定，同一快照内翻页不能因为新行为写入导致重复或跳页。
- 如果内容下架、转私密或审核状态变化，下一次请求不得继续展示该项，即使它仍存在于旧快照中。

### 首页 Feeds

首页 Feeds 用于纵向展示混合内容流：

- 未登录用户看到公开热门、最新发布、分类精选和少量探索内容的混合流。
- 已登录用户可以在公开内容基础上叠加关注作者、订阅页面、近期互动分类等轻量信号。
- 首页 Feeds 不承诺强个性化，首期可以基于快照池做规则混排。
- Feed item 必须可追溯到具体来源，例如 `ranking`、`category`、`subscription_hint`、`fresh`，便于 UI 展示和排查。

### 分类推荐

分类页或首页分类模块读取分类维度快照：

- 每个分类展示该分类下公开审核通过页面的热门、最新或精选列表。
- 分类推荐优先使用 `category_id`，没有分类的页面进入 `uncategorized` 或探索池，不强行归类。
- 停用分类不应出现在前台分类入口，但已有快照项仍需在请求阶段过滤掉。

### 横向列表

首页可包含多个横向列表：

- `hot_pages`：全站热门页面，来源为 `pages_hot`。
- `fresh_pages`：近期发布或更新页面，来源为发布事件或最新快照。
- `rising_pages`：新近增长较快页面，来源为短窗口热度快照。
- `category:{category_id}:hot`：分类热门页面。

横向列表每组返回少量 item，并带有 `next_cursor`，支持用户在当前模块内继续加载。

### 换一换

「换一换」用于在同一推荐池中返回另一组候选，不代表实时重新计算：

- 客户端第一次请求可不传 `seed`，服务端生成并返回稳定 `seed`。
- 后续点击「换一换」时传回同一个 `seed` 和上一轮 `cursor`。
- `seed` 决定同一用户、同一场景下的稳定打散顺序。
- `cursor` 表示当前推荐池已经消费到的位置或页码。
- 如果只传 `seed` 不传 `cursor`，表示从该 seed 对应顺序的起点重新读取。
- 如果既不传 `seed` 也不传 `cursor`，表示开启一次新的推荐会话。

所有参数使用 snake_case，例如 `ranking_key`、`category_id`、`time_window`、`next_cursor`。

## 数据模型

### `ranking_snapshots`

`ranking_snapshots` 表示一次榜单或推荐池生成结果的元信息。公开 API 读取某个 `ranking_key + time_window + scope` 的最新可用快照。

建议字段：

- `id`：主键。
- `ranking_key`：榜单或推荐池标识，例如 `pages_hot`、`pages_fresh`、`pages_rising`、`home_feed_guest`、`category_pages_hot`。
- `entity_type`：榜单项实体类型，页面使用 `published_page`，moment 使用 `moment`。
- `time_window`：统计窗口，例如 `7d`、`30d`、`all`。
- `scope_type`：作用域类型，例如 `global`、`category`、`user_segment`。
- `scope_id`：作用域 id；全局榜单为空，分类榜单为 `page_categories.id`。
- `algorithm_version`：算法版本，例如 `pages_hot_v1`。
- `status`：快照状态，可选 `building`、`ready`、`failed`、`expired`。
- `generated_at`：生成完成时间。
- `valid_from`：快照可被读取的开始时间。
- `valid_until`：快照建议失效时间；失效后可继续作为兜底，但应触发重建告警。
- `source_from`：统计窗口开始时间。
- `source_until`：统计窗口结束时间。
- `item_count`：快照项数量。
- `metadata`：扩展 JSON，记录生成参数、过滤数量、异常原因等。
- `created_at`、`updated_at`。

约束：

- 同一 `ranking_key + time_window + scope_type + scope_id + algorithm_version + generated_at` 不应重复。
- 公开读取只选择 `status = ready` 且 `valid_from <= now()` 的最新快照。
- 后台重建先写入 `building` 快照，完成所有 item 写入后再切换为 `ready`，避免前台读到半成品。

### `ranking_items`

`ranking_items` 保存快照中的排序结果和展示所需的轻量冗余字段。

建议字段：

- `id`：主键。
- `snapshot_id`：关联 `ranking_snapshots.id`。
- `rank`：快照内排名，从 1 开始。
- `entity_type`：实体类型，首期主要为 `published_page`。
- `entity_id`：实体主键，例如 `published_pages.id`。
- `score`：最终排序分。
- `raw_score`：未衰减或未归一化的基础分。
- `decay_factor`：时间衰减系数。
- `reason`：推荐原因，例如 `hot`、`fresh`、`category_hot`、`followed_author_related`。
- `breakdown`：分数字段拆解 JSON，例如 `unique_views`、`likes`、`favorites`、`comments`、`reposts`、`age_hours`。
- `title`：标题快照。
- `description`：摘要快照。
- `user_id`：作者 id 快照。
- `user_slug`：作者 slug 快照。
- `page_id`：页面公开 uid 快照。
- `category_id`：分类 id 快照，可空。
- `cover_asset_id`：封面资源 id 快照，可空。
- `tags`：标签快照。
- `published_at`：页面发布时间快照。
- `last_published_at`：页面最近发布时间快照。
- `created_at`。

约束：

- 唯一约束：`snapshot_id + entity_type + entity_id`。
- 唯一约束：`snapshot_id + rank`，保证同一快照内排名稳定。
- 查询索引：`snapshot_id + rank`、`entity_type + entity_id`。
- `ranking_items` 中的标题、作者、封面等只是展示快照；请求阶段仍需读取当前实体做可见性和审核过滤。

### 数据来源要求

`pages_hot` 至少消费以下字段：

- `entity_stats_daily.entity_type = published_page`。
- `entity_stats_daily.entity_id = published_pages.id`。
- 近 7 天 `unique_viewer_count` 或等价去重浏览指标，作为 `unique_views`。
- 近 7 天 `like_count`、`favorite_count`、`comment_count`、`repost_count`。
- `published_pages.visibility`、`published_pages.moderation_status`、`published_pages.published_at`、`published_pages.last_published_at`。

如果 `entity_stats_daily` 首期尚未包含 `favorite_count`、`comment_count`、`repost_count`，需要在前序统计表补齐字段，或由快照任务从对应互动聚合表产出同名输入。公开 API 不直接聚合互动明细表。

## API

所有 query 参数、body 字段和响应字段使用 snake_case。

### `GET /api/rankings`

读取指定榜单快照，服务 `/leaderboard` 和通用横向列表。

query 参数：

- `ranking_key`：必填，例如 `pages_hot`。
- `time_window`：可选，默认 `7d`。
- `scope_type`：可选，默认 `global`。
- `scope_id`：可选，分类榜单传 `category_id`。
- `cursor`：可选，稳定分页游标。
- `limit`：可选，默认 30，最大 100。
- `seed`：可选，用于打散读取；榜单页默认不打散，首页模块可使用。
- `include_breakdown`：可选，默认 false；管理或调试场景可返回分数拆解。

响应字段：

- `ranking_key`
- `time_window`
- `scope_type`
- `scope_id`
- `snapshot_id`
- `algorithm_version`
- `generated_at`
- `items`
- `next_cursor`
- `has_more`
- `seed`

单条 item 至少包含：

- `rank`
- `entity_type`
- `entity_id`
- `score`
- `reason`
- `title`
- `description`
- `user_slug`
- `page_id`
- `read_url`
- `category_id`
- `cover_url`
- `tags`
- `published_at`
- `last_published_at`
- `stats`

读取规则：

- 请求阶段必须再次校验实体当前可见性，只返回 `visibility = public` 且 `moderation_status = approved` 的页面。
- 如果快照项对应页面已删除、下架、隐藏、转私密或审核不通过，直接跳过，并继续从快照后续 item 补足 `limit`。
- 如果最新快照不存在，返回空列表和可诊断错误码，不能退化为实时扫大表。

### `GET /api/rankings/{ranking_key}`

`GET /api/rankings/{ranking_key}` 是 `GET /api/rankings?ranking_key={ranking_key}` 的语义糖，适合前端按资源路径调用。其他 query 参数保持一致。

### `GET /api/rankings/home`

读取首页推荐组合，服务 `/` 与 `/web`。

query 参数：

- `cursor`：可选，首页 Feeds 的分页游标。
- `limit`：可选，默认 30，最大 60。
- `seed`：可选，首页推荐会话 seed。
- `category_id`：可选，用于首页分类 Tab 或分类推荐上下文。
- `include_sections`：可选，默认 true；是否返回横向列表模块。

响应字段：

- `seed`
- `feed_items`
- `next_cursor`
- `has_more`
- `sections`
- `generated_at`

`sections` 中每个模块包含：

- `section_key`：例如 `hot_pages`、`fresh_pages`、`rising_pages`、`category_pages_hot`。
- `title`
- `ranking_key`
- `items`
- `next_cursor`
- `has_more`

首页接口只能读取 `ranking_snapshots`、`ranking_items`、当前页面轻量表和少量关系索引。不得在请求时按天聚合统计大表。

### `GET /api/rankings/sections/{section_key}`

读取首页某个横向列表的更多内容，适合「查看更多」或横向列表懒加载。

query 参数：

- `cursor`
- `limit`
- `seed`
- `category_id`
- `time_window`

响应字段同单个 section。

### `POST /api/admin/rankings/rebuild`

管理端手动触发榜单重建。仅管理员或后台任务身份可调用。

body 字段：

- `ranking_key`：必填，例如 `pages_hot`。
- `time_window`：可选，默认由 ranking 配置决定。
- `scope_type`：可选。
- `scope_id`：可选。
- `algorithm_version`：可选；为空时使用当前默认版本。
- `source_from`：可选，指定统计窗口开始时间。
- `source_until`：可选，指定统计窗口结束时间。
- `dry_run`：可选，默认 false；为 true 时只返回预计输入数量和过滤数量，不写入快照。
- `force`：可选，默认 false；允许在已有新鲜快照时仍重建。

响应字段：

- `snapshot_id`
- `status`
- `ranking_key`
- `time_window`
- `scope_type`
- `scope_id`
- `algorithm_version`
- `item_count`
- `generated_at`
- `warnings`

重建接口可以同步返回完成结果，也可以返回 `building` 状态并由后台任务继续执行。无论哪种方式，前台公开读取只读 `ready` 快照。

## 排序公式

### `pages_hot_v1`

`pages_hot` 使用近 7 天公开页面互动统计：

```text
raw_score = unique_views + likes * 4 + favorites * 6 + comments * 3 + reposts * 8
score = raw_score * decay_factor
```

字段口径：

- `unique_views`：近 7 天去重浏览人数或去重访问者数，优先使用 `entity_stats_daily.unique_viewer_count`。
- `likes`：近 7 天点赞数。
- `favorites`：近 7 天收藏数。
- `comments`：近 7 天评论数。
- `reposts`：近 7 天转发或分享再传播数。

时间衰减：

- 使用页面最近有效活跃时间计算衰减，优先取近 7 天内最后一次有效互动时间；缺失时取 `last_published_at`，再缺失时取 `published_at`。
- 建议半衰期为 72 小时，公式为 `decay_factor = pow(0.5, age_hours / 72)`。
- `decay_factor` 下限建议为 `0.15`，避免 7 天窗口内较早但质量高的内容完全消失。
- `age_hours` 小于 0 时按 0 处理。

排序稳定性：

- 主排序：`score` 倒序。
- 并列排序：`raw_score` 倒序、`last_published_at` 倒序、`entity_id` 升序。
- 分数写入 `ranking_items.score`，拆解写入 `breakdown`。

过滤规则：

- 只计算 `published_pages.visibility = public`。
- 只计算 `published_pages.moderation_status = approved`。
- 作者账号必须处于可公开展示状态。
- 被系统隐藏、删除、封禁、审核拒绝或软删除的内容不得写入公开快照。

### 其他首期排序池

`pages_fresh`：

- 来源为公开审核通过页面。
- 按 `last_published_at` 倒序，再按 `published_at` 倒序、`id` 倒序。
- 用于首页最新发布横向列表，不用于替代订阅追更流。

`pages_rising`：

- 来源为近 24 小时或近 48 小时互动增长。
- 可复用 `pages_hot_v1` 权重，但统计窗口更短，时间衰减更强。
- 用于发现新近增长内容，避免热门榜长期被老内容占据。

`category_pages_hot`：

- 来源为 `category_id` 对应公开审核通过页面。
- 公式与 `pages_hot_v1` 一致。
- 每个活跃分类独立生成快照，避免请求时按分类实时聚合。

## 快照生成

快照生成由后台任务负责，可以由定时任务、队列任务或管理接口触发。

生成流程：

1. 读取 ranking 配置，确定 `ranking_key`、`time_window`、`scope_type`、`scope_id`、`algorithm_version`。
2. 创建 `status = building` 的 `ranking_snapshots`。
3. 从预聚合表读取候选集合，例如 `entity_stats_daily` 的近 7 天聚合结果、`published_pages` 的最新元数据、订阅和互动计数缓存。
4. 应用权限与审核过滤，只保留公开审核通过内容。
5. 计算 `raw_score`、`decay_factor`、`score` 和 `breakdown`。
6. 按排序规则取前 N 个候选，建议全局榜单至少保留 500 到 2000 个 item，首页池可保留更多。
7. 写入 `ranking_items`。
8. 校验 item 数量、排名连续性和重复项。
9. 将快照状态切换为 `ready`，并设置 `generated_at`、`valid_from`、`valid_until`。
10. 将旧快照标记为 `expired` 或由清理任务按保留策略删除。

性能要求：

- 前台请求不得触发快照生成。
- 快照任务可以扫描聚合表和轻量元数据表，但不得阻塞发布、阅读或互动写入。
- 快照生成失败不得影响旧 `ready` 快照读取。
- 重建任务必须幂等；同一参数重复执行不会产生前台可见的半成品。

刷新频率建议：

- `pages_hot`：每 15 到 30 分钟生成一次。
- `pages_rising`：每 5 到 15 分钟生成一次。
- `pages_fresh`：每 5 分钟或由发布事件触发增量刷新。
- `category_pages_hot`：每 30 到 60 分钟生成一次，低流量分类可降低频率。

## 首页推荐接口

首页推荐不是单一榜单，而是多个快照池的规则混排。

### 未登录用户

未登录首页 Feed 可按以下比例混排：

- 40% 来自 `pages_hot`。
- 25% 来自 `pages_fresh`。
- 20% 来自活跃分类的 `category_pages_hot`。
- 15% 来自 `pages_rising` 或冷启动探索池。

混排时需要去重，同一 `published_page_id` 在一次响应中只出现一次。若某个池不足，用其他池补足，但不能实时扫大表。

### 已登录用户

已登录用户可在公开推荐池上叠加轻量信号：

- 用户关注作者的新近公开页面可以提高混排优先级，但不替代 `/api/feed/subscriptions`。
- 用户直接订阅页面的更新仍主要进入 `/subscription`，首页可展示少量 `subscription_hint`。
- 用户近期互动过的分类、标签可调整分类池抽样权重。
- 当前用户自己的页面默认不进入首页推荐给自己，除非是管理或预览场景。

首期不需要建立用户级快照。请求阶段允许读取当前用户少量关系数据，例如关注作者 id 集合、近期偏好分类 id 集合，并对预生成公共池做轻量重排。

### cursor 与 seed

首页 `cursor` 应编码以下信息：

- 当前 `seed`。
- 已消费的 feed 位置。
- 各来源池已消费位置。
- 使用的 `snapshot_id` 列表。
- 去重集合的摘要或可重建信息。

语义要求：

- `cursor` 只对同一 `seed` 和同一用户上下文有效。
- 当传入过期 snapshot 的 cursor 时，服务端可以继续用旧快照完成当前翻页，也可以返回新 cursor 并从新快照边界续读，但不能重复大量已看内容。
- `seed` 不应携带敏感信息；cursor 如果包含用户上下文，应签名或加密，避免客户端伪造越权。

### 换一换

换一换接口可以复用 `GET /api/rankings/home` 或 section 接口：

- 初次加载：`GET /api/rankings/home?limit=12`
- 换一换：`GET /api/rankings/home?limit=12&seed={seed}&cursor={next_cursor}`
- 指定分类换一换：`GET /api/rankings/home?category_id={category_id}&seed={seed}&cursor={next_cursor}`

服务端返回新的 `next_cursor`。如果池耗尽，可以循环到起点但必须在响应中设置 `has_more = false` 或更换 seed，避免用户误以为还有无限新内容。

## 权限与审核过滤

公开榜单和首页推荐必须同时在快照生成阶段和请求读取阶段过滤。

生成阶段过滤：

- `published_pages.visibility = public`。
- `published_pages.moderation_status = approved`。
- 作者账号可公开展示，且未被封禁或隐藏。
- 页面未软删除，分类未被禁止展示。
- 页面内容未被系统风控标记为不可推荐。

读取阶段过滤：

- 对每个 `ranking_item` 关联当前 `published_pages` 记录做二次校验。
- 页面转为 `private`、`unlisted`、`hidden`、`rejected`、`pending` 后，公开 API 立即跳过该项。
- `unlisted` 页面即使可通过直接链接访问，也不得进入榜单和首页公开推荐。
- 管理调试接口如需查看被过滤项，必须使用 admin 权限和明确参数，默认公开接口永远不返回。

审核状态变化：

- 页面审核状态从 `approved` 变为 `hidden`、`rejected` 或 `pending` 时，应触发推荐失效事件，尽快重建相关快照或将页面加入即时屏蔽集合。
- 页面从非公开状态恢复为 `approved + public` 后，不要求立即进榜，等待下一轮快照生成即可。

## 冷启动策略

新页面、新分类和新站点都需要避免完全没有内容。

新页面冷启动：

- 新发布且 `public + approved` 的页面进入 `pages_fresh`。
- 在 `pages_hot` 中，允许给发布时间 24 小时内且审核通过的新页面一个小的探索加成，但加成必须写入 `breakdown`。
- 探索加成不能让无互动内容长期占据热门榜，建议只影响首页探索池，不影响 `/leaderboard` 主榜前列。

新分类冷启动：

- 分类内容不足时，返回该分类最新公开页面。
- 如果分类少于最小展示数量，可补充全站热门中标签或标题相关的公开页面，但必须在 item `reason` 中标记为 `fallback`。
- 停用分类不触发冷启动兜底。

新用户冷启动：

- 未登录和新登录用户使用全局公共池。
- 已登录但无互动历史用户使用全局热门、最新、上升和分类均衡混排。
- 不基于空历史强行推断兴趣。

新站点冷启动：

- 如果快照为空，首页返回空状态和最新公开页面池；仍不得实时扫大表。
- 管理端可以通过 `POST /api/admin/rankings/rebuild` 立即生成首个快照。

## 迁移风险

- `entity_stats_daily` 现有字段可能不足以表达 `favorites`、`comments`、`reposts`，需要先补齐统计聚合或建立等价输入，否则 `pages_hot` 只能降级，影响公式一致性。
- 旧页面缺少审核、可见性、分类、封面和发布时间字段时，需要依赖前序迁移默认值；默认值错误会导致不该公开的内容进榜。
- 快照项保存展示快照，页面后续改名或改封面可能与榜单展示短暂不一致；读取阶段可用当前实体覆盖关键展示字段。
- 审核状态变化如果只等待下一轮快照，可能产生短暂违规展示；需要即时屏蔽集合或读取阶段二次校验兜底。
- 大量分类独立生成快照会增加后台任务成本，需要按活跃分类、内容量和访问量分级调度。
- cursor 如果直接暴露内部 rank 或 snapshot 信息，可能被篡改造成跳页、重复或越权读取；需要签名或不可伪造编码。
- 首页轻量个性化如果读取过多用户关系，会把请求路径变慢；首期只允许读取小集合关系和缓存偏好。
- 多个 worker 同时编写社区 spec 时，字段命名可能不一致；实现前需要统一 `favorite_count`、`comment_count`、`repost_count` 等统计字段口径。

## 测试验收

数据模型：

- migration 后存在 `ranking_snapshots` 与 `ranking_items`。
- `ranking_items` 在同一 `snapshot_id` 内 `rank` 连续且不重复。
- 同一快照内同一 `entity_type + entity_id` 不重复。
- 快照从 `building` 切换到 `ready` 前，公开接口不会读取该快照。

排序公式：

- `pages_hot` 使用近 7 天 `unique_views + likes * 4 + favorites * 6 + comments * 3 + reposts * 8` 计算 `raw_score`。
- `score` 正确叠加时间衰减，并在 `breakdown` 中可解释。
- 分数相同时按 `raw_score`、`last_published_at`、`entity_id` 稳定排序。
- `pages_hot` 不包含 7 天窗口外且无有效统计的页面，除非明确进入冷启动探索池。

公开过滤：

- `private`、`unlisted`、`pending`、`rejected`、`hidden` 页面不会写入公开快照。
- 页面在快照生成后改为非公开或审核不通过，`GET /api/rankings` 立即不返回该页面。
- 作者被封禁或隐藏后，其页面不再出现在公开榜单和首页推荐中。

API：

- `GET /api/rankings?ranking_key=pages_hot&time_window=7d` 返回最新 `ready` 快照。
- `GET /api/rankings/{ranking_key}` 与 query 形式语义一致。
- `GET /api/rankings/home` 返回 `feed_items`、`sections`、`seed`、`next_cursor` 和 `has_more`。
- `GET /api/rankings/sections/{section_key}` 支持 `cursor`、`seed`、`category_id`。
- 所有 query 参数和响应字段为 snake_case。
- 传入非法 `ranking_key`、伪造 cursor 或无权限 admin rebuild 时返回明确错误。

换一换：

- 首次请求不传 `seed` 时，服务端返回 `seed`。
- 使用相同 `seed + cursor` 连续请求时，不重复返回同一批 item。
- 只传 `seed` 不传 `cursor` 时，从该 seed 的起点重新返回。
- 池耗尽时 `has_more = false`，不会实时扫大表补内容。

快照生成：

- `POST /api/admin/rankings/rebuild` 可重建 `pages_hot`。
- `dry_run = true` 不写入快照和 item。
- 重建失败时旧 `ready` 快照仍可读取。
- 并发重建不会让前台读到半成品或重复 rank。

首页推荐：

- 未登录首页不读取用户关系表也能返回公共推荐。
- 已登录首页可以基于关注作者或近期分类偏好做轻量重排，但不展示不可见内容。
- 首页和榜单请求路径不聚合扫描 `entity_stats_daily`、moments 或互动明细大表。

## 依赖

- 页面目录化与统计能力：依赖 `published_pages` 的可见性、审核、分类、标签、封面、发布时间和累计计数字段；依赖 `entity_stats_daily` 的日聚合统计。
- 互动统计能力：点赞、收藏、评论、转发需要产出可被快照任务消费的聚合计数。
- 订阅与关注能力：依赖 `user_follows`、`page_subscriptions`、`page_update_events` 提供首页轻量个性化和追更提示信号。
- 权限判断能力：需要统一的页面公开可见性判断函数，供快照生成和公开 API 二次过滤复用。
- 审核与风控能力：需要可靠的 `moderation_status`、作者状态和即时屏蔽机制。
- 后台任务能力：需要定时、手动和补偿重建快照的任务执行环境。
- Web 登录态：已登录首页推荐需要当前用户 id，但公开榜单必须支持未登录访问。
