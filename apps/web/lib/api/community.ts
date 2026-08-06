async function postCommunityApi(
  url: string,
  body: Record<string, string>,
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (res.status === 401) throw new Error("login_required")
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.code ?? "api_error")
  }
  return res.json()
}

export interface ToggleReactionResult {
  has_reacted: boolean
  reactions_count: number
}

export async function toggleReaction(params: {
  entityType: "moment" | "published_page" | "comment"
  entityId: string
}): Promise<ToggleReactionResult> {
  return postCommunityApi("/api/community/reactions/toggle", {
    entity_type: params.entityType,
    entity_id: params.entityId,
    reaction_type: "like",
  }) as Promise<ToggleReactionResult>
}

export interface ToggleBookmarkResult {
  has_bookmarked: boolean
  bookmarks_count: number
}

export async function toggleBookmark(params: {
  entityType: "moment" | "published_page"
  entityId: string
}): Promise<ToggleBookmarkResult> {
  return postCommunityApi("/api/community/bookmarks/toggle", {
    entity_type: params.entityType,
    entity_id: params.entityId,
  }) as Promise<ToggleBookmarkResult>
}

export interface CreateCommentResult {
  comment: {
    id: string
    content: string
    status: string
    depth: number
    parent_comment_id: string | null
    created_at: string
  }
}

export async function createComment(params: {
  entityType: "moment" | "published_page" | "project"
  entityId: string
  content: string
  parentCommentId?: string | null
}): Promise<CreateCommentResult> {
  const body: Record<string, string> = {
    entity_type: params.entityType,
    entity_id: params.entityId,
    parent_comment_id: params.parentCommentId || "",
    content: params.content,
  }
  return postCommunityApi("/api/community/comments", body) as Promise<CreateCommentResult>
}
