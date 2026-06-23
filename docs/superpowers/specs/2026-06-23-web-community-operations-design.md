# Web 社区首页运营位与后台配置设计

## 背景

Web 社区首页需要从现有营销页迁移为社区发现入口。新的 `/` 不再承载产品营销内容，而是展示运营、头条、可订阅的页面更新、海报、分类推荐和社区内容入口。现有营销首页迁移到 `/landing`。

本设计定义首页运营位和后台配置能力，确保首页内容可运营、可审核、可回滚、可按 locale 配置，并且在没有人工运营配置或配置失效时仍有稳定兜底。首页不得硬编码运营内容，所有人工运营内容必须来自后台配置或服务端兜底策略。

全局路由语义：

- `/` 是社区发现首页。
- `/web` 是桌面 view url，用户体验与 `/` 的社区首页一致。
- `/landing` 是现有营销首页。
- `/{user_slug}` 是公开作者主页。
- `/page/{user_slug}` 是作者 published page 列表。
- `/page/{user_slug}/{page_id}` 保持 HTML 直出。
- `/read/{user_slug}/{page_id}` 是社区阅读壳。

## 目标

- 支持社区首页按 surface 和 locale 获取运营配置，首期 surface 为 `web_home`。
- 支持头条、海报、已发布页面、Moment、MCP、Skill、合集、分类和外链等运营项。
- 定义 `operation_slots`、`operation_items`、`operation_revisions` 三类核心数据模型。
- 提供 `GET /api/home/config?surface=web_home&locale=zh-CN` 给前台读取首页配置。
- 提供 `/api/admin/operations/*` 后台管理接口，用于配置、预览、发布、回滚运营内容。
- 支持完整产品闭环：运营配置、权限控制、审核审计、发布修订、前台读取、兜底展示。
- 所有引用实体在前台读取时必须校验公开状态，避免运营位暴露私密或下架内容。
- `/` 和 `/web` 共享同一份首页读取策略；不同容器只允许有展示适配，不允许出现业务内容分叉。

## 非目标

- 不实现复杂推荐算法或个性化首页；本期只定义人工运营、规则兜底和基础排序。
- 不定义 MCP、Skill、Moment、合集、分类等业务实体自身的完整模型，只定义运营位对这些实体的引用和校验要求。
- 不实现图片二进制上传服务；海报图片只引用已有媒体资源或受信任 URL。
- 不实现 A/B 实验系统；后续可在 `metadata` 中扩展实验参数。
- 不改变 `/page/{user_slug}/{page_id}` 的 HTML 直出语义。
- 不改变作者主页、阅读壳、订阅通知、互动、动态流等 spec 的核心数据模型。
- 不要求首期后台具备可视化拖拽排版；列表式配置和预览即可满足 MVP。

## 用户体验

### 社区首页 `/`

首页首屏应体现社区发现，而不是产品营销。建议信息结构：

- 顶部导航：社区入口、分类、Moment、订阅、登录/用户菜单。
- 头条区：展示 1 到 3 条重点内容，可以是公开页面、合集、Moment、MCP、Skill 或外链。
- 海报区：展示当前活动、专题、创作者计划或精选作品，支持图片、标题、说明和跳转。
- 页面更新区：展示可订阅的页面更新，内容来自 `page_update_events` 或发布页更新流。
- 分类推荐区：展示精选分类，进入分类后读取公开页面列表。
- 推荐内容区：展示精选 published page、Moment、合集、MCP 或 Skill。

未登录用户：

- 可以浏览所有公开运营内容。
- 点击订阅、关注、收藏等需要身份的动作时进入登录流程。
- 不应看到内部运营状态、审核状态或后台入口。

已登录普通用户：

- 看到与未登录用户一致的公开运营内容。
- 可以对页面、作者或更新流执行订阅相关操作，具体能力依赖订阅通知 spec。
- 如果自己具备后台权限，可看到管理入口；普通用户不显示。

### 桌面 View `/web`

`/web` 是桌面 view url，展示同一社区首页体验：

- 默认读取 `surface=web_home` 的同一配置。
- 可以根据 Desktop 容器调整密度、窗口尺寸和跳转方式。
- 不允许为 `/web` 单独硬编码另一套运营内容。
- 如果 Desktop 需要不同 surface，必须新增明确 surface，例如 `desktop_home`，并在产品上单独确认；本期默认不新增。

### 营销页 `/landing`

现有 `/` 营销页迁移到 `/landing`：

