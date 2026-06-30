'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Loader2,
  User,
  Mail,
  Globe,
  Calendar,
  Users,
  FileText,
  History,
  Shield,
  AlertTriangle,
  CheckCircle,
  Eye,
  GitBranch,
  Key,
  BookOpen,
  ExternalLink,
  FileEdit,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

// Types matching the API response
interface OAuthConnection {
  id: string;
  provider: string;
  createdAt: string;
}

interface BrowseHistoryItem {
  id: string;
  entityType: string;
  entityId: string;
  lastViewedAt: string;
  viewCount: number;
  snapshotTitle: string | null;
}

interface ModerationLogEntry {
  id: string;
  adminId: string;
  action: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface PublishedPage {
  id: string;
  uid: string;
  title: string;
  visibility: string;
  moderationStatus: string;
  publishedAt: string;
  viewCount: number;
}

interface UserDetail {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  bio: string | null;
  websiteUrl: string | null;
  githubUsername: string | null;
  emailVerified: boolean;
  followersCount: number;
  pageCount: number | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  bannedAt: string | null;
  bannedReason: string | null;
  warnedAt: string | null;
  warnedReason: string | null;
}

interface UserDetailResponse {
  user: UserDetail;
  oauthConnections: OAuthConnection[];
  apiKeysCount: number;
  followersCount: number;
  followeesCount: number;
  pageSubscriptionsCount: number;
  draftsCount: number;
  publishedPagesCount: number;
  publishedPages: PublishedPage[];
  recentBrowseHistory: BrowseHistoryItem[];
  moderationLogs: ModerationLogEntry[];
}

const ROLE_LABELS: Record<string, string> = {
  user: '用户',
  developer: '开发者',
  support: '客服',
  moderator: '版主',
  admin: '管理员',
  super_admin: '超级管理员',
};

const ROLE_COLORS: Record<string, string> = {
  user: 'bg-gray-100 text-gray-800',
  developer: 'bg-blue-100 text-blue-800',
  support: 'bg-green-100 text-green-800',
  moderator: 'bg-yellow-100 text-yellow-800',
  admin: 'bg-purple-100 text-purple-800',
  super_admin: 'bg-red-100 text-red-800',
};

const OAUTH_PROVIDER_LABELS: Record<string, string> = {
  github: 'GitHub',
  google: 'Google',
};

const MODERATION_ACTION_LABELS: Record<string, string> = {
  approve: '批准',
  reject: '拒绝',
  feature: '精选',
  unfeature: '取消精选',
  delete: '删除',
  warn: '警告',
  ban: '封禁',
  unban: '解封',
  hide: '隐藏',
  unhide: '取消隐藏',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  published_page: '页面',
  moment: '动态',
  comment: '评论',
  user: '用户',
  mcp: 'MCP',
  skill: '技能',
  collection: '合集',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface UserDetailDialogProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserDetailDialog({ userId, isOpen, onClose }: UserDetailDialogProps) {
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || '获取用户详情失败');
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户详情失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserDetail(userId);
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, userId, fetchUserDetail]);

  const handleClose = () => {
    onClose();
  };

  const user = data?.user;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {user && (
              <>
                <span>用户详情</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="py-8 text-center text-destructive">{error}</div>
        )}

        {data && user && !loading && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Profile Header */}
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-lg">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{user.displayName}</h3>
                    <Badge className={ROLE_COLORS[user.role] || ''} variant="secondary">
                      {ROLE_LABELS[user.role] || user.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    @{user.username}
                  </p>
                  {user.bio && (
                    <p className="text-sm">{user.bio}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {user.email}
                      {user.emailVerified && (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      )}
                    </span>
                    {user.websiteUrl && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        <a
                          href={user.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-0.5"
                        >
                          {user.websiteUrl.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </span>
                    )}
                    {user.githubUsername && (
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3.5 w-3.5" />
                        <a
                          href={`https://github.com/${user.githubUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-0.5"
                        >
                          {user.githubUsername}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Dates & Status */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">注册时间:</span>
                  <span>{formatDate(user.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">最后登录:</span>
                  <span>
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : '-'}
                  </span>
                </div>
                {user.bannedAt && (
                  <div className="flex items-center gap-2 col-span-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span>已封禁于 {formatDate(user.bannedAt)}</span>
                    {user.bannedReason && <span>- {user.bannedReason}</span>}
                  </div>
                )}
                {user.warnedAt && !user.bannedAt && (
                  <div className="flex items-center gap-2 col-span-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>已警告于 {formatDate(user.warnedAt)}</span>
                    {user.warnedReason && <span>- {user.warnedReason}</span>}
                  </div>
                )}
              </div>

              <Separator />

              {/* OAuth Connections */}
              {data.oauthConnections.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    OAuth 连接
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {data.oauthConnections.map((conn) => (
                      <Badge key={conn.id} variant="outline">
                        {OAUTH_PROVIDER_LABELS[conn.provider] || conn.provider}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  用户统计
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{data.followersCount}</div>
                    <div className="text-xs text-muted-foreground">粉丝</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{data.followeesCount}</div>
                    <div className="text-xs text-muted-foreground">关注</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{data.publishedPagesCount}</div>
                    <div className="text-xs text-muted-foreground">已发布页面</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{data.draftsCount}</div>
                    <div className="text-xs text-muted-foreground">草稿</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{data.apiKeysCount}</div>
                    <div className="text-xs text-muted-foreground">API 密钥</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{data.pageSubscriptionsCount}</div>
                    <div className="text-xs text-muted-foreground">页面订阅</div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Published Pages */}
              {data.publishedPages.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    已发布页面
                  </h4>
                  <div className="space-y-2">
                    {data.publishedPages.map((page) => (
                      <div
                        key={page.id}
                        className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{page.title}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {page.visibility === 'public'
                              ? '公开'
                              : page.visibility === 'unlisted'
                                ? '不公开'
                                : '私密'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {page.viewCount}
                          </span>
                          <span>{formatDate(page.publishedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Browse History */}
              {data.recentBrowseHistory.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <History className="h-4 w-4 text-muted-foreground" />
                    最近浏览历史
                  </h4>
                  <div className="space-y-1.5">
                    {data.recentBrowseHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {item.snapshotTitle || `${item.entityType} / ${item.entityId}`}
                          </span>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {ENTITY_TYPE_LABELS[item.entityType] || item.entityType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {item.viewCount}
                          </span>
                          <span>{formatDate(item.lastViewedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Moderation Logs */}
              {data.moderationLogs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    管理日志
                  </h4>
                  <div className="space-y-2">
                    {data.moderationLogs.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3 py-1"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {MODERATION_ACTION_LABELS[entry.action] || entry.action}
                            </Badge>
                            <span className="text-muted-foreground">
                              {formatDate(entry.createdAt)}
                            </span>
                          </div>
                          {entry.reason && (
                            <p className="mt-1 text-muted-foreground text-xs">
                              {entry.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
