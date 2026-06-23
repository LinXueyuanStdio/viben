# Web 社区浏览历史、分享与转发设计

## 目标

为 Web 社区发布页补齐浏览历史、分享和转发能力，使公开页面可以被再次发现、被用户回看、被链接分享，并能在社区内转发为动态。

本 spec 覆盖：

- 新增 `view_events`，记录页面浏览和阅读事件明细。
- 新增 `user_browse_history`，保存登录用户可管理的浏览历史快照。
- 新增 `share_links`，保存可追踪、可撤销的分享链接。
- 新增 `share_events`，记录分享链接创建、复制、打开、渠道点击等事件。
- 新增 `reposts`，记录用户对页面等实体的转发关系，并与 Moment 形成接口边界。
- 明确匿名浏览、私密内容、历史删除、分享计数和转发计数的权限与隐私策略。
- 明确 `/page/{user_slug}/{page_id}` 保持 HTML 直出，`/read/{user_slug}/{page_id}` 作为社区阅读壳负责社区上下文和埋点。

## 非目标

- 不定义 Moment 的完整数据模型、时间线排序、评论互动或动态详情页；这些由 spec 5 负责。
- 不实现推荐算法、反作弊系统、复杂归因模型或实时风控。
- 不改变 `/page/{user_slug}/{page_id}` 的 HTML 直出语义。
- 不要求历史、分享、转发计数强实时一致；允许异步聚合和短时间延迟。
- 不把浏览历史暴露给其他用户、作者或管理员分析界面。
- 不定义最终 UI 视觉稿，只定义必须支持的交互和数据边界。

## 用户体验

### 首页浏览历史入口

社区首页需要提供“最近浏览”入口，入口只展示当前登录用户自己的历史摘要：

- 未登录用户可以看到入口，但点击后提示登录，或只显示当前匿名会话内的本地浏览记录；服务端不返回跨会话历史。
- 已登录用户可以查看最近浏览过的公开、未列出或本人有权访问的页面。
- 历史列表展示页面标题、作者、封面、最后浏览时间、浏览来源和阅读进度摘要。
- 用户可以删除单条历史，也可以清空全部历史。
- 当页面已经变为私密、被隐藏、被删除或当前用户失去访问权限时，历史列表中不继续展示敏感内容；可以显示“内容不可访问”的占位项，或在读取时过滤。

### 阅读页分享与转发

`/read/{user_slug}/{page_id}` 是社区阅读壳，需要展示页面标题、作者、统计、分享入口和转发入口：

- 分享用于生成或复制可公开访问的链接。
- 转发用于把该页面转发到社区动态，最终生成或关联 Moment。
- 对 `private`、不可见、审核未通过或当前用户无权访问的内容，不展示公开分享入口，也不允许生成公开分享链接。
- 对 `unlisted` 内容，是否允许分享由页面分享策略决定；默认可以生成持链接访问的分享链接，但不进入公开目录。
- 分享成功后更新页面分享计数；转发成功后更新页面转发计数，并由 Moment 侧负责动态分发。

### 页面卡分享与转发

社区首页、作者主页和列表卡片可以提供轻量分享/转发操作：

- 卡片分享默认复制 `/read/{user_slug}/{page_id}` 链接，而不是 HTML 直出链接。
- 需要嵌入或兼容旧场景时，仍可提供“复制 HTML 直出链接”的次级动作。
- 卡片转发需要登录；未登录点击时进入登录流程，登录后回到原操作上下文。
- 卡片操作不得绕过页面可见性、审核状态和作者分享策略。

### HTML 直出与阅读壳

两个路由的用户感知和计数职责必须分开：

- `/page/{user_slug}/{page_id}` 保持 HTML 直出，面向 iframe、嵌入、旧分享链接和兼容访问。它可以写入基础 `view_events`，但不得强制展示社区 chrome，也不得依赖主站交互才能渲染内容。
- `/read/{user_slug}/{page_id}` 是社区阅读壳，负责展示社区上下文、触发阅读埋点、提供分享和转发入口，并安全加载或链接到 HTML 直出内容。

## 数据模型

### `view_events`