- 原营销页的 SEO、外部链接、分享卡片和导航入口需要同步迁移。
- `/landing` 不参与社区首页运营位配置。
- 如果旧外部链接仍访问 `/`，应看到新的社区首页；不通过运营配置回放旧营销页。

### 后台管理入口

有权限的运营、管理员或审核人员可以进入后台运营管理：

- 查看不同 surface、locale 下的 slot 列表。
- 创建和编辑 slot。
- 添加、排序、启用、停用 operation item。
- 选择引用实体并看到实体当前公开状态。
- 上传或选择海报资源，填写标题、说明、CTA 和跳转。
- 预览某个 revision 在前台的渲染结果。
- 发布 revision，使其成为前台读取的 active 配置。
- 回滚到历史 revision。
- 查看操作审计和发布历史。

后台预览必须清楚标记不可公开展示的 item，例如目标页面已私密、审核未通过、外链不合法、locale 文案缺失。发布时可以选择阻止发布或自动跳过不可用 item，默认应阻止发布并要求运营修正。

## 数据模型

### `operation_slots`

`operation_slots` 定义首页上的运营区域，是前台读取和后台配置的稳定槽位。

建议字段：

- `id`：主键。
- `uid`：稳定公开标识，便于 API 响应和前端匹配。
- `surface`：展示面，首期为 `web_home`。
- `slot_key`：槽位标识，如 `hero_headline`、`poster_strip`、`page_updates`、`featured_categories`、`recommended_collections`。
- `name`：后台展示名。
- `description`：后台说明，可空。
- `layout_type`：布局类型，如 `headline`、`carousel`、`grid`、`list`、`rail`、`banner`。
- `locale`：配置 locale，如 `zh-CN`、`en-US`；可使用 `default` 表示跨 locale 默认配置。
- `min_items`：最少展示数量。
- `max_items`：最多展示数量。
- `sort_order`：首页内 slot 排序。
- `is_active`：是否启用。
- `fallback_strategy`：兜底策略，如 `latest_public_pages`、`trending_pages`、`featured_categories`、`latest_page_updates`、`none`。
- `metadata`：扩展 JSON，用于布局参数、展示密度、端侧兼容信息。
- `created_by`、`updated_by`：操作人。
- `created_at`、`updated_at`。

约束：

- `surface + locale + slot_key` 唯一。
- `surface`、`locale`、`slot_key` 使用 snake_case 或 BCP 47 locale 格式，不使用 camelCase。
- 停用 slot 后前台不展示该区域，但如果这是首页关键区域，读取层可以按兜底策略补足。
- `layout_type` 只描述展示意图，不在数据库中保存前端组件实现细节。

### `operation_items`

`operation_items` 定义某个 slot 下的具体运营内容。item 可以引用站内实体，也可以是纯运营海报或外链。

建议字段：

- `id`：主键。
- `uid`：稳定公开标识。
- `slot_id`：关联 `operation_slots.id`。
- `item_type`：运营项类型。
- `target_entity_type`：引用实体类型，可空。
- `target_entity_id`：引用实体内部 id，可空。
- `target_entity_uid`：引用实体公开 uid 或 slug 快照，可空。
- `target_url`：外链或内部跳转 URL，可空。
- `title`：运营标题。
- `subtitle`：副标题，可空。
- `description`：说明，可空。
- `image_asset_id`：图片资源 id，可空。
- `image_url`：受信任图片 URL，可空。
- `cta_label`：按钮文案，可空。
- `badge_label`：角标文案，可空。
- `locale`：item 文案 locale，默认继承 slot locale。
- `starts_at`：开始展示时间，可空。
- `ends_at`：结束展示时间，可空。
- `sort_order`：slot 内排序。
- `is_active`：是否启用。
- `visibility`：后台可见性，建议 `draft`、`scheduled`、`published`、`archived`。
- `metadata`：扩展 JSON，用于海报比例、颜色、追踪参数等。
- `created_by`、`updated_by`。
- `created_at`、`updated_at`。

`item_type` 必须包含：

- `headline`：头条内容。
- `poster`：海报或活动 banner。
- `published_page`：已发布页面。
- `moment`：社区动态。
- `mcp`：MCP 能力或服务。
- `skill`：Skill 条目。
- `collection`：合集。
- `category`：分类入口。
- `external_link`：外部链接。

约束：

