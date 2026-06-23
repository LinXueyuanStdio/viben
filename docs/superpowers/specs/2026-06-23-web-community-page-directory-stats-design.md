# Web 社区发布页目录化与统计设计

## 目标

将已发布的静态页面从“按作者直接访问的 HTML 发布物”扩展为可在社区首页、作者主页、分类目录、阅读页中被发现、排序和统计的公开内容实体。

本 spec 覆盖：

- 扩展 `published_pages` 与 `published_page_versions`，补齐目录化、审核、可见性、封面、标签和统计所需字段。
- 新增 `page_categories`，提供社区目录分类基础数据。
- 新增 `media_assets`，统一保存封面等媒体资源的元信息，不保存封面二进制。
- 新增 `entity_stats_daily`，按天记录页面等实体的聚合统计。
- 明确旧发布 API 的兼容默认值。
- 明确正式 migration 是数据库结构的权威来源，运行时 `ensurePublishedPagesTable` 只做补洞。

## 非目标

- 不实现推荐算法、全文搜索、个性化 feed 或复杂审核工作流。
- 不实现封面图片上传的二进制存储服务；本次只定义媒体元信息模型。
- 不改变 `/page/{user_slug}/{page_id}` 的 HTML 直出语义。
- 不废弃旧发布 API，也不要求 Desktop 端在同一版本内必须提交分类、标签或封面。
- 不定义所有社区页面的最终视觉稿；这里只描述必须支持的数据和 UI 行为边界。

## 现状

当前发布页能力以静态 HTML 发布和公开访问为主：

- `published_pages` 现有核心字段只有 `uid`、`user_id`、`title`、`icon`、`description`、`html`、`current_version`、`created_at`、`updated_at`。
- `published_page_versions` 用于记录发布版本快照，但版本快照仍偏向页面内容本身，缺少目录化和统计所需元数据。
- 运行时存在 `ensurePublishedPagesTable`，同时仓库也存在正式 migration；两者并存容易造成字段演进职责不清。
- 公开页面已经形成作者 slug 与 page uid 组合访问的约束，后续需要在保持兼容的前提下补充社区入口。

## 路由影响

路由语义必须保持清晰，避免社区首页、作者主页、HTML 直出和阅读壳互相抢占：

- `/` 保持社区首页，用于展示公开页面目录、推荐/最新列表、分类入口和社区统计摘要。
- `/landing` 承接现有营销首页，避免营销内容占用社区根路径。
- `/web` 是 Desktop view url，与 `/` 展示同一社区首页语义；如有技术层重定向或复用页面组件，用户可感知内容应一致。
- `/{user_slug}` 是公开作者主页，展示作者资料、作者公开页面概览和作者维度统计。
- `/page/{user_slug}` 保持作者 published page 列表，作为已有发布页列表入口兼容保留。
- `/page/{user_slug}/{page_id}` 保持 HTML 直出，面向 iframe、分享、嵌入和历史链接兼容。
- `/read/{user_slug}/{page_id}` 是社区阅读壳，展示标题、作者、封面、分类、标签、阅读统计、相关推荐等社区上下文，并在壳内加载或链接到 HTML 直出内容。

`/{user_slug}` 与其他顶层路由冲突时，保留系统路由优先级；用户 slug 注册或更新时必须避开 `landing`、`web`、`page`、`read`、`api` 等保留词。

## 数据模型

### `published_pages`

`published_pages` 是页面最新发布状态的权威表，继续保存当前 HTML，同时新增社区目录和统计字段。

建议新增字段：

- `category_id`：可空，关联 `page_categories.id`。旧页面或未分类页面为空。
- `cover_asset_id`：可空，关联 `media_assets.id`。封面文件本体不写入此表。
- `tags`：字符串数组或 JSON 数组，保存归一化后的标签快照，便于列表筛选和展示。
- `visibility`：页面可见性，建议枚举值为 `public`、`unlisted`、`private`。
- `moderation_status`：审核状态，建议枚举值为 `pending`、`approved`、`rejected`、`hidden`。
- `published_at`：首次成功发布并进入可访问状态的时间。
- `last_published_at`：最近一次成功发布的时间。
- `view_count`：累计浏览次数缓存。
- `unique_view_count`：累计去重浏览次数缓存，去重口径由浏览事件实现确定。
- `read_count`：累计阅读次数缓存，可由阅读壳事件驱动。
- `like_count`：累计点赞数缓存，为后续互动预留。
- `favorite_count`：累计收藏数缓存，为后续互动预留。
- `comment_count`：累计评论数缓存，为后续互动预留。
- `share_count`：累计分享数缓存，为后续互动预留。
- `repost_count`：累计转发数缓存，为后续互动预留。
- `subscriber_count`：累计直接订阅人数缓存，为订阅追更预留；关注作者不计入页面订阅数。
- `version_count`：累计发布版本数缓存，与 `current_version` 语义区分；`current_version` 仍表示当前内容版本号。
- `stats_updated_at`：统计缓存最后刷新时间。

