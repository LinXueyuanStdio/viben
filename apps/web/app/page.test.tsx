import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getHomePageData: vi.fn(),
  getHomeTopAuthors: vi.fn(),
  sidebarProps: {} as { authorCards?: unknown[]; rankingPages?: unknown[] },
}));

vi.mock('@/lib/auth/cookies', () => ({
  getSession: mocks.getSession,
}));

vi.mock('@/lib/services/community', () => ({
  getHomePageData: mocks.getHomePageData,
  getHomeTopAuthors: mocks.getHomeTopAuthors,
}));

vi.mock('@/lib/services/moment-mapper', () => ({
  timeAgo: () => 'recently',
}));

vi.mock('@/lib/metadata', () => ({
  APP_URL: 'https://viben.app',
  makeOG: (data: unknown) => data,
  makeTwitter: (data: unknown) => data,
}));

vi.mock('@/components/content/hero-carousel', () => ({
  HeroCarousel: ({ slides }: { slides: unknown[] }) => (
    <div data-testid="hero-carousel">slides:{slides.length}</div>
  ),
}));

vi.mock('@/components/content/page-card', () => ({
  PageCard: ({ data }: { data: { title: string } }) => (
    <a data-testid="page-card">{data.title}</a>
  ),
}));

vi.mock('@/components/content/section-head', () => ({
  SectionHead: ({ title }: { title: string }) => <h2>{title}</h2>,
}));

vi.mock('@/components/content/recommended-section', () => ({
  RecommendedSection: () => <section data-testid="recommended-section" />,
}));

vi.mock('@/components/content/i18n-text', () => ({
  T: ({ fallback }: { fallback?: string }) => <>{fallback ?? ''}</>,
}));

vi.mock('@/components/home/home-feed-section', () => ({
  HomeFeedSection: () => <div data-testid="home-feed-section" />,
}));

vi.mock('@/components/home/home-sidebar-section', () => ({
  HomeSidebarSection: (props: { authorCards?: unknown[]; rankingPages?: unknown[] }) => {
    mocks.sidebarProps = props;
    return <aside data-testid="home-sidebar-section" />;
  },
}));

vi.mock('@/components/shared/skeletons', () => ({
  FeedSkeleton: () => <div data-testid="feed-skeleton" />,
}));

vi.mock('@/components/layout/footer', () => ({
  Footer: () => <footer data-testid="footer" />,
}));

import HomePage from './(dashboard)/page';

function makeRankingItem(overrides: Record<string, unknown> = {}) {
  return {
    cover_url: 'https://example.com/cover.png',
    title: 'Featured page',
    description: 'Featured description',
    read_url: '/alice/featured?tab=read',
    view_count: 10,
    like_count: 5,
    comment_count: 2,
    user_slug: 'alice',
    page_id: 'featured',
    last_published_at: new Date('2026-08-12T00:00:00.000Z'),
    published_at: new Date('2026-08-12T00:00:00.000Z'),
    author_display_name: 'Alice',
    author_avatar_url: null,
    ...overrides,
  };
}

function makeLatestPage(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'latest',
    title: 'Latest page',
    coverUrl: null,
    authorDisplayName: 'Bob',
    authorAvatarUrl: null,
    authorSlug: 'bob',
    lastPublishedAt: new Date('2026-08-12T00:00:00.000Z'),
    viewCount: 1,
    likeCount: 0,
    commentCount: 0,
    ...overrides,
  };
}

describe('Root home page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sidebarProps = {};
    mocks.getSession.mockResolvedValue(null);
    mocks.getHomePageData.mockResolvedValue({ rankingItems: [], latestPages: [] });
    mocks.getHomeTopAuthors.mockResolvedValue([]);
  });

  it('renders the community homepage sections when data is available', async () => {
    mocks.getHomePageData.mockResolvedValue({
      rankingItems: [makeRankingItem()],
      latestPages: [makeLatestPage()],
    });

    render(await HomePage());

    expect(screen.getByTestId('hero-carousel')).toHaveTextContent('slides:1');
    expect(screen.getByTestId('recommended-section')).toBeInTheDocument();
    expect(screen.getByTestId('home-feed-section')).toBeInTheDocument();
    expect(screen.getByTestId('home-sidebar-section')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('filters the current user out of the top authors sidebar', async () => {
    mocks.getSession.mockResolvedValue({ userId: 'user-1' });
    mocks.getHomeTopAuthors.mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
      { id: 'user-3' },
    ]);

    render(await HomePage());

    expect(mocks.sidebarProps.authorCards).toEqual([
      { id: 'user-2' },
      { id: 'user-3' },
    ]);
  });
});