- `published_page`、`moment`、`mcp`、`skill`、`collection`、`category` 类型必须提供可校验的引用实体。
- `external_link` 必须提供 `target_url`，且服务端需要校验协议和允许域名策略。
- `poster` 可以只提供图片、标题和 `target_url`，但如果跳转到站内实体，仍应填写引用实体，便于权限校验和失效检测。
- `starts_at` 晚于当前时间的 item 不进入前台有效配置。
- `ends_at` 早于当前时间的 item 不进入前台有效配置。
- 同一 slot 内有效 item 数量超过 `max_items` 时按 `sort_order`、发布时间和 id 稳定截断。

### `operation_revisions`

`operation_revisions` 保存运营配置发布快照，用于预览、发布、回滚和审计。

建议字段：

- `id`：主键。
- `uid`：修订公开标识。
- `surface`：展示面。
- `locale`：locale。
- `revision_number`：递增版本号。
- `status`：修订状态，建议 `draft`、`published`、`rolled_back`、`archived`。
- `snapshot`：发布快照 JSON，包含 slots、items、排序、文案、图片引用和元信息。
- `validation_report`：发布前校验报告 JSON。
- `published_at`：发布时间，可空。
- `published_by`：发布人，可空。
- `created_by`：创建人。
- `created_at`、`updated_at`。

约束：

- `surface + locale + revision_number` 唯一。
- 同一 `surface + locale` 同一时刻只能有一个 `status = published` 的 active revision。
- 前台读取默认读取 active revision；如果不存在 active revision，进入兜底策略。
- 回滚不修改历史 revision 内容，应创建新的 revision 或将历史 revision 复制为新 active revision，并记录来源。
- `snapshot` 是前台稳定读取的权威快照，避免读取过程中后台正在编辑导致页面抖动。

### 引用实体公开状态

运营位引用实体时，前台读取必须二次校验目标实体当前状态，不得只相信快照：

- `published_page`：必须 `visibility = public` 且 `moderation_status = approved`，作者账号也必须可公开展示。
- `moment`：必须公开、未删除、未隐藏，且其附件不能泄露私有实体。
- `mcp`：必须处于公开发布状态，未下架，未被审核隐藏。
- `skill`：必须处于公开发布状态，未下架，未被审核隐藏。
- `collection`：必须公开、未删除、未隐藏，集合内不可见条目需要过滤或降级。
- `category`：必须 `is_active = true`，且分类本身可展示。
- `external_link`：必须通过 URL 安全校验，不允许 `javascript:`、`data:` 等危险协议。

如果引用实体在运营配置发布后变为私密、下架、删除或审核不通过，前台读取应跳过该 item，并按 slot 的兜底策略补足。

## API

所有 query 参数、请求体字段和响应字段使用 snake_case。

### 首页配置读取

`GET /api/home/config?surface=web_home&locale=zh-CN`

用途：

- 给 `/` 和 `/web` 读取首页运营配置。
- 返回已发布 revision 中当前有效、可公开展示的 slots 和 items。
- 在配置缺失或 item 不可用时返回服务端兜底内容。

Query 参数：

- `surface`：必填，首期支持 `web_home`。
- `locale`：必填或由请求上下文推断，示例 `zh-CN`。
- `preview_revision_id`：可选，仅后台权限可用，用于预览草稿 revision。

响应应包含：

- `surface`。
- `locale`。
- `resolved_locale`：实际命中的 locale，如 `zh-CN`、`en-US`、`default`。
- `revision_id`：命中的 active revision，可空。
- `revision_number`：命中的版本号，可空。
- `generated_at`：服务端生成时间。
- `slots`：slot 列表，每个 slot 包含 `slot_key`、`layout_type`、`items`、`metadata`。
- `fallback_used`：是否使用过兜底。
- `warnings`：可选，只在预览或后台上下文返回；公开请求不返回内部错误细节。

读取规则：

- 优先读取 `surface + locale` 的 active revision。
- 如果没有 locale 精确匹配，读取 `surface + default`。
- 如果 active revision 不存在或有效 item 不足，按 slot 的 `fallback_strategy` 补足。
- 所有 item 返回前必须校验当前公开状态。
- 响应中不得包含内部审核原因、后台备注、操作人 id、未公开实体 id 等敏感字段。
- 可以返回 `cache_ttl_seconds`，但涉及预览时必须禁用公共缓存。

### 后台运营管理 API

后台接口统一放在 `/api/admin/operations/*` 下。具体路由可以按资源拆分，但必须保持权限和审计一致。

建议能力：

