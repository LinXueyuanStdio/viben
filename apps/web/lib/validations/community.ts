import { z } from 'zod';

// ============================================
// 查询参数
// ============================================

/** 评论列表查询参数 */
export const CommunityCommentsQuery = z.object({
  entity_type: z.enum(['published_page', 'moment', 'comment']).describe('实体类型'),
  entity_id: z.string().describe('实体 ID'),
  parent_comment_id: z.string().optional().describe('父评论 ID'),
  limit: z.coerce.number().min(1).max(100).default(20).describe('每页数量'),
  cursor: z.string().optional().describe('分页游标'),
});

/** 收藏列表查询参数 */
export const CommunityBookmarksQuery = z.object({
  entity_type: z.enum(['published_page', 'moment']).optional().describe('实体类型过滤'),
  limit: z.coerce.number().min(1).max(100).default(30).describe('每页数量'),
  cursor: z.string().optional().describe('分页游标'),
});

/** 浏览历史查询参数 */
export const CommunityHistoryQuery = z.object({
  limit: z.coerce.number().min(1).max(100).default(30).describe('每页数量'),
  cursor: z.string().optional().describe('分页游标'),
});

/** 通知列表查询参数 */
export const NotificationsQuery = z.object({
  limit: z.coerce.number().min(1).max(100).default(30).describe('每页数量'),
  unread_only: z.coerce.boolean().optional().describe('仅未读'),
  cursor: z.string().optional().describe('分页游标'),
});

/** 用户收藏查询参数 */
export const FavoritesQuery = z.object({
  limit: z.coerce.number().min(1).max(50).default(20).describe('每页数量'),
  cursor: z.string().optional().describe('分页游标'),
});

// ============================================
// 请求体 schemas
// ============================================

/** 切换书签/收藏请求体 */
export const ToggleBookmarkBody = z.object({
  entity_type: z.enum(['published_page', 'moment']).describe('实体类型'),
  entity_id: z.string().min(1).describe('实体 ID'),
});

/** 切换反应请求体 */
export const ToggleReactionBody = z.object({
  entity_type: z.enum(['published_page', 'moment', 'comment']).describe('实体类型'),
  entity_id: z.string().min(1).describe('实体 ID'),
  reaction_type: z.string().optional().describe('反应类型（默认 like）'),
});

/** 创建评论请求体 */
export const CreateCommentBody = z.object({
  entity_type: z.enum(['published_page', 'moment']).describe('实体类型'),
  entity_id: z.string().min(1).describe('实体 ID'),
  content: z.string().min(1).describe('评论内容'),
  parent_comment_id: z.string().optional().describe('父评论 ID'),
});

/** 更新评论请求体 */
export const UpdateCommentBody = z.object({
  content: z.string().min(1).optional().describe('新的评论内容'),
  reaction: z.boolean().optional().describe('是否切换反应'),
});

/** 创建分享链接请求体 */
export const CreateShareBody = z.object({
  entity_type: z.literal('published_page').describe('实体类型'),
  user_slug: z.string().min(1).describe('发布者的用户 URL slug'),
  page_id: z.string().min(1).describe('页面 ID'),
  channel: z.string().optional().describe('分享渠道'),
});

/** 批量标记通知已读请求体 */
export const NotificationsReadBody = z.object({
  notification_ids: z.array(z.string()).optional().describe('通知 ID 列表'),
  before_cursor: z.string().optional().describe('标记该游标之前的所有通知已读'),
});

/** 页面订阅请求体 */
export const PageSubscribeBody = z.object({
  notify_level: z.enum(['all', 'major', 'none']).default('all').describe('通知级别'),
});

/** 页面订阅更新请求体 */
export const PageSubscriptionUpdateBody = z.object({
  notify_level: z.enum(['all', 'major', 'none']).optional().describe('通知级别'),
  last_seen_version: z.number().int().min(0).optional().describe('上次已读版本号'),
});

/** 反馈提交请求体 */
export const FeedbackBody = z.object({
  page_id: z.string().min(1).describe('页面 ID'),
  category: z.enum(['bug', 'suggestion', 'other']).describe('反馈分类'),
  rating: z.number().int().min(1).max(5).describe('评分（1-5）'),
  content: z.string().min(1).max(1000).describe('反馈内容'),
});

