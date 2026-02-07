/**
 * React Query hooks for kanban comments
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { Comment, CommentReaction } from "@viben/kanban";

// Types matching Rust backend
export interface KanbanComment extends Comment {
  task_id: string;
}

// Query keys
export const kanbanCommentsKeys = {
  all: ["kanban-comments"] as const,
  comments: (taskId: string) => [...kanbanCommentsKeys.all, "comments", taskId] as const,
};

/**
 * Fetch all comments for a task
 */
export function useKanbanComments(taskId: string | null) {
  return useQuery({
    queryKey: kanbanCommentsKeys.comments(taskId || ""),
    queryFn: async () => {
      if (!taskId) return [];
      const comments = await invoke<KanbanComment[]>("get_kanban_comments", { taskId });
      return comments;
    },
    enabled: !!taskId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

interface AddCommentParams {
  taskId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
}

/**
 * Add a new comment to a task
 */
export function useAddKanbanComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, content, authorId, authorName, authorAvatar }: AddCommentParams) => {
      const comment = await invoke<KanbanComment>("add_kanban_comment", {
        taskId,
        content,
        authorId,
        authorName,
        authorAvatar,
      });
      return comment;
    },
    onSuccess: (newComment) => {
      // Invalidate and refetch comments
      queryClient.invalidateQueries({
        queryKey: kanbanCommentsKeys.comments(newComment.task_id),
      });
    },
  });
}

interface UpdateCommentParams {
  taskId: string;
  commentId: string;
  content: string;
}

/**
 * Update an existing comment
 */
export function useUpdateKanbanComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, commentId, content }: UpdateCommentParams) => {
      const comment = await invoke<KanbanComment>("update_kanban_comment", {
        taskId,
        commentId,
        content,
      });
      return comment;
    },
    onMutate: async ({ taskId, commentId, content }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: kanbanCommentsKeys.comments(taskId),
      });

      // Snapshot previous value
      const previousComments = queryClient.getQueryData<KanbanComment[]>(
        kanbanCommentsKeys.comments(taskId)
      );

      // Optimistically update
      if (previousComments) {
        queryClient.setQueryData<KanbanComment[]>(
          kanbanCommentsKeys.comments(taskId),
          previousComments.map((c) =>
            c.id === commentId
              ? { ...c, content, updatedAt: new Date().toISOString() }
              : c
          )
        );
      }

      return { previousComments, taskId };
    },
    onError: (
      _err: unknown,
      { taskId }: UpdateCommentParams,
      context: { previousComments?: KanbanComment[]; taskId: string } | undefined
    ) => {
      // Rollback on error
      if (context?.previousComments) {
        queryClient.setQueryData(
          kanbanCommentsKeys.comments(taskId),
          context.previousComments
        );
      }
    },
    onSettled: (
      _data: KanbanComment | undefined,
      _error: unknown,
      { taskId }: UpdateCommentParams
    ) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: kanbanCommentsKeys.comments(taskId),
      });
    },
  });
}

interface DeleteCommentParams {
  taskId: string;
  commentId: string;
}

/**
 * Delete a comment
 */
export function useDeleteKanbanComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, commentId }: DeleteCommentParams) => {
      await invoke("delete_kanban_comment", { taskId, commentId });
      return { taskId, commentId };
    },
    onMutate: async ({ taskId, commentId }) => {
      await queryClient.cancelQueries({
        queryKey: kanbanCommentsKeys.comments(taskId),
      });

      const previousComments = queryClient.getQueryData<KanbanComment[]>(
        kanbanCommentsKeys.comments(taskId)
      );

      if (previousComments) {
        queryClient.setQueryData<KanbanComment[]>(
          kanbanCommentsKeys.comments(taskId),
          previousComments.filter((c) => c.id !== commentId)
        );
      }

      return { previousComments, taskId };
    },
    onError: (
      _err: unknown,
      { taskId }: DeleteCommentParams,
      context: { previousComments?: KanbanComment[]; taskId: string } | undefined
    ) => {
      if (context?.previousComments) {
        queryClient.setQueryData(
          kanbanCommentsKeys.comments(taskId),
          context.previousComments
        );
      }
    },
    onSettled: (
      _data: { taskId: string; commentId: string } | undefined,
      _error: unknown,
      { taskId }: DeleteCommentParams
    ) => {
      queryClient.invalidateQueries({
        queryKey: kanbanCommentsKeys.comments(taskId),
      });
    },
  });
}

interface ToggleReactionParams {
  taskId: string;
  commentId: string;
  emoji: string;
  userId: string;
  userName: string;
}

/**
 * Toggle a reaction on a comment
 */
export function useToggleCommentReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, commentId, emoji, userId, userName }: ToggleReactionParams) => {
      const comment = await invoke<KanbanComment>("toggle_comment_reaction", {
        taskId,
        commentId,
        emoji,
        userId,
        userName,
      });
      return comment;
    },
    onMutate: async ({ taskId, commentId, emoji, userId, userName }) => {
      await queryClient.cancelQueries({
        queryKey: kanbanCommentsKeys.comments(taskId),
      });

      const previousComments = queryClient.getQueryData<KanbanComment[]>(
        kanbanCommentsKeys.comments(taskId)
      );

      if (previousComments) {
        queryClient.setQueryData<KanbanComment[]>(
          kanbanCommentsKeys.comments(taskId),
          previousComments.map((c) => {
            if (c.id !== commentId) return c;

            const existingReaction = c.reactions.find(
              (r: CommentReaction) => r.emoji === emoji && r.users.some((u) => u.id === userId)
            );

            if (existingReaction) {
              // Remove user from reaction
              const updatedReactions = c.reactions
                .map((r: CommentReaction) =>
                  r.emoji === emoji
                    ? {
                        ...r,
                        count: r.count - 1,
                        users: r.users.filter((u) => u.id !== userId),
                      }
                    : r
                )
                .filter((r: CommentReaction) => r.count > 0);
              return { ...c, reactions: updatedReactions };
            } else {
              // Add user to reaction
              const existingEmoji = c.reactions.find((r: CommentReaction) => r.emoji === emoji);
              if (existingEmoji) {
                return {
                  ...c,
                  reactions: c.reactions.map((r: CommentReaction) =>
                    r.emoji === emoji
                      ? {
                          ...r,
                          count: r.count + 1,
                          users: [...r.users, { id: userId, name: userName }],
                        }
                      : r
                  ),
                };
              } else {
                return {
                  ...c,
                  reactions: [
                    ...c.reactions,
                    {
                      emoji,
                      count: 1,
                      users: [{ id: userId, name: userName }],
                    },
                  ],
                };
              }
            }
          })
        );
      }

      return { previousComments, taskId };
    },
    onError: (
      _err: unknown,
      { taskId }: ToggleReactionParams,
      context: { previousComments?: KanbanComment[]; taskId: string } | undefined
    ) => {
      if (context?.previousComments) {
        queryClient.setQueryData(
          kanbanCommentsKeys.comments(taskId),
          context.previousComments
        );
      }
    },
    onSettled: (
      _data: KanbanComment | undefined,
      _error: unknown,
      { taskId }: ToggleReactionParams
    ) => {
      queryClient.invalidateQueries({
        queryKey: kanbanCommentsKeys.comments(taskId),
      });
    },
  });
}
