// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useCommandQueue } from "../command-queue";

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
});