/** 语音 token 请求体 */
export const VoiceTokenBody = z.object({
  api_key: z.string().min(1).describe('Vocal Bridge API 密钥'),
  agent_id: z.string().uuid().describe('智能体 UUID'),
  participant_name: z.string().default('User').describe('参与者名称'),
});

/** 举报提交请求体 */
export const ReportBody = z.object({
  entity_type: z.string().min(1).describe('被举报实体类型'),
  entity_id: z.string().min(1).describe('被举报实体 ID'),
  reason: z.enum(['spam', 'inappropriate', 'copyright', 'security', 'other']).describe('举报原因'),
  description: z.string().max(500).optional().describe('详细描述'),
});

/** 桌面端 GitHub OAuth 回调请求体 */
export const GithubDesktopCallbackBody = z.object({
  code: z.string().min(1).describe('GitHub OAuth 授权码'),
});

/** 桌面端 GitHub OAuth 回调响应 */
export const GithubDesktopCallbackResponse = z.object({
  user: z.object({
    id: z.string().describe('用户 ID'),
    email: z.string().describe('邮箱'),
    username: z.string().describe('用户名'),
    userSlug: z.string().describe('用户 URL slug'),
    displayName: z.string().nullable().describe('显示名称'),
    avatarUrl: z.string().nullable().describe('头像地址'),
  }).describe('用户信息'),
  accessToken: z.string().describe('加密的 session token'),
  refreshToken: z.string().nullable().describe('刷新 token（暂未实现）'),
  expiresAt: z.number().describe('过期时间戳（ms）'),
});

/** 实体摘要查询参数 */
export const EntitySummaryQuery = z.object({
  entity_type: z.enum(['published_page', 'moment', 'comment']).describe('实体类型'),
  entity_id: z.string().min(1).describe('实体 ID'),
});

/** 热门搜索词查询参数 */
export const HotSearchQuery = z.object({
  limit: z.coerce.number().min(1).max(20).default(8).describe('返回条数'),
});

/** 最近搜索词查询参数 */
export const RecentSearchQuery = z.object({
  limit: z.coerce.number().min(1).max(20).default(5).describe('返回条数'),
});

/** 首页配置查询参数 */
export const HomeConfigQuery = z.object({
  surface: z.string().default('web_home').describe('页面标识'),
  locale: z.string().default('default').describe('语言区域'),
});

/** 榜单列表查询参数 */
export const RankingQuery = z.object({
  ranking_key: z.string().min(1).describe('榜单标识'),
  time_window: z.string().default('7d').describe('时间窗口'),
  limit: z.coerce.number().min(1).max(100).default(30).describe('返回条数'),
});

/** 单个榜单详情查询参数 */
export const RankingDetailQuery = z.object({
  limit: z.coerce.number().min(1).max(100).default(30).describe('返回条数'),
  time_window: z.string().default('7d').describe('时间窗口'),
});

/** 首页榜单查询参数 */
export const HomeRankingQuery = z.object({
  limit: z.coerce.number().min(1).max(60).default(30).describe('每页条数'),
  cursor: z.string().optional().describe('分页游标'),
  seed: z.string().optional().describe('随机种子'),
  locale: z.string().default('default').describe('语言区域'),
});

/** 分区榜单查询参数 */
export const SectionRankingQuery = z.object({
  limit: z.coerce.number().min(1).max(60).default(30).describe('每页条数'),
  cursor: z.string().optional().describe('分页游标'),
  seed: z.string().optional().describe('随机种子'),
  category_id: z.string().optional().describe('分类 ID'),
  time_window: z.string().default('7d').describe('时间窗口'),
});

/** 订阅动态查询参数 */
export const SubscriptionFeedQuery = z.object({
  limit: z.coerce.number().min(1).max(100).default(30).describe('每页数量'),
  cursor: z.string().optional().describe('分页游标'),
  include_seen: z.coerce.boolean().default(true).describe('是否包含已读'),
  source: z.enum(['followed_authors', 'subscribed_pages', 'all']).default('all').describe('来源过滤'),
});

/** 页面合集查询参数 */
export const PageCollectionsQuery = z.object({
  mine: z.coerce.boolean().optional().describe('仅查看当前用户的合集'),
});

// ============================================
// 路径参数
// ============================================

/** 评论 ID 路径参数 */
export const CommentIdParams = z.object({
  comment_id: z.string().describe('评论 ID'),
});

