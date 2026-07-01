"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { MiniPageCardData } from "@/components/content/mini-page-card"

// ============================================================================
// Community Summary
// ============================================================================
export interface CommunitySummary {
  entity_id: string
  reactions_count: number
  bookmarks_count: number
  comments_count: number
  shares_count: number
  viewer: {
    has_reacted: boolean
    has_bookmarked: boolean
  }
}

async function fetchCommunitySummary(entityType: string, entityId: string) {
  const params = new URLSearchParams({ entity_type: entityType, entity_id: entityId })
  const res = await fetch(`/api/community/entities/summary?${params}`)
  if (!res.ok) throw new Error("Failed to fetch community summary")
  return res.json() as Promise<CommunitySummary>
}

export function useCommunitySummary(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["community-summary", entityType, entityId],
    queryFn: () => fetchCommunitySummary(entityType, entityId),
    staleTime: 10_000,
  })
}

export function usePrefetchCommunitySummary() {
  const queryClient = useQueryClient()
  return (entityType: string, entityId: string) => {
    queryClient.prefetchQuery({
      queryKey: ["community-summary", entityType, entityId],
      queryFn: () => fetchCommunitySummary(entityType, entityId),
    })
  }
}

// ============================================================================
// Comments
// ============================================================================
export interface PageComment {
  id: string
  content: string
  created_at: string
  updated_at: string
  depth: number
  parent_comment_id?: string | null
  replies_count: number
  reactions_count: number
  viewer_has_reacted: boolean
  author: {
    id: string
    user_slug: string
    display_name: string
    avatar_url: string | null
  }
}

interface CommentsResponse {
  comments: PageComment[]
  next_cursor: string | null
}

async function fetchComments(entityType: string, entityId: string, cursor?: string | null) {
  const params = new URLSearchParams({
    entity_type: entityType,
    entity_id: entityId,
    limit: "20",
  })
  if (cursor) params.set("cursor", cursor)
  const res = await fetch(`/api/community/comments?${params}`)
  if (!res.ok) throw new Error("Failed to fetch comments")
  return res.json() as Promise<CommentsResponse>
}

export function useComments(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["comments", entityType, entityId],
    queryFn: () => fetchComments(entityType, entityId),
    staleTime: 10_000,
  })
}

export function usePrefetchComments() {
  const queryClient = useQueryClient()
  return (entityType: string, entityId: string) => {
    queryClient.prefetchQuery({
      queryKey: ["comments", entityType, entityId],
      queryFn: () => fetchComments(entityType, entityId),
    })
  }
}

// ============================================================================
// Recommendations
// ============================================================================
interface RecommendationEntry {
  data: MiniPageCardData
  href: string
}

async function fetchRecommendations(pageId: string, categoryId?: string | null, authorId?: string) {
  const params = new URLSearchParams({ page_id: pageId })
  if (categoryId) params.set("category_id", categoryId)
  if (authorId) params.set("author_id", authorId)
  const res = await fetch(`/api/pages/recommendations?${params}`)
  if (!res.ok) return [] as RecommendationEntry[]
  return res.json() as Promise<RecommendationEntry[]>
}

export function useRecommendations(pageId: string, categoryId?: string | null, authorId?: string) {
  return useQuery({
    queryKey: ["recommendations", pageId],
    queryFn: () => fetchRecommendations(pageId, categoryId, authorId),
    staleTime: 60_000,
  })
}

export function usePrefetchRecommendations() {
  const queryClient = useQueryClient()
  return (pageId: string) => {
    queryClient.prefetchQuery({
      queryKey: ["recommendations", pageId],
      queryFn: () => fetchRecommendations(pageId),
    })
  }
}