字段约束：

- `visibility` 默认 `public`，兼容旧发布行为。
- `moderation_status` 默认 `approved`，在没有审核系统接入前保证旧发布页继续可见。
- `published_at` 对旧数据回填为 `created_at`。
- `last_published_at` 对旧数据回填为 `updated_at`。
- 计数字段默认 `0`，不得为负数。
- `tags` 不参与权限判断，只用于发现和筛选；权限由 `visibility` 与 `moderation_status` 决定。
- `cover_asset_id` 只引用媒体元信息，不允许把封面二进制、base64 或大段 data url 存入 `published_pages`。

### `published_page_versions`

`published_page_versions` 是不可变发布快照。除已有 `published_page_id`、`uid`、`user_id`、`version`、`title`、`icon`、`description`、`html`、`created_at` 外，需要同步记录发布时的目录元数据。

建议新增字段：

- `category_id`：发布当时的分类。
- `cover_asset_id`：发布当时的封面资源引用。
- `tags`：发布当时的标签快照。
- `visibility`：发布当时的可见性。
- `moderation_status`：发布当时的审核状态。
- `published_at`：该版本成为发布版本的时间。

版本表不保存计数字段。统计属于页面实体当前状态和每日聚合，不属于内容版本快照。

### `page_categories`

`page_categories` 提供社区目录分类。

建议字段：

- `id`：主键。
- `slug`：分类公开标识，唯一，使用小写英文、数字和连字符。
- `name`：分类展示名。
- `description`：分类说明，可空。
- `icon`：分类图标，可空，沿用现有 icon JSON 或约定字符串格式。
- `sort_order`：分类排序权重。
- `is_active`：是否在前台展示。
- `created_at`、`updated_at`。

分类删除策略：

- 不建议物理删除已有分类。
- 若分类停用，设置 `is_active = false`。
- 页面关联到停用分类时，后台仍可展示；前台列表可归入“其他”或隐藏该筛选入口。

### `media_assets`

`media_assets` 保存封面和后续媒体资源的元信息。封面二进制必须由外部对象存储、现有上传服务或远端 URL 提供，本表不保存文件内容。

建议字段：

- `id`：主键。
- `owner_user_id`：资源归属用户。
- `kind`：资源类型，封面使用 `cover`。
- `source`：来源类型，如 `external_url`、`object_storage`、`generated`。
- `url`：可访问 URL 或对象存储访问地址。
- `thumbnail_url`：缩略图 URL，可空。
- `mime_type`：媒体 MIME 类型，可空。
- `width`、`height`：图片尺寸，可空。
- `size_bytes`：文件大小元信息，可空。
- `alt_text`：无障碍描述，可空。
- `metadata`：扩展 JSON，可空。
- `created_at`、`updated_at`。

约束：

- `url` 不接受 base64 data url。
- 服务端应校验 `owner_user_id` 与发布页 `user_id` 一致，避免引用他人私有媒体。
- 对外部 URL 的可用性、转存和安全扫描由后续上传/媒体 spec 细化。

### `entity_stats_daily`

`entity_stats_daily` 是通用实体日统计表，先服务发布页，后续可复用到作者、模板、智能体等实体。

建议字段：

- `id`：主键。
- `entity_type`：实体类型，发布页使用 `published_page`。
- `entity_id`：实体 id，发布页使用 `published_pages.id`。
- `stat_date`：统计日期，按 UTC 或产品统一时区存储，必须在实现中明确。
- `view_count`：当日浏览次数。
- `unique_view_count`：当日去重浏览次数。
- `read_count`：当日阅读次数。
- `like_count`：当日点赞次数。
- `favorite_count`：当日收藏次数。
- `comment_count`：当日评论次数。
- `share_count`：当日分享次数。
- `repost_count`：当日转发次数。
- `subscriber_count`：当日新增直接订阅次数。
- `unique_viewer_count`：当日去重访问者数，可先为 `0` 或空实现。
- `created_at`、`updated_at`。

约束：

