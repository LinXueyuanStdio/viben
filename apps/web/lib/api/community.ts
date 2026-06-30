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

export async function toggleReaction(momentId: string): Promise<ToggleReactionResult> {
  return postCommunityApi("/api/community/reactions/toggle", {
    entity_type: "moment",
    entity_id: momentId,
    reaction_type: "like",
  }) as Promise<ToggleReactionResult>
}

export interface ToggleBookmarkResult {
  has_bookmarked: boolean
  bookmarks_count: number
}

export async function toggleBookmark(momentId: string): Promise<ToggleBookmarkResult> {
  return postCommunityApi("/api/community/bookmarks/toggle", {
    entity_type: "moment",
    entity_id: momentId,
  }) as Promise<ToggleBookmarkResult>
}