/** 通知 ID 路径参数 */
export const NotificationIdParams = z.object({
  notification_id: z.string().describe('通知 ID'),
});

/** API Key ID 路径参数 */
export const ApiKeyIdParams = z.object({
  id: z.string().describe('API Key ID'),
});

/** 用户 Slug 路径参数 */
export const UserSlugParams = z.object({
  user_slug: z.string().describe('用户 URL slug'),
});

/** 页面订阅路径参数 */
export const PageSubscriptionParams = z.object({
  user_slug: z.string().describe('发布者的用户 URL slug'),
  page_id: z.string().describe('页面 ID'),
});

/** 榜单 key 路径参数 */
export const RankingKeyParams = z.object({
  ranking_key: z.string().describe('榜单标识'),
});

/** 分区 key 路径参数 */
export const SectionKeyParams = z.object({
  section_key: z.string().describe('分区标识'),
});

/** 合集条目路径参数 */
export const CollectionItemParams = z.object({
  id: z.string().describe('合集 ID'),
  itemId: z.string().describe('条目 ID'),
});

// ============================================
// 响应 schemas
// ============================================

/** 热门搜索词响应（直接返回数组） */
export const HotSearchesResponse = z.array(
  z.object({
    query: z.string().describe('搜索词'),
    count: z.number().describe('搜索次数'),
  }),
).describe('热门搜索词列表');

/** 最近搜索词响应（直接返回数组） */
export const RecentSearchesResponse = z.array(z.string()).describe('最近搜索词列表');

/** 语音 token 响应 */
export const VoiceTokenResponse = z.object({
  livekit_url: z.string().describe('LiveKit 服务器地址'),
  token: z.string().describe('访问 token'),
  room_name: z.string().describe('房间名'),
  participant_identity: z.string().describe('参与者标识'),
  expires_in: z.number().describe('过期时间（秒）'),
  agent_mode: z.string().describe('智能体模式'),
});

/** 举报响应 */
export const ReportResponse = z.object({
  id: z.string().describe('举报 ID'),
  status: z.string().describe('举报状态'),
});

/** 反馈响应 */
export const FeedbackResponse = z.object({
  id: z.string().describe('反馈 ID'),
});

/** 首页配置响应 */
export const HomeConfigResponse = z.object({}).passthrough().describe('首页配置数据');

/** 榜单响应 */
export const RankingResponse = z.object({}).passthrough().describe('榜单数据');

/** 评论创建响应 */
export const CommentCreateResponse = z.object({
  comment: z.object({
    id: z.string(),
    content: z.string(),
    status: z.string(),
    depth: z.number(),
    parent_comment_id: z.string().nullable(),
    created_at: z.string(),
  }).describe('创建的评论'),
});

/** 评论列表响应 */
export const CommentListResponse = z.object({}).passthrough().describe('评论列表数据');

/** 收藏列表响应 */
export const BookmarkListResponse = z.object({}).passthrough().describe('收藏列表数据');

/** 浏览历史响应 */
export const BrowseHistoryResponse = z.object({}).passthrough().describe('浏览历史数据');

/** 通知列表响应 */
export const NotificationListResponse = z.object({}).passthrough().describe('通知列表数据');

/** 用户收藏列表响应 */
export const UserFavoritesResponse = z.object({
  favorites: z.array(z.object({
    id: z.string().describe('包 ID'),
    type: z.enum(['mcp', 'skill']).describe('包类型'),
    name: z.string().describe('名称'),
    slug: z.string().describe('URL 友好标识符'),
    version: z.string().describe('版本号'),
    description: z.string().nullable().describe('简短描述'),
    category: z.string().nullable().describe('分类'),
    bookmarksCount: z.number().describe('收藏数'),
    downloadsCount: z.number().describe('下载数'),
    ratingAvg: z.number().describe('平均评分'),
    transport: z.string().optional().describe('传输协议（仅 MCP）'),
    skillType: z.string().optional().describe('Skill 类型（仅 Skill）'),
    author: z.object({
      username: z.string().describe('作者用户名'),
      userSlug: z.string().describe('作者 URL slug'),
      avatarUrl: z.string().nullable().describe('作者头像'),
    }).nullable().describe('作者信息'),
    favoritedAt: z.string().describe('收藏时间'),
  })).describe('收藏包列表'),
  nextCursor: z.string().nullable().describe('下一页游标'),
  hasMore: z.boolean().describe('是否有更多数据'),
}).describe('分页的用户收藏列表');