`view_events` 是浏览和阅读行为的事件明细表，用于审计、统计聚合、历史 upsert 和后续推荐信号。

建议字段：

- `id`：主键。
- `entity_type`：被浏览实体类型，发布页使用 `published_page`。
- `entity_id`：被浏览实体 id，发布页使用 `published_pages.id`。
- `actor_user_id`：登录用户 id，可空。
- `anonymous_viewer_hash`：匿名访问者 hash，可空。
- `session_id_hash`：匿名或登录会话 hash，可空。
- `source`：事件来源，如 `read_shell`、`html_direct`、`card_preview`、`share_link`、`repost`。
- `route`：触发事件的路由，如 `/read` 或 `/page`。
- `referrer_type`：来源类型，如 `internal`、`external`、`share`、`repost`、`unknown`。
- `referrer_url_hash`：外部 referrer 的 hash，可空；不保存完整 URL。
- `share_link_id`：由分享链接进入时关联 `share_links.id`，可空。
- `repost_id`：由转发动态进入时关联 `reposts.id`，可空。
- `user_agent_hash`：用户代理 hash，可空。
- `ip_hash`：IP hash，可空。
- `country_code`、`region_code`：粗粒度地理信息，可空；不得保存精确地址。
- `duration_ms`：阅读停留时长，可空。
- `scroll_depth`：阅读滚动深度，取值 `0` 到 `100`，可空。
- `created_at`：事件创建时间。

约束：

- 登录用户浏览时写 `actor_user_id`，也可以写会话 hash 作为降噪辅助。
- 匿名浏览可以写事件，但只保存 hash 或匿名标识，不保存明文 IP、完整 user agent、完整 referrer 或可直接识别个人的信息。
- 所有浏览都 append `view_events`，不得因为历史已存在而跳过事件明细。
- `entity_type + entity_id + created_at` 需要支持时间范围查询，服务日统计聚合。

### `user_browse_history`

`user_browse_history` 是登录用户的浏览历史索引表，面向个人回看和删除。

建议字段：

- `id`：主键。
- `user_id`：历史所属用户。
- `entity_type`：实体类型，发布页使用 `published_page`。
- `entity_id`：实体 id。
- `last_view_event_id`：最近一次浏览事件 id，关联 `view_events.id`。
- `last_viewed_at`：最近浏览时间。
- `first_viewed_at`：首次浏览时间。
- `view_count`：该用户对该实体的浏览次数缓存。
- `last_source`：最近来源，如 `read_shell`、`html_direct`、`share_link`、`repost`。
- `last_route`：最近路由。
- `last_progress`：最近阅读进度 JSON，可空，例如停留时长和滚动深度摘要。
- `snapshot_title`：历史展示用标题快照。
- `snapshot_author_user_id`：作者 id 快照。
- `snapshot_cover_asset_id`：封面资源快照，可空。
- `deleted_at`：用户删除历史的时间，可空。
- `created_at`、`updated_at`。

约束：

- 唯一键：`user_id + entity_type + entity_id`。
- 同一用户浏览同一实体时，对 `user_browse_history` 执行 upsert，更新 `last_view_event_id`、`last_viewed_at`、`view_count` 和展示快照。
- 同一用户浏览同一实体时，仍必须 append `view_events`。
- `deleted_at` 只表示该用户从自己的历史列表移除，不删除 `view_events`，也不影响全局统计。
- 用户删除历史后再次浏览同一实体，应恢复或新建历史项，并更新 `first_viewed_at` 的策略需要在 migration 中明确；建议保留旧记录并清空 `deleted_at`，`last_viewed_at` 写新时间。

匿名用户不写入 `user_browse_history`。匿名会话的最近浏览可以只存在客户端本地，服务端仅保存不可反查个人的 `view_events`。

### `share_links`

`share_links` 保存可追踪分享链接，支持计数、撤销、过期和渠道归因。

建议字段：

