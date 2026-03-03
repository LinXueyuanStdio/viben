/**
 * Kanban Module
 * 看板评论/活动模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { KanbanComment, KanbanActivity } from "../types";

// ============================================================================
// Kanban Comments
// ============================================================================

/**
 * Get all comments for a kanban task
 */
export async function getKanbanComments(
  baseUrl: string,
  taskId: string
): Promise<KanbanComment[]> {
  const response = await fetch(
    `${baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/comments`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get kanban comments: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Add a comment to a kanban task
 */
export async function addKanbanComment(
  baseUrl: string,
  taskId: string,
  content: string,
  authorId: string,
  authorName: string,
  authorAvatar?: string
): Promise<KanbanComment> {
  const response = await fetch(
    `${baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/comments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        content,
        author_id: authorId,
        author_name: authorName,
        author_avatar: authorAvatar,
      }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to add kanban comment: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update a kanban comment
 */
export async function updateKanbanComment(
  baseUrl: string,
  taskId: string,
  commentId: string,
  content: string
): Promise<KanbanComment> {
  const response = await fetch(
    `${baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ content }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to update kanban comment: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete a kanban comment
 */
export async function deleteKanbanComment(
  baseUrl: string,
  taskId: string,
  commentId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete kanban comment: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Toggle a reaction on a kanban comment
 */
export async function toggleCommentReaction(
  baseUrl: string,
  taskId: string,
  commentId: string,
  emoji: string,
  userId: string,
  userName: string
): Promise<KanbanComment> {
  const response = await fetch(
    `${baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}/reactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        emoji,
        user_id: userId,
        user_name: userName,
      }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to toggle comment reaction: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// Kanban Activities
// ============================================================================

/**
 * Get all activities for a kanban task
 */
export async function getKanbanActivities(
  baseUrl: string,
  taskId: string
): Promise<KanbanActivity[]> {
  const response = await fetch(
    `${baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/activities`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get kanban activities: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Add an activity to a kanban task
 */
export async function addKanbanActivity(
  baseUrl: string,
  taskId: string,
  activityType: string,
  actorId: string,
  actorName: string,
  actorAvatar?: string,
  oldValue?: string,
  newValue?: string
): Promise<KanbanActivity> {
  const response = await fetch(
    `${baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/activities`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        activity_type: activityType,
        actor_id: actorId,
        actor_name: actorName,
        actor_avatar: actorAvatar,
        old_value: oldValue,
        new_value: newValue,
      }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to add kanban activity: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Clear all comments and activities for a kanban task
 */
export async function clearKanbanTaskData(
  baseUrl: string,
  taskId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/data`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to clear kanban task data: ${errorMessage}`,
      response.status
    );
  }
}