- 唯一键：`entity_type + entity_id + stat_date`。
- 所有计数字段默认 `0`，不得为负数。
- 日统计写入可以异步或批量聚合，但页面详情需要可读取累计缓存字段。

## API

### 发布 API 兼容

现有发布 API 必须继续接受旧请求体，只包含 `uid`、`title`、`icon`、`description`、`html` 时仍能发布成功。

旧请求体默认值：

- `visibility` 默认 `public`。
- `moderation_status` 默认 `approved`。
- `category_id` 默认空。
- `cover_asset_id` 默认空。
- `tags` 默认空数组。
- `published_at` 首次发布时写入当前服务端时间；旧数据迁移回填为 `created_at`。
- `last_published_at` 每次成功发布时更新为当前服务端时间。

新版发布请求可以选择携带分类、封面、标签和可见性。服务端仍以当前登录用户为 owner，不接受客户端提交 `user_id`。

发布响应应继续返回已有字段，并可增加社区阅读 URL：

- HTML 直出 URL：`/page/{user_slug}/{page_id}`。
- 社区阅读 URL：`/read/{user_slug}/{page_id}`。

### 目录 API

社区首页和分类页需要读取目录化页面列表。API 应支持：

- 按分类筛选。
- 按标签筛选。
- 按作者筛选。
- 按排序方式读取：最新发布、最近更新、最多浏览、趋势。
- 分页。

列表只返回满足以下条件的页面：

- `visibility = public`。
- `moderation_status = approved`。
- 作者账号处于可公开展示状态。

### 统计 API

统计写入和读取应拆分：

- 写入事件用于记录 view/read/share 等动作，可由阅读壳或 HTML 直出页触发。
- 读取接口用于页面详情、作者主页和社区首页展示累计统计与日趋势。

统计接口必须允许幂等或降噪策略，避免页面刷新造成明显虚高。去重口径可以后续细化，但本 spec 要求数据模型能承载 `unique_viewer_count`。

## 权限

发布页展示权限由页面状态和用户身份共同决定：

- 未登录用户只能访问 `visibility = public` 且 `moderation_status = approved` 的页面。
- 作者本人可以在管理场景看到自己的 `private`、`unlisted`、`pending` 或 `rejected` 页面，但公开社区入口不得展示。
- `unlisted` 页面不进入 `/`、分类列表、作者公开主页的默认公开列表，但持有直接链接可访问阅读壳和 HTML 直出。
- `private` 页面仅作者本人和未来被授权用户可访问。
- `hidden` 或 `rejected` 页面不进入公开列表；非作者访问返回 404 或统一不可见响应，避免泄露审核状态。

媒体资源权限：

- 发布页引用封面时，`media_assets.owner_user_id` 必须等于页面 `user_id`，或资源被标记为系统公共资源。
- 删除或替换封面不应删除历史版本记录中的 `cover_asset_id`，但前台展示需要能处理资源失效。

## UI 影响

社区首页 `/` 与 `/web`：

- 展示公开页面目录，包括最新发布、热门、分类入口和基础统计。
- 页面卡片展示标题、描述、作者、封面、分类、标签、浏览/阅读计数和更新时间。
- 没有封面的页面使用稳定的默认视觉占位，不能依赖 HTML 截图实时生成。

营销首页：

- 现有营销首页迁移到 `/landing`。
- 导航中从社区首页跳转到营销页时应使用明确入口，避免用户误认为 `/` 仍是产品介绍页。

作者主页 `/{user_slug}`：

- 展示作者公开资料、公开页面摘要、作者总浏览/阅读等聚合统计。
- 默认不展示 `unlisted`、`private`、`pending`、`rejected` 页面。

作者页面列表 `/page/{user_slug}`：

- 保持已有 published page 列表兼容。
- 可逐步增加分类、封面、标签、统计展示，但不改变 URL 语义。

阅读壳 `/read/{user_slug}/{page_id}`：

- 展示社区上下文：标题、作者、描述、封面、分类、标签、发布时间、统计和分享入口。
- 加载页面 HTML 时必须保持隔离，不能让用户 HTML 访问主站 cookie、localStorage 或 DOM。

HTML 直出 `/page/{user_slug}/{page_id}`：

- 保持直接返回或展示用户 HTML 的语义。
- 不强制展示社区 chrome。
- 可记录基础 view 事件，但不能破坏旧嵌入场景。

## 排序/统计策略

基础排序：

- 最新发布：按 `last_published_at` 倒序，缺失时回退 `published_at`、`updated_at`。
- 最近创建：按 `published_at` 倒序。
- 最多浏览：按 `view_count` 倒序，再按 `last_published_at` 倒序。
- 最多阅读：按 `read_count` 倒序，再按 `last_published_at` 倒序。

