import { describe, it, expect, vi } from "vitest";
import { PromptQueue } from "../prompt-queue.js";

describe("PromptQueue — Comprehensive Edge Cases", () => {
  describe("basic processing", () => {
    it("processes single prompt and resolves", async () => {
      const processor = vi.fn().mockResolvedValue(undefined);
      const queue = new PromptQueue(processor);

      await queue.enqueue("hello", undefined as any);

      expect(processor).toHaveBeenCalledWith("hello", undefined, undefined, undefined, undefined, undefined);
    });

    it("passes attachments to processor", async () => {
      const processor = vi.fn().mockResolvedValue(undefined);
      const queue = new PromptQueue(processor);
      const attachments = [{ type: "image" as const, filePath: "/a", fileName: "a", mimeType: "image/png", size: 1 }];

      await queue.enqueue("hello", undefined as any, attachments);

      expect(processor).toHaveBeenCalledWith("hello", undefined, attachments, undefined, undefined, undefined);
    });
  });

  describe("serial processing guarantee", () => {
    it("processes prompts one at a time, never concurrently", async () => {
      let concurrency = 0;
      let maxConcurrency = 0;

      const processor = vi.fn().mockImplementation(async () => {
        concurrency++;
        maxConcurrency = Math.max(maxConcurrency, concurrency);
        await new Promise((r) => setTimeout(r, 10));
        concurrency--;
      });

      const queue = new PromptQueue(processor);

      const promises = [
        queue.enqueue("a"),
        queue.enqueue("b"),
        queue.enqueue("c"),
      ];

      await Promise.all(promises);

      expect(maxConcurrency).toBe(1);
      expect(processor).toHaveBeenCalledTimes(3);
    });

    it("maintains FIFO order", async () => {
      const order: string[] = [];
      const processor = vi.fn().mockImplementation(async (text: string) => {
        order.push(text);
      });

      const queue = new PromptQueue(processor);

      // First enqueue starts processing immediately
      const p1 = queue.enqueue("first");
      // These get queued
      const p2 = queue.enqueue("second");
      const p3 = queue.enqueue("third");

      await Promise.all([p1, p2, p3]);

      expect(order).toEqual(["first", "second", "third"]);
    });
  });

  describe("isProcessing and pending state", () => {
    it("isProcessing reflects current state", async () => {
      let resolve!: () => void;
      const blocker = new Promise<void>((r) => { resolve = r; });
      const processor = vi.fn().mockImplementation(() => blocker);
      const queue = new PromptQueue(processor);

      expect(queue.isProcessing).toBe(false);

      const promise = queue.enqueue("test");
      expect(queue.isProcessing).toBe(true);

      resolve();
      await promise;
      expect(queue.isProcessing).toBe(false);
    });

    it("pending count accurately reflects queue depth", async () => {
      let resolve!: () => void;
      const blocker = new Promise<void>((r) => { resolve = r; });
      const processor = vi.fn().mockImplementation(async (text: string) => {
        if (text === "block") await blocker;
      });
      const queue = new PromptQueue(processor);

      expect(queue.pending).toBe(0);

      const p1 = queue.enqueue("block");
      expect(queue.pending).toBe(0); // first is processing, not pending

      queue.enqueue("second");
      expect(queue.pending).toBe(1);

      queue.enqueue("third");
      expect(queue.pending).toBe(2);

      resolve();
      await p1;
      // Let queue drain
      await new Promise((r) => setTimeout(r, 50));
      expect(queue.pending).toBe(0);
    });
  });

  describe("clear() behavior", () => {
    it("aborts current processing via abort signal", async () => {
      let resolve!: () => void;
      const neverResolve = new Promise<void>((r) => { resolve = r; });
      const processor = vi.fn().mockImplementation(() => neverResolve);
      const queue = new PromptQueue(processor);

      const promise = queue.enqueue("long-running");
      queue.clear();

      // The promise should resolve (abort causes the processor to be rejected internally)
      // and the queue should be ready for new items
      resolve(); // let the promise settle
      await promise.catch(() => {}); // may reject due to abort

      expect(queue.isProcessing).toBe(false);
    });

    it("resolves all pending promises so callers don't hang", async () => {
      let resolve!: () => void;
      const blocker = new Promise<void>((r) => { resolve = r; });
      const processor = vi.fn().mockImplementation(async (text: string) => {
        if (text === "block") await blocker;
      });
      const queue = new PromptQueue(processor);

      const p1 = queue.enqueue("block");
      const p2 = queue.enqueue("pending1");
      const p3 = queue.enqueue("pending2");

      queue.clear();

      // p2 and p3 should resolve immediately (not hang forever)
      await expect(Promise.race([p2, new Promise((_, rej) => setTimeout(() => rej("timeout"), 100))])).resolves.toBeUndefined();
      await expect(Promise.race([p3, new Promise((_, rej) => setTimeout(() => rej("timeout"), 100))])).resolves.toBeUndefined();

      resolve();
      await p1.catch(() => {});
    });

    it("clear with empty queue is safe", () => {
      const processor = vi.fn();
      const queue = new PromptQueue(processor);

      expect(() => queue.clear()).not.toThrow();
      expect(queue.pending).toBe(0);
      expect(queue.isProcessing).toBe(false);
    });

    it("multiple consecutive clears are safe", async () => {
      let resolve!: () => void;
      const blocker = new Promise<void>((r) => { resolve = r; });
      const processor = vi.fn().mockImplementation(() => blocker);
      const queue = new PromptQueue(processor);

      queue.enqueue("test");
      queue.clear();
      queue.clear();
      queue.clear();

      resolve();
      expect(queue.pending).toBe(0);
    });

    it("can enqueue new items after clear", async () => {
      const processor = vi.fn().mockResolvedValue(undefined);
      const queue = new PromptQueue(processor);

      await queue.enqueue("first");
      queue.clear();

      // Should be able to process new items
      await queue.enqueue("after-clear", undefined as any);
      expect(processor).toHaveBeenCalledWith("after-clear", undefined, undefined, undefined, undefined, undefined);
    });
  });

  describe("error handling", () => {
    it("processor error calls onError but does not break queue", async () => {
      const onError = vi.fn();
      const processor = vi.fn()
        .mockRejectedValueOnce(new Error("first fails"))
        .mockResolvedValue(undefined);

      const queue = new PromptQueue(processor, onError);

      await queue.enqueue("first");
      expect(onError).toHaveBeenCalledWith(expect.any(Error));

      // Queue should still work
      await queue.enqueue("second", undefined as any);
      expect(processor).toHaveBeenCalledWith("second", undefined, undefined, undefined, undefined, undefined);
    });

    it("abort error is NOT forwarded to onError", async () => {
      const onError = vi.fn();
      let resolve!: () => void;
      const neverEnd = new Promise<void>((r) => { resolve = r; });
      const processor = vi.fn().mockImplementation(() => neverEnd);

      const queue = new PromptQueue(processor, onError);
      const promise = queue.enqueue("test");
      queue.clear(); // abort

      resolve();
      await promise.catch(() => {});

      // onError should NOT have been called for abort
      expect(onError).not.toHaveBeenCalled();
    });

    it("multiple errors do not accumulate state", async () => {
      const onError = vi.fn();
      const processor = vi.fn().mockRejectedValue(new Error("fail"));
      const queue = new PromptQueue(processor, onError);

      await queue.enqueue("a");
      await queue.enqueue("b");
      await queue.enqueue("c");

      expect(onError).toHaveBeenCalledTimes(3);
      expect(queue.isProcessing).toBe(false);
    });

    it("error in queued item still drains remaining", async () => {
      const order: string[] = [];
      let callCount = 0;
      const processor = vi.fn().mockImplementation(async (text: string) => {
        callCount++;
        order.push(text);
        if (callCount === 2) throw new Error("second fails");
      });
      const onError = vi.fn();
      const queue = new PromptQueue(processor, onError);

      // Make first block briefly so others queue
      let resolveFirst!: () => void;
      const firstBlock = new Promise<void>((r) => { resolveFirst = r; });
      processor.mockImplementationOnce(async (text: string) => {
        order.push(text);
        await firstBlock;
      });

      const p1 = queue.enqueue("first");
      const p2 = queue.enqueue("second");
      const p3 = queue.enqueue("third");

      resolveFirst();
      await Promise.all([p1, p2, p3]);

      expect(order).toEqual(["first", "second", "third"]);
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe("no onError handler", () => {
    it("does not throw if onError is not provided", async () => {
      const processor = vi.fn().mockRejectedValue(new Error("fail"));
      const queue = new PromptQueue(processor); // no onError

      // Should not throw
      await queue.enqueue("test");
      expect(queue.isProcessing).toBe(false);
    });
  });
});
