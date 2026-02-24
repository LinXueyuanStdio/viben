/**
 * Agent Service
 *
 * Manages runtime agent state:
 * - Abort controllers for session cancellation
 * - Plan approval workflow
 *
 * Note: Session persistence is handled by SessionStoreService
 */

import { randomUUID } from "node:crypto";

// ============================================================================
// Types
// ============================================================================

/**
 * Agent plan for approval
 */
export interface AgentPlan {
  id: string;
  sessionId: string;
  goal: string;
  steps: Array<{
    id: string;
    description: string;
    status: "pending" | "in_progress" | "completed" | "failed";
  }>;
  notes?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}

/**
 * Pending question from AskUserQuestion tool
 */
export interface AgentQuestion {
  id: string;
  sessionId: string;
  toolUseId: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
  }>;
  status: "pending" | "answered";
  answers?: Record<string, string>;
  createdAt: Date;
  /** Agent path for workspace-level agents */
  agentPath?: string;
  /** Workspace path */
  workspacePath?: string;
}

// ============================================================================
// AgentService Class
// ============================================================================

/**
 * AgentService - Manages runtime agent state
 *
 * Features:
 * - Track abort controllers for session cancellation
 * - Store and manage execution plans
 * - Handle plan approval/rejection workflow
 */
export class AgentService {
  private abortControllers = new Map<string, AbortController>();
  private plans = new Map<string, AgentPlan>();
  private questions = new Map<string, AgentQuestion>();

  // ==========================================================================
  // Abort Controller Management
  // ==========================================================================

  /**
   * Register a session for abort control
   *
   * @param sessionId - The session identifier
   * @returns The created AbortController
   */
  registerSession(sessionId: string): AbortController {
    const controller = new AbortController();
    this.abortControllers.set(sessionId, controller);
    console.log(`[AgentService] Registered session: ${sessionId}`);
    return controller;
  }

  /**
   * Get abort signal for a session
   *
   * @param sessionId - The session identifier
   * @returns The abort signal or undefined if session not found
   */
  getAbortSignal(sessionId: string): AbortSignal | undefined {
    return this.abortControllers.get(sessionId)?.signal;
  }

  /**
   * Stop a session by triggering abort
   *
   * @param sessionId - The session identifier
   * @returns True if session was stopped, false if not found
   */
  stopSession(sessionId: string): boolean {
    const controller = this.abortControllers.get(sessionId);
    if (!controller) return false;

    controller.abort();
    console.log(`[AgentService] Stopped session: ${sessionId}`);
    return true;
  }

  /**
   * Unregister a session (cleanup)
   *
   * @param sessionId - The session identifier
   */
  unregisterSession(sessionId: string): void {
    this.abortControllers.delete(sessionId);
  }

  /**
   * Check if a session is aborted
   *
   * @param sessionId - The session identifier
   * @returns True if session is aborted, false otherwise
   */
  isSessionAborted(sessionId: string): boolean {
    const controller = this.abortControllers.get(sessionId);
    return controller?.signal.aborted ?? false;
  }

  /**
   * Get the number of active sessions
   * Used for metrics/telemetry
   *
   * @returns The count of active sessions
   */
  getActiveSessionCount(): number {
    return this.abortControllers.size;
  }

  // ==========================================================================
  // Plan Management
  // ==========================================================================

  /**
   * Store a plan for approval
   *
   * @param sessionId - The session identifier
   * @param plan - The plan details (without id, sessionId, status, createdAt)
   * @returns The created plan with all fields
   */
  storePlan(
    sessionId: string,
    plan: Omit<AgentPlan, "id" | "sessionId" | "status" | "createdAt">
  ): AgentPlan {
    const fullPlan: AgentPlan = {
      ...plan,
      id: randomUUID(),
      sessionId,
      status: "pending",
      createdAt: new Date(),
    };
    this.plans.set(fullPlan.id, fullPlan);
    console.log(`[AgentService] Stored plan: ${fullPlan.id}`);
    return fullPlan;
  }

  /**
   * Get a plan by ID
   *
   * @param planId - The plan identifier
   * @returns The plan or undefined if not found
   */
  getPlan(planId: string): AgentPlan | undefined {
    return this.plans.get(planId);
  }

  /**
   * Get pending plan for a session
   *
   * @param sessionId - The session identifier
   * @returns The pending plan or undefined
   */
  getPendingPlanForSession(sessionId: string): AgentPlan | undefined {
    for (const plan of this.plans.values()) {
      if (plan.sessionId === sessionId && plan.status === "pending") {
        return plan;
      }
    }
    return undefined;
  }

