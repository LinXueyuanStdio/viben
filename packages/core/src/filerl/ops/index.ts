/**
 * FileRL Operations
 *
 * Export all FileRL operations for use by CLI commands and other modules.
 */

// Types
export * from "./types";

// Parser
export { parseTarget, validateConfig, generateTargetContent } from "./parser";

// State management
export {
  getFileRlDir,
  getStatePath,
  ensureFileRlDir,
  createInitialState,
  createIterationState,
  readState,
  writeState,
  startIteration,
  completeIteration,
  checkConvergence,
  markConverged,
  stopRun,
  listRuns,
  getStatus,
  runExists,
  isRunActive,
} from "./state";

// Runner
export {
  initRun,
  runIteration,
  createTasksFromIdeas,
  selectBest,
  stop,
  resume,
} from "./runner";

// Orchestration (direct ops function calls)
export type { OrchestrationResult } from "./runner";
export {
  orchestrateGenerateIdeas,
  orchestrateFetchIdeas,
  orchestratePromoteIdeas,
  orchestrateStartTasks,
  orchestrateCheckTasksStatus,
  orchestrateComputeRewards,
  orchestrateSelectBest,
  orchestrateMergeAndCleanup,
  orchestrateFullIteration,
  waitForTasksCompletion,
  runFileRlLoop,
} from "./runner";
