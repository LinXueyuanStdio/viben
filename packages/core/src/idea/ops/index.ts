/**
 * Idea operations module
 *
 * Re-exports all idea-related operations for use by commands, API endpoints, and other modules.
 *
 * Module structure:
 * - types.ts     - Type definitions (Idea, IdeaType, IdeaSession, etc.)
 * - store.ts     - Storage operations (read/write ideas, sessions, types)
 * - generator.ts - AI-powered idea generation
 * - crud.ts      - Create, Read, Update, Delete operations
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Constants as types
  BuiltinIdeaTypeName,
  EffortLevel,
  IdeaStatus,
  IdeaTypeSource,
  // Core interfaces
  IdeaType,
  Idea,
  RawIdeaData,
  IdeaSessionSummary,
  RawIdeaSessionSummary,
  IdeaSession,
  RawIdeaSession,
  // Command options
  IdeaGenerateOptions,
  IdeaListOptions,
  IdeaPromoteOptions,
  IdeaRemoveOptions,
  // Result types
  IdeaGenerateTypeResult,
  IdeaGenerateResult,
  IdeaPromoteResult,
  IdeaListResult,
  IdeaViewResult,
  IdeaRemoveResult,
  IdeaListTypesResult,
  // Idea Type CRUD types
  IdeaTypeInput,
  IdeaTypeCreateResult,
  IdeaTypeUpdateResult,
  IdeaTypeDeleteResult,
} from "./types";

// Export constants
export {
  BUILTIN_IDEA_TYPES,
  EFFORT_LEVELS,
  IDEA_STATUSES,
  EFFORT_PRIORITY_MAP,
  DEFAULT_MAX_IDEAS,
  IDEAS_DIR,
  CUSTOM_IDEA_TYPES_DIR,
  IDEA_JSON_FILE,
  IDEA_FILE_PREFIX,
} from "./types";

// Export helper functions from types
export {
  isValidEffortLevel,
  isValidIdeaStatus,
  isBuiltinIdeaType,
  getDefaultPriority,
  getIdeaIdPrefix,
  parseRawIdea,
  parseRawSession,
  generateShortUuid,
} from "./types";

// =============================================================================
// Store Operations
// =============================================================================

// Path utilities
export {
  getIdeasDir,
  getIdeaTypesDir,
  getIdeaSessionDir,
  getIdeaJsonPath,
  getIdeaMarkdownPath,
  getIdeaTypePromptPath,
  getBuiltinIdeaTypePromptPath,
} from "./store";

// Idea type management
export {
  getIdeaType,
  listIdeaTypes,
  loadIdeaTypePrompt,
  createIdeaType,
  updateIdeaType,
  deleteIdeaType,
} from "./store";

// Session management
export {
  generateSessionId,
  createSessionDir,
  writeSessionMetadata,
  readSessionMetadata,
  listSessions,
  getLatestSession,
  listIdeaSessions,
  writeIdeaSession,
} from "./store";

// Idea file management
export {
  getIdeaFilePath,
  getSingleIdeaFilePath,
  getSingleIdeaFileName,
  writeIdeasToFile,
  writeSingleIdeaToFile,
  writeIdeasToSeparateFiles,
  readIdeasFromFile,
  getAllIdeasFromSession,
  findIdeaById,
  updateIdea,
} from "./store";

// Idea query functions
export {
  getAllIdeas,
  getIdeaById,
  updateIdeaStatus,
  removeIdea,
  removeIdeasByType,
  removeAllIdeas,
} from "./store";

// =============================================================================
// Generator Operations
// =============================================================================

export type { AIResponse, ProjectContext } from "./generator";

export {
  gatherProjectContext,
  buildPrompt,
  parseAIResponse,
  generateIdeasForType,
  generateIdeas,
} from "./generator";

// =============================================================================
// CRUD Operations
// =============================================================================

export {
  listIdeas,
  listTypes,
  viewIdea,
  promoteIdea,
  promoteIdeaDirect,
  removeIdeas,
  dismissIdea,
  validateIdeaType,
  validateIdeaTypes,
  // Idea Type CRUD
  createIdeaTypeOp,
  updateIdeaTypeOp,
  deleteIdeaTypeOp,
} from "./crud";
