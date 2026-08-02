import Link from 'next/link';
import { ArrowUpRight, Bell, Compass, History, MessageSquare, Sparkles } from 'lucide-react';
import { HeaderAuthButtons } from '@/components/layout/header-auth-buttons';
import { UserMenu } from '@/components/layout/user-menu';
import type { Session } from '@/lib/auth/types';
import { getHomeConfig } from '@/lib/services/community';

type HomeItem = {
  item_type?: string;
  title?: string;
  description?: string | null;
  target_url?: string;
  user_slug?: string;
  page_id?: string;
  stats?: {
    view_count?: number;
    read_count?: number;
    like_count?: number;
    bookmark_count?: number;
    comment_count?: number;
  };
};

function asHomeItem(value: unknown): HomeItem | null {
  if (!value || typeof value !== 'object') return null;
  return value as HomeItem;
}

type CommunityHomeProps = {
  session: Session | null;
};

export async function CommunityHome({ session }: CommunityHomeProps) {
  const config = await getHomeConfig('web_home', 'default');
  const firstSlot = config.slots[0] as { items?: unknown[] } | undefined;
  const items = (firstSlot?.items ?? []).map(asHomeItem).filter((item): item is HomeItem => Boolean(item));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1 text-sm text-muted-foreground">
              <Compass className="h-4 w-4" />
              社区
            </div>
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">发现已发布的作品</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              浏览公开页面，关注创作者，订阅更新，加入全新的 Viben 社区。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <nav className="flex flex-wrap gap-2">
              <Link href="/moment" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                <MessageSquare className="h-4 w-4" />
                动态
              </Link>
              <Link href="/leaderboard" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                <Sparkles className="h-4 w-4" />
                排行榜
              </Link>
              <Link href="/subscription" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                <Bell className="h-4 w-4" />
                订阅
              </Link>
            </nav>
            <div className="flex items-center gap-2 border-l border-border pl-2">
              {session ? (
                <>
                  <span className="hidden max-w-44 truncate text-sm text-muted-foreground sm:inline">
                    已登录：{session.username}
                  </span>
                  <UserMenu session={session} />
                </>
              ) : (
                <HeaderAuthButtons />
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 py-8 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-normal">最新公开页面</h2>
            {config.fallback_used ? (
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">fallback</span>
            ) : null}
          </div>
          {items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
              暂无公开页面。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((item) => (
                <Link
                  key={`${item.user_slug}-${item.page_id}`}
                  href={item.target_url ?? '#'}
                  className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">{item.item_type ?? '页面'}</p>
                      <h3 className="mt-1 line-clamp-2 text-lg font-semibold tracking-normal">{item.title}</h3>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                  </div>
                  {item.description ? (
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{item.stats?.view_count ?? 0} 次浏览</span>
                    <span>{item.stats?.comment_count ?? 0} 条评论</span>
                    <span>{item.stats?.bookmark_count ?? 0} 次收藏</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4" />
              最近浏览
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              您的登录阅读历史可通过社区历史 API 获取。
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">营销页面</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              产品营销页面现位于 <Link href="/home" className="text-primary hover:underline">/home</Link>。
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
