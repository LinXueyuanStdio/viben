import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import {
  canReadPage,
  ensureCommunityEntityForPage,
  getCommunitySummary,
  getPublishedPageContext,
  recordPageView,
} from '@/lib/services/community';
import { decryptSession } from '@/lib/auth/jwe';
import { CommunityInteractions } from '@/components/community/community-interactions';

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
  const communitySummary =
    (await getCommunitySummary('published_page', context.page.id, session)) ?? {
      entity: {
        id: communityEntity.id,
        entity_type: 'published_page' as const,
        entity_id: context.page.id,
        visibility: communityEntity.visibility,
        status: communityEntity.status,
        reactions_count: communityEntity.reactionsCount,
        favorites_count: communityEntity.favoritesCount,
        comments_count: communityEntity.commentsCount,
        canonical_path: communityEntity.canonicalPath,
      },
      viewer: {
        is_authenticated: Boolean(session),
        has_reacted: false,
        has_favorited: false,
        can_comment: Boolean(session),
        can_moderate:
          session?.role === 'admin' ||
          session?.role === 'super_admin' ||
          session?.role === 'moderator',
      },
    };
  const viewer = {
    ...communitySummary.viewer,
    user_id: session?.userId ?? null,
    can_manage_comments:
      Boolean(session) &&
      (session?.userId === context.page.userId ||
        session?.role === 'admin' ||
        session?.role === 'super_admin' ||
        session?.role === 'moderator'),
  };
  after(async () => {
    try {
      await recordPageView({
        context,
        session,
        source: 'read_shell',
        route: '/read',
      });
    } catch (error) {
      console.error('Failed to record read_shell page view:', error);
    }
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
              <Link href={`/page/${encodeURIComponent(context.author.userSlug)}/${encodeURIComponent(context.page.uid)}`} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                HTML
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{context.page.viewCount + 1} views</span>
            <span>{context.page.readCount + 1} reads</span>
            <span>{communitySummary.entity.reactions_count} likes</span>
            <span>{communitySummary.entity.favorites_count} favorites</span>
            <span>{communitySummary.entity.comments_count} comments</span>
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
          <CommunityInteractions
            key={context.page.id}
            entityType="published_page"
            entityId={context.page.id}
            userSlug={context.author.userSlug}
            pageId={context.page.uid}
            pageTitle={context.page.title}
            initialSummary={communitySummary}
            viewer={viewer}
          />
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
