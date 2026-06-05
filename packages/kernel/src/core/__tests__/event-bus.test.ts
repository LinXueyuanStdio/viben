import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../event-bus.js";

describe("EventBus", () => {
  it("emits session:created event to subscribers", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("session:created", handler);
    bus.emit("session:created", {
      sessionId: "s1",
      agent: "claude",
      status: "initializing",
    });
    expect(handler).toHaveBeenCalledWith({
      sessionId: "s1",
      agent: "claude",
      status: "initializing",
    });
  });

  it("emits session:updated event", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("session:updated", handler);
    bus.emit("session:updated", {
      sessionId: "s1",
      status: "active",
      name: "Test",
    });
    expect(handler).toHaveBeenCalledWith({
      sessionId: "s1",
      status: "active",
      name: "Test",
    });
  });

  it("emits session:deleted event", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("session:deleted", handler);
    bus.emit("session:deleted", { sessionId: "s1" });
    expect(handler).toHaveBeenCalledWith({ sessionId: "s1" });
  });

  it("emits agent:event with sessionId", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("agent:event", handler);
    bus.emit("agent:event", {
      sessionId: "s1",
      event: { type: "text", content: "hello" },
    });
    expect(handler).toHaveBeenCalledWith({
      sessionId: "s1",
      event: { type: "text", content: "hello" },
    });
  });

  it("emits permission:request event", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("permission:request", handler);
    const perm = {
      id: "p1",
      description: "Write file",
      options: [{ id: "allow", label: "Allow", isAllow: true }],
    };
    bus.emit("permission:request", { sessionId: "s1", permission: perm });
    expect(handler).toHaveBeenCalledWith({ sessionId: "s1", permission: perm });
  });

  it("removes listener with off()", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("session:created", handler);
    bus.off("session:created", handler);
    bus.emit("session:created", {
      sessionId: "s1",
      agent: "claude",
      status: "initializing",
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