- `GET /api/admin/operations/surfaces`：列出可配置 surface。
- `GET /api/admin/operations/slots?surface=web_home&locale=zh-CN`：读取后台 slot 和 item 草稿状态。
- `POST /api/admin/operations/slots`：创建 slot。
- `PATCH /api/admin/operations/slots/{slot_id}`：更新 slot。
- `POST /api/admin/operations/items`：创建 item。
- `PATCH /api/admin/operations/items/{item_id}`：更新 item。
- `DELETE /api/admin/operations/items/{item_id}`：归档或删除 item；建议软删除或归档。
- `POST /api/admin/operations/validate`：校验当前配置，返回不可发布原因和警告。
- `POST /api/admin/operations/preview`：生成预览配置。
- `POST /api/admin/operations/revisions`：从当前草稿创建 revision。
- `POST /api/admin/operations/revisions/{revision_id}/publish`：发布 revision。
- `POST /api/admin/operations/revisions/{revision_id}/rollback`：回滚到指定 revision。
- `GET /api/admin/operations/revisions?surface=web_home&locale=zh-CN`：查看 revision 历史。
- `GET /api/admin/operations/audit_logs?surface=web_home&locale=zh-CN`：查看审计记录。

后台接口约束：

- 创建和更新 item 时，服务端必须校验 `item_type` 与引用字段是否匹配。
- 发布 revision 前必须运行公开状态校验、时间窗校验、locale 文案校验、图片 URL 校验和外链安全校验。
- 预览可以展示不可发布 item，但必须明确返回错误或警告。
- 发布接口必须幂等处理重复提交；同一个 revision 重复发布不应产生多个 active revision。
- 删除 item 默认不影响已发布 revision 的历史快照，但新发布 revision 不再包含该 item。

## 后台权限

运营管理需要明确权限边界。首期可二选一：

- 新增细粒度权限 `operations.manage`。
- 或复用现有 `admin`、`moderator` 权限。

建议策略：

- `admin`：拥有全部运营配置、发布、回滚、审计查看能力。
- `moderator`：可查看、校验、预览、隐藏违规 item；是否允许发布由产品决定。
- `operations.manage`：可管理运营 slot、item、revision，并发布到前台。
- 普通用户：无后台接口访问权限。

权限要求：

- 所有 `/api/admin/operations/*` 接口必须登录。
- 修改、发布、回滚必须校验 `operations.manage` 或等价的 `admin` 权限。
- 只读审计接口也不对普通用户开放。
- 预览草稿配置的 `GET /api/home/config` 必须校验后台权限；未授权请求不能通过 `preview_revision_id` 读取草稿内容。

## 首页读取策略

首页读取分为三层：

1. 读取 active revision 快照。
2. 对快照中的 item 做实时有效性和公开状态校验。
3. 对缺失或无效 slot 应用兜底策略。

有效 item 判断：

- `is_active = true`。
- 当前时间位于 `starts_at` 和 `ends_at` 范围内。
- item 所属 slot 启用。
- locale 可命中或可降级。
- 引用实体当前可公开展示。
- 外链和图片资源通过安全校验。

排序规则：

- slot 按 `operation_slots.sort_order` 或 revision snapshot 中的 slot 顺序展示。
- item 按 `sort_order` 升序展示。
- 相同 `sort_order` 使用 `starts_at`、`created_at`、`uid` 稳定排序。
- 超过 `max_items` 的部分不返回前台。

缓存策略：

- 公开首页配置可以短 TTL 缓存。
- 发布或回滚 revision 后必须主动失效 `surface + locale` 缓存。
- 如果引用实体状态变更为不可公开，缓存最长只能在可接受 TTL 后失效；涉及审核隐藏时应主动失效相关首页缓存。
- 后台预览不进入公共缓存。

## 运营位类型

### 头条 `headline`

用于首页最高优先级内容：

- 可以引用 published page、Moment、合集、MCP、Skill 或外链。
- 必须有标题。
- 建议有说明和封面。
- 点击站内实体时进入对应公开页面，如 `/read/{user_slug}/{page_id}`、Moment 详情或合集页。

### 海报 `poster`

用于活动、专题和视觉运营：

- 必须有图片或可渲染的媒体资源。
- 可以配置 CTA。
- 可以跳转站内实体或外部链接。
- 外链必须经过安全校验和跳转提示策略。

### 已发布页面 `published_page`

用于推荐公开页面：

