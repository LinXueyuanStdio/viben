'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Eye, Check, X, EyeOff } from 'lucide-react';

interface PageForReview {
  id: string;
  uid: string;
  userId: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  visibility: string;
  moderationStatus: string;
  publishedAt: string;
  lastPublishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  authorName: string | null;
  authorAvatarUrl: string | null;
  authorUsername: string | null;
}

interface PageDetail extends PageForReview {
  html: string;
  tags: string[];
  categoryId: string | null;
  authorEmail: string | null;
}

const MODERATION_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '待审核', variant: 'default' },
  approved: { label: '已通过', variant: 'secondary' },
  rejected: { label: '已拒绝', variant: 'destructive' },
  hidden: { label: '已隐藏', variant: 'outline' },
};

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN');
}

export function PageReviewManagement() {
  const [pages, setPages] = useState<PageForReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'hidden' | 'all'>('pending');

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Moderate state
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingPageId, setRejectingPageId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pages?moderation_status=${statusFilter}`);
      if (!res.ok) throw new Error('Failed to fetch pages');
      const data = await res.json();
      setPages(data.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const fetchDetail = async (pageId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`);
      if (!res.ok) throw new Error('Failed to fetch page detail');
      const data = await res.json();
      setSelectedPage(data.page);
      setDetailOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load page detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleModerate = async (pageId: string, status: 'approved' | 'rejected' | 'hidden', reason?: string) => {
    setActingId(pageId);
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moderation_status: status,
          rejection_reason: reason || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${status} page`);
      }

      setDetailOpen(false);
      setRejectDialogOpen(false);
      fetchPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${status} page`);
    } finally {
      setActingId(null);
    }
  };

  const openRejectDialog = (pageId: string) => {
    setRejectingPageId(pageId);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">页面审核</h1>
          <p className="text-muted-foreground">审核用户发布的页面内容</p>
        </div>
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected', 'hidden', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {s === 'all' ? '全部' : MODERATION_STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchPages} className="mt-2 text-sm text-primary hover:underline">
            重试
          </button>
        </div>
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无待审核页面</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {statusFilter === 'pending' ? '所有页面已审核完毕' : '没有符合条件的页面'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">标题</th>
                <th className="px-4 py-3 text-left text-sm font-medium">作者</th>
                <th className="px-4 py-3 text-left text-sm font-medium">可见性</th>
                <th className="px-4 py-3 text-left text-sm font-medium">审核状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">数据</th>
                <th className="px-4 py-3 text-left text-sm font-medium">发布时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => {
                const modConf = MODERATION_STATUS_CONFIG[page.moderationStatus] || MODERATION_STATUS_CONFIG.pending;
                return (
                  <tr key={page.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium max-w-[200px] truncate">
                      {page.title}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {page.authorName || page.authorUsername || '未知'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {page.visibility === 'public' ? '公开' : page.visibility === 'unlisted' ? '不公开' : '私密'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={modConf.variant}>{modConf.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      👁 {page.viewCount} · ❤ {page.likeCount} · 💬 {page.commentCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(page.lastPublishedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchDetail(page.id)}
                          title="查看详情"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {page.moderationStatus === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleModerate(page.id, 'approved')}
                              disabled={actingId === page.id}
                              title="通过"
                            >
                              {actingId === page.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRejectDialog(page.id)}
                              disabled={actingId === page.id}
                              title="拒绝"
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {page.moderationStatus === 'approved' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleModerate(page.id, 'hidden')}
                            disabled={actingId === page.id}
                            title="隐藏"
                          >
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        共 {pages.length} 个页面
      </p>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedPage ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedPage.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">作者：</span>
                    {selectedPage.authorName || selectedPage.authorUsername || '未知'}
                    {selectedPage.authorEmail && (
                      <span className="text-muted-foreground ml-1">({selectedPage.authorEmail})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">可见性：</span>
                    {selectedPage.visibility === 'public' ? '公开' : selectedPage.visibility === 'unlisted' ? '不公开' : '私密'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">审核状态：</span>
                    <Badge variant={MODERATION_STATUS_CONFIG[selectedPage.moderationStatus]?.variant || 'default'} className="ml-1">
                      {MODERATION_STATUS_CONFIG[selectedPage.moderationStatus]?.label || selectedPage.moderationStatus}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">发布时间：</span>
                    {formatDateTime(selectedPage.publishedAt)}
                  </div>
                </div>
                {selectedPage.tags && selectedPage.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedPage.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                )}
                {selectedPage.description && (
                  <div>
                    <Label className="text-muted-foreground">描述</Label>
                    <p className="mt-1 text-sm">{selectedPage.description}</p>
                  </div>
                )}
                {selectedPage.coverUrl && (
                  <div>
                    <Label className="text-muted-foreground">封面</Label>
                    <img
                      src={selectedPage.coverUrl}
                      alt={selectedPage.title}
                      className="mt-1 max-h-48 rounded-lg border object-cover"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">数据统计</Label>
                  <p className="mt-1 text-sm">
                    👁 {selectedPage.viewCount} 浏览 · ❤ {selectedPage.likeCount} 点赞 · 💬 {selectedPage.commentCount} 评论
                  </p>
                </div>
                {selectedPage.html && (
                  <div>
                    <Label className="text-muted-foreground">内容预览</Label>
                    <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border p-4 text-sm bg-muted/30">
                      <div className="line-clamp-4 text-muted-foreground">
                        {selectedPage.html.replace(/<[^>]*>/g, '').slice(0, 500)}
                        {(selectedPage.html.replace(/<[^>]*>/g, '').length > 500) && '...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                {selectedPage.moderationStatus === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => openRejectDialog(selectedPage.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      拒绝
                    </Button>
                    <Button
                      onClick={() => handleModerate(selectedPage.id, 'approved')}
                      disabled={actingId === selectedPage.id}
                    >
                      {actingId === selectedPage.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      通过
                    </Button>
                  </>
                )}
                {selectedPage.moderationStatus !== 'pending' && (
                  <Button variant="outline" onClick={() => setDetailOpen(false)}>
                    关闭
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              加载失败
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝页面</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              请填写拒绝原因（可选），该原因将对作者可见。
            </p>
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">拒绝原因</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="如：内容不完整、违反社区规范等"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectingPageId) {
                  handleModerate(rejectingPageId, 'rejected', rejectionReason);
                }
              }}
              disabled={actingId === rejectingPageId}
            >
              {actingId === rejectingPageId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
