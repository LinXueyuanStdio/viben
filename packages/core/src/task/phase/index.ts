/**
 * Task Phase Modules
 *
 * Each phase module provides a standalone function to run a specific
 * phase of the multi-agent pipeline.
 *
 * Phases:
 * - plan: Creates task structure and runs planning agent
 * - implement: Runs implementation agent to build features
 * - review: Runs code review (check) agent to verify quality
 *
 * Usage:
 * ```typescript
 * import { runPlanPhase, runImplementPhase, runCheckPhase } from "@viben/core/task/phase";
 *
 * // Run plan phase
 * const planResult = await runPlanPhase(repoRoot, taskDir, { platform: "claude" });
 *
 * // Run implement phase
 * const implResult = await runImplementPhase(repoRoot, taskDir, { platform: "claude" });
 *
 * // Run check phase (uses "check" agent)
 * const checkResult = await runCheckPhase(repoRoot, taskDir, { platform: "claude" });
 * ```
 */

// Plan Phase
export {
  runPlanPhase,
  type PlanPhaseOptions,
  type PlanPhaseResult,
} from "./plan";

// Implement Phase
export {
  runImplementPhase,
  runImplementPhaseSync,
  type ImplementPhaseOptions,
  type ImplementPhaseResult,
} from "./implement";

// Check Phase
export {
  runCheckPhase,
  type CheckPhaseOptions,
  type CheckPhaseResult,
} from "./check";

// Work Phase (work agent - reusable by swarm start)
export {
  runWorkPhase,
  type WorkPhaseOptions,
  type WorkPhaseResult,
} from "./work";

// Start Phase (unified entry point for task execution)
export {
  startTask,
  type StartTaskOptions,
  type StartTaskResult,
} from "./start";

// Worktree Phase (creates isolated git worktree)
export {
  runCreateWorktree,
  type CreateWorktreeOptions,
  type CreateWorktreeResult,
} from "./worktree";

// Merge PR Phase (merges PR via agent)
export {
  runMergePRPhase,
  type MergePRPhaseOptions,
  type MergePRPhaseResult,
} from "./merge-pr";
