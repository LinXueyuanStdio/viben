'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, EyeOff, Eye, Trash2, Paperclip, Repeat, FileText } from 'lucide-react';

interface Moment {
  id: string; uid: string; kind: string; body: string | null; visibility: string;
  likeCount: number; commentCount: number; repostCount: number; viewCount: number | null;
  attachmentCount: number;
  isPinned: boolean; createdAt: string; authorId: string; authorName: string | null; authorUsername: string | null;
}

interface MomentAttachment {
  id: string; momentId: string; attachmentType: string; attachmentId: string;
  attachmentUid: string | null; titleSnapshot: string; descriptionSnapshot: string | null;
  coverUrlSnapshot: string | null; sortOrder: number; createdAt: string;
}

interface RepostRecord {
  id: string; entityType: string; entityId: string; userId: string;
  momentId: string; comment: string | null; visibility: string; status: string;
  failureReason: string | null; createdAt: string;
}

interface RepostChainItem {
  direction: 'upstream' | 'downstream';
  moment: {
    id: string; uid: string; kind: string; body: string | null;
    visibility: string; createdAt: string; repostCount?: number;
    authorId?: string; authorName: string | null; authorUsername: string | null;
  };
}

interface MomentDetail {
  moment: Moment & { bodyFormat?: string; repostOfMomentId?: string | null; replyToMomentId?: string | null; isDeleted?: boolean; updatedAt?: string };
  attachments: MomentAttachment[];
  sourceRepost: (RepostRecord & { reposterName?: string | null; reposterUsername?: string | null }) | null;
  repostChain: RepostChainItem[];
}

interface Pagination {
  page: number; limit: number; total: number; totalPages: number;
}