/** 用户公开资料响应 */
export const UserProfileResponse = z.object({
  user: z.object({
    id: z.string().describe('用户 ID'),
    username: z.string().describe('用户名'),
    userSlug: z.string().describe('用户 URL slug'),
    displayName: z.string().nullable().describe('显示名称'),
    avatarUrl: z.string().nullable().describe('头像地址'),
    bio: z.string().nullable().describe('个人简介'),
    websiteUrl: z.string().nullable().describe('个人网站'),
    githubUsername: z.string().nullable().describe('GitHub 用户名'),
    role: z.string().describe('角色'),
    createdAt: z.string().describe('注册时间'),
    stats: z.object({
      mcpPackages: z.number().describe('MCP 包数量'),
      skillPackages: z.number().describe('Skill 包数量'),
    }).describe('包数量统计'),
  }).describe('用户公开资料及统计数据'),
});

/** 首页榜单响应 */
export const HomeRankingResponse = z.object({
  seed: z.string(),
  feed_items: z.array(z.unknown()),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
  sections: z.array(z.unknown()),
  generated_at: z.string().optional(),
}).describe('首页榜单数据');

/** 分区榜单响应 */
export const SectionRankingResponse = z.object({
  section_key: z.string(),
  items: z.array(z.unknown()),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
}).describe('分区榜单数据');

/** 页面合集响应 */
export const PageCollectionResponse = z.object({
  collection: z.object({
    slug: z.string().describe('合集 slug'),
    name: z.string().describe('合集名称'),
  }).describe('合集信息'),
});

/** 页面合集列表响应 */
export const PageCollectionsListResponse = z.object({
  collections: z.array(z.object({
    slug: z.string(),
    name: z.string(),
    page_count: z.number(),
  })).describe('合集列表'),
});

/** 订阅动态响应 */
export const SubscriptionFeedResponse = z.object({
  items: z.array(z.unknown()).describe('动态条目列表'),
  next_cursor: z.string().nullable().describe('下一页游标'),
  has_more: z.boolean().describe('是否有更多数据'),
});

// ============================================
// 作者列表
// ============================================

/** 作者列表查询参数 */
export const AuthorsListQuery = z.object({
  cursor: z.string().optional().describe('base64url 编码的分页游标，包含 followers_count 和 id'),
  limit: z.coerce.number().min(1).max(60).default(20).describe('每页数量（默认 20，最大 60）'),
});

/** 作者列表响应 */
export const AuthorsListResponse = z.object({
  items: z.array(z.object({
    fallbackText: z.string().describe('头像回退文本'),
    avatarUrl: z.string().nullable().describe('头像地址'),
    name: z.string().nullable().describe('显示名称'),
    handle: z.string().describe('用户 handle（@userSlug）'),
    userSlug: z.string().describe('用户 URL slug'),
    description: z.string().describe('个人简介'),
    pageCount: z.number().describe('页面数'),
    followerCount: z.number().describe('粉丝数'),
  })).describe('作者列表'),
  next_cursor: z.string().nullable().describe('下一页游标（base64url 编码）'),
  has_more: z.boolean().describe('是否有更多数据'),
});

// ============================================
// 用户包列表
// ============================================

/** 用户包列表响应 */
export const UserPackagesResponse = z.object({
  mcps: z.array(z.object({
    id: z.string().describe('包 ID'),
    name: z.string().describe('名称'),
    slug: z.string().describe('URL 友好标识符'),
    description: z.string().describe('简短描述'),
    version: z.string().describe('版本号'),
    transport: z.string().describe('传输协议'),
    createdAt: z.string().describe('创建时间'),
  })).describe('MCP 包列表（最多 10 条）'),
  skills: z.array(z.object({
    id: z.string().describe('包 ID'),
    name: z.string().describe('名称'),
    slug: z.string().describe('URL 友好标识符'),
    description: z.string().describe('简短描述'),
    version: z.string().describe('版本号'),
    skillType: z.string().describe('Skill 类型'),
    createdAt: z.string().describe('创建时间'),
  })).describe('Skill 包列表（最多 10 条）'),
});