- `id`：主键。
- `uid`：公开分享标识，使用不可枚举随机值。
- `entity_type`：分享实体类型，发布页使用 `published_page`。
- `entity_id`：分享实体 id。
- `created_by_user_id`：创建分享链接的用户，可空；匿名复制公开链接时可为空。
- `visibility_snapshot`：创建时实体可见性快照，如 `public`、`unlisted`。
- `channel`：分享渠道，如 `copy_link`、`system_share`、`x`、`wechat`、`email`、`embed`。
- `target_url`：最终落地 URL，默认 `/read/{user_slug}/{page_id}`。
- `html_direct_url`：HTML 直出 URL，可空，用于嵌入和兼容场景。
- `expires_at`：过期时间，可空。
- `revoked_at`：撤销时间，可空。
- `open_count`：打开次数缓存。
- `unique_open_count`：去重打开次数缓存。
- `created_at`、`updated_at`。

约束：

- `uid` 不能包含可推断 `entity_id`、`user_id` 的信息。
- 私密内容不可创建公开 `share_links`。
- 实体变为 `private`、`hidden`、`rejected` 或删除后，既有分享链接必须停止公开访问。
- 分享链接打开时仍要重新校验实体当前权限，不能只依赖 `visibility_snapshot`。
- 同一用户、同一实体、同一渠道可以复用最近未撤销且未过期的分享链接，也可以按产品需要每次新建；计数口径必须通过 `share_events` 明确。

### `share_events`

`share_events` 是分享行为和分享链接打开行为的事件明细表。

建议字段：

- `id`：主键。
- `share_link_id`：关联 `share_links.id`，可空；纯复制普通 URL 时可为空。
- `entity_type`：实体类型。
- `entity_id`：实体 id。
- `actor_user_id`：执行分享动作的用户，可空。
- `anonymous_actor_hash`：匿名分享者 hash，可空。
- `event_type`：事件类型，如 `link_created`、`link_copied`、`native_share_opened`、`share_target_clicked`、`link_opened`。
- `channel`：渠道。
- `target`：分享目标，可空，如 `wechat`、`x`、`email`。
- `source_route`：触发分享的路由，如 `/read`、`/page_card`。
- `viewer_hash`：打开分享链接的访问者 hash，可空。
- `ip_hash`、`user_agent_hash`：可空。
- `created_at`。

约束：

- 分享创建、复制和打开都 append `share_events`。
- 匿名分享事件只保存 hash 或匿名标识。
- 公开分享被拒绝时可以记录失败事件，但不得写入可公开访问的 `share_links`。
- `share_events` 是 `published_pages.share_count`、`entity_stats_daily.share_count`、`share_links.open_count` 等缓存的聚合来源。

### `reposts`

`reposts` 保存“某用户转发某实体”的关系和状态。它是页面等实体与 Moment 之间的连接层，不承载 Moment 的完整内容模型。

建议字段：

- `id`：主键。
- `entity_type`：被转发实体类型，发布页使用 `published_page`。
- `entity_id`：被转发实体 id。
- `user_id`：转发用户。
- `moment_id`：关联 Moment id，可空；由 Moment 服务创建成功后回填或在同一事务内写入。
- `comment`：转发附言快照，可空；最终展示以 Moment 模型为准。
- `visibility`：转发可见性，如 `public`、`followers`、`private`；具体枚举由 Moment spec 确认。
- `status`：转发状态，如 `pending`、`active`、`failed`、`deleted`。
- `failure_reason`：失败原因，可空。
- `created_at`、`updated_at`、`deleted_at`。

约束：

- 转发需要登录。
- 私密内容、审核不可见内容、当前用户无权访问的内容不可公开转发。
- 同一用户对同一实体是否允许多次转发由产品策略决定；MVP 建议唯一键 `user_id + entity_type + entity_id + deleted_at` 的活跃态约束，避免重复刷计数。
- 删除转发只软删除 `reposts` 并通知 Moment 侧处理动态状态，不删除原始页面。
- `reposts` 是实体转发计数缓存的聚合来源，但 Moment 的评论、点赞、转发二次传播由 spec 5 定义。

## API

所有 Gateway API query 参数使用 snake_case。

### 浏览事件写入

阅读壳和 HTML 直出都需要写入浏览事件，但语义不同：

