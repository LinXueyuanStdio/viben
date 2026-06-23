import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { MessageSquare, Star, ThumbsUp, Share2, Bell } from 'lucide-react';
import {
  canReadPage,
  ensureCommunityEntityForPage,
  getPublishedPageContext,
  recordPageView,
} from '@/lib/services/community';
import { decryptSession } from '@/lib/auth/jwe';

interface ReadPageProps {
  params: Promise<{ user_slug: string; page_id: string }>;
}

const iframeSandbox = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';

export const dynamic = 'force-dynamic';

export default async function ReadPage({ params }: ReadPageProps) {
  const { user_slug: userSlug, page_id: pageId } = await params;
  const context = await getPublishedPageContext(userSlug, pageId);
  const session = await getOptionalSessionFromHeaders();

  if (!context || !canReadPage(context.page, session)) {
    notFound();
  }

  const communityEntity = await ensureCommunityEntityForPage(context);
  await recordPageView({
    context,
    session,
    source: 'read_shell',
    route: '/read',
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-6">
          <nav className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Community</Link>
            <span className="px-2">/</span>
            <Link href={`/page/${encodeURIComponent(context.author.userSlug)}`} className="hover:text-foreground">
              {context.author.userSlug}
            </Link>
          </nav>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-normal">{context.page.title}</h1>
              {context.page.description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {context.page.description}
                </p>
              ) : null}
              <p className="mt-3 text-sm text-muted-foreground">
                by <Link href={`/page/${encodeURIComponent(context.author.userSlug)}`} className="text-foreground hover:underline">{context.author.displayName}</Link>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/api/read/${encodeURIComponent(context.author.userSlug)}/${encodeURIComponent(context.page.uid)}/subscription`} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <Bell className="h-4 w-4" />
                Subscribe
              </Link>
              <Link href={`/page/${encodeURIComponent(context.author.userSlug)}/${encodeURIComponent(context.page.uid)}`} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                HTML
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{context.page.viewCount + 1} views</span>
            <span>{context.page.readCount + 1} reads</span>
            <span>{context.page.likeCount} likes</span>
            <span>{context.page.favoriteCount} favorites</span>
            <span>{context.page.commentCount} comments</span>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 py-6 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <iframe
            title={context.page.title}
            srcDoc={context.page.html}
            sandbox={iframeSandbox}
            className="h-[72vh] w-full border-0 bg-background"
          />
        </div>
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Interactions</h2>
            <div className="mt-4 grid gap-2">
              <button className="inline-flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2"><ThumbsUp className="h-4 w-4" /> Like</span>
                <span>{communityEntity.reactionsCount}</span>
              </button>
              <button className="inline-flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2"><Star className="h-4 w-4" /> Favorite</span>
                <span>{communityEntity.favoritesCount}</span>
              </button>
              <button className="inline-flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comments</span>
                <span>{communityEntity.commentsCount}</span>
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

async function getOptionalSessionFromHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  return decryptSession(token);
}
