'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

interface ActivityEvent {
  id: string;
  actorUserId: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  targetUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  targetUsername: string | null;
  targetDisplayName: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'page.create': { label: '创建页面', variant: 'default' },
  'page.update': { label: '更新页面', variant: 'secondary' },
  'page.delete': { label: '删除页面', variant: 'destructive' },
  'page.like': { label: '点赞页面', variant: 'outline' },
  'page.bookmark': { label: '收藏页面', variant: 'outline' },
  'comment.create': { label: '发表评论', variant: 'default' },
  'comment.delete': { label: '删除评论', variant: 'destructive' },
  'collection.create': { label: '创建合集', variant: 'default' },
  'collection.add': { label: '添加至合集', variant: 'secondary' },
  'user.follow': { label: '关注用户', variant: 'outline' },
  'user.register': { label: '用户注册', variant: 'default' },
  'package.publish': { label: '发布包', variant: 'default' },
  'package.update': { label: '更新包', variant: 'secondary' },
  'moment.create': { label: '发布动态', variant: 'default' },
  'moment.like': { label: '点赞动态', variant: 'outline' },
};

function getEventConfig(eventType: string) {
  return EVENT_TYPE_CONFIG[eventType] || { label: eventType, variant: 'secondary' as const };
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActorName(event: ActivityEvent) {
  return event.actorDisplayName || event.actorUsername || event.actorUserId?.slice(0, 8) || '系统';
}

function getTargetName(event: ActivityEvent) {
  return event.targetDisplayName || event.targetUsername || event.targetUserId?.slice(0, 8) || null;
}

export function ActivityFeed() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentEventType = searchParams.get('event_type') || '';
  const currentStartDate = searchParams.get('start_date') || '';
  const currentEndDate = searchParams.get('end_date') || '';
  const currentPage = Number(searchParams.get('page')) || 1;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
      if (currentEventType) params.set('event_type', currentEventType);
      if (currentStartDate) params.set('start_date', currentStartDate);
      if (currentEndDate) params.set('end_date', currentEndDate);
      const res = await fetch(`/api/admin/activity?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch activity events');
      const data = await res.json();
      setEvents(data.events);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity events');
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentEventType, currentStartDate, currentEndDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const updateFilter = (eventType: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (eventType) {
      params.set('event_type', eventType);
    } else {
      params.delete('event_type');
    }
    params.delete('page');
    router.push(`/admin/activity?${params.toString()}`);
  };

  const updateDateFilter = (key: 'start_date' | 'end_date', value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/admin/activity?${params.toString()}`);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/admin/activity?${params.toString()}`);
  };

  const handleEventClick = (event: ActivityEvent) => {
    const prefix = event.eventType.split('.')[0];
    const entityId = event.entityId;
    switch (prefix) {
      case 'page':
        router.push(`/admin/pages?id=${entityId}`);
        break;
      case 'comment':
        router.push(`/admin/comments`);
        break;
      case 'collection':
        router.push(`/admin/collections?id=${entityId}`);
        break;
      case 'user':
        router.push(`/admin/users?id=${event.targetUserId || entityId}`);
        break;
      case 'package':
        router.push(`/admin/packages?id=${entityId}`);
        break;
      case 'moment':
        router.push(`/admin/moments?id=${entityId}`);
        break;
      default:
        break;
    }
  };

  const eventTypes = Object.keys(EVENT_TYPE_CONFIG);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">活动流</h1>
        <p className="text-muted-foreground">查看平台用户活动动态</p>
      </div>

      {/* Event type filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateFilter('')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !currentEventType
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          全部
        </button>
        {eventTypes.map((et) => {
          const config = getEventConfig(et);
          return (
            <button
              key={et}
              type="button"
              onClick={() => updateFilter(et)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentEventType === et
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="activity-start-date" className="text-sm text-muted-foreground shrink-0">
            开始日期
          </label>
          <input
            id="activity-start-date"
            type="date"
            value={currentStartDate}
            onChange={(e) => updateDateFilter('start_date', e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="activity-end-date" className="text-sm text-muted-foreground shrink-0">
            结束日期
          </label>
          <input
            id="activity-end-date"
            type="date"
            value={currentEndDate}
            onChange={(e) => updateDateFilter('end_date', e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        {(currentStartDate || currentEndDate) && (
          <button
            type="button"
            onClick={() => {
              updateDateFilter('start_date', '');
              updateDateFilter('end_date', '');
            }}
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            清除日期
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchEvents} className="mt-2 text-sm text-primary hover:underline">
            重试
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无活动记录</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-2 bottom-2 w-px bg-border" />

          <div className="space-y-4">
            {events.map((event) => {
              const config = getEventConfig(event.eventType);
              const actorName = getActorName(event);
              const targetName = getTargetName(event);
              const initials = actorName.slice(0, 2).toUpperCase();

              return (
                <div key={event.id} className="relative flex gap-4 pl-10">
                  {/* Avatar / placeholder on the timeline */}
                  <div className="absolute left-2 z-10">
                    {event.actorAvatarUrl ? (
                      <Avatar className="h-6 w-6 ring-2 ring-background">
                        <AvatarImage src={event.actorAvatarUrl} alt={actorName} />
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted ring-2 ring-background">
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {initials}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Event card */}
                  <div
                    className="flex-1 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/30 cursor-pointer"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{actorName}</span>
                        <Badge variant={config.variant} className="shrink-0">
                          {config.label}
                        </Badge>
                      </div>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {formatTime(event.createdAt)}
                      </time>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        <span className="font-medium">实体:</span>{' '}
                        <span className="font-mono">{event.entityType}</span>
                      </span>
                      <span>
                        <span className="font-medium">ID:</span>{' '}
                        <span className="font-mono">{event.entityId.length > 16 ? `${event.entityId.slice(0, 16)}...` : event.entityId}</span>
                      </span>
                      {targetName && (
                        <span>
                          <span className="font-medium">目标:</span> {targetName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                p === currentPage
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        显示 {events.length} / {pagination.total} 条活动记录
      </p>
    </div>
  );
}