- `/read/{user_slug}/{page_id}` 打开时写入 `source = read_shell` 的 view 事件。
- `/read/{user_slug}/{page_id}` 产生有效停留或滚动后，可以补充阅读进度事件或更新同一事件的阅读字段，具体实现可在技术方案中选择。
- `/page/{user_slug}/{page_id}` 直出访问时写入 `source = html_direct` 的 view 事件，不能影响 HTML 响应速度和兼容性。
- 从分享链接进入时关联 `share_link_id`。
- 从 Moment 或转发卡片进入时关联 `repost_id`。

写入成功后：

- append `view_events`。
- 如果存在登录用户，对 `user_browse_history` 做 upsert。
- 异步或同步更新页面累计 `view_count`、`read_count` 和 `entity_stats_daily`。

### 浏览历史读取与删除

历史读取接口面向当前登录用户：

- 支持分页。
- 支持按实体类型筛选。
- 支持删除单条历史。
- 支持清空全部历史。
- 只返回当前登录用户自己的历史。

权限要求：

- 不允许通过传入 `user_id` 读取其他用户历史。
- 删除历史只影响 `user_browse_history.deleted_at`，不删除事件明细和聚合统计。
- 返回历史列表时必须重新校验实体当前可访问性；不可访问内容不能泄露标题、作者、封面等敏感快照，除非产品明确允许显示本地历史占位。

### 分享链接创建与打开

分享创建接口需要：

- 校验当前用户或匿名访问者是否有权访问该实体。
- 校验实体是否允许公开分享。
- 对 `private`、`hidden`、`rejected`、删除态内容拒绝创建公开分享链接。
- 创建或复用 `share_links`。
- append `share_events`。
- 返回默认阅读壳链接 `/read/{user_slug}/{page_id}`，必要时返回 HTML 直出链接 `/page/{user_slug}/{page_id}`。

分享打开流程需要：

- 通过 `share_links.uid` 解析实体。
- 校验链接未过期、未撤销。
- 校验实体当前可见性和访问权限。
- append `share_events` 的 `link_opened`。
- 写入关联 `share_link_id` 的 `view_events`。
- 跳转或渲染 `/read/{user_slug}/{page_id}`。

### 转发创建与删除

转发创建接口需要：

- 要求登录。
- 校验实体存在、可访问、可转发。
- 创建 `reposts`。
- 调用 Moment 边界接口创建或关联 Moment。
- 成功后将 `reposts.status` 置为 `active`，并回填 `moment_id`。
- 聚合更新实体 `repost_count` 和日统计。

转发删除接口需要：

- 要求登录且只能删除自己的转发。
- 将 `reposts.deleted_at` 写入并更新 `status = deleted`。
- 通知 Moment 侧隐藏或删除对应动态。
- 聚合扣减或重算实体转发计数，具体采用增量扣减还是定期重算由实现方案决定。

## 权限与隐私

### 浏览隐私

- 登录用户历史只允许本人读取和删除。
- 作者不能查看具体谁浏览过自己的页面。
- 匿名浏览可以写 `view_events`，但只保存 hash 或匿名标识。
- 不保存明文 IP、完整 user agent、完整外部 referrer 或其他可直接识别个人的信息。
- 地理位置只能保存国家或区域级别，不保存精确位置。
- 用户删除浏览历史不等于删除匿名化统计事件；产品文案需要明确这是“从我的历史移除”。

### 内容权限

浏览、分享、转发每次操作都必须重新校验实体当前权限：

- `public + approved` 内容可以被公开浏览、分享和转发。
- `unlisted + approved` 内容可通过直接链接访问；是否允许公开分享由页面分享策略控制，默认允许持链接分享，不进入公开目录。
- `private` 内容不可公开分享，不可公开转发。
- `hidden`、`rejected`、删除态内容不可公开浏览、分享或转发。
- 作者本人可以浏览自己的私密内容，但该权限不自动扩展到分享接收者或转发受众。

### 分享隐私

- 分享链接 uid 必须不可枚举。
- 分享链接打开不得泄露创建者身份，除非产品明确展示“由某用户分享”。
- 撤销或过期的分享链接返回统一不可访问状态，不暴露实体是否存在。
- 分享事件用于聚合计数，不向普通用户展示访问者明细。

