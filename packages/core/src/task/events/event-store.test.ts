/**
 * Event Store Tests
 *
 * Tests event validation, sequencing, and persistence.
 * Uses mocks for file system and taskService dependencies.
 * For integration tests with real file system, see event-store.integration.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TaskEventStore, type ApplyEventResult } from "./event-store";
import { isValidEventType, VALID_EVENT_TYPES, type TaskEventType } from "./event-types";
import { createMockTask, createMockEvent, createTaskInState } from "../__fixtures__/task-fixtures";
import type { UnifiedTask, TaskEvent } from "../ops/types";

// =============================================================================
// Mocks
// =============================================================================

// Mock taskService - use explicit function types to avoid inference issues
const mockGetTask = vi.fn<(taskDir: string) => Promise<UnifiedTask | null>>();
const mockUpdateTask = vi.fn<(taskDir: string, updates: Partial<UnifiedTask>) => Promise<UnifiedTask>>();

vi.mock("../service", () => ({
  taskService: {
    getTask: (taskDir: string) => mockGetTask(taskDir),
    updateTask: (taskDir: string, updates: Partial<UnifiedTask>) => mockUpdateTask(taskDir, updates),
  },
}));

// Mock file system - use explicit function types
const mockAppendFile = vi.fn<(path: string, data: string, encoding: string) => Promise<void>>();
const mockReadFile = vi.fn<(path: string, encoding: string) => Promise<string>>();
const mockWriteFile = vi.fn<(path: string, data: string, encoding: string) => Promise<void>>();
const mockExistsSync = vi.fn<(path: string) => boolean>();

vi.mock("node:fs/promises", () => ({
  appendFile: (path: string, data: string, encoding: string) => mockAppendFile(path, data, encoding),
  readFile: (path: string, encoding: string) => mockReadFile(path, encoding),
  writeFile: (path: string, data: string, encoding: string) => mockWriteFile(path, data, encoding),
}));

vi.mock("node:fs", () => ({
  existsSync: (path: string) => mockExistsSync(path),
}));

// Mock async lock - immediately execute the function
vi.mock("../../utils/async-lock", () => ({
  taskLock: {
    withLock: async <T>(_key: string, fn: () => Promise<T>): Promise<T> => fn(),
  },
}));

// =============================================================================
// isValidEventType Tests
// =============================================================================

describe("isValidEventType", () => {
  describe("valid event types", () => {
    const validTypes: TaskEventType[] = [
      "QUEUE", "START", "DEQUEUE",
      "PLAN_COMPLETE", "PLAN_FAILED",
      "SUBTASK_COMPLETE", "ALL_SUBTASKS_DONE", "IMPLEMENT_FAILED",
      "CHECK_PASSED", "CHECK_FAILED", "FIX_COMPLETE", "FIX_FAILED",
      "USER_STOPPED", "APPROVED", "REJECTED", "CANCEL",
      "PAUSE", "RESUME", "RETRY", "ABANDON",
    ];

    for (const type of validTypes) {
      it(`accepts "${type}" as valid`, () => {
        expect(isValidEventType(type)).toBe(true);
      });
    }
  });

  describe("invalid event types", () => {
    const invalidTypes = ["INVALID", "queue", "start", "", "123", " QUEUE", "QUEUE "];

    for (const type of invalidTypes) {
      it(`rejects "${type}" as invalid`, () => {
        expect(isValidEventType(type)).toBe(false);
      });
    }
  });

  it("VALID_EVENT_TYPES contains all 21 event types", () => {
    expect(VALID_EVENT_TYPES).toHaveLength(21);
  });
});

// =============================================================================
// TaskEventStore.applyEvent Tests
// =============================================================================

describe("TaskEventStore.applyEvent", () => {
  let store: TaskEventStore;
  const taskDir = "/workspace/.viben/tasks/01-01-test-task";

  beforeEach(() => {
    store = new TaskEventStore();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockAppendFile.mockResolvedValue(undefined);
  });

  describe("successful event application", () => {
    it("applies QUEUE event to backlog task", async () => {
      const task = createTaskInState("backlog", { id: "task1" });
      mockGetTask.mockResolvedValue(task);
      mockUpdateTask.mockImplementation(async (_, updates) => ({ ...task, ...updates }));

      const event: TaskEvent = {
        eventId: "evt_1",
        sequence: 1,
        type: "QUEUE",
        timestamp: "2026-01-15T10:00:00.000Z",
      };

      const result = await store.applyEvent(taskDir, event);

      expect(result.success).toBe(true);
      expect(result.newState).toBe('"queue"');
      expect(mockAppendFile).toHaveBeenCalledWith(
        expect.stringContaining("events.jsonl"),
        expect.stringContaining('"type":"QUEUE"'),
        "utf-8"
      );
      expect(mockUpdateTask).toHaveBeenCalledWith(taskDir, expect.objectContaining({
        status: "queue",
        queuedAt: event.timestamp,
      }));
    });

    it("applies START event to queue task", async () => {
      const task = createTaskInState("queue", {
        id: "task1",
        lastEvent: { eventId: "evt_1", sequence: 1, type: "QUEUE", timestamp: "2026-01-15T10:00:00.000Z" },
      });
      mockGetTask.mockResolvedValue(task);
      mockUpdateTask.mockImplementation(async (_, updates) => ({ ...task, ...updates }));

      const event: TaskEvent = {
        eventId: "evt_2",
        sequence: 2,
        type: "START",
        timestamp: "2026-01-15T10:01:00.000Z",
      };

      const result = await store.applyEvent(taskDir, event);

      expect(result.success).toBe(true);
      expect(result.newState).toBe('{"in_progress":"plan"}');
    });

    it("applies PAUSE event and saves machine_context", async () => {
      const task = createTaskInState("queue", {
        id: "task1",
        xstateState: "queue",
        lastEvent: { eventId: "evt_1", sequence: 1, type: "QUEUE", timestamp: "2026-01-15T10:00:00.000Z" },
        machine_context: { current_subtask_index: 0, requires_plan_review: false },
      });
      mockGetTask.mockResolvedValue(task);
      mockUpdateTask.mockImplementation(async (_, updates) => ({ ...task, ...updates }));

      const event: TaskEvent = {
        eventId: "evt_2",
        sequence: 2,
        type: "PAUSE",
        timestamp: "2026-01-15T10:01:00.000Z",
      };

      const result = await store.applyEvent(taskDir, event);

      expect(result.success).toBe(true);
      expect(mockUpdateTask).toHaveBeenCalledWith(taskDir, expect.objectContaining({
        machine_context: expect.objectContaining({
          paused_snapshot: expect.objectContaining({
            from_state: "queue",
            paused_at: event.timestamp,
          }),
        }),
      }));
    });

    it("applies RESUME event and clears paused_snapshot", async () => {
      const task = createTaskInState("paused", {
        id: "task1",
        xstateState: "paused",
        lastEvent: { eventId: "evt_2", sequence: 2, type: "PAUSE", timestamp: "2026-01-15T10:01:00.000Z" },
        machine_context: {
          current_subtask_index: 0,
          requires_plan_review: false,
          paused_snapshot: { from_state: "queue", subtask_index: 0, paused_at: "2026-01-15T10:01:00.000Z" },
        },
      });
      mockGetTask.mockResolvedValue(task);
      mockUpdateTask.mockImplementation(async (_, updates) => ({ ...task, ...updates }));

      const event: TaskEvent = {
        eventId: "evt_3",
        sequence: 3,
        type: "RESUME",
        timestamp: "2026-01-15T10:02:00.000Z",
      };

      const result = await store.applyEvent(taskDir, event);

      expect(result.success).toBe(true);
      expect(mockUpdateTask).toHaveBeenCalledWith(taskDir, expect.objectContaining({
        machine_context: expect.objectContaining({
          paused_snapshot: undefined,
        }),
      }));
    });

    it("applies SUBTASK_COMPLETE and increments subtask index", async () => {
      const task = createTaskInState("in_progress", {
        id: "task1",
        xstateState: { in_progress: "implement" },
        lastEvent: { eventId: "evt_3", sequence: 3, type: "PLAN_COMPLETE", timestamp: "2026-01-15T10:02:00.000Z" },
        machine_context: { current_subtask_index: 0, requires_plan_review: false },
      });
      mockGetTask.mockResolvedValue(task);
      mockUpdateTask.mockImplementation(async (_, updates) => ({ ...task, ...updates }));

      const event: TaskEvent = {
        eventId: "evt_4",
        sequence: 4,
        type: "SUBTASK_COMPLETE",
        timestamp: "2026-01-15T10:03:00.000Z",
      };

      const result = await store.applyEvent(taskDir, event);

      expect(result.success).toBe(true);
      expect(mockUpdateTask).toHaveBeenCalledWith(taskDir, expect.objectContaining({
        machine_context: expect.objectContaining({
          current_subtask_index: 1,
        }),
      }));
    });

    it("rejects SUBTASK_COMPLETE from non-implement state", async () => {
      const task = createTaskInState("in_progress", {
        id: "task1",
        xstateState: { in_progress: "plan" },
        lastEvent: { eventId: "evt_2", sequence: 2, type: "START", timestamp: "2026-01-15T10:01:00.000Z" },
      });
      mockGetTask.mockResolvedValue(task);

      const event: TaskEvent = {
        eventId: "evt_3",
        sequence: 3,
        type: "SUBTASK_COMPLETE",
        timestamp: "2026-01-15T10:02:00.000Z",
      };

      const result = await store.applyEvent(taskDir, event);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_TRANSITION");
    });
  });

  describe("error handling", () => {
    it("returns TASK_NOT_FOUND when task does not exist", async () => {
      mockGetTask.mockResolvedValue(null);

      const event: TaskEvent = {
        eventId: "evt_1",
        sequence: 1,
        type: "QUEUE",
        timestamp: "2026-01-15T10:00:00.000Z",
      };

      const result = await store.applyEvent(taskDir, event);

      expect(result.success).toBe(false);
      expect(result.error).toBe("TASK_NOT_FOUND");
    });

    it("returns INVALID_EVENT_TYPE for unknown event type", async () => {
      const task = createTaskInState("backlog", { id: "task1" });
      mockGetTask.mockResolvedValue(task);

      // Use unknown first then cast to TaskEvent to test invalid type handling
      const event = {
        eventId: "evt_1",
        sequence: 1,
        type: "UNKNOWN_EVENT",
        timestamp: "2026-01-15T10:00:00.000Z",
      } as unknown as TaskEvent;

      const result = await store.applyEvent(taskDir, event);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_EVENT_TYPE");
    });

    it("returns SEQUENCE_MISMATCH when sequence is wrong", async () => {
      const task = createTaskInState("backlog", {
        id: "task1",
        lastEvent: { eventId: "evt_1", sequence: 1, type: "QUEUE", timestamp: "2026-01-15T10:00:00.000Z" },
      });
      mockGetTask.mockResolvedValue(task);

      const event: TaskEvent = {
        eventId: "evt_2",
        sequence: 5, // Should be 2
        type: "START",
        timestamp: "2026-01-15T10:01:00.000Z",
      };

      const result = await store.applyEvent(taskDir, event);

      expect(result.success).toBe(false);
      expect(result.error).toBe("SEQUENCE_MISMATCH");
      expect(result.expected).toBe(2);
      expect(result.received).toBe(5);
    });

    it("returns INVALID_TRANSITION for illegal state transition", async () => {
      const task = createTaskInState("backlog", { id: "task1" });
      mockGetTask.mockResolvedValue(task);

      const event: TaskEvent = {
        eventId: "evt_1",
        sequence: 1,
        type: "START", // Cannot START from backlog, must QUEUE first
        timestamp: "2026-01-15T10:00:00.000Z",
      };

      const result = await store.applyEvent(taskDir, event);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_TRANSITION");
      expect(result.currentState).toBe('"backlog"');
    });
  });
});

// =============================================================================
// TaskEventStore.validateEvent Tests
// =============================================================================

describe("TaskEventStore.validateEvent", () => {
  let store: TaskEventStore;
  const taskDir = "/workspace/.viben/tasks/01-01-test-task";

  beforeEach(() => {
    store = new TaskEventStore();
    vi.clearAllMocks();
  });

  it("validates a correct event without applying it", async () => {
    const task = createTaskInState("backlog", { id: "task1" });
    mockGetTask.mockResolvedValue(task);

    const event: TaskEvent = {
      eventId: "evt_1",
      sequence: 1,
      type: "QUEUE",
      timestamp: "2026-01-15T10:00:00.000Z",
    };

    const result = await store.validateEvent(taskDir, event);

    expect(result.success).toBe(true);
    expect(result.newState).toBe('"queue"');
    // Should NOT call appendFile or updateTask
    expect(mockAppendFile).not.toHaveBeenCalled();
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("returns error for invalid transition without modifying task", async () => {
    const task = createTaskInState("completed", { id: "task1" });
    mockGetTask.mockResolvedValue(task);

    const event: TaskEvent = {
      eventId: "evt_1",
      sequence: 1,
      type: "START",
      timestamp: "2026-01-15T10:00:00.000Z",
    };

    const result = await store.validateEvent(taskDir, event);

    expect(result.success).toBe(false);
    expect(result.error).toBe("INVALID_TRANSITION");
    expect(mockAppendFile).not.toHaveBeenCalled();
  });
});

// =============================================================================
// TaskEventStore.getNextSequence Tests
// =============================================================================

describe("TaskEventStore.getNextSequence", () => {
  let store: TaskEventStore;
  const taskDir = "/workspace/.viben/tasks/01-01-test-task";

  beforeEach(() => {
    store = new TaskEventStore();
    vi.clearAllMocks();
  });

  it("returns 1 for task with no events", async () => {
    const task = createTaskInState("backlog", { id: "task1" });
    mockGetTask.mockResolvedValue(task);

    const seq = await store.getNextSequence(taskDir);
    expect(seq).toBe(1);
  });

  it("returns lastEvent.sequence + 1 for task with events", async () => {
    const task = createTaskInState("queue", {
      id: "task1",
      lastEvent: { eventId: "evt_5", sequence: 5, type: "PAUSE", timestamp: "2026-01-15T10:00:00.000Z" },
    });
    mockGetTask.mockResolvedValue(task);

    const seq = await store.getNextSequence(taskDir);
    expect(seq).toBe(6);
  });

  it("returns 1 for non-existent task", async () => {
    mockGetTask.mockResolvedValue(null);

    const seq = await store.getNextSequence(taskDir);
    expect(seq).toBe(1);
  });
});

// =============================================================================
// TaskEventStore.getEventHistory Tests
// =============================================================================

describe("TaskEventStore.getEventHistory", () => {
  let store: TaskEventStore;
  const taskDir = "/workspace/.viben/tasks/01-01-test-task";

  beforeEach(() => {
    store = new TaskEventStore();
    vi.clearAllMocks();
  });

  it("reads events from events.jsonl file", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(
      '{"eventId":"evt_1","sequence":1,"type":"QUEUE","timestamp":"2026-01-15T10:00:00.000Z"}\n' +
      '{"eventId":"evt_2","sequence":2,"type":"START","timestamp":"2026-01-15T10:01:00.000Z"}\n'
    );

    const events = await store.getEventHistory(taskDir);

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("QUEUE");
    expect(events[1].type).toBe("START");
  });

  it("filters events by since parameter", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(
      '{"eventId":"evt_1","sequence":1,"type":"QUEUE","timestamp":"2026-01-15T10:00:00.000Z"}\n' +
      '{"eventId":"evt_2","sequence":2,"type":"START","timestamp":"2026-01-15T10:01:00.000Z"}\n' +
      '{"eventId":"evt_3","sequence":3,"type":"PAUSE","timestamp":"2026-01-15T10:02:00.000Z"}\n'
    );

    const events = await store.getEventHistory(taskDir, 1);

    expect(events).toHaveLength(2);
    expect(events[0].sequence).toBe(2);
    expect(events[1].sequence).toBe(3);
  });

  it("falls back to task.json eventHistory for legacy tasks", async () => {
    mockExistsSync.mockReturnValue(false);
    const task = createTaskInState("queue", {
      id: "task1",
      eventHistory: [
        { eventId: "evt_1", sequence: 1, type: "QUEUE", timestamp: "2026-01-15T10:00:00.000Z" },
      ],
    });
    mockGetTask.mockResolvedValue(task);
    mockWriteFile.mockResolvedValue(undefined);

    const events = await store.getEventHistory(taskDir);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("QUEUE");
    // Should migrate to events.jsonl
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("events.jsonl"),
      expect.stringContaining('"eventId":"evt_1"'),
      "utf-8"
    );
  });

  it("returns empty array when no events exist", async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetTask.mockResolvedValue(createTaskInState("backlog", { id: "task1" }));

    const events = await store.getEventHistory(taskDir);
    expect(events).toHaveLength(0);
  });

  it("skips malformed JSON lines", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(
      '{"eventId":"evt_1","sequence":1,"type":"QUEUE","timestamp":"2026-01-15T10:00:00.000Z"}\n' +
      'invalid json line\n' +
      '{"eventId":"evt_2","sequence":2,"type":"START","timestamp":"2026-01-15T10:01:00.000Z"}\n'
    );

    const events = await store.getEventHistory(taskDir);

    expect(events).toHaveLength(2);
  });
});

// =============================================================================
// State Transition Complete Flows
// =============================================================================

describe("Complete State Transition Flows", () => {
  let store: TaskEventStore;
  const taskDir = "/workspace/.viben/tasks/01-01-test-task";

  beforeEach(() => {
    store = new TaskEventStore();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00.000Z"));
    mockExistsSync.mockReturnValue(true);
    mockAppendFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("completes happy path: backlog -> queue -> plan -> implement -> check -> review -> completed", async () => {
    let currentTask = createTaskInState("backlog", { id: "task1" });

    const eventFlow: Array<{ type: TaskEventType; expectedState: string }> = [
      { type: "QUEUE", expectedState: "queue" },
      { type: "START", expectedState: "in_progress" },
      { type: "PLAN_COMPLETE", expectedState: "in_progress" },
      { type: "ALL_SUBTASKS_DONE", expectedState: "in_progress" },
      { type: "CHECK_PASSED", expectedState: "review" },
      { type: "APPROVED", expectedState: "completed" },
    ];

    for (let i = 0; i < eventFlow.length; i++) {
      const { type, expectedState } = eventFlow[i];

      mockGetTask.mockResolvedValue(currentTask);
      mockUpdateTask.mockImplementation(async (_, updates) => {
        currentTask = { ...current_task, ...updates } as UnifiedTask;
        return currentTask;
      });

      const event: TaskEvent = {
        eventId: `evt_${i + 1}`,
        sequence: i + 1,
        type,
        timestamp: `2026-01-15T10:0${i}:00.000Z`,
      };

      const result = await store.applyEvent(taskDir, event);

      expect(result.success).toBe(true);
      expect(currentTask.status).toBe(expectedState);
    }
  });

  it("handles pause/resume flow", async () => {
    let currentTask = createTaskInState("queue", {
      id: "task1",
      lastEvent: { eventId: "evt_1", sequence: 1, type: "QUEUE", timestamp: "2026-01-15T10:00:00.000Z" },
    });

    // PAUSE
    mockGetTask.mockResolvedValue(currentTask);
    mockUpdateTask.mockImplementation(async (_, updates) => {
      currentTask = { ...current_task, ...updates } as UnifiedTask;
      return currentTask;
    });

    let result = await store.applyEvent(taskDir, {
      eventId: "evt_2",
      sequence: 2,
      type: "PAUSE",
      timestamp: "2026-01-15T10:01:00.000Z",
    });

    expect(result.success).toBe(true);
    expect(currentTask.status).toBe("paused");
    expect(currentTask.machine_context?.paused_snapshot).toBeDefined();

    // RESUME
    mockGetTask.mockResolvedValue(currentTask);

    result = await store.applyEvent(taskDir, {
      eventId: "evt_3",
      sequence: 3,
      type: "RESUME",
      timestamp: "2026-01-15T10:02:00.000Z",
    });

    expect(result.success).toBe(true);
    expect(currentTask.status).toBe("queue");
    expect(currentTask.machine_context?.paused_snapshot).toBeUndefined();
  });
});

// =============================================================================
// Legacy State Normalization Tests
// =============================================================================

describe("Legacy State Normalization", () => {
  let store: TaskEventStore;
  const taskDir = "/workspace/.viben/tasks/01-01-test-task";

  beforeEach(() => {
    store = new TaskEventStore();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockAppendFile.mockResolvedValue(undefined);
  });

  it("rejects RETRY from completed state (terminal)", async () => {
    const task = createMockTask({
      id: "task1",
      status: "completed",
      xstateState: "completed",
    });
    mockGetTask.mockResolvedValue(task);

    // Trying RETRY from 'completed' should fail (completed is terminal)
    const result = await store.validateEvent(taskDir, {
      eventId: "evt_1",
      sequence: 1,
      type: "RETRY",
      timestamp: "2026-01-15T10:00:00.000Z",
    });

    // 'completed' is a terminal state
    expect(result.success).toBe(false);
    expect(result.error).toBe("INVALID_TRANSITION");
  });

  it("normalizes 'error' state to 'failed'", async () => {
    const task = createMockTask({
      id: "task1",
      status: "failed",
      xstateState: "error" as any, // Legacy state
    });
    mockGetTask.mockResolvedValue(task);
    mockUpdateTask.mockImplementation(async (_, updates) => ({ ...task, ...updates }));

    // RETRY from 'error' (normalized to 'failed') should work
    const result = await store.applyEvent(taskDir, {
      eventId: "evt_1",
      sequence: 1,
      type: "RETRY",
      timestamp: "2026-01-15T10:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Review Reason Computation Tests
// =============================================================================

describe("Review Reason Computation", () => {
  let store: TaskEventStore;
  const taskDir = "/workspace/.viben/tasks/01-01-test-task";

  beforeEach(() => {
    store = new TaskEventStore();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockAppendFile.mockResolvedValue(undefined);
  });

  it("sets reviewReason to 'completed' on CHECK_PASSED", async () => {
    const task = createTaskInState("in_progress", {
      id: "task1",
      xstateState: { in_progress: "check" },
      lastEvent: { eventId: "evt_4", sequence: 4, type: "ALL_SUBTASKS_DONE", timestamp: "2026-01-15T10:03:00.000Z" },
    });
    mockGetTask.mockResolvedValue(task);
    mockUpdateTask.mockImplementation(async (_, updates) => ({ ...task, ...updates }));

    await store.applyEvent(taskDir, {
      eventId: "evt_5",
      sequence: 5,
      type: "CHECK_PASSED",
      timestamp: "2026-01-15T10:04:00.000Z",
    });

    expect(mockUpdateTask).toHaveBeenCalledWith(taskDir, expect.objectContaining({
      reviewReason: "completed",
    }));
  });

  it("sets reviewReason to 'stopped' on USER_STOPPED", async () => {
    const task = createTaskInState("in_progress", {
      id: "task1",
      xstateState: { in_progress: "implement" },
      lastEvent: { eventId: "evt_3", sequence: 3, type: "PLAN_COMPLETE", timestamp: "2026-01-15T10:02:00.000Z" },
      machine_context: { current_subtask_index: 1, requires_plan_review: false }, // Has progress
    });
    mockGetTask.mockResolvedValue(task);
    mockUpdateTask.mockImplementation(async (_, updates) => ({ ...task, ...updates }));

    await store.applyEvent(taskDir, {
      eventId: "evt_4",
      sequence: 4,
      type: "USER_STOPPED",
      timestamp: "2026-01-15T10:03:00.000Z",
    });

    expect(mockUpdateTask).toHaveBeenCalledWith(taskDir, expect.objectContaining({
      reviewReason: "stopped",
    }));
  });

  it("sets reviewReason to 'qa_rejected' on CHECK_FAILED", async () => {
    const task = createTaskInState("in_progress", {
      id: "task1",
      xstateState: { in_progress: "check" },
      lastEvent: { eventId: "evt_4", sequence: 4, type: "ALL_SUBTASKS_DONE", timestamp: "2026-01-15T10:03:00.000Z" },
    });
    mockGetTask.mockResolvedValue(task);
    mockUpdateTask.mockImplementation(async (_, updates) => ({ ...task, ...updates }));

    await store.applyEvent(taskDir, {
      eventId: "evt_5",
      sequence: 5,
      type: "CHECK_FAILED",
      timestamp: "2026-01-15T10:04:00.000Z",
    });

    expect(mockUpdateTask).toHaveBeenCalledWith(taskDir, expect.objectContaining({
      reviewReason: "qa_rejected",
    }));
  });
});

// =============================================================================
// Self-Transition (SUBTASK_COMPLETE) Comprehensive Tests
// =============================================================================

describe("Self-Transition Tests", () => {
  let store: TaskEventStore;
  const taskDir = "/workspace/.viben/tasks/01-01-test-task";

  beforeEach(() => {
    store = new TaskEventStore();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00.000Z"));
    mockExistsSync.mockReturnValue(true);
    mockAppendFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles multiple consecutive SUBTASK_COMPLETE events", async () => {
    let currentTask = createTaskInState("in_progress", {
      id: "task1",
      xstateState: { in_progress: "implement" },
      lastEvent: { eventId: "evt_3", sequence: 3, type: "PLAN_COMPLETE", timestamp: "2026-01-15T10:02:00.000Z" },
      machine_context: { current_subtask_index: 0, requires_plan_review: false },
    });

    // Apply 5 consecutive SUBTASK_COMPLETE events
    for (let i = 0; i < 5; i++) {
      mockGetTask.mockResolvedValue(currentTask);
      mockUpdateTask.mockImplementation(async (_, updates) => {
        currentTask = { ...current_task, ...updates } as UnifiedTask;
        return currentTask;
      });

      const result = await store.applyEvent(taskDir, {
        eventId: `evt_${4 + i}`,
        sequence: 4 + i,
        type: "SUBTASK_COMPLETE",
        timestamp: `2026-01-15T10:0${3 + i}:00.000Z`,
      });

      expect(result.success).toBe(true);
      expect(currentTask.machine_context?.current_subtask_index).toBe(i + 1);
    }

    // Verify final state
    expect(currentTask.machine_context?.current_subtask_index).toBe(5);
    expect(currentTask.status).toBe("in_progress");
    expect(currentTask.xstate_state).toEqual({ in_progress: "implement" });
  });

  it("validates SUBTASK_COMPLETE without applying", async () => {
    const task = createTaskInState("in_progress", {
      id: "task1",
      xstateState: { in_progress: "implement" },
      lastEvent: { eventId: "evt_3", sequence: 3, type: "PLAN_COMPLETE", timestamp: "2026-01-15T10:02:00.000Z" },
    });
    mockGetTask.mockResolvedValue(task);

    const result = await store.validateEvent(taskDir, {
      eventId: "evt_4",
      sequence: 4,
      type: "SUBTASK_COMPLETE",
      timestamp: "2026-01-15T10:03:00.000Z",
    });

    expect(result.success).toBe(true);
    // Validation should not modify task
    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it("rejects SUBTASK_COMPLETE from check state", async () => {
    const task = createTaskInState("in_progress", {
      id: "task1",
      xstateState: { in_progress: "check" },
      lastEvent: { eventId: "evt_4", sequence: 4, type: "ALL_SUBTASKS_DONE", timestamp: "2026-01-15T10:03:00.000Z" },
    });
    mockGetTask.mockResolvedValue(task);

    const result = await store.applyEvent(taskDir, {
      eventId: "evt_5",
      sequence: 5,
      type: "SUBTASK_COMPLETE",
      timestamp: "2026-01-15T10:04:00.000Z",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("INVALID_TRANSITION");
  });

  it("rejects SUBTASK_COMPLETE from fix state", async () => {
    const task = createTaskInState("in_progress", {
      id: "task1",
      xstateState: { in_progress: "fix" },
      lastEvent: { eventId: "evt_5", sequence: 5, type: "CHECK_FAILED", timestamp: "2026-01-15T10:04:00.000Z" },
    });
    mockGetTask.mockResolvedValue(task);

    const result = await store.applyEvent(taskDir, {
      eventId: "evt_6",
      sequence: 6,
      type: "SUBTASK_COMPLETE",
      timestamp: "2026-01-15T10:05:00.000Z",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("INVALID_TRANSITION");
  });

  it("rejects SUBTASK_COMPLETE from queue state", async () => {
    const task = createTaskInState("queue", {
      id: "task1",
      lastEvent: { eventId: "evt_1", sequence: 1, type: "QUEUE", timestamp: "2026-01-15T10:00:00.000Z" },
    });
    mockGetTask.mockResolvedValue(task);

    const result = await store.applyEvent(taskDir, {
      eventId: "evt_2",
      sequence: 2,
      type: "SUBTASK_COMPLETE",
      timestamp: "2026-01-15T10:01:00.000Z",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("INVALID_TRANSITION");
  });
});

// =============================================================================
// File System Error Handling Tests
// =============================================================================

describe("File System Error Handling", () => {
  let store: TaskEventStore;
  const taskDir = "/workspace/.viben/tasks/01-01-test-task";

  beforeEach(() => {
    store = new TaskEventStore();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  it("handles readFile error gracefully in getEventHistory", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockRejectedValue(new Error("ENOENT: file not found"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const events = await store.getEventHistory(taskDir);

    expect(events).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error reading events.jsonl"),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("handles writeFile error during legacy migration", async () => {
    mockExistsSync.mockReturnValue(false);
    const task = createTaskInState("queue", {
      id: "task1",
      eventHistory: [
        { eventId: "evt_1", sequence: 1, type: "QUEUE", timestamp: "2026-01-15T10:00:00.000Z" },
      ],
    });
    mockGetTask.mockResolvedValue(task);
    mockWriteFile.mockRejectedValue(new Error("EACCES: permission denied"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Should still return events even if migration fails
    const events = await store.getEventHistory(taskDir);

    expect(events).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to migrate event history"),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