趋势排序：

- 第一阶段可使用近 7 日 `entity_stats_daily.view_count` 与 `read_count` 的加权和。
- 趋势分不需要入库为字段；可以在查询或定时聚合中计算。
- 趋势只考虑 `public + approved` 页面。

计数更新：

- `published_pages` 上的计数字段是累计缓存，用于列表快速展示和排序。
- `entity_stats_daily` 是日聚合明细，用于趋势和图表。
- 单次事件写入时可以同步更新累计缓存，也可以先写事件/日聚合再异步刷新缓存；实现需保证最终一致。
- 统计失败不应阻断 HTML 直出或阅读页渲染。

## 迁移与兼容

正式 migration 是数据库结构演进的唯一权威来源：

- 新字段、新表、索引、默认值、回填逻辑都必须写入正式 migration。
- 运行时 `ensurePublishedPagesTable` 只允许补洞，用于开发环境或历史环境缺字段时的安全兜底。
- `ensurePublishedPagesTable` 不应承载完整 schema 定义，也不应与正式 migration 产生不同字段类型、默认值或约束。

迁移策略：

- 给 `published_pages` 添加新字段时使用兼容默认值，避免旧数据不可读。
- 旧页面 `visibility` 回填为 `public`。
- 旧页面 `moderation_status` 回填为 `approved`。
- 旧页面 `published_at` 回填为 `created_at`。
- 旧页面 `last_published_at` 回填为 `updated_at`。
- 旧页面计数字段回填为 `0`。
- 旧页面 `tags` 回填为空数组。
- 旧页面 `category_id`、`cover_asset_id` 保持空。
- `published_page_versions` 的历史版本同样回填兼容值；无法确定的分类、封面和标签保持空。
- 新建 `page_categories` 时可以预置少量系统分类，但分类内容本身不应阻断迁移。

兼容旧 API：

- Desktop 或旧客户端不传分类、封面、标签、可见性时，发布行为与当前一致。
- 旧 HTML 直出链接继续可访问。
- `/page/{user_slug}` 继续作为作者页面列表存在，不被 `/read` 替代。

## 测试验收

数据库与迁移：

- 新库执行 migration 后包含 `published_pages` 新字段、`published_page_versions` 新字段、`page_categories`、`media_assets`、`entity_stats_daily`。
- 旧库执行 migration 后旧发布页可正常查询，默认值符合兼容策略。
- `ensurePublishedPagesTable` 在缺少个别字段时能补洞，但不会覆盖正式 migration 的约束设计。

发布 API：

- 旧请求体发布成功，并自动写入默认 `visibility`、`moderation_status`、`tags`、`published_at`、`last_published_at`。
- 新请求体可写入分类、封面、标签和可见性。
- 非 owner 不能更新他人页面。
- 引用他人私有 `media_assets` 作为封面时失败。

公开访问：

- `/` 和 `/web` 展示同一社区首页内容。
- `/landing` 展示迁移后的营销首页。
- `/{user_slug}` 展示公开作者主页。
- `/page/{user_slug}` 继续展示作者 published page 列表。
- `/page/{user_slug}/{page_id}` 继续 HTML 直出。
- `/read/{user_slug}/{page_id}` 展示社区阅读壳。

权限过滤：

- `private` 页面不出现在公开目录，未授权访问不可见。
- `unlisted` 页面不出现在公开目录，但直接链接可访问。
- `pending`、`rejected`、`hidden` 页面不出现在公开目录。

统计：

- 访问阅读壳或 HTML 直出后，累计计数最终更新。
- `entity_stats_daily` 按实体和日期聚合，唯一键防止重复行。
- 排序接口能按最新、浏览、阅读和趋势返回稳定分页结果。

UI：

- 页面卡片在无分类、无封面、无标签、计数为 0 时仍能正常展示。
- 封面 URL 失效时有稳定 fallback。
- 列表分页和排序切换不会展示不可见或未通过审核的页面。

## 依赖后续 spec

本 spec 需要后续 spec 继续细化以下内容：

- 社区首页与阅读壳的具体 UI 信息架构、组件拆分和视觉设计。
- 封面上传、媒体转存、安全扫描、图片裁剪和默认封面生成策略。
- 统计事件采集、去重口径、反作弊和异步聚合实现。
- 审核后台、举报流程、内容隐藏和恢复机制。
- 搜索、推荐、趋势算法和分类运营规则。