## 计数策略

### 浏览计数

浏览计数来源于 `view_events`：

- `/page` 的 HTML 直出访问计入 `view_count`。
- `/read` 的阅读壳访问计入 `view_count`。
- 满足有效阅读条件的 `/read` 事件可计入 `read_count`，例如停留时长或滚动深度达到阈值；具体阈值由实现方案配置。
- 同一用户或匿名 hash 在短时间内重复刷新可以通过聚合层降噪，但事件明细仍可 append。

登录用户历史与全局浏览计数不是同一概念：

- `user_browse_history.view_count` 是该用户自己的历史次数缓存。
- `published_pages.view_count` 是实体累计浏览缓存。
- `entity_stats_daily.view_count` 是实体日统计。

### 分享计数

分享计数来源于 `share_events`：

- `link_created` 或 `link_copied` 可计入 `share_count`，二者只能选择一种作为主要口径，避免同一次操作重复计数。
- MVP 建议以用户成功触发复制、系统分享面板或渠道分享为计数点，而不是单纯打开分享菜单。
- `link_opened` 计入 `share_links.open_count` 和可选的分享传播统计，但不应计入页面 `share_count`。
- `published_pages.share_count` 和 `entity_stats_daily.share_count` 由 `share_events` 聚合。

### 转发计数

转发计数来源于 `reposts`：

- `status = active` 且 `deleted_at` 为空的转发计入 `repost_count`。
- 创建失败、待处理、已删除的转发不计入有效转发数。
- 如果同一用户同一实体只允许一个活跃转发，重复转发不应重复增加计数。
- `published_pages.repost_count` 和 `entity_stats_daily.repost_count` 由 `reposts` 聚合。

### 聚合一致性

- 事件表和关系表是事实来源。
- 页面表上的 `view_count`、`share_count`、`repost_count` 是读取优化缓存。
- `entity_stats_daily` 是日维度聚合表。
- 缓存计数允许短暂延迟，但必须可通过后台任务从事实表重算。

## 与 Moment 的接口边界

Moment 由 spec 5 定义，本 spec 只定义转发侧需要的最小契约。

### 本 spec 负责

- 判断页面等实体是否可被当前用户转发。
- 创建和维护 `reposts` 关系。
- 保存 `entity_type`、`entity_id`、`user_id`、`moment_id`、`status` 等连接信息。
- 提供实体预览信息给 Moment 创建流程，例如标题、作者、封面、摘要和阅读 URL。
- 根据 `reposts` 聚合实体转发计数。

### Moment spec 负责

- Moment 的主表、内容结构、可见性枚举和时间线分发。
- Moment 的评论、点赞、二次转发、删除和审核策略。
- Moment 详情页和 feed 的展示模型。
- Moment 删除后如何通知或回写 `reposts`。

### 边界约定

- `reposts.moment_id` 是跨 spec 的关联键。
- 转发创建成功的定义是：`reposts` 进入 `active`，且已生成或关联可展示的 Moment。
- 如果 Moment 创建失败，`reposts.status` 保持 `failed`，不得增加页面转发计数。
- 如果 Moment 后续被删除或隐藏，Moment 侧需要提供状态同步机制，使 `reposts` 可以软删除或转为不可见。

## 错误处理

### 浏览事件失败

- 浏览事件写入失败不得阻断 `/page` HTML 直出。
- `/read` 埋点失败时页面仍应可读，但客户端可以降级重试。
- 历史 upsert 失败不得导致浏览事件回滚；实现可记录错误并异步修复。

### 历史读取失败

- 未登录访问历史接口返回未认证错误。
- 请求删除不存在或已删除的历史项时返回幂等成功或明确的不存在状态。
- 历史项对应实体不可访问时，不返回敏感快照。

### 分享失败

- 私密内容、审核不可见内容或无权限内容创建分享链接时返回不可分享错误。
- 分享链接过期、撤销或实体不可访问时，返回统一不可访问页面。
- 分享事件写入失败不应生成错误的公开链接；若链接已创建但事件失败，需要允许后续聚合从 `share_links` 或补偿任务修复。

### 转发失败

