/**
 * Agent Service
 *
 * Manages agent session lifecycle and plan approvals.
 * This service provides:
 * - Session creation and management
 * - Plan storage and approval workflow
 * - Session status updates with observer pattern
 */

import { randomUUID } from "node:crypto";

// ============================================================================
// Types
// ============================================================================

/**
 * Agent session state
 */
export interface AgentSession {
  sessionId: string;
  agentId: string;
  prompt: string;
  status: "running" | "paused" | "completed" | "error" | "cancelled";
  startedAt: Date;
  completedAt?: Date;
  abortController: AbortController;
}

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
 * Session listener callback type
 */
type SessionListener = (session: AgentSession) => void;

// ============================================================================
// AgentService Class
// ============================================================================

/**
 * AgentService - Manages agent session lifecycle and plan approvals
 *
 * Features:
 * - Create and manage agent sessions
 * - Track session status with observer pattern
 * - Store and manage execution plans
 * - Handle plan approval/rejection workflow
 * - Automatic cleanup of completed sessions
 */
export class AgentService {
  private sessions = new Map<string, AgentSession>();
  private plans = new Map<string, AgentPlan>();
  private sessionListeners = new Map<string, Set<SessionListener>>();

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Create a new session
   *
   * @param agentId - The agent identifier
   * @param prompt - The initial prompt for the session
   * @returns The created session
   */
  createSession(agentId: string, prompt: string): AgentSession {
    const sessionId = randomUUID();
    const session: AgentSession = {
      sessionId,
      agentId,
      prompt,
      status: "running",
      startedAt: new Date(),
      abortController: new AbortController(),
    };
    this.sessions.set(sessionId, session);
    console.log(`[AgentService] Created session: ${sessionId}`);
    return session;
  }

  /**
   * Get a session by ID
   *
   * @param sessionId - The session identifier
   * @returns The session or undefined if not found
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session status
   *
   * @param sessionId - The session identifier
   * @param status - The new status
   * @param completedAt - Optional completion timestamp
   */
  updateSessionStatus(
    sessionId: string,
    status: AgentSession["status"],
    completedAt?: Date
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = status;
    if (completedAt) session.completedAt = completedAt;

    // Notify listeners
    const listeners = this.sessionListeners.get(sessionId);
    if (listeners) {
      for (const listener of listeners) {
        listener(session);
      }
    }

    console.log(`[AgentService] Session ${sessionId} status: ${status}`);
  }

  /**
   * Stop a session
   *
   * @param sessionId - The session identifier
   * @returns True if session was stopped, false if not found
   */
  stopSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.abortController.abort();
    this.updateSessionStatus(sessionId, "cancelled", new Date());
    return true;
  }

  /**
   * Get abort signal for a session
   *
   * @param sessionId - The session identifier
   * @returns The abort signal or undefined if session not found
   */
  getAbortSignal(sessionId: string): AbortSignal | undefined {
    return this.sessions.get(sessionId)?.abortController.signal;
  }

  /**
   * Subscribe to session updates
   *
   * @param sessionId - The session identifier
   * @param listener - Callback to invoke on session updates
   * @returns Unsubscribe function
   */
  subscribeSession(sessionId: string, listener: SessionListener): () => void {
    if (!this.sessionListeners.has(sessionId)) {
      this.sessionListeners.set(sessionId, new Set());
    }
    this.sessionListeners.get(sessionId)!.add(listener);
    return () => {
      this.sessionListeners.get(sessionId)?.delete(listener);
    };
  }

  /**
   * List all sessions
   *
   * @returns Array of all sessions
   */
  listSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * List running sessions
   *
   * @returns Array of running sessions
   */
  listRunningSessions(): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "running"
    );
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
    // Also cancel the associated session
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
   * Cleanup completed sessions older than specified age
   *
   * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
   */
  cleanup(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (
        session.status !== "running" &&
        session.completedAt &&
        now - session.completedAt.getTime() > maxAgeMs
      ) {
        this.sessions.delete(id);
        this.sessionListeners.delete(id);
        // Also cleanup associated plans
        for (const [planId, plan] of this.plans) {
          if (plan.sessionId === id) {
            this.plans.delete(planId);
          }
        }
        console.log(`[AgentService] Cleaned up session: ${id}`);
      }
    }
  }

  /**
   * Clear all sessions and plans (for testing)
   */
  clearAll(): void {
    // Abort all running sessions
    for (const session of this.sessions.values()) {
      if (session.status === "running") {
        session.abortController.abort();
      }
    }
    this.sessions.clear();
    this.plans.clear();
    this.sessionListeners.clear();
    console.log(`[AgentService] Cleared all sessions and plans`);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Singleton instance of AgentService
 */
export const agentService = new AgentService();