  /**
   * Approve a plan
   *
   * @param planId - The plan identifier
   * @returns True if plan was approved, false if not found or already processed
   */
  approvePlan(planId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan || plan.status !== "pending") return false;

    plan.status = "approved";
    console.log(`[AgentService] Plan approved: ${planId}`);
    return true;
  }

  /**
   * Reject a plan
   *
   * @param planId - The plan identifier
   * @returns True if plan was rejected, false if not found or already processed
   */
  rejectPlan(planId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan || plan.status !== "pending") return false;

    plan.status = "rejected";
    // Also trigger abort for the associated session
    this.stopSession(plan.sessionId);
    console.log(`[AgentService] Plan rejected: ${planId}`);
    return true;
  }

  /**
   * Update plan step status
   *
   * @param planId - The plan identifier
   * @param stepId - The step identifier
   * @param status - The new step status
   * @returns True if step was updated, false if plan or step not found
   */
  updatePlanStep(
    planId: string,
    stepId: string,
    status: "pending" | "in_progress" | "completed" | "failed"
  ): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return false;

    step.status = status;
    console.log(`[AgentService] Plan ${planId} step ${stepId} status: ${status}`);
    return true;
  }

  // ==========================================================================
  // Question Management (AskUserQuestion)
  // ==========================================================================

  /**
   * Store a question for user response
   *
   * @param sessionId - The session identifier
   * @param toolUseId - The tool use ID from the SDK
   * @param questions - Array of questions to ask
   * @param options - Optional agent path and workspace path
   * @returns The created question with all fields
   */
  storeQuestion(
    sessionId: string,
    toolUseId: string,
    questions: AgentQuestion["questions"],
    options?: { agentPath?: string; workspacePath?: string }
  ): AgentQuestion {
    const fullQuestion: AgentQuestion = {
      id: toolUseId, // Use toolUseId as the question ID for easy lookup
      sessionId,
      toolUseId,
      questions,
      status: "pending",
      createdAt: new Date(),
      agentPath: options?.agentPath,
      workspacePath: options?.workspacePath,
    };
    this.questions.set(fullQuestion.id, fullQuestion);
    console.log(`[AgentService] Stored question: ${fullQuestion.id}`);
    return fullQuestion;
  }

  /**
   * Get a question by ID
   *
   * @param questionId - The question identifier (same as toolUseId)
   * @returns The question or undefined if not found
   */
  getQuestion(questionId: string): AgentQuestion | undefined {
    return this.questions.get(questionId);
  }

  /**
   * Get pending question for a session
   *
   * @param sessionId - The session identifier
   * @returns The pending question or undefined
   */
  getPendingQuestionForSession(sessionId: string): AgentQuestion | undefined {
    for (const question of this.questions.values()) {
      if (question.sessionId === sessionId && question.status === "pending") {
        return question;
      }
    }
    return undefined;
  }

  /**
   * Answer a question
   *
   * @param questionId - The question identifier
   * @param answers - User's answers as key-value pairs
   * @returns True if question was answered, false if not found or already answered
   */
  answerQuestion(questionId: string, answers: Record<string, string>): boolean {
    const question = this.questions.get(questionId);
    if (!question || question.status !== "pending") return false;

    question.status = "answered";
    question.answers = answers;
    console.log(`[AgentService] Question answered: ${questionId}`);
    return true;
  }

  /**
   * Get answer for a question
   *
   * @param questionId - The question identifier
   * @returns The answers or undefined if not found or not answered
   */
  getQuestionAnswers(questionId: string): Record<string, string> | undefined {
    const question = this.questions.get(questionId);
    if (!question || question.status !== "answered") return undefined;
    return question.answers;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Cleanup old plans and questions
   *
   * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
   */
  cleanup(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    // Cleanup old plans
    for (const [planId, plan] of this.plans) {
      if (now - plan.createdAt.getTime() > maxAgeMs && plan.status !== "pending") {
        this.plans.delete(planId);
        console.log(`[AgentService] Cleaned up plan: ${planId}`);
      }
    }
    // Cleanup old questions
    for (const [questionId, question] of this.questions) {
      if (now - question.createdAt.getTime() > maxAgeMs && question.status !== "pending") {
        this.questions.delete(questionId);
        console.log(`[AgentService] Cleaned up question: ${questionId}`);
      }
    }
  }

  /**
   * Clear all state (for testing)
   */
  clearAll(): void {
    // Abort all sessions
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.plans.clear();
    this.questions.clear();
    console.log(`[AgentService] Cleared all state`);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Singleton instance of AgentService
 */
export const agentService = new AgentService();
