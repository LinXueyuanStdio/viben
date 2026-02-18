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
  // Cleanup
  // ==========================================================================

  /**
   * Cleanup old plans
   *
   * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
   */
  cleanup(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    for (const [planId, plan] of this.plans) {
      if (now - plan.createdAt.getTime() > maxAgeMs && plan.status !== "pending") {
        this.plans.delete(planId);
        console.log(`[AgentService] Cleaned up plan: ${planId}`);
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
