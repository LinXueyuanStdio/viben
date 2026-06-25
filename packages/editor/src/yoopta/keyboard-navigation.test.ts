import { describe, expect, it } from "vitest";

import {
  findClosestTextOffsetForX,
  findVerticalNavigationTarget,
  getTargetLineCoordinates,
  groupRectsByVisualLine,
  type BlockOrderEntry,
  type RectLike,
} from "./keyboard-navigation";

const rect = (top: number, bottom: number, left = 0, right = 100): RectLike => ({
  top,
  bottom,
  left,
  right,
  width: right - left,
  height: bottom - top,
});

const blocks: BlockOrderEntry[] = [
  { id: "previous", order: 0 },
  { id: "current", order: 1 },
  { id: "next", order: 2 },
];

describe("yoopta-keyboard-navigation", () => {
  it("groups inline rect fragments into visual lines", () => {
    expect(
      groupRectsByVisualLine([
        rect(10, 28, 0, 30),
        rect(11, 29, 32, 70),
        rect(34, 52, 0, 40),
      ]),
    ).toEqual([rect(10, 29, 0, 70), rect(34, 52, 0, 40)]);
  });

  it("moves ArrowDown to the next block from the last visual line even before the block text end", () => {
    const target = findVerticalNavigationTarget({
      direction: "down",
      currentBlockId: "current",
      caretRect: rect(34, 52, 12, 12),
      visualLines: [rect(10, 28), rect(34, 52)],
      blocks,
    });

    expect(target).toEqual({ blockId: "next", placement: "start", x: 12 });
  });

  it("keeps ArrowDown inside the current block before the last visual line", () => {
    const target = findVerticalNavigationTarget({
      direction: "down",
      currentBlockId: "current",
      caretRect: rect(10, 28, 12, 12),
      visualLines: [rect(10, 28), rect(34, 52)],
      blocks,
    });

    expect(target).toBeNull();
  });

  it("moves ArrowUp to the previous block from the first visual line", () => {
    const target = findVerticalNavigationTarget({
      direction: "up",
      currentBlockId: "current",
      caretRect: rect(10, 28, 42, 42),
      visualLines: [rect(10, 28), rect(34, 52)],
      blocks,
    });

    expect(target).toEqual({ blockId: "previous", placement: "end", x: 42 });
  });

  it("maps a carried caret x coordinate to the same relative text offset in the target block line", () => {
    expect(
      findClosestTextOffsetForX(
        { text: "next target line", rect: rect(60, 78, 10, 210) },
        110,
      ),
    ).toBe(8);
  });

  it("uses the target visual line midpoint and clamps x when resolving a cross-block caret target", () => {
    expect(
      getTargetLineCoordinates({
        placement: "start",
        targetX: 260,
        targetLine: rect(60, 80, 40, 220),
        fallbackRect: rect(50, 90, 0, 300),
      }),
    ).toEqual({ x: 220, y: 70 });
  });
});
