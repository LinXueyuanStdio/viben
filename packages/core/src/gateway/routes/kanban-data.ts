/**
 * Kanban Data Routes
 *
 * Provides HTTP API for kanban comments and activities.
 * Data is stored in ~/.viben/kanban/ directory.
 */
import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

// ============================================================================
// Types
// ============================================================================

interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
}

interface CommentReactionUser {
  id: string;
  name: string;
}

interface CommentReaction {
  emoji: string;
  users: CommentReactionUser[];
  count: number;
}

interface KanbanComment {
  id: string;
  task_id: string;
  content: string;
  author: CommentAuthor;
  created_at: string;
  updated_at?: string;
  reactions: CommentReaction[];
}

interface CommentsStore {
  version: string;
  comments: KanbanComment[];
}

interface ActivityActor {
  id: string;
  name: string;
  avatar?: string;
}

interface ActivityData {
  old_value?: string;
  new_value?: string;
  [key: string]: unknown;
}

interface KanbanActivity {
  id: string;
  task_id: string;
  type: string;
  actor: ActivityActor;
  timestamp: string;
  data: ActivityData;
}

interface ActivitiesStore {
  version: string;
  activities: KanbanActivity[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the kanban data directory path
 */
function getKanbanDataDir(): string {
  return join(homedir(), ".viben", "kanban");
}

/**
 * Get the comments file path for a task
 */
function getCommentsFilePath(taskId: string): string {
  return join(getKanbanDataDir(), "comments", `${taskId}.json`);
}

/**
 * Get the activities file path for a task
 */
function getActivitiesFilePath(taskId: string): string {
  return join(getKanbanDataDir(), "activities", `${taskId}.json`);
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Load comments for a task
 */
async function loadComments(taskId: string): Promise<CommentsStore> {
  const filePath = getCommentsFilePath(taskId);
  if (!existsSync(filePath)) {
    return { version: "1.0", comments: [] };
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as CommentsStore;
  } catch {
    return { version: "1.0", comments: [] };
  }
}

/**
 * Save comments for a task
 */
async function saveComments(taskId: string, store: CommentsStore): Promise<void> {
  const filePath = getCommentsFilePath(taskId);
  await ensureDir(join(getKanbanDataDir(), "comments"));
  await writeFile(filePath, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Load activities for a task
 */
async function loadActivities(taskId: string): Promise<ActivitiesStore> {
  const filePath = getActivitiesFilePath(taskId);
  if (!existsSync(filePath)) {
    return { version: "1.0", activities: [] };
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as ActivitiesStore;
  } catch {
    return { version: "1.0", activities: [] };
  }
}

/**
 * Save activities for a task
 */
async function saveActivities(taskId: string, store: ActivitiesStore): Promise<void> {
  const filePath = getActivitiesFilePath(taskId);
  await ensureDir(join(getKanbanDataDir(), "activities"));
  await writeFile(filePath, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Get current timestamp as ISO string
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// ============================================================================
// Routes
// ============================================================================

export function registerKanbanDataRoutes(fastify: FastifyInstance): void {
  // ==========================================================================
  // Comments
  // ==========================================================================

  /**
   * Get all comments for a task
   * GET /api/kanban/tasks/:taskId/comments
   */
  fastify.get<{
    Params: { taskId: string };
  }>("/api/kanban/tasks/:taskId/comments", {
    schema: {
      description: "Get all comments for a task",
      tags: ["kanban"],
      params: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Task ID" },
        },
        required: ["taskId"],
      },
      response: {
        200: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              task_id: { type: "string" },
              content: { type: "string" },
              author: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  avatar: { type: "string" },
                },
              },
              created_at: { type: "string" },
              updated_at: { type: "string" },
              reactions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    emoji: { type: "string" },
                    count: { type: "number" },
                    users: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { taskId } = request.params;
    const store = await loadComments(taskId);
    return store.comments;
  });

  /**
   * Add a comment to a task
   * POST /api/kanban/tasks/:taskId/comments
   */
  fastify.post<{
    Params: { taskId: string };
    Body: {
      content: string;
      author_id: string;
      author_name: string;
      author_avatar?: string;
    };
  }>("/api/kanban/tasks/:taskId/comments", async (request) => {
    const { taskId } = request.params;
    const { content, author_id, author_name, author_avatar } = request.body;

    const store = await loadComments(taskId);
    const now = getCurrentTimestamp();

    const comment: KanbanComment = {
      id: randomUUID(),
      task_id: taskId,
      content,
      author: {
        id: author_id,
        name: author_name,
        avatar: author_avatar,
      },
      created_at: now,
      reactions: [],
    };

    store.comments.push(comment);
    await saveComments(taskId, store);

    // Also add an activity for this comment
    await addActivityInternal(taskId, "comment_added", author_id, author_name, author_avatar, undefined, content);

    return comment;
  });

  /**
   * Update a comment
   * PATCH /api/kanban/tasks/:taskId/comments/:commentId
   */
  fastify.patch<{
    Params: { taskId: string; commentId: string };
    Body: { content: string };
  }>("/api/kanban/tasks/:taskId/comments/:commentId", async (request, reply) => {
    const { taskId, commentId } = request.params;
    const { content } = request.body;

    const store = await loadComments(taskId);
    const comment = store.comments.find((c) => c.id === commentId);

    if (!comment) {
      reply.code(404);
      return { error: "Comment not found" };
    }

    comment.content = content;
    comment.updated_at = getCurrentTimestamp();

    await saveComments(taskId, store);
    return comment;
  });

  /**
   * Delete a comment
   * DELETE /api/kanban/tasks/:taskId/comments/:commentId
   */
  fastify.delete<{
    Params: { taskId: string; commentId: string };
  }>("/api/kanban/tasks/:taskId/comments/:commentId", async (request, reply) => {
    const { taskId, commentId } = request.params;

    const store = await loadComments(taskId);
    const initialLength = store.comments.length;
    store.comments = store.comments.filter((c) => c.id !== commentId);

    if (store.comments.length === initialLength) {
      reply.code(404);
      return { error: "Comment not found" };
    }

    await saveComments(taskId, store);
    return { deleted: commentId };
  });

  /**
   * Toggle a reaction on a comment
   * POST /api/kanban/tasks/:taskId/comments/:commentId/reactions
   */
  fastify.post<{
    Params: { taskId: string; commentId: string };
    Body: {
      emoji: string;
      user_id: string;
      user_name: string;
    };
  }>("/api/kanban/tasks/:taskId/comments/:commentId/reactions", async (request, reply) => {
    const { taskId, commentId } = request.params;
    const { emoji, user_id, user_name } = request.body;

    const store = await loadComments(taskId);
    const comment = store.comments.find((c) => c.id === commentId);

    if (!comment) {
      reply.code(404);
      return { error: "Comment not found" };
    }

    // Find existing reaction with this emoji
    let reaction = comment.reactions.find((r) => r.emoji === emoji);

    if (reaction) {
      const userIndex = reaction.users.findIndex((u) => u.id === user_id);
      if (userIndex >= 0) {
        // Remove user's reaction
        reaction.users.splice(userIndex, 1);
        reaction.count--;

        // Remove the reaction entirely if no users left
        if (reaction.count <= 0) {
          comment.reactions = comment.reactions.filter((r) => r.emoji !== emoji);
        }
      } else {
        // Add user's reaction
        reaction.users.push({ id: user_id, name: user_name });
        reaction.count++;
      }
    } else {
      // Create new reaction
      comment.reactions.push({
        emoji,
        users: [{ id: user_id, name: user_name }],
        count: 1,
      });
    }

    await saveComments(taskId, store);
    return comment;
  });

  // ==========================================================================
  // Activities
  // ==========================================================================

  /**
   * Get all activities for a task
   * GET /api/kanban/tasks/:taskId/activities
   */
  fastify.get<{
    Params: { taskId: string };
  }>("/api/kanban/tasks/:taskId/activities", {
    schema: {
      description: "Get all activities for a task",
      tags: ["kanban"],
      params: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Task ID" },
        },
        required: ["taskId"],
      },
      response: {
        200: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              task_id: { type: "string" },
              type: { type: "string" },
              actor: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  avatar: { type: "string" },
                },
              },
              timestamp: { type: "string" },
              data: { type: "object" },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { taskId } = request.params;
    const store = await loadActivities(taskId);
    // Return in reverse chronological order (most recent first)
    return store.activities.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  });

  /**
   * Add an activity to a task
   * POST /api/kanban/tasks/:taskId/activities
   */
  fastify.post<{
    Params: { taskId: string };
    Body: {
      activity_type: string;
      actor_id: string;
      actor_name: string;
      actor_avatar?: string;
      old_value?: string;
      new_value?: string;
    };
  }>("/api/kanban/tasks/:taskId/activities", async (request) => {
    const { taskId } = request.params;
    const { activity_type, actor_id, actor_name, actor_avatar, old_value, new_value } = request.body;

    const activity = await addActivityInternal(
      taskId,
      activity_type,
      actor_id,
      actor_name,
      actor_avatar,
      old_value,
      new_value
    );

    return activity;
  });

  /**
   * Clear all comments and activities for a task
   * DELETE /api/kanban/tasks/:taskId/data
   */
  fastify.delete<{
    Params: { taskId: string };
  }>("/api/kanban/tasks/:taskId/data", async (request) => {
    const { taskId } = request.params;

    // Delete comments file
    const commentsPath = getCommentsFilePath(taskId);
    if (existsSync(commentsPath)) {
      await unlink(commentsPath);
    }

    // Delete activities file
    const activitiesPath = getActivitiesFilePath(taskId);
    if (existsSync(activitiesPath)) {
      await unlink(activitiesPath);
    }

    return { cleared: taskId };
  });
}

/**
 * Internal helper to add an activity
 */
async function addActivityInternal(
  taskId: string,
  activityType: string,
  actorId: string,
  actorName: string,
  actorAvatar?: string,
  oldValue?: string,
  newValue?: string
): Promise<KanbanActivity> {
  const store = await loadActivities(taskId);

  const activity: KanbanActivity = {
    id: randomUUID(),
    task_id: taskId,
    type: activityType,
    actor: {
      id: actorId,
      name: actorName,
      avatar: actorAvatar,
    },
    timestamp: getCurrentTimestamp(),
    data: {
      old_value: oldValue,
      new_value: newValue,
    },
  };

  store.activities.push(activity);
  await saveActivities(taskId, store);

  return activity;
}
