import Link from 'next/link';
import { db, publishedPages } from '@/lib/db';
import { and, eq, sql } from 'drizzle-orm';
import { SectionHead } from '@/components/content/section-head';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata = {
  title: '标签',
  description: '浏览 Viben 上的所有标签',
  alternates: {
    canonical: `${APP_URL}/tags`,
  },
  openGraph: {
    title: '标签',
    description: '浏览 Viben 上的所有标签',
    url: `${APP_URL}/tags`,
    type: "website",
  },
};

export default async function TagsPage() {
  const result = await db.execute(sql`
    SELECT DISTINCT tag, COUNT(*) as cnt
    FROM published_pages, jsonb_array_elements_text(tags) as tag
    WHERE visibility = 'public' AND moderation_status = 'approved'
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 200
  `);

  const tags = (result.rows as { tag: string; cnt: number }[]).filter(
    (r) => r.tag?.trim()
  );

  return (
    <div className="grid gap-3">
      <SectionHead title="标签" />
      {tags.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          暂无标签
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag.tag}
              href={`/tags/${encodeURIComponent(tag.tag)}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
            >
              {tag.tag}
              <span className="text-xs opacity-60">{tag.cnt}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
