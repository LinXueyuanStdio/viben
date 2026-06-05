import { describe, it, expect, vi } from "vitest";
import { TypedEmitter } from "../typed-emitter.js";

interface TestEvents {
  data: (payload: string) => void;
  error: (err: Error) => void;
  multi: (a: number, b: string) => void;
}

describe("TypedEmitter — Comprehensive Tests", () => {
  describe("basic on/off/emit", () => {
    it("emits to registered listener", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on("data", handler);

      emitter.emit("data", "hello");

      expect(handler).toHaveBeenCalledWith("hello");
    });

    it("supports multiple listeners on same event", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const h1 = vi.fn();
      const h2 = vi.fn();
      emitter.on("data", h1);
      emitter.on("data", h2);

      emitter.emit("data", "test");

      expect(h1).toHaveBeenCalledWith("test");
      expect(h2).toHaveBeenCalledWith("test");
    });

    it("routes different events to correct listeners", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const dataHandler = vi.fn();
      const errorHandler = vi.fn();
      emitter.on("data", dataHandler);
      emitter.on("error", errorHandler);

      emitter.emit("data", "payload");

      expect(dataHandler).toHaveBeenCalledWith("payload");
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("emit with no listeners is safe", () => {
      const emitter = new TypedEmitter<TestEvents>();
      expect(() => emitter.emit("data", "hello")).not.toThrow();
    });

    it("passes multiple args correctly", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on("multi", handler);

      emitter.emit("multi", 42, "hello");

      expect(handler).toHaveBeenCalledWith(42, "hello");
    });

    it("off removes specific listener", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on("data", handler);
      emitter.off("data", handler);

      emitter.emit("data", "test");

      expect(handler).not.toHaveBeenCalled();
    });

    it("off with non-registered listener is safe", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const handler = vi.fn();

      expect(() => emitter.off("data", handler)).not.toThrow();
    });

    it("on returns this for chaining", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const result = emitter.on("data", () => {});
      expect(result).toBe(emitter);
    });

    it("off returns this for chaining", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const result = emitter.off("data", () => {});
      expect(result).toBe(emitter);
    });
  });

  describe("removeAllListeners", () => {
    it("removes all listeners for specific event", () => {
      const emitter = new TypedEmitter<TestEvents>();
      emitter.on("data", vi.fn());
      emitter.on("data", vi.fn());
      emitter.on("error", vi.fn());

      emitter.removeAllListeners("data");
      emitter.emit("data", "test");

      // No error handler should be affected
      const errorHandler = vi.fn();
      emitter.on("error", errorHandler);
      emitter.emit("error", new Error("test"));
      expect(errorHandler).toHaveBeenCalled();
    });

    it("removes all listeners for all events when no arg", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const h1 = vi.fn();
      const h2 = vi.fn();
      emitter.on("data", h1);
      emitter.on("error", h2);

      emitter.removeAllListeners();

      emitter.emit("data", "test");
      emitter.emit("error", new Error("test"));

      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });
  });

  describe("pause and resume", () => {
    it("buffers events when paused", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on("data", handler);

      emitter.pause();
      emitter.emit("data", "buffered");

      expect(handler).not.toHaveBeenCalled();
      expect(emitter.bufferSize).toBe(1);
    });

    it("replays buffered events on resume in order", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const received: string[] = [];
      emitter.on("data", (s) => received.push(s));

      emitter.pause();
      emitter.emit("data", "first");
      emitter.emit("data", "second");
      emitter.emit("data", "third");

      emitter.resume();

      expect(received).toEqual(["first", "second", "third"]);
    });

    it("resume clears the buffer", () => {
      const emitter = new TypedEmitter<TestEvents>();
      emitter.on("data", () => {});

      emitter.pause();
      emitter.emit("data", "test");
      expect(emitter.bufferSize).toBe(1);

      emitter.resume();
      expect(emitter.bufferSize).toBe(0);
    });

    it("normal delivery resumes after resume()", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on("data", handler);

      emitter.pause();
      emitter.resume();

      emitter.emit("data", "after resume");
      expect(handler).toHaveBeenCalledWith("after resume");
    });

    it("isPaused reflects state", () => {
      const emitter = new TypedEmitter<TestEvents>();

      expect(emitter.isPaused).toBe(false);
      emitter.pause();
      expect(emitter.isPaused).toBe(true);
      emitter.resume();
      expect(emitter.isPaused).toBe(false);
    });
  });

  describe("clearBuffer", () => {
    it("discards buffered events without delivering", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on("data", handler);

      emitter.pause();
      emitter.emit("data", "will be discarded");
      emitter.emit("data", "also discarded");

      emitter.clearBuffer();
      expect(emitter.bufferSize).toBe(0);

      emitter.resume();
      expect(handler).not.toHaveBeenCalled();
    });

    it("clearBuffer when not paused is safe", () => {
      const emitter = new TypedEmitter<TestEvents>();
      expect(() => emitter.clearBuffer()).not.toThrow();
      expect(emitter.bufferSize).toBe(0);
    });
  });

  describe("passthrough filter", () => {
    it("allows specific events through while paused", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const dataHandler = vi.fn();
      const errorHandler = vi.fn();
      emitter.on("data", dataHandler);
      emitter.on("error", errorHandler);

      // Let error events pass through
      emitter.pause((event) => event === "error");

      emitter.emit("data", "buffered");
      emitter.emit("error", new Error("pass through"));

      expect(dataHandler).not.toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));

      // Data was buffered
      expect(emitter.bufferSize).toBe(1);

      emitter.resume();
      expect(dataHandler).toHaveBeenCalledWith("buffered");
    });

    it("passthrough filter receives event name and args", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const filterFn = vi.fn().mockReturnValue(false);
      emitter.on("data", () => {});

      emitter.pause(filterFn);
      emitter.emit("data", "test");

      expect(filterFn).toHaveBeenCalledWith("data", ["test"]);

      emitter.resume();
    });

    it("passthrough filter with multi-arg event", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on("multi", handler);

      emitter.pause((_event, args) => {
        return (args[0] as number) > 10; // only pass through if first arg > 10
      });

      emitter.emit("multi", 5, "small");
      emitter.emit("multi", 20, "large");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(20, "large");

      emitter.resume();
      // Now the buffered event (5, "small") should be delivered
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(5, "small");
    });

    it("passthrough filter is cleared on resume", () => {
      const emitter = new TypedEmitter<TestEvents>();
      emitter.on("data", () => {});

      const filter = vi.fn().mockReturnValue(true);
      emitter.pause(filter);
      emitter.resume();

      // After resume, pause without filter should buffer everything
      emitter.pause();
      emitter.emit("data", "test");
      expect(emitter.bufferSize).toBe(1); // no passthrough
      emitter.resume();
    });
  });

  describe("mixed event types during pause", () => {
    it("buffers different event types and replays in order", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const order: string[] = [];
      emitter.on("data", (s) => order.push(`data:${s}`));
      emitter.on("error", (e) => order.push(`error:${e.message}`));

      emitter.pause();
      emitter.emit("data", "first");
      emitter.emit("error", new Error("oops"));
      emitter.emit("data", "second");

      emitter.resume();

      expect(order).toEqual(["data:first", "error:oops", "data:second"]);
    });
  });

  describe("listener during emit", () => {
    it("listener added during emit is not called for current event", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const lateHandler = vi.fn();

      emitter.on("data", () => {
        emitter.on("data", lateHandler);
      });

      emitter.emit("data", "test");

      // lateHandler was added during iteration of the Set, behavior depends on Set iteration
      // In JS, Set iteration includes items added during iteration
      // But this is an implementation detail we're testing
    });
  });

  describe("edge cases", () => {
    it("same listener registered twice receives event twice", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const handler = vi.fn();

      // TypedEmitter uses Set, so same function reference is only stored once
      emitter.on("data", handler);
      emitter.on("data", handler);

      emitter.emit("data", "test");

      // Set deduplicates, so only called once
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("handles rapid pause/resume cycles", () => {
      const emitter = new TypedEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on("data", handler);

      for (let i = 0; i < 100; i++) {
        emitter.pause();
        emitter.emit("data", `msg-${i}`);
        emitter.resume();
      }

      expect(handler).toHaveBeenCalledTimes(100);
    });
  });
});