- 必须引用已发布页面实体。
- 前台读取时校验 `visibility = public`、`moderation_status = approved`。
- 默认跳转 `/read/{user_slug}/{page_id}`，不直接跳转 HTML 直出。

### Moment `moment`

用于推荐社区动态：

- 必须引用公开、未删除、未隐藏的 Moment。
- 如果 Moment 附件引用不可见内容，前台应隐藏附件或跳过整个 item，具体由 Moment 可见性规则决定。

### MCP `mcp`

用于推荐公开 MCP 能力或服务：

- 必须引用已公开、可安装或可查看的 MCP 条目。
- 下架、私有、审核隐藏的 MCP 不进入前台。

### Skill `skill`

用于推荐公开 Skill：

- 必须引用公开 Skill 条目。
- 文案应使用 skill 的公开标题和摘要，运营可覆盖标题但不得伪造不可用状态。

### 合集 `collection`

用于推荐一组页面、Skill、MCP 或专题内容：

- 合集本身必须公开。
- 合集内不可公开条目在前台需要过滤。
- 如果过滤后合集为空，应跳过该 item。

### 分类 `category`

用于首页分类推荐：

- 必须引用 active 分类。
- 点击进入分类目录或带分类参数的社区列表。
- 分类下如果没有公开内容，后台发布时应提示；前台可展示但不应承诺不存在的数量。

### 外链 `external_link`

用于跳转到站外活动、文档或合作页面：

- 必须配置 `target_url`。
- 只允许 `https`，本地开发环境可允许明确的 localhost 白名单。
- 不允许 `javascript:`、`data:`、`file:` 等协议。
- 可配置 `rel="noopener noreferrer"` 和外链提示。

## 审核 / 审计

运营配置影响公共首页，必须具备可追溯性。

审核要求：

- 发布 revision 前必须校验所有引用实体当前公开状态。
- 如果引用实体处于 `pending`、`rejected`、`hidden`、`private`、`unlisted` 或已删除状态，不得作为公开首页 item 发布。
- 如果 item 已在 active revision 中，但目标实体后续被隐藏，首页读取必须实时跳过。
- 后台应提供失效 item 列表，方便运营修复。

审计要求：

- 记录 slot 创建、更新、停用。
- 记录 item 创建、更新、排序、启用、停用、归档。
- 记录 revision 创建、发布、回滚。
- 记录操作人、操作时间、操作对象、变更摘要和请求来源。
- 重要操作保留前后 diff 或快照引用。

审计日志可独立建表，也可复用现有后台审计能力，但 `/api/admin/operations/audit_logs` 需要能按 surface、locale、操作人和时间范围查询。

## 国际化 / 多 locale

首页运营内容需要支持多 locale：

- `operation_slots.locale` 和 `operation_items.locale` 使用 `zh-CN`、`en-US` 等 locale。
- `default` locale 作为兜底配置。
- `GET /api/home/config?surface=web_home&locale=zh-CN` 优先返回 `zh-CN`。
- 如果 `zh-CN` 没有 active revision，降级到 `default`。
- 如果 slot 存在但 item 文案缺失，可以按 item 级别降级到 `default`，但响应中应标记 `resolved_locale`。

文案规则：

- 运营自定义文案按 locale 存储。
- 引用实体标题、说明可以使用实体自身 locale 能力；如果实体没有对应 locale，则使用实体默认标题。
- 后台发布前应提示 locale 不完整，但是否阻止发布由 slot 重要性决定。
- 外链的语言版本需要由运营显式配置，不由前端自动猜测。

中文翻译约定：

- `agent` 翻译为“智能体”。
- `token` 翻译为“词元”。

## 兜底策略

首页不能因为没有运营配置而空白。兜底策略按 slot 执行。

推荐兜底：

- 头条区：读取最近发布且统计表现较好的公开 published page。
- 页面更新区：读取最新 `page_update_events`，并过滤当前不可见页面。
- 分类推荐区：读取 active 分类，按 `sort_order` 和公开内容数量排序。
- 推荐内容区：读取最近公开 published page、公开合集或公开 Moment。
- 海报区：如果没有可用海报，可以隐藏该 slot，不使用硬编码营销图。

兜底约束：

- 兜底内容也必须通过公开状态校验。
- 兜底内容不得引用私密、unlisted、审核未通过或作者账号不可公开的实体。
- 兜底结果不足 `min_items` 时可以少量展示，不应制造假数据。
- 如果关键 slot 无内容，前台展示更紧凑的布局，而不是空白卡片。
- 服务端响应应包含 `fallback_used = true`，方便监控和后台排查。