// ============================================
// API Key 响应
// ============================================

/** API Key 列表响应 */
export const ApiKeysListResponse = z.object({
  keys: z.array(z.object({
    id: z.string().describe('API Key ID'),
    name: z.string().describe('API Key 名称'),
    keyPrefix: z.string().describe('密钥前缀（用于识别）'),
    scopes: z.array(z.string()).describe('权限范围'),
    expiresAt: z.string().nullable().describe('过期时间'),
    lastUsedAt: z.string().nullable().describe('最后使用时间'),
    createdAt: z.string().describe('创建时间'),
  })).describe('API Key 列表（不含完整密钥）'),
});

/** API Key 创建响应 */
export const ApiKeyCreateResponse = z.object({
  key: z.string().describe('完整 API Key（仅在创建时返回一次）'),
  apiKey: z.object({
    id: z.string().describe('API Key ID'),
    name: z.string().describe('API Key 名称'),
    keyPrefix: z.string().describe('密钥前缀'),
    scopes: z.array(z.string()).describe('权限范围'),
    expiresAt: z.string().nullable().describe('过期时间'),
    lastUsedAt: z.string().nullable().describe('最后使用时间'),
    createdAt: z.string().describe('创建时间'),
  }).describe('API Key 元信息'),
  warning: z.string().describe('安全提示'),
});

// ============================================
// 订阅响应
// ============================================

/** 页面订阅响应 */
export const SubscriptionSubscribeResponse = z.object({
  subscribed: z.literal(true).describe('已订阅'),
  subscriber_count: z.number().describe('当前订阅数'),
  notify_level: z.enum(['all', 'major', 'none']).describe('通知级别'),
  last_seen_version: z.number().describe('上次已读版本号'),
});

/** 取消订阅响应 */
export const SubscriptionUnsubscribeResponse = z.object({
  subscribed: z.literal(false).describe('已取消订阅'),
  subscriber_count: z.number().describe('当前订阅数'),
});

/** 更新订阅设置响应 */
export const SubscriptionUpdateResponse = z.object({
  subscribed: z.literal(true).describe('已订阅'),
  notify_level: z.enum(['all', 'major', 'none']).describe('通知级别'),
  last_seen_version: z.number().describe('已读版本号'),
});

// ============================================
// 关注响应
// ============================================

/** 关注用户响应 */
export const FollowUserResponse = z.object({
  following: z.literal(true).describe('已关注'),
  followers_count: z.number().describe('当前粉丝数'),
});

/** 取消关注用户响应 */
export const UnfollowUserResponse = z.object({
  following: z.literal(false).describe('已取消关注'),
  followers_count: z.number().describe('当前粉丝数'),
});

// ============================================
// 阅读页面响应
// ============================================

/** 阅读页面响应元信息 */
const PageMeta = z.object({
  userSlug: z.string().describe('作者 URL slug'),
  pageId: z.string().describe('页面 UID'),
  pageDbId: z.string().describe('页面数据库 ID'),
  title: z.string().describe('页面标题'),
  description: z.string().nullable().describe('页面描述'),
  authorDisplayName: z.string().nullable().describe('作者显示名称'),
  authorAvatarUrl: z.string().nullable().describe('作者头像'),
  sidePageUid: z.string().nullable().describe('侧页 UID'),
  visibility: z.string().describe('可见性'),
  publishedAt: z.string().nullable().describe('发布时间'),
  tags: z.array(z.string()).nullable().describe('标签'),
  coverUrl: z.string().nullable().describe('封面图 URL'),
  viewCount: z.number().describe('浏览数'),
  likeCount: z.number().describe('点赞数'),
  commentCount: z.number().describe('评论数'),
  bookmarkCount: z.number().describe('收藏数'),
  shareCount: z.number().describe('分享数'),
  isAuthor: z.boolean().describe('是否为页面作者'),
  hasSidePage: z.boolean().describe('是否有侧页'),
  communityEntityId: z.string().describe('社区实体 ID'),
});

/** 阅读已发布页面响应 */
export const ReadPageResponse = z.object({
  html: z.string().optional().describe('HTML 内容（fields=html|all 时包含）'),
  meta: PageMeta.optional().describe('页面元信息（fields=meta|all 时包含）'),
}).describe('阅读页面响应，字段根据 fields 参数动态返回');
