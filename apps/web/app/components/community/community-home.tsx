import Link from 'next/link';
import { ArrowUpRight, Bell, Compass, History, MessageSquare, Sparkles } from 'lucide-react';
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
    favorite_count?: number;
    comment_count?: number;
  };
};

function asHomeItem(value: unknown): HomeItem | null {
  if (!value || typeof value !== 'object') return null;
  return value as HomeItem;
}

export async function CommunityHome() {
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
              Community
            </div>
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">Discover published work</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Browse public pages, follow creators, subscribe to updates, and join the new Viben community surface.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link href="/moment" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
              <MessageSquare className="h-4 w-4" />
              Moment
            </Link>
            <Link href="/leaderboard" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
              <Sparkles className="h-4 w-4" />
              Leaderboard
            </Link>
            <Link href="/subscription" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
              <Bell className="h-4 w-4" />
              Subscriptions
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 py-8 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-normal">Latest public pages</h2>
            {config.fallback_used ? (
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">fallback</span>
            ) : null}
          </div>
          {items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
              No public pages are available yet.
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
                      <p className="text-xs uppercase text-muted-foreground">{item.item_type ?? 'page'}</p>
                      <h3 className="mt-1 line-clamp-2 text-lg font-semibold tracking-normal">{item.title}</h3>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                  </div>
                  {item.description ? (
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{item.stats?.view_count ?? 0} views</span>
                    <span>{item.stats?.comment_count ?? 0} comments</span>
                    <span>{item.stats?.favorite_count ?? 0} favorites</span>
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
              Recently browsed
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your signed-in reading history is available through the community history API.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Marketing page</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Product marketing now lives at <Link href="/landing" className="text-primary hover:underline">/landing</Link>.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
