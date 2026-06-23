import Link from 'next/link';
import { MessageSquarePlus } from 'lucide-react';
import { listMoments } from '@/lib/services/community';

export const dynamic = 'force-dynamic';

export default async function MomentPage() {
  const feed = await listMoments({ feedType: 'latest', session: null, limit: 30 });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <p className="mb-3 text-sm text-muted-foreground">Community</p>
          <h1 className="text-3xl font-semibold tracking-normal">Moment</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Creator updates, short notes, reposts, and page update activity.
          </p>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-6 py-6">
        <div className="mb-5 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquarePlus className="h-4 w-4" />
            Share an update
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Posting is available through <code className="rounded bg-muted px-1">POST /api/moments</code>.
          </p>
        </div>
        <div className="space-y-4">
          {feed.items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
              No public moments yet.
            </div>
          ) : (
            feed.items.map((item) => (
              <article key={item.moment.uid} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/page/${item.author.user_slug}`} className="font-medium hover:underline">
                    {item.author.display_name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{item.moment.created_at}</span>
                </div>
                {item.moment.body ? <p className="mt-3 text-sm leading-6">{item.moment.body}</p> : null}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