失效处理：

- active revision 不存在：使用全站兜底。
- active revision 存在但所有 item 失效：使用 slot 兜底。
- locale 缺失：降级到 `default`，再应用兜底。
- 数据源异常：返回可缓存的最小首页结构，避免前端崩溃。

## 迁移风险

### `/` 从营销页迁移到社区首页

风险：

- 外部链接、SEO 和用户预期可能仍指向旧营销页。
- 旧导航可能存在写死 `/` 作为营销首页。
- 搜索引擎短期内会把 `/` 的旧内容和新内容混合理解。

缓解：

- 将现有营销页迁移到 `/landing`。
- 更新导航、页脚、分享链接和站内营销入口。
- 为 `/landing` 配置独立标题、描述和 canonical。
- 确认 `/` 的新标题、描述和 Open Graph 信息符合社区首页定位。

### 运营配置不完整

风险：

- 首次上线时还没有 active revision。
- 某 locale 缺少配置。
- 运营 item 引用实体被删除或下架。

缓解：

- 必须实现服务端兜底策略。
- 后台提供发布前校验。
- 首页读取时实时过滤不可见实体。
- 提供后台失效 item 报告。

### 多 worker 并行开发

风险：

- 社区首页、订阅、Moment、目录、互动等 spec 同时演进，字段命名和路由可能冲突。

缓解：

- 所有 Gateway API query 参数使用 snake_case。
- 遵守已确认路由语义。
- 运营位引用其他实体只使用公开读取契约，不修改其他 spec 的数据所有权。
- 对未知实体状态采用保守策略：无法证明公开则不展示。

## 测试验收

### 前台读取

- `GET /api/home/config?surface=web_home&locale=zh-CN` 返回 `surface`、`locale`、`resolved_locale`、`slots` 和 `generated_at`。
- 没有 active revision 时，接口仍返回可渲染的兜底首页配置。
- `/` 和 `/web` 读取同一 surface 后展示内容一致。
- `locale=zh-CN` 缺失时可以降级到 `default`。
- 响应字段和 query 参数全部使用 snake_case。

### 公开状态校验

- 运营 item 引用 `private` published page 时，公开首页不返回该 item。
- 运营 item 引用 `unlisted` published page 时，公开首页不返回该 item。
- 运营 item 引用 `moderation_status != approved` 的页面时，公开首页不返回该 item。
- 运营 item 引用已删除或隐藏 Moment、MCP、Skill、合集时，公开首页不返回该 item。
- 外链使用危险协议时，发布校验失败，公开首页不返回。

### 后台配置

- 有 `operations.manage` 或等价 admin 权限的用户可以创建 slot、item 和 revision。
- 无权限用户访问 `/api/admin/operations/*` 返回 403。
- 发布 revision 后，前台读取命中新 revision。
- 回滚 revision 后，前台读取命中回滚后的 active revision。
- 预览草稿 revision 需要后台权限，普通用户无法通过 `preview_revision_id` 读取草稿。
- 发布前校验能报告缺失图片、不可见引用实体、locale 文案缺失和非法外链。

### 审计

- 创建、更新、发布、回滚都有审计记录。
- 审计记录能按 surface、locale 和时间范围查询。
- 历史 revision 的 snapshot 不因后续 item 编辑而改变。

### 迁移

- 访问 `/` 看到社区发现首页。
- 访问 `/web` 看到同一社区首页体验。
- 访问 `/landing` 看到现有营销首页。
- 访问 `/page/{user_slug}/{page_id}` 仍保持 HTML 直出。
- 访问 `/read/{user_slug}/{page_id}` 仍进入社区阅读壳。

## 依赖

- 发布页目录化与统计能力：用于读取公开 published page、分类和统计排序。
- 关注、订阅与通知能力：用于页面更新区和可订阅更新入口。
- Moment 动态流能力：用于运营 Moment item 和动态兜底。
- 互动能力：用于展示点赞、评论、收藏、分享等计数时的读取契约。
- 合集、MCP、Skill 的公开目录能力：用于运营引用和公开状态校验。
- 媒体资源能力：用于海报和封面图片的元信息引用。
- 后台权限系统：提供 `operations.manage` 或复用 `admin`、`moderator`。
- 审计日志能力：记录运营配置变更、发布和回滚。
- 路由迁移：将现有营销首页迁移到 `/landing`，并确保 `/` 与 `/web` 指向社区首页体验。