export function MomentManagement() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [moments, setMoments] = useState<Moment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const currentKind = searchParams.get('kind') || 'all';
  const currentVisibility = searchParams.get('visibility') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; action: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Detail dialog
  const [detailMoment, setDetailMoment] = useState<MomentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
    published_page: '页面', collection: '合集', mcp: 'MCP', skill: '技能', media: '媒体',
  };
  const ATTACHMENT_TYPE_ICONS: Record<string, React.ReactNode> = {
    published_page: <FileText className="h-3 w-3" />,
    collection: <Paperclip className="h-3 w-3" />,
    mcp: <Paperclip className="h-3 w-3" />,
    skill: <Paperclip className="h-3 w-3" />,
    media: <Paperclip className="h-3 w-3" />,
  };

  const KIND_LABELS: Record<string, string> = { post: '帖子', page_update: '页面更新', repost: '转发', system: '系统' };
  const VISIBILITY_LABELS: Record<string, string> = { public: '公开', unlisted: '不公开', private: '私有' };

  const fetchMoments = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20', kind: currentKind, visibility: currentVisibility });
      const res = await fetch(`/api/admin/moments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch moments');
      const data = await res.json();
      setMoments(data.moments);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.moments.loadError'));
    } finally { setLoading(false); }
  }, [currentPage, currentKind, currentVisibility, t]);

  useEffect(() => { fetchMoments(); }, [fetchMoments]);

  const fetchMomentDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/moments/${id}`);
      if (!res.ok) throw new Error('Failed to fetch moment detail');
      const data = await res.json();
      setDetailMoment(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moment detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value); else params.delete(key);
    params.delete('page');
    router.push(`/admin/moments?${params.toString()}`);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/admin/moments?${params.toString()}`);
  };

  const handleAction = async (id: string, action: 'hide' | 'unhide' | 'delete') => {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/moments/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} moment`);
      setDeleteTarget(null);
      fetchMoments();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.moments.actionError'));
    } finally { setActingId(null); }
  };

  const confirmAction = (id: string, action: 'hide' | 'unhide' | 'delete') => {
    const labels: Record<string, string> = {
      hide: t('dashboard.admin.moments.hide'),
      unhide: t('dashboard.admin.moments.unhide'),
      delete: t('dashboard.admin.moments.delete'),
    };
    setDeleteTarget({ id, action, label: labels[action] });
  };

  const getDialogTitle = () => {
    if (!deleteTarget) return '';
    if (deleteTarget.action === 'delete') return t('dashboard.admin.moments.deleteConfirm');
    return `${t('common.confirm')}${deleteTarget.label}`;
  };

  const getDialogDescription = () => {
    if (!deleteTarget) return '';
    if (deleteTarget.action === 'delete') return t('dashboard.admin.moments.deleteConfirmDesc');
    return `确定要${deleteTarget.label}此动态吗？`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.moments.title')}</h1><p className="text-muted-foreground">{t('dashboard.admin.moments.subtitle')}</p></div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center mr-1">类型:</span>
          {(['all', 'post', 'page_update', 'repost', 'system'] as const).map((k) => (
            <button key={k} type="button" onClick={() => updateFilter('kind', k)}
              className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${currentKind === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {k === 'all' ? t('dashboard.admin.moments.filterAll') : KIND_LABELS[k] || k}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center mr-1">{t('dashboard.admin.moments.columns.visibility')}:</span>
          {(['all', 'public', 'unlisted', 'private'] as const).map((v) => (
            <button key={v} type="button" onClick={() => updateFilter('visibility', v)}
              className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${currentVisibility === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {v === 'all' ? t('dashboard.admin.moments.filterAll') : VISIBILITY_LABELS[v] || v}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center"><p className="text-destructive">{error}</p><button onClick={fetchMoments} className="mt-2 text-sm text-primary hover:underline">{t('dashboard.admin.moments.retry')}</button></div>
      ) : moments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center"><p className="text-lg text-muted-foreground">{t('dashboard.admin.moments.emptyTitle')}</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.moments.columns.author')}</th><th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.moments.columns.content')}</th>
              <th className="px-4 py-3 text-left text-sm font-medium">类型</th><th className="px-4 py-3 text-left text-sm font-medium">附件</th><th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.moments.columns.visibility')}</th>
              <th className="px-4 py-3 text-left text-sm font-medium">互动</th><th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.moments.columns.time')}</th>
              <th className="px-4 py-3 text-right text-sm font-medium">{t('dashboard.admin.moments.columns.actions')}</th>
            </tr></thead>
            <tbody>
              {moments.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => fetchMomentDetail(m.id)}>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">{m.authorName || m.authorUsername || '未知'}</td>
                  <td className="px-4 py-3 text-sm max-w-[250px] truncate">{m.body?.slice(0, 100) || '-'}</td>
                  <td className="px-4 py-3 text-sm"><Badge variant="outline">{KIND_LABELS[m.kind] || m.kind}</Badge></td>
                  <td className="px-4 py-3 text-sm">
                    {m.attachmentCount > 0 ? (
                      <Badge variant="secondary" className="gap-1">
                        <Paperclip className="h-3 w-3" />
                        {m.attachmentCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{VISIBILITY_LABELS[m.visibility] || m.visibility}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">❤ {m.likeCount} · 💬 {m.commentCount} · 🔄 {m.repostCount}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{new Date(m.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {m.visibility !== 'private' ? (
                      <Button variant="ghost" size="sm" onClick={() => confirmAction(m.id, 'hide')} disabled={actingId === m.id} title={t('dashboard.admin.moments.hide')}><EyeOff className="h-4 w-4" /></Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => confirmAction(m.id, 'unhide')} disabled={actingId === m.id} title={t('dashboard.admin.moments.unhide')}><Eye className="h-4 w-4" /></Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => confirmAction(m.id, 'delete')} disabled={actingId === m.id} title={t('dashboard.admin.moments.delete')}>
                      {actingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                    </Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${p === currentPage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{p}</button>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">{t('dashboard.admin.moments.showing', { count: moments.length, total: pagination.total })}</p>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{getDialogTitle()}</DialogTitle><DialogDescription>{getDialogDescription()}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant={deleteTarget?.action === 'delete' ? 'destructive' : 'default'}
              onClick={() => deleteTarget && handleAction(deleteTarget.id, deleteTarget.action as 'hide' | 'unhide' | 'delete')}
              disabled={actingId === deleteTarget?.id}>
              {actingId === deleteTarget?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{t('common.confirm')}{deleteTarget?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Moment Detail Dialog */}
      <Dialog open={!!detailMoment} onOpenChange={(open) => { if (!open) setDetailMoment(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : detailMoment ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {t('dashboard.admin.moments.detailTitle')}
                  <Badge variant="outline">{KIND_LABELS[detailMoment.moment.kind] || detailMoment.moment.kind}</Badge>
                  <Badge variant="secondary">{VISIBILITY_LABELS[detailMoment.moment.visibility] || detailMoment.moment.visibility}</Badge>
                </DialogTitle>
                <DialogDescription>
                  {detailMoment.moment.authorName || detailMoment.moment.authorUsername || '未知'} · {new Date(detailMoment.moment.createdAt).toLocaleString('zh-CN')}
                  {detailMoment.moment.isPinned && <Badge variant="outline" className="ml-2">已置顶</Badge>}
                </DialogDescription>
              </DialogHeader>

              {/* Body */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('dashboard.admin.moments.detailContent')}</h4>
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                    {detailMoment.moment.body || '(无内容)'}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>❤ {detailMoment.moment.likeCount}</span>
                    <span>💬 {detailMoment.moment.commentCount}</span>
                    <span>🔄 {detailMoment.moment.repostCount}</span>
                    <span>👁 {detailMoment.moment.viewCount ?? 0}</span>
                  </div>
                </div>

                {/* Attachments */}
                {detailMoment.attachments.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">{t('dashboard.admin.moments.detailAttachments')} ({detailMoment.attachments.length})</h4>
                    <div className="space-y-2">
                      {detailMoment.attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-3 rounded-lg border p-3">
                          {att.coverUrlSnapshot && (
                            <img src={att.coverUrlSnapshot} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs gap-1">
                                {ATTACHMENT_TYPE_ICONS[att.attachmentType]}
                                {ATTACHMENT_TYPE_LABELS[att.attachmentType] || att.attachmentType}
                              </Badge>
                              <span className="text-sm font-medium truncate">{att.titleSnapshot}</span>
                            </div>
                            {att.descriptionSnapshot && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{att.descriptionSnapshot}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repost Chain */}
                {(detailMoment.sourceRepost || detailMoment.repostChain.length > 0) && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">{t('dashboard.admin.moments.detailRepostChain')}</h4>
                    <div className="space-y-3">
                      {/* Source repost (if this moment is a repost) */}
                      {detailMoment.sourceRepost && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Repeat className="h-4 w-4 text-primary" />
                            <span className="text-xs font-medium text-primary">
                              {t('dashboard.admin.moments.repostSource')}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>{t('dashboard.admin.moments.repostBy')}: {detailMoment.sourceRepost.reposterName || detailMoment.sourceRepost.reposterUsername || detailMoment.sourceRepost.userId}</div>
                            <div>{t('dashboard.admin.moments.repostEntity')}: {detailMoment.sourceRepost.entityType} / {detailMoment.sourceRepost.entityId}</div>
                            <div>{t('dashboard.admin.moments.repostStatus')}: <Badge variant="outline" className="text-xs">{detailMoment.sourceRepost.status}</Badge></div>
                            {detailMoment.sourceRepost.comment && (
                              <div className="mt-1 italic">"{detailMoment.sourceRepost.comment}"</div>
                            )}
                            {detailMoment.sourceRepost.failureReason && (
                              <div className="text-destructive">{t('dashboard.admin.moments.repostFailure')}: {detailMoment.sourceRepost.failureReason}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Repost chain items */}
                      {detailMoment.repostChain.map((item, idx) => (
                        <div key={idx} className="rounded-lg border p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={item.direction === 'upstream' ? 'secondary' : 'outline'} className="text-xs">
                              {item.direction === 'upstream' ? t('dashboard.admin.moments.repostUpstream') : t('dashboard.admin.moments.repostDownstream')}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {item.moment.authorName || item.moment.authorUsername || '未知'} · {new Date(item.moment.createdAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <p className="text-sm">{item.moment.body?.slice(0, 200) || '(无内容)'}</p>
                          {item.moment.repostCount !== undefined && (
                            <span className="text-xs text-muted-foreground">🔄 {item.moment.repostCount}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta info */}
                <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
                  <div>ID: {detailMoment.moment.id}</div>
                  <div>UID: {detailMoment.moment.uid}</div>
                  {detailMoment.moment.repostOfMomentId && <div>转发自: {detailMoment.moment.repostOfMomentId}</div>}
                  {detailMoment.moment.replyToMomentId && <div>回复: {detailMoment.moment.replyToMomentId}</div>}
                  {detailMoment.moment.bodyFormat && <div>格式: {detailMoment.moment.bodyFormat}</div>}
                  {detailMoment.moment.updatedAt && <div>更新于: {new Date(detailMoment.moment.updatedAt).toLocaleString('zh-CN')}</div>}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailMoment(null)}>{t('common.close')}</Button>
                {detailMoment.moment.visibility !== 'private' ? (
                  <Button variant="secondary" onClick={() => { handleAction(detailMoment.moment.id, 'hide'); setDetailMoment(null); }}>{t('dashboard.admin.moments.hide')}</Button>
                ) : (
                  <Button variant="secondary" onClick={() => { handleAction(detailMoment.moment.id, 'unhide'); setDetailMoment(null); }}>{t('dashboard.admin.moments.unhide')}</Button>
                )}
                <Button variant="destructive" onClick={() => { confirmAction(detailMoment.moment.id, 'delete'); setDetailMoment(null); }}>{t('dashboard.admin.moments.delete')}</Button>
              </DialogFooter>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">{t('dashboard.admin.moments.loadError')}</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
