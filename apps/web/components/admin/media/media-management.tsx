'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Trash2, ImageIcon, FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MediaOwner {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface MediaAsset {
  id: string;
  kind: string;
  source: 'external_url' | 'object_storage' | 'generated';
  url: string;
  thumbnailUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  altText: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  owner: MediaOwner | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const KIND_LABELS: Record<string, string> = {
  avatar: '头像',
  cover: '封面',
  package_icon: '包图标',
  attachment: '附件',
  screenshot: '截图',
  thumbnail: '缩略图',
  banner: '横幅',
  gallery: '图库',
  document: '文档',
  media: '媒体',
  other: '其他',
};

const SOURCE_LABELS: Record<string, string> = {
  external_url: '外部链接',
  object_storage: '对象存储',
  generated: '生成',
};

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDimensions(width: number | null, height: number | null): string {
  if (width === null && height === null) return '-';
  if (width === null) return `?×${height}`;
  if (height === null) return `${width}×?`;
  return `${width}×${height}`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN');
}

function getKindBadgeVariant(kind: string): 'default' | 'secondary' | 'outline' {
  if (kind === 'avatar' || kind === 'package_icon') return 'default';
  if (kind === 'screenshot' || kind === 'thumbnail') return 'secondary';
  return 'outline';
}

export function MediaManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentKind = searchParams.get('kind') || 'all';
  const currentSource = searchParams.get('source') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        source: currentSource,
      });
      if (currentKind !== 'all') {
        params.set('kind', currentKind);
      }
      const res = await fetch(`/api/admin/media?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch media assets');
      const data = await res.json();
      setAssets(data.assets);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载媒体资源失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentKind, currentSource]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/admin/media?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/media/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete media asset');
      toast.success('媒体资源已删除');
      fetchAssets();
    } catch {
      toast.error('删除媒体资源失败');
    } finally {
      setDeleteId(null);
      setDeleting(false);
    }
  };

  const renderThumbnail = (asset: MediaAsset) => {
    const thumbUrl = asset.thumbnailUrl || asset.url;
    const isImage = asset.mimeType?.startsWith('image/');

    if (isImage && thumbUrl) {
      return (
        <div className="relative h-10 w-10 overflow-hidden rounded-md border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbUrl}
            alt={asset.altText || ''}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="hidden flex h-full w-full items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted">
        {isImage ? (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">媒体管理</h1>
          <p className="text-muted-foreground">管理所有上传的媒体资源</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">类型</span>
          <Select
            value={currentKind}
            onValueChange={(v) => updateFilter('kind', v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {Object.entries(KIND_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">来源</span>
          <Select
            value={currentSource}
            onValueChange={(v) => updateFilter('source', v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="全部来源" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部来源</SelectItem>
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button
            onClick={fetchAssets}
            className="mt-2 text-sm text-primary hover:underline"
          >
            重试
          </button>
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无媒体资源</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">预览</th>
                <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">来源</th>
                <th className="px-4 py-3 text-left text-sm font-medium">MIME</th>
                <th className="px-4 py-3 text-left text-sm font-medium">大小</th>
                <th className="px-4 py-3 text-left text-sm font-medium">尺寸</th>
                <th className="px-4 py-3 text-left text-sm font-medium">所有者</th>
                <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{renderThumbnail(a)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={getKindBadgeVariant(a.kind)}>
                      {KIND_LABELS[a.kind] || a.kind}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {SOURCE_LABELS[a.source] || a.source}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-[120px] truncate">
                    {a.mimeType || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatBytes(a.sizeBytes)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDimensions(a.width, a.height)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {a.owner ? (
                      <span>
                        <span className="font-medium">{a.owner.displayName}</span>
                        <span className="text-muted-foreground ml-1">@{a.owner.username}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(a.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(a.id)}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('page', String(page));
            return (
              <button
                key={page}
                type="button"
                onClick={() => router.push(`/admin/media?${params.toString()}`)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        显示 {assets.length} / {pagination.total} 个资源
      </p>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              此操作将永久删除该媒体资源，无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
