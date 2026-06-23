import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { listRanking } from '@/lib/services/community';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const ranking = await listRanking({ rankingKey: 'pages_hot', timeWindow: '7d', limit: 50 });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4" />
            pages_hot · 7d
          </div>
          <h1 className="text-3xl font-semibold tracking-normal">Leaderboard</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Stable ranking snapshots power this page. If no ready snapshot exists, the API returns an empty diagnostic response instead of scanning large tables.
          </p>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-6">
        {ranking.items.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
            No ready ranking snapshot yet.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {ranking.items.map((item) => (
              <Link key={item.entity_id} href={item.read_url} className="flex items-center gap-4 p-4 hover:bg-accent">
                <span className="w-8 text-lg font-semibold">{item.rank}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-medium">{item.title}</h2>
                  <p className="truncate text-sm text-muted-foreground">{item.description}</p>
                </div>
                <span className="text-sm text-muted-foreground">{Math.round(item.score)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
