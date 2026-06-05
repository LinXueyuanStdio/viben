// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { useCommandQueue, useCommandQueueInputRecall } from "../command-queue";

describe("useCommandQueue", () => {
  test("recalls queued items in order and clears the queue", () => {
    const { result } = renderHook(() =>
      useCommandQueue({
        id: `recall-${Date.now()}`,
        isBusy: true,
        supportsSteer: false,
        onSend: vi.fn(),
        onSteer: vi.fn(),
      })
    );

    act(() => {
      result.current.enqueue("first");
      result.current.enqueue("second");
    });

    expect(result.current.items.map((item) => item.content)).toEqual(["first", "second"]);

    let recalled: string[] = [];
    act(() => {
      recalled = result.current.recall().map((item) => item.content);
    });

    expect(recalled).toEqual(["first", "second"]);
    expect(result.current.items).toEqual([]);
  });

  test("provides an empty-input ArrowUp recall handler for ChatInput", () => {
    const onRecalled = vi.fn();
    const { result } = renderHook(() => {
      const [value, setValue] = useState("");
      const queue = useCommandQueue({
        id: `input-recall-${Date.now()}`,
        isBusy: true,
        supportsSteer: false,
        onSend: vi.fn(),
        onSteer: vi.fn(),
      });
      const recallInput = useCommandQueueInputRecall({
        value,
        onValueChange: setValue,
        recall: queue.recall,
        onRecalled,
      });

      return { value, setValue, queue, recallInput };
    });

    act(() => {
      result.current.queue.enqueue("first");
      result.current.queue.enqueue("second");
    });

    act(() => {
      result.current.recallInput.onRecallQueuedInput("");
    });

    expect(result.current.value).toBe("first\n\nsecond");
    expect(result.current.queue.items).toEqual([]);
    expect(onRecalled).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ content: "first" }),
        expect.objectContaining({ content: "second" }),
      ]),
      "first\n\nsecond"
    );
  });

  test("does not recall queue when input is not empty", () => {
    const { result } = renderHook(() => {
      const [value, setValue] = useState("draft");
      const queue = useCommandQueue({
        id: `input-recall-non-empty-${Date.now()}`,
        isBusy: true,
        supportsSteer: false,
        onSend: vi.fn(),
        onSteer: vi.fn(),
      });
      const recallInput = useCommandQueueInputRecall({
        value,
        onValueChange: setValue,
        recall: queue.recall,
      });

      return { value, queue, recallInput };
    });

    act(() => {
      result.current.queue.enqueue("queued");
    });

    act(() => {
      result.current.recallInput.onRecallQueuedInput("draft");
    });

    expect(result.current.value).toBe("draft");
    expect(result.current.queue.items.map((item) => item.content)).toEqual(["queued"]);
  });
});
