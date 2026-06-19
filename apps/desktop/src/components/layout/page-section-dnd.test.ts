import { describe, expect, it } from "vitest";

import type { PageIndex } from "@/lib/gateway/types/page";
import {
  buildPageDropPlan,
  buildPageDropPreview,
  getPageProjectedDepth,
  getPageDropPosition,
  getStaticSortableTransform,
  PAGE_DROP_INTO_THRESHOLD,
  PAGE_ROOT_DROP_START_UID,
  PAGE_ROOT_DROP_TAIL_UID,
  PAGE_TREE_DEPTH_STEP_PX,
} from "./page-section-dnd";

describe("page section drag and drop planning", () => {
  it("moves a page into the hovered page when dropped in the center band", () => {
    const index: PageIndex = {
      root: ["a", "b", "c"],
    };

    const plan = buildPageDropPlan({
      index,
      activeUid: "a",
      overUid: "b",
      dropPosition: "inside",
    });

    expect(plan).toEqual({
      nextIndex: {
        root: ["b", "c"],
        b: ["a"],
      },
      reorderRequests: [
        { parentUid: null, orderedUids: ["b", "c"] },
        { parentUid: "b", orderedUids: ["a"] },
      ],
      targetParentUid: "b",
      projectedDepth: 1,
    });
  });

  it("keeps above and below drops as sibling reorders", () => {
    const index: PageIndex = {
      root: ["a", "b", "c"],
    };

    expect(
      buildPageDropPlan({
        index,
        activeUid: "a",
        overUid: "c",
        dropPosition: "before",
      })
    ).toEqual({
      nextIndex: {
        root: ["b", "a", "c"],
      },
      reorderRequests: [{ parentUid: null, orderedUids: ["b", "a", "c"] }],
      targetParentUid: null,
      projectedDepth: 0,
    });

    expect(
      buildPageDropPlan({
        index,
        activeUid: "a",
        overUid: "c",
        dropPosition: "after",
      })
    ).toEqual({
      nextIndex: {
        root: ["b", "c", "a"],
      },
      reorderRequests: [{ parentUid: null, orderedUids: ["b", "c", "a"] }],
      targetParentUid: null,
      projectedDepth: 0,
    });
  });

  it("does not move a page into its own descendant", () => {
    const index: PageIndex = {
      root: ["a"],
      a: ["b"],
    };

    const plan = buildPageDropPlan({
      index,
      activeUid: "a",
      overUid: "b",
      dropPosition: "inside",
    });

    expect(plan).toBeNull();
  });

  it("returns an invalid preview instead of disappearing for illegal targets", () => {
    const index: PageIndex = {
      root: ["a"],
      a: ["b"],
    };

    expect(
      buildPageDropPreview({
        index,
        activeUid: "a",
        overUid: "b",
        dropPosition: "inside",
      })
    ).toMatchObject({
      uid: "b",
      position: "inside",
      isInvalid: true,
    });
  });

  it("can reorder root fallback pages that are missing from the persisted root index", () => {
    const index: PageIndex = {
      root: ["a"],
    };

    const plan = buildPageDropPlan({
      index,
      rootUids: ["a", "b"],
      activeUid: "b",
      overUid: "a",
      dropPosition: "before",
    });

    expect(plan).toEqual({
      nextIndex: {
        root: ["b", "a"],
      },
      reorderRequests: [{ parentUid: null, orderedUids: ["b", "a"] }],
      targetParentUid: null,
      projectedDepth: 0,
    });
  });

  it("moves a child page out to the hovered page parent level", () => {
    const index: PageIndex = {
      root: ["a", "c"],
      a: ["b"],
    };

    const plan = buildPageDropPlan({
      index,
      rootUids: ["a", "c"],
      activeUid: "b",
      overUid: "c",
      dropPosition: "before",
    });

    expect(plan).toEqual({
      nextIndex: {
        root: ["a", "b", "c"],
        a: [],
      },
      reorderRequests: [
        { parentUid: "a", orderedUids: [] },
        { parentUid: null, orderedUids: ["a", "b", "c"] },
      ],
      targetParentUid: null,
      projectedDepth: 0,
    });
  });

  it("moves a child page to root when the pointer is projected to root depth", () => {
    const index: PageIndex = {
      root: ["a", "c"],
      a: ["b"],
    };

    const plan = buildPageDropPlan({
      index,
      rootUids: ["a", "c"],
      visibleRows: [
        { uid: "a", depth: 0, parentUid: null },
        { uid: "b", depth: 1, parentUid: "a" },
        { uid: "c", depth: 0, parentUid: null },
      ],
      activeUid: "b",
      overUid: "c",
      dropPosition: "before",
      projectedDepth: 0,
    });

    expect(plan).toEqual({
      nextIndex: {
        root: ["a", "b", "c"],
        a: [],
      },
      reorderRequests: [
        { parentUid: "a", orderedUids: [] },
        { parentUid: null, orderedUids: ["a", "b", "c"] },
      ],
      targetParentUid: null,
      projectedDepth: 0,
    });
  });

  it("indents after the previous visible row when projected right", () => {
    const index: PageIndex = {
      root: ["a", "c"],
    };

    const plan = buildPageDropPlan({
      index,
      rootUids: ["a", "c"],
      visibleRows: [
        { uid: "a", depth: 0, parentUid: null },
        { uid: "c", depth: 0, parentUid: null },
      ],
      activeUid: "c",
      overUid: "c",
      dropPosition: "after",
      projectedDepth: 1,
    });

    expect(plan).toEqual({
      nextIndex: {
        root: ["a"],
        a: ["c"],
      },
      reorderRequests: [
        { parentUid: null, orderedUids: ["a"] },
        { parentUid: "a", orderedUids: ["c"] },
      ],
      targetParentUid: "a",
      projectedDepth: 1,
    });
  });

  it("moves a page into a child page when the after line is projected to child depth", () => {
    const index: PageIndex = {
      root: ["a", "d"],
      a: ["b"],
    };

    const plan = buildPageDropPlan({
      index,
      rootUids: ["a", "d"],
      visibleRows: [
        { uid: "a", depth: 0, parentUid: null },
        { uid: "b", depth: 1, parentUid: "a" },
        { uid: "d", depth: 0, parentUid: null },
      ],
      activeUid: "d",
      overUid: "b",
      dropPosition: "after",
      projectedDepth: 2,
    });

    expect(plan).toEqual({
      nextIndex: {
        root: ["a"],
        a: ["b"],
        b: ["d"],
      },
      reorderRequests: [
        { parentUid: null, orderedUids: ["a"] },
        { parentUid: "b", orderedUids: ["d"] },
      ],
      targetParentUid: "b",
      projectedDepth: 2,
    });
  });

  it("moves a child page out of its parent when projected left", () => {
    const index: PageIndex = {
      root: ["a"],
      a: ["b", "c"],
    };

    const plan = buildPageDropPlan({
      index,
      rootUids: ["a"],
      visibleRows: [
        { uid: "a", depth: 0, parentUid: null },
        { uid: "b", depth: 1, parentUid: "a" },
        { uid: "c", depth: 1, parentUid: "a" },
      ],
      activeUid: "c",
      overUid: "c",
      dropPosition: "after",
      projectedDepth: 0,
    });

    expect(plan).toEqual({
      nextIndex: {
        root: ["a", "c"],
        a: ["b"],
      },
      reorderRequests: [
        { parentUid: "a", orderedUids: ["b"] },
        { parentUid: null, orderedUids: ["a", "c"] },
      ],
      targetParentUid: null,
      projectedDepth: 0,
    });
  });

  it("moves a page to the root start drop zone", () => {
    const index: PageIndex = {
      root: ["a"],
      a: ["b"],
    };

    const plan = buildPageDropPlan({
      index,
      rootUids: ["a"],
      visibleRows: [
        { uid: "a", depth: 0, parentUid: null },
        { uid: "b", depth: 1, parentUid: "a" },
      ],
      activeUid: "b",
      overUid: PAGE_ROOT_DROP_START_UID,
      dropPosition: "before",
      projectedDepth: 0,
    });

    expect(plan).toEqual({
      nextIndex: {
        root: ["b", "a"],
        a: [],
      },
      reorderRequests: [
        { parentUid: "a", orderedUids: [] },
        { parentUid: null, orderedUids: ["b", "a"] },
      ],
      targetParentUid: null,
      projectedDepth: 0,
    });
  });

  it("moves a page to the root tail drop zone", () => {
    const index: PageIndex = {
      root: ["a"],
      a: ["b"],
    };

    const plan = buildPageDropPlan({
      index,
      rootUids: ["a"],
      visibleRows: [
        { uid: "a", depth: 0, parentUid: null },
        { uid: "b", depth: 1, parentUid: "a" },
      ],
      activeUid: "b",
      overUid: PAGE_ROOT_DROP_TAIL_UID,
      dropPosition: "after",
      projectedDepth: 0,
    });

    expect(plan).toEqual({
      nextIndex: {
        root: ["a", "b"],
        a: [],
      },
      reorderRequests: [
        { parentUid: "a", orderedUids: [] },
        { parentUid: null, orderedUids: ["a", "b"] },
      ],
      targetParentUid: null,
      projectedDepth: 0,
    });
  });

  it("previews the root start drop zone with a root line", () => {
    const index: PageIndex = {
      root: ["a"],
      a: ["b"],
    };

    const preview = buildPageDropPreview({
      index,
      rootUids: ["a"],
      visibleRows: [
        { uid: "a", depth: 0, parentUid: null },
        { uid: "b", depth: 1, parentUid: "a" },
      ],
      activeUid: "b",
      overUid: PAGE_ROOT_DROP_START_UID,
      dropPosition: "before",
      projectedDepth: 0,
    });

    expect(preview).toEqual({
      uid: PAGE_ROOT_DROP_START_UID,
      position: "before",
      changesParent: true,
      targetParentUid: null,
      projectedDepth: 0,
      lineUid: PAGE_ROOT_DROP_START_UID,
      linePosition: "before",
      lineDepth: 0,
    });
  });

  it("previews the root tail drop zone with a root line", () => {
    const index: PageIndex = {
      root: ["a"],
      a: ["b"],
    };

    const preview = buildPageDropPreview({
      index,
      rootUids: ["a"],
      visibleRows: [
        { uid: "a", depth: 0, parentUid: null },
        { uid: "b", depth: 1, parentUid: "a" },
      ],
      activeUid: "b",
      overUid: PAGE_ROOT_DROP_TAIL_UID,
      dropPosition: "after",
      projectedDepth: 0,
    });

    expect(preview).toEqual({
      uid: PAGE_ROOT_DROP_TAIL_UID,
      position: "after",
      changesParent: true,
      targetParentUid: null,
      projectedDepth: 0,
      lineUid: PAGE_ROOT_DROP_TAIL_UID,
      linePosition: "after",
      lineDepth: 0,
    });
  });

  it("previews the final depth and target parent for before and after drops", () => {
    const index: PageIndex = {
      root: ["a", "c"],
      a: ["b"],
    };

    const preview = buildPageDropPreview({
      index,
      visibleRows: [
        { uid: "a", depth: 0, parentUid: null },
        { uid: "b", depth: 1, parentUid: "a" },
        { uid: "c", depth: 0, parentUid: null },
      ],
      activeUid: "b",
      overUid: "c",
      dropPosition: "before",
      projectedDepth: 0,
    });

    expect(preview).toEqual({
      uid: "c",
      position: "before",
      changesParent: true,
      targetParentUid: null,
      projectedDepth: 0,
      lineUid: "c",
      linePosition: "before",
      lineDepth: 0,
    });
  });

  it("previews the final child insertion line for inside drops on expanded parents", () => {
    const index: PageIndex = {
      root: ["a", "d"],
      a: ["b"],
      b: ["c"],
    };

    const preview = buildPageDropPreview({
      index,
      visibleRows: [
        { uid: "a", depth: 0, parentUid: null },
        { uid: "b", depth: 1, parentUid: "a" },
        { uid: "c", depth: 2, parentUid: "b" },
        { uid: "d", depth: 0, parentUid: null },
      ],
      activeUid: "d",
      overUid: "a",
      dropPosition: "inside",
    });

    expect(preview).toMatchObject({
      uid: "a",
      position: "inside",
      targetParentUid: "a",
      projectedDepth: 1,
      lineUid: "c",
      linePosition: "after",
      lineDepth: 1,
    });
  });

  it("derives inside only from the center band of the hovered row", () => {
    const rect = {
      top: 100,
      bottom: 130,
      left: 0,
      right: 200,
      width: 200,
      height: 30,
    };

    expect(getPageDropPosition(rect.top + 1, rect)).toBe("before");
    expect(getPageDropPosition(rect.top + rect.height * PAGE_DROP_INTO_THRESHOLD, rect)).toBe("inside");
    expect(getPageDropPosition(rect.bottom - 1, rect)).toBe("after");
  });

  it("snaps horizontal movement to the page tree depth grid", () => {
    expect(getPageProjectedDepth(1, -23)).toBe(1);
    expect(getPageProjectedDepth(1, -24)).toBe(0);
    expect(getPageProjectedDepth(0, 23)).toBe(0);
    expect(getPageProjectedDepth(0, 24)).toBe(1);
    expect(getPageProjectedDepth(0, 24 + PAGE_TREE_DEPTH_STEP_PX)).toBe(2);
  });

  it("keeps sortable rows visually static while dragging", () => {
    const transform = {
      x: 0,
      y: 28,
      scaleX: 1,
      scaleY: 1,
    };

    expect(getStaticSortableTransform(transform, true)).toBeUndefined();
    expect(getStaticSortableTransform(transform, false)).toBe("translate3d(0px, 28px, 0) scaleX(1) scaleY(1)");
  });
});