- 未登录转发返回未认证错误，并保留登录后继续操作所需上下文。
- 无权限或内容不可转发返回不可转发错误。
- Moment 创建失败时，`reposts` 标记为 `failed`，并向用户展示转发失败；不得增加转发计数。
- 重复转发在唯一约束策略下返回已有转发结果，或提示已转发，不重复计数。

## 迁移风险

- 旧页面没有 `repost_count` 字段时，需要与目录统计相关 migration 协调，确保计数字段默认值为 `0`。
- 旧分享入口可能直接复制 `/page/{user_slug}/{page_id}`；迁移后默认分享应改为 `/read/{user_slug}/{page_id}`，但旧链接必须继续可用。
- `/page` 写埋点不能破坏 HTML 直出性能、缓存和 iframe 嵌入。
- 匿名 hash 盐值和轮换策略需要谨慎设计，避免既无法降噪又造成长期跟踪风险。
- 历史快照可能保存旧标题和封面；读取时必须以当前权限为准，不能因为快照泄露已私密内容。
- 分享链接撤销、页面可见性变化和 Moment 状态变化都可能影响计数，需要提供重算任务。
- 多 worker 同时扩展社区表时，migration 命名、字段归属和计数字段需要统一，避免重复定义 `share_count`、`repost_count` 等缓存字段。

## 测试验收

### 浏览历史

- 登录用户访问 `/read/{user_slug}/{page_id}` 后，新增一条 `view_events`，并 upsert 当前用户的 `user_browse_history`。
- 同一登录用户重复访问同一页面时，`user_browse_history` 仍只有一条活跃记录，`last_viewed_at` 和 `view_count` 更新，`view_events` 追加多条。
- 匿名用户访问页面时可以写 `view_events`，但不写 `user_browse_history`，且事件中不包含明文 IP、完整 user agent、完整 referrer。
- 用户只能读取和删除自己的浏览历史，不能通过参数读取其他用户历史。
- 删除历史后，该用户历史列表不再返回该条记录；全局浏览统计不被删除。

### 分享

- 公开且审核通过的页面可以从阅读页和卡片创建或复制分享链接。
- 私密内容不可创建公开分享链接。
- 审核隐藏、拒绝或删除态内容的既有分享链接不可继续访问。
- 分享链接默认落到 `/read/{user_slug}/{page_id}`。
- 分享创建或复制追加 `share_events`，并最终更新页面 `share_count` 和日统计。
- 分享链接打开追加 `share_events.link_opened`，并写入关联 `share_link_id` 的 `view_events`。

### 转发

- 未登录用户点击转发进入登录流程，不创建 `reposts`。
- 登录用户转发公开页面后创建 `reposts`，生成或关联 `moment_id`，状态为 `active`。
- 私密内容、无权限内容、审核不可见内容不可公开转发。
- Moment 创建失败时 `reposts.status = failed`，页面 `repost_count` 不增加。
- 删除转发后 `reposts.deleted_at` 写入，页面有效转发计数最终扣减或重算正确。
- 同一用户同一实体重复转发不会重复增加有效转发计数。

### 路由与埋点

- `/page/{user_slug}/{page_id}` 仍保持 HTML 直出，不展示社区阅读壳。
- `/read/{user_slug}/{page_id}` 展示社区阅读壳，并写入 `source = read_shell` 的浏览事件。
- 从 `/page` 访问写入 `source = html_direct` 的浏览事件，但埋点失败不阻断 HTML 内容返回。

## 依赖

- 依赖发布页目录化与统计 spec 中的 `published_pages` 可见性、审核状态、统计缓存和 `entity_stats_daily`。
- 依赖用户身份体系提供当前登录用户、匿名会话标识和 user slug 解析。
- 依赖阅读壳路由 `/read/{user_slug}/{page_id}` 的页面加载与隔离能力。
- 依赖分享策略配置，至少需要判断实体是否允许公开分享。
- 依赖 Moment spec 5 提供 Moment 创建、删除或隐藏状态同步接口。
- 依赖后台聚合任务或队列，从 `view_events`、`share_events`、`reposts` 重算页面累计计数和日统计。
