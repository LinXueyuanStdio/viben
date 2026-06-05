import { z } from 'zod';

// Zod schemas for session API requests. Security-relevant size limits are documented inline.

export const ListSessionsQuerySchema = z.object({
  status: z.enum(['initializing', 'active', 'finished', 'cancelled', 'error']).optional(),
  agentName: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Workspace names may be relative (resolved under baseDir) or absolute paths.
// Absolute path validation is handled by ConfigManager.resolveWorkspace(), which
// enforces the allowExternalWorkspaces flag and verifies the path exists on disk.
const WorkspaceNameSchema = z.string().optional();

export const CreateSessionBodySchema = z.object({
  agent: z.string().max(200).optional(),
  workspace: WorkspaceNameSchema,
  channel: z.string().max(200).optional(),
});

export const AdoptSessionBodySchema = z.object({
  agent: z.string().min(1).max(200),
  agentSessionId: z.string().min(1).max(200),
  // cwd for adopt is the existing agent's working directory — absolute paths are valid here
  // since the agent is already running at that location.
  cwd: z.string().max(500).optional(),
  channel: z.string().max(200).optional(),
});

// Attachment input: base64-encoded file sent alongside a prompt.
// fileName accepts any non-empty string up to 255 chars — file-service sanitizes it before writing to disk.
// mimeType must be structurally valid (type/subtype) to prevent misleading agent processing.
// data is capped at ~10 MB base64 (~13.3 MB string); actual Fastify bodyLimit enforced per-route.
const AttachmentInputSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*$/, 'mimeType must be a valid MIME type')
    .max(200),
  data: z.string().max(15_000_000), // ~10 MB base64 ≈ 13.3 MB string
});

export type AttachmentInput = z.infer<typeof AttachmentInputSchema>;

export const PromptBodySchema = z.object({
  // 100 KB limit — prevents memory exhaustion / DoS via enormous payloads
  prompt: z.string().min(1).max(100_000),
  // Multi-adapter routing fields
  sourceAdapterId: z.string().optional(),
  responseAdapterId: z.string().nullable().optional(),
  // Optional file attachments; each decoded and stored via FileService
  attachments: z.array(AttachmentInputSchema).max(10).optional(),
  // Client-provided turnId to avoid SSE echo race condition
  turnId: z.string().max(64).optional(),
});

export const PermissionResponseBodySchema = z.object({
  permissionId: z.string().min(1).max(200),
  optionId: z.string().min(1).max(200),
  /** Optional feedback text — when provided with a deny option, queued as next prompt */
  feedback: z.string().max(100_000).optional(),
});

export const DangerousModeBodySchema = z.object({
  enabled: z.boolean(),
});

export const UpdateSessionBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  agentName: z.string().min(1).max(200).optional(),
  voiceMode: z.enum(['off', 'next', 'on']).optional(),
  dangerousMode: z.boolean().optional(),
});

export const SessionIdParamSchema = z.object({
  sessionId: z.string().min(1).max(200),
});

export const ConfigIdParamSchema = z.object({
  sessionId: z.string().min(1).max(200),
  configId: z.string().min(1).max(200),
});

export const SetConfigOptionBodySchema = z.object({
  value: z.string().max(1_000),
});

export const SetClientOverridesBodySchema = z.object({
  bypassPermissions: z.boolean().optional(),
});
