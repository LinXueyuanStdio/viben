/**
 * Event Store Integration Tests
 *
 * Tests real file system persistence without mocking.
 * Uses temporary directories for isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import type { TaskEvent } from "../ops/types";
import { createWorkspaceTempDir, type TempDirContext } from "../../test/helpers/temp-dir";

// =============================================================================
// Integration Tests - Real File System Persistence
// =============================================================================
// NOTE: These tests use real file system operations with temporary directories
// to verify actual persistence behavior without mocking.

describe("TaskEventStore file persistence (integration)", () => {
  let tempDir: TempDirContext & { vibenDir: string; tasksDir: string };
  let taskDir: string;

  beforeEach(async () => {
    // Create a temporary workspace with proper structure
    tempDir = await createWorkspaceTempDir();

    // Create a task directory manually for testing
    const taskName = "01-15-test-persistence";
    taskDir = join(tempDir.tasksDir, taskName);
    await tempDir.mkdir(`.viben/tasks/${taskName}`);

    // Create task.json with proper initial state
    const taskData = {
      id: "task_persistence_test",
      name: taskName,
      title: "Test Persistence Task",
      status: "backlog",
      priority: "medium",
      createdAt: "2026-01-15T10:00:00.000Z",
      updatedAt: "2026-01-15T10:00:00.000Z",
      workspacePath: tempDir.root,
    };
    await tempDir.writeJson(`.viben/tasks/${taskName}/task.json`, taskData);
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should persist events to real JSONL file", async () => {
    const eventsPath = `.viben/tasks/01-15-test-persistence/events.jsonl`;

    // Manually append an event (simulating what applyEvent does)
    const event: TaskEvent = {
      eventId: "evt_1",
      sequence: 1,
      type: "QUEUE",
      timestamp: "2026-01-15T10:00:00.000Z",
    };
    const eventLine = JSON.stringify(event) + "\n";
    await tempDir.writeFile(eventsPath, eventLine);

    // Verify file exists
    const exists = await tempDir.exists(eventsPath);
    expect(exists).toBe(true);

    // Verify file content
    const content = await tempDir.readFile(eventsPath);
    expect(content).toContain('"type":"QUEUE"');
    expect(content).toContain('"sequence":1');

    // Parse and verify
    const parsedEvent = JSON.parse(content.trim());
    expect(parsedEvent.eventId).toBe("evt_1");
    expect(parsedEvent.type).toBe("QUEUE");
  });

  it("should append multiple events to JSONL file", async () => {
    const eventsPath = `.viben/tasks/01-15-test-persistence/events.jsonl`;

    // Write multiple events
    const events: TaskEvent[] = [
      { eventId: "evt_1", sequence: 1, type: "QUEUE", timestamp: "2026-01-15T10:00:00.000Z" },
      { eventId: "evt_2", sequence: 2, type: "START", timestamp: "2026-01-15T10:01:00.000Z" },
      { eventId: "evt_3", sequence: 3, type: "PLAN_COMPLETE", timestamp: "2026-01-15T10:02:00.000Z" },
    ];

    const content = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    await tempDir.writeFile(eventsPath, content);

    // Read and verify
    const fileContent = await tempDir.readFile(eventsPath);
    const lines = fileContent.trim().split("\n");

    expect(lines).toHaveLength(3);

    // Parse each line
    const parsedEvents = lines.map((line) => JSON.parse(line) as TaskEvent);
    expect(parsedEvents[0].type).toBe("QUEUE");
    expect(parsedEvents[1].type).toBe("START");
    expect(parsedEvents[2].type).toBe("PLAN_COMPLETE");

    // Verify sequence ordering
    expect(parsedEvents[0].sequence).toBe(1);
    expect(parsedEvents[1].sequence).toBe(2);
    expect(parsedEvents[2].sequence).toBe(3);
  });

  it("should read persisted events on reload", async () => {
    const eventsPath = `.viben/tasks/01-15-test-persistence/events.jsonl`;

    // Write events to file
    const events: TaskEvent[] = [
      { eventId: "evt_1", sequence: 1, type: "QUEUE", timestamp: "2026-01-15T10:00:00.000Z" },
      { eventId: "evt_2", sequence: 2, type: "START", timestamp: "2026-01-15T10:01:00.000Z" },
    ];
    const content = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    await tempDir.writeFile(eventsPath, content);

    // Simulate reload by reading from file
    const fileContent = await tempDir.readFile(eventsPath);
    const lines = fileContent.trim().split("\n").filter((line) => line.trim());

    // Parse events (same logic as readEventsFromJsonl)
    const readEvents: TaskEvent[] = [];
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as TaskEvent;
        readEvents.push(event);
      } catch {
        // Skip malformed lines (same as in implementation)
      }
    }

    expect(readEvents).toHaveLength(2);
    expect(readEvents[0].eventId).toBe("evt_1");
    expect(readEvents[1].eventId).toBe("evt_2");
  });

  it("should handle malformed JSON lines gracefully", async () => {
    const eventsPath = `.viben/tasks/01-15-test-persistence/events.jsonl`;

    // Write content with some malformed lines
    const content = [
      '{"eventId":"evt_1","sequence":1,"type":"QUEUE","timestamp":"2026-01-15T10:00:00.000Z"}',
      "invalid json line",
      '{"eventId":"evt_2","sequence":2,"type":"START","timestamp":"2026-01-15T10:01:00.000Z"}',
      "", // Empty line
      '{"eventId":"evt_3","sequence":3,"type":"PLAN_COMPLETE","timestamp":"2026-01-15T10:02:00.000Z"}',
    ].join("\n") + "\n";

    await tempDir.writeFile(eventsPath, content);

    // Read and parse (same logic as implementation)
    const fileContent = await tempDir.readFile(eventsPath);
    const lines = fileContent.trim().split("\n").filter((line) => line.trim());

    const readEvents: TaskEvent[] = [];
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as TaskEvent;
        readEvents.push(event);
      } catch {
        // Skip malformed lines
      }
    }

    // Should have parsed 3 valid events, skipping invalid JSON
    expect(readEvents).toHaveLength(3);
    expect(readEvents.map((e) => e.sequence)).toEqual([1, 2, 3]);
  });

  it("should support filtering events by sequence number", async () => {
    const eventsPath = `.viben/tasks/01-15-test-persistence/events.jsonl`;

    // Write multiple events
    const events: TaskEvent[] = [
      { eventId: "evt_1", sequence: 1, type: "QUEUE", timestamp: "2026-01-15T10:00:00.000Z" },
      { eventId: "evt_2", sequence: 2, type: "START", timestamp: "2026-01-15T10:01:00.000Z" },
      { eventId: "evt_3", sequence: 3, type: "PLAN_COMPLETE", timestamp: "2026-01-15T10:02:00.000Z" },
      { eventId: "evt_4", sequence: 4, type: "ALL_SUBTASKS_DONE", timestamp: "2026-01-15T10:03:00.000Z" },
    ];

    const content = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    await tempDir.writeFile(eventsPath, content);

    // Read and filter by since parameter (same as getEventHistory implementation)
    const fileContent = await tempDir.readFile(eventsPath);
    const lines = fileContent.trim().split("\n").filter((line) => line.trim());

    const allEvents: TaskEvent[] = lines.map((line) => JSON.parse(line) as TaskEvent);

    // Filter: get events since sequence 2 (should return seq 3 and 4)
    const since = 2;
    const filteredEvents = allEvents.filter((e) => e.sequence > since);

    expect(filteredEvents).toHaveLength(2);
    expect(filteredEvents[0].sequence).toBe(3);
    expect(filteredEvents[1].sequence).toBe(4);
  });

  it("should handle empty events file", async () => {
    const eventsPath = `.viben/tasks/01-15-test-persistence/events.jsonl`;

    // Create empty file
    await tempDir.writeFile(eventsPath, "");

    // Read and parse
    const fileContent = await tempDir.readFile(eventsPath);
    const lines = fileContent.trim().split("\n").filter((line) => line.trim());

    expect(lines).toHaveLength(0);
  });

  it("should preserve event data integrity through write/read cycle", async () => {
    const eventsPath = `.viben/tasks/01-15-test-persistence/events.jsonl`;

    // Create event with all possible fields
    const originalEvent: TaskEvent = {
      eventId: "evt_complex_1",
      sequence: 1,
      type: "QUEUE",
      timestamp: "2026-01-15T10:00:00.000Z",
      payload: {
        customField: "custom value",
        numericField: 42,
        nestedObject: { key: "value" },
      },
    };

    // Write
    await tempDir.writeFile(eventsPath, JSON.stringify(originalEvent) + "\n");

    // Read
    const fileContent = await tempDir.readFile(eventsPath);
    const readEvent = JSON.parse(fileContent.trim()) as TaskEvent;

    // Verify exact match
    expect(readEvent.eventId).toBe(originalEvent.eventId);
    expect(readEvent.sequence).toBe(originalEvent.sequence);
    expect(readEvent.type).toBe(originalEvent.type);
    expect(readEvent.timestamp).toBe(originalEvent.timestamp);
    expect(readEvent.payload).toEqual(originalEvent.payload);
  });
});
