/**
 * Event Service Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventService } from "./events";
import type { GatewayEvent } from "./events";

describe("EventService", () => {
  let service: EventService;

  beforeEach(() => {
    service = new EventService();
  });

  describe("subscribe and broadcast", () => {
    it("should notify subscribers of events", () => {
      const listener = vi.fn();
      service.subscribe(listener);

      const event: GatewayEvent = {
        type: "agent_spawned",
        data: { agentId: "agent-1", sessionId: "session-1" },
      };
      service.broadcast(event);

      expect(listener).toHaveBeenCalledWith(event);
    });

    it("should notify multiple subscribers", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      service.subscribe(listener1);
      service.subscribe(listener2);

      const event: GatewayEvent = {
        type: "agent_completed",
        data: { agentId: "agent-1", sessionId: "session-1", success: true },
      };
      service.broadcast(event);

      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);
    });
  });

  describe("unsubscribe", () => {
    it("should stop notifying unsubscribed listeners", () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);
      unsubscribe();

      const event: GatewayEvent = {
        type: "agent_spawned",
        data: { agentId: "agent-1", sessionId: "session-1" },
      };
      service.broadcast(event);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("convenience methods", () => {
    it("should emit agent_spawned event", () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.agentSpawned("agent-1", "session-1");

      expect(listener).toHaveBeenCalledWith({
        type: "agent_spawned",
        data: { agentId: "agent-1", sessionId: "session-1" },
      });
    });

    it("should emit agent_completed event", () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.agentCompleted("agent-1", "session-1", true);

      expect(listener).toHaveBeenCalledWith({
        type: "agent_completed",
        data: { agentId: "agent-1", sessionId: "session-1", success: true },
      });
    });

    it("should emit task_status_changed event", () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.taskStatusChanged("task-1", "pending", "completed");

      expect(listener).toHaveBeenCalledWith({
        type: "task_status_changed",
        data: { taskId: "task-1", oldStatus: "pending", newStatus: "completed" },
      });
    });
  });

  describe("event types", () => {
    it("should handle various event types", () => {
      const listener = vi.fn();
      service.subscribe(listener);

      const events: GatewayEvent[] = [
        { type: "agent_spawned", data: { agentId: "a", sessionId: "s" } },
        { type: "agent_completed", data: { agentId: "a", sessionId: "s", success: true } },
        { type: "task_created", data: { taskId: "t" } },
        { type: "task_updated", data: { taskId: "t" } },
        { type: "session_created", data: { sessionId: "s" } },
        { type: "session_updated", data: { sessionId: "s" } },
      ];

      for (const event of events) {
        service.broadcast(event);
      }

      expect(listener).toHaveBeenCalledTimes(events.length);
    });
  });

  describe("patch subscription", () => {
    it("should broadcast patches to patch subscribers", () => {
      const patchListener = vi.fn();
      service.subscribePatch(patchListener);

      const patch = [{ op: "add", path: "/tasks/1", value: { id: "1" } }];
      service.broadcastPatch(patch);

      expect(patchListener).toHaveBeenCalledWith(patch);
    });

    it("should unsubscribe from patches", () => {
      const patchListener = vi.fn();
      const unsubscribe = service.subscribePatch(patchListener);
      unsubscribe();

      service.broadcastPatch([{ op: "add", path: "/test" }]);

      expect(patchListener).not.toHaveBeenCalled();
    });
  });
});
