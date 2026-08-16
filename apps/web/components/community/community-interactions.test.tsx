import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { CommunityInteractions } from './community-interactions';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const fetchMock = vi.fn();

const baseSummary = {
  entity: {
    id: 'entity-1',
    entity_type: 'published_page' as const,
    entity_id: 'page-row-1',
    visibility: 'public',
    status: 'active',
    reactions_count: 2,
    bookmarks_count: 1,
    comments_count: 3,
    canonical_path: '/alice/demo?tab=read',
  },
  viewer: {
    is_authenticated: true,
    has_reacted: false,
    has_bookmarked: false,
    can_comment: true,
    can_moderate: false,
  },
};

function renderInteractions(
  overrides: Partial<React.ComponentProps<typeof CommunityInteractions>> = {}
) {
  return render(
    <CommunityInteractions
      entityType="published_page"
      entityId="page-row-1"
      userSlug="alice"
      pageId="demo"
      pageTitle="Demo page"
      initialSummary={baseSummary}
      viewer={baseSummary.viewer}
      {...overrides}
    />
  );
}

describe('CommunityInteractions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/community/comments')) {
        return Promise.resolve(
          new Response(JSON.stringify({ comments: [], next_cursor: null }), { status: 200 })
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('toggles like and favorite with snake_case community API bodies', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/community/reactions/toggle') {
        expect(JSON.parse(String(init?.body))).toEqual({
          entity_type: 'published_page',
          entity_id: 'page-row-1',
          reaction_type: 'like',
        });
        return Promise.resolve(
          new Response(
            JSON.stringify({
              has_reacted: true,
              reaction_type: 'like',
              reactions_count: 3,
            }),
            { status: 200 }
          )
        );
      }
      if (url === '/api/community/bookmarks/toggle') {
        expect(JSON.parse(String(init?.body))).toEqual({
          entity_type: 'published_page',
          entity_id: 'page-row-1',
        });
        return Promise.resolve(
          new Response(
            JSON.stringify({
              has_bookmarked: true,
              bookmarks_count: 2,
            }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ comments: [], next_cursor: null }), { status: 200 })
      );
    });

    renderInteractions();

    fireEvent.click(screen.getByRole('button', { name: /点赞/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '点赞：3' })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /收藏/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '收藏：2' })).toBeInTheDocument()
    );
  });

  it('loads comments and submits a new comment with snake_case payload', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/community/comments') && !init) {
        expect(url).toContain('entity_type=published_page');
        expect(url).toContain('entity_id=page-row-1');
        return Promise.resolve(
          new Response(
            JSON.stringify({
              comments: [
                {
                  id: 'comment-1',
                  content: 'Useful write-up',
                  status: 'active',
                  depth: 0,
                  replies_count: 0,
                  reactions_count: 0,
                  viewer_has_reacted: false,
                  created_at: '2026-06-25T00:00:00.000Z',
                  updated_at: '2026-06-25T00:00:00.000Z',
                  author: {
                    id: 'user-2',
                    user_slug: 'bob',
                    display_name: 'Bob',
                    avatar_url: null,
                  },
                },
              ],
              next_cursor: null,
            }),
            { status: 200 }
          )
        );
      }
      if (url === '/api/community/comments') {
        expect(JSON.parse(String(init?.body))).toEqual({
          entity_type: 'published_page',
          entity_id: 'page-row-1',
          parent_comment_id: null,
          content: 'New comment',
        });
        return Promise.resolve(
          new Response(
            JSON.stringify({
              comment: {
                id: 'comment-2',
                content: 'New comment',
                status: 'active',
                depth: 0,
                parent_comment_id: null,
                created_at: '2026-06-25T00:01:00.000Z',
              },
            }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    renderInteractions();

    expect(await screen.findByText('Useful write-up')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('添加评论'), {
      target: { value: 'New comment' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发布评论' }));

    await waitFor(() => expect(screen.getByText('New comment')).toBeInTheDocument());
  });

  it('shows a login prompt for anonymous write actions without calling write APIs', async () => {
    renderInteractions({
      initialSummary: {
        ...baseSummary,
        viewer: {
          is_authenticated: false,
          has_reacted: false,
          has_bookmarked: false,
          can_comment: false,
          can_moderate: false,
        },
      },
      viewer: {
        is_authenticated: false,
        has_reacted: false,
        has_bookmarked: false,
        can_comment: false,
        can_moderate: false,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /点赞/ }));
    fireEvent.click(screen.getByRole('button', { name: /收藏/ }));
    fireEvent.focus(screen.getByLabelText('添加评论'));
    fireEvent.click(screen.getByRole('button', { name: '发布评论' }));

    expect(toast.error).toHaveBeenCalledWith('登录后才能与此页面互动。');
    expect(fetchMock).not.toHaveBeenCalledWith('/api/community/reactions/toggle', expect.anything());
    expect(fetchMock).not.toHaveBeenCalledWith('/api/community/bookmarks/toggle', expect.anything());
    expect(fetchMock).not.toHaveBeenCalledWith('/api/community/comments', expect.anything());
  });

  it('copies the read URL from the share button', async () => {
    renderInteractions();

    fireEvent.click(screen.getByRole('button', { name: /分享/ }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:3000/alice/demo?tab=read');
    });
    expect(toast.success).toHaveBeenCalledWith('链接已复制。');
  });

  it('prevents authenticated viewers without comment permission from submitting comments', () => {
    renderInteractions({
      initialSummary: {
        ...baseSummary,
        viewer: {
          is_authenticated: true,
          has_reacted: false,
          has_bookmarked: false,
          can_comment: false,
          can_moderate: false,
        },
      },
      viewer: {
        is_authenticated: true,
        has_reacted: false,
        has_bookmarked: false,
        can_comment: false,
        can_moderate: false,
      },
    });

    expect(screen.getByRole('button', { name: '发布评论' })).toBeDisabled();
    fireEvent.focus(screen.getByLabelText('添加评论'));

    expect(toast.error).toHaveBeenCalledWith('您无法在此页面评论。');
    expect(fetchMock).not.toHaveBeenCalledWith('/api/community/comments', expect.anything());
  });

  it('lets page owners delete comments after confirmation', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/community/comments') && !init) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              comments: [
                {
                  id: 'comment-1',
                  content: 'Needs moderation',
                  status: 'active',
                  depth: 0,
                  replies_count: 0,
                  reactions_count: 0,
                  viewer_has_reacted: false,
                  created_at: '2026-06-25T00:00:00.000Z',
                  updated_at: '2026-06-25T00:00:00.000Z',
                  author: {
                    id: 'user-2',
                    user_slug: 'bob',
                    display_name: 'Bob',
                    avatar_url: null,
                  },
                },
              ],
              next_cursor: null,
            }),
            { status: 200 }
          )
        );
      }
      if (url === '/api/community/comments/comment-1') {
        expect(init?.method).toBe('DELETE');
        expect(JSON.parse(String(init?.body))).toEqual({ mode: 'delete' });
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, deleted_count: 1 }), { status: 200 })
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    renderInteractions({
      initialSummary: {
        ...baseSummary,
        viewer: {
          ...baseSummary.viewer,
          user_id: 'owner-1',
          can_manage_comments: true,
        },
      },
      viewer: {
        ...baseSummary.viewer,
        user_id: 'owner-1',
        can_manage_comments: true,
      },
    });

    expect(await screen.findByText('Needs moderation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '删除评论' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/community/comments/comment-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
