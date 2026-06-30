import { revalidatePath } from 'next/cache';
import { db, reports, users } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';

export const metadata = {
  title: '举报管理',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  mcp: 'MCP',
  skill: '技能',
  comment: '评论',
  collection: '合集',
  user: '用户',
  published_page: '页面',
};

const REASON_LABELS: Record<string, string> = {
  spam: '垃圾信息',
  inappropriate: '不当内容',
  copyright: '版权问题',
  security: '安全问题',
  other: '其他',
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: '待处理', variant: 'default' },
  resolved: { label: '已处理', variant: 'secondary' },
  dismissed: { label: '已驳回', variant: 'outline' },
};

async function resolveReport(formData: FormData) {
  'use server';
  const id = formData.get('id') as string;
  if (!id) return;

  await db
    .update(reports)
    .set({
      status: 'resolved',
      resolvedAt: new Date(),
    })
    .where(eq(reports.id, id));

  revalidatePath('/admin/reports');
}

async function dismissReport(formData: FormData) {
  'use server';
  const id = formData.get('id') as string;
  if (!id) return;

  await db
    .update(reports)
    .set({
      status: 'dismissed',
      resolvedAt: new Date(),
    })
    .where(eq(reports.id, id));

  revalidatePath('/admin/reports');
}

interface ReportsPageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const currentStatus = params.status || 'pending';
  const currentPage = Math.max(1, Number(params.page) || 1);
  const limit = 20;
  const offset = (currentPage - 1) * limit;

  const whereCondition =
    currentStatus === 'all'
      ? undefined
      : eq(reports.status, currentStatus as 'pending' | 'resolved' | 'dismissed');

  const [reportRows, totalResult] = await Promise.all([
    db
      .select({
        id: reports.id,
        entityType: reports.entityType,
        entityId: reports.entityId,
        reason: reports.reason,
        description: reports.description,
        status: reports.status,
        createdAt: reports.createdAt,
        resolvedAt: reports.resolvedAt,
        reporterId: reports.reporterId,
        reporterName: users.username,
      })
      .from(reports)
      .leftJoin(users, eq(users.id, reports.reporterId))
      .where(whereCondition)
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: reports.id })
      .from(reports)
      .where(whereCondition),
  ]);

  const total = totalResult.length;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">举报管理</h1>
          <p className="text-muted-foreground">查看和处理用户举报</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin/reports?status=pending"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentStatus === 'pending'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            待处理
          </a>
          <a
            href="/admin/reports?status=resolved"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentStatus === 'resolved'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            已处理
          </a>
          <a
            href="/admin/reports?status=dismissed"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentStatus === 'dismissed'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            已驳回
          </a>
          <a
            href="/admin/reports?status=all"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentStatus === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            全部
          </a>
        </div>
      </div>

      {/* Reports List */}
      {reportRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">暂无举报</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {currentStatus === 'pending' ? '没有待处理的举报' : '没有符合条件的举报'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">举报人</th>
                <th className="px-4 py-3 text-left text-sm font-medium">实体类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">实体ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium">原因</th>
                <th className="px-4 py-3 text-left text-sm font-medium">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((report) => {
                const statusConf = STATUS_CONFIG[report.status ?? 'pending'] || STATUS_CONFIG.pending;
                return (
                  <tr key={report.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">{report.reporterName || '未知'}</td>
                    <td className="px-4 py-3 text-sm">
                      {ENTITY_TYPE_LABELS[report.entityType] || report.entityType}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-xs max-w-[120px] truncate">
                      {report.entityId.slice(0, 12)}...
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {REASON_LABELS[report.reason] || report.reason}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[200px] truncate">
                      {report.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(report.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {report.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <form action={resolveReport}>
                            <input type="hidden" name="id" value={report.id} />
                            <Button type="submit" variant="outline" size="sm">
                              处理
                            </Button>
                          </form>
                          <form action={dismissReport}>
                            <input type="hidden" name="id" value={report.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              驳回
                            </Button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <a
              key={page}
              href={`/admin/reports?status=${currentStatus}&page=${page}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                page === currentPage
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {page}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
