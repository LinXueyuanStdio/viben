import type { ClientRect } from "@dnd-kit/core";
import type { Transform } from "@dnd-kit/utilities";
import { CSS } from "@dnd-kit/utilities";

import type { PageIndex } from "@/lib/gateway/types/page";

export const PAGE_DROP_INTO_THRESHOLD = 0.25;
export const PAGE_TREE_DEPTH_STEP_PX = 16;
export const PAGE_TREE_DEPTH_CHANGE_THRESHOLD_PX = 24;
export const PAGE_ROOT_DROP_START_UID = "__root_start__";
export const PAGE_ROOT_DROP_TAIL_UID = "__root_tail__";

export type PageDropPosition = "before" | "inside" | "after";

export interface PageDropPreview {
  uid: string;
  position: PageDropPosition;
  changesParent?: boolean;
  targetParentUid?: string | null;
  projectedDepth?: number;
  lineUid?: string;
  linePosition?: Exclude<PageDropPosition, "inside">;
  lineDepth?: number;
  isInvalid?: boolean;
}

export interface PageReorderRequest {
  parentUid: string | null;
  orderedUids: string[];
}

export interface PageDropPlan {
  nextIndex: PageIndex;
  reorderRequests: PageReorderRequest[];
  targetParentUid?: string | null;
  projectedDepth?: number;
}

export interface PageVisibleRow {
  uid: string;
  depth: number;
  parentUid: string | null;
}

interface BuildPageDropPlanOptions {
  index: PageIndex;
  activeUid: string;
  overUid: string;
  dropPosition: PageDropPosition;
  rootUids?: string[];
  visibleRows?: PageVisibleRow[];
  projectedDepth?: number;
}

interface BuildPageDropPreviewOptions {
  index: PageIndex;
  activeUid: string;
  overUid: string;
  dropPosition: PageDropPosition;
  rootUids?: string[];
  visibleRows?: PageVisibleRow[];
  projectedDepth?: number;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function cloneIndex(index: PageIndex): PageIndex {
  return Object.fromEntries(
    Object.entries(index).map(([key, children]) => [key, [...children]])
  );
}

function parentKeyToUid(parentKey: string): string | null {
  return parentKey === "root" ? null : parentKey;
}

function isRootDropUid(uid: string): boolean {
  return uid === PAGE_ROOT_DROP_START_UID || uid === PAGE_ROOT_DROP_TAIL_UID;
}

function findParentKey(index: PageIndex, uid: string): string {
  if (isRootDropUid(uid)) return "root";

  for (const [parentKey, children] of Object.entries(index)) {
    if (children.includes(uid)) {
      return parentKey;
    }
  }

  return "root";
}

function uidToParentKey(uid: string | null): string {
  return uid ?? "root";
}

function parentKeyToDepth(index: PageIndex, parentKey: string): number {
  if (parentKey === "root") return 0;

  let depth = 1;
  let currentParentKey = findParentKey(index, parentKey);

  while (currentParentKey !== "root") {
    depth += 1;
    currentParentKey = findParentKey(index, currentParentKey);
  }

  return depth;
}

function clampDepth(depth: number | undefined, fallbackDepth: number): number {
  if (depth === undefined) return fallbackDepth;
  return Math.max(0, Math.round(depth));
}

function fallbackRowsFromIndex(index: PageIndex, rootUids: string[]): PageVisibleRow[] {
  const rows: PageVisibleRow[] = [];

  function walk(uids: string[], depth: number, parentUid: string | null) {
    for (const uid of uids) {
      rows.push({ uid, depth, parentUid });
      walk(index[uid] ?? [], depth + 1, uid);
    }
  }

  walk(rootUids, 0, null);
  return rows;
}

function findRow(rows: PageVisibleRow[], uid: string): PageVisibleRow | undefined {
  return rows.find((row) => row.uid === uid);
}

function previousVisibleRow(rows: PageVisibleRow[], overUid: string): PageVisibleRow | undefined {
  const overIndex = rows.findIndex((row) => row.uid === overUid);
  if (overIndex <= 0) return undefined;
  return rows[overIndex - 1];
}

function lastVisibleDescendantRow(rows: PageVisibleRow[], uid: string): PageVisibleRow | undefined {
  const rowIndex = rows.findIndex((row) => row.uid === uid);
  if (rowIndex === -1) return undefined;

  let lastRow = rows[rowIndex];
  const baseDepth = lastRow.depth;
  for (let index = rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || row.depth <= baseDepth) break;
    lastRow = row;
  }

  return lastRow;
}

function getSlotAnchorRow(
  rows: PageVisibleRow[],
  activeUid: string,
  overUid: string,
  dropPosition: Exclude<PageDropPosition, "inside">
): PageVisibleRow | undefined {
  if (dropPosition === "before") {
    if (overUid === PAGE_ROOT_DROP_START_UID) return undefined;
    return previousVisibleRow(rows, overUid);
  }

  if (overUid === PAGE_ROOT_DROP_TAIL_UID) {
    return rows[rows.length - 1];
  }

  return activeUid === overUid ? previousVisibleRow(rows, overUid) : findRow(rows, overUid);
}

function resolveProjectedParentUid(
  rows: PageVisibleRow[],
  activeUid: string,
  overUid: string,
  dropPosition: Exclude<PageDropPosition, "inside">,
  projectedDepth: number
): string | null {
  if (projectedDepth <= 0) return null;

  const anchorRow = getSlotAnchorRow(rows, activeUid, overUid, dropPosition);
  if (!anchorRow) return null;

  if (projectedDepth === anchorRow.depth + 1) {
    return anchorRow.uid;
  }

  let candidate: PageVisibleRow | undefined = anchorRow;
  while (candidate && candidate.depth >= projectedDepth) {
    candidate = candidate.parentUid ? findRow(rows, candidate.parentUid) : undefined;
  }

  return candidate?.uid ?? null;
}

function resolveProjectedDrop(
  index: PageIndex,
  rootUids: string[],
  visibleRows: PageVisibleRow[] | undefined,
  activeUid: string,
  overUid: string,
  dropPosition: Exclude<PageDropPosition, "inside">,
  requestedDepth: number | undefined
): { parentKey: string; depth: number } {
  const rows = visibleRows ?? fallbackRowsFromIndex(index, rootUids);
  const overParentKey = findParentKey(index, overUid);
  const fallbackDepth = parentKeyToDepth(index, overParentKey);
  const requestedProjectedDepth = clampDepth(requestedDepth, fallbackDepth);
  const slotAnchorRow = getSlotAnchorRow(rows, activeUid, overUid, dropPosition);
  const maxDepth = slotAnchorRow ? slotAnchorRow.depth + 1 : 0;
  const projectedDepth = Math.min(requestedProjectedDepth, maxDepth);
  const parentUid = resolveProjectedParentUid(rows, activeUid, overUid, dropPosition, projectedDepth);
  const parentKey = uidToParentKey(parentUid);

  return {
    parentKey,
    depth: parentKey === "root" ? 0 : parentKeyToDepth(index, parentKey),
  };
}

export function buildPageDropPreview({
  index,
  activeUid,
  overUid,
  dropPosition,
  rootUids,
  visibleRows,
  projectedDepth,
}: BuildPageDropPreviewOptions): PageDropPreview | null {
  if (dropPosition === "inside") {
    if (activeUid === overUid || isDescendant(index, activeUid, overUid)) {
      return {
        uid: overUid,
        position: dropPosition,
        isInvalid: true,
      };
    }

    const activeParentKey = findParentKey(index, activeUid);
    const targetDepth = parentKeyToDepth(index, overUid);
    const rows = visibleRows ?? fallbackRowsFromIndex(index, index.root ?? []);
    const lineRow = lastVisibleDescendantRow(rows, overUid) ?? findRow(rows, overUid);

    return {
      uid: overUid,
      position: dropPosition,
      changesParent: activeParentKey !== overUid,
      targetParentUid: overUid,
      projectedDepth: targetDepth,
      lineUid: lineRow?.uid ?? overUid,
      linePosition: "after",
      lineDepth: targetDepth,
    };
  }

  const activeParentKey = findParentKey(index, activeUid);
  const rootChildren = rootUids ?? index.root ?? [];
  if (!isRootDropUid(overUid) && isDescendant(index, activeUid, overUid)) {
    return {
      uid: overUid,
      position: dropPosition,
      isInvalid: true,
    };
  }

  const projectedDrop = resolveProjectedDrop(
    index,
    rootChildren,
    visibleRows,
    activeUid,
    overUid,
    dropPosition,
    projectedDepth
  );

  if (
    projectedDrop.parentKey === activeUid ||
    (projectedDrop.parentKey !== "root" && isDescendant(index, activeUid, projectedDrop.parentKey))
  ) {
    return {
      uid: overUid,
      position: dropPosition,
      isInvalid: true,
    };
  }

  if (!isRootDropUid(overUid) && activeUid === overUid && activeParentKey === projectedDrop.parentKey) return null;

  return {
    uid: overUid,
    position: dropPosition,
    changesParent: activeParentKey !== projectedDrop.parentKey,
    targetParentUid: parentKeyToUid(projectedDrop.parentKey),
    projectedDepth: projectedDrop.depth,
    lineUid: overUid,
    linePosition: dropPosition,
    lineDepth: projectedDrop.depth,
  };
}

function isDescendant(index: PageIndex, ancestorUid: string, candidateUid: string): boolean {
  const pending = [...(index[ancestorUid] ?? [])];

  while (pending.length > 0) {
    const currentUid = pending.shift();
    if (!currentUid) continue;
    if (currentUid === candidateUid) return true;
    pending.push(...(index[currentUid] ?? []));
  }

  return false;
}

export function getPageDropPosition(
  clientY: number,
  rect: Pick<ClientRect, "top" | "bottom" | "height">
): PageDropPosition {
  const beforeBoundary = rect.top + rect.height * PAGE_DROP_INTO_THRESHOLD;
  const afterBoundary = rect.bottom - rect.height * PAGE_DROP_INTO_THRESHOLD;

  if (clientY < beforeBoundary) return "before";
  if (clientY > afterBoundary) return "after";
  return "inside";
}

export function getPageProjectedDepth(activeDepth: number, deltaX: number): number {
  if (Math.abs(deltaX) < PAGE_TREE_DEPTH_CHANGE_THRESHOLD_PX) return activeDepth;

  const direction = deltaX > 0 ? 1 : -1;
  const additionalSteps = Math.floor(
    (Math.abs(deltaX) - PAGE_TREE_DEPTH_CHANGE_THRESHOLD_PX) / PAGE_TREE_DEPTH_STEP_PX
  );
  return Math.max(0, activeDepth + direction * (1 + additionalSteps));
}

export function getPageProjectedDepthForRow(
  visibleRows: PageVisibleRow[],
  overUid: string,
  fallbackDepth: number,
  deltaX: number
): number {
  const overRow = visibleRows.find((row) => row.uid === overUid);
  return getPageProjectedDepth(overRow?.depth ?? fallbackDepth, deltaX);
}

export function getStaticSortableTransform(
  transform: Transform | null,
  isDragActive: boolean
): string | undefined {
  if (isDragActive) return undefined;
  return CSS.Transform.toString(transform) ?? undefined;
}

function findProjectedInsertIndex(
  rows: PageVisibleRow[] | undefined,
  activeUid: string,
  overUid: string,
  dropPosition: Exclude<PageDropPosition, "inside">,
  targetParentUid: string | null,
  projectedDepth: number,
  targetSiblings: string[]
): number {
  if (!rows) return targetSiblings.length;

  const overRowIndex = rows.findIndex((row) => row.uid === overUid);
  if (overRowIndex === -1) return targetSiblings.length;

  const startIndex = dropPosition === "before" ? overRowIndex : overRowIndex + 1;
  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || row.uid === activeUid) continue;
    if (row.depth < projectedDepth) break;
    if (row.depth !== projectedDepth || row.parentUid !== targetParentUid) continue;

    const siblingIndex = targetSiblings.indexOf(row.uid);
    if (siblingIndex !== -1) return siblingIndex;
  }

  return targetSiblings.length;
}

export function buildPageDropPlan({
  index,
  activeUid,
  overUid,
  dropPosition,
  rootUids,
  visibleRows,
  projectedDepth,
}: BuildPageDropPlanOptions): PageDropPlan | null {
  if (activeUid === overUid && dropPosition === "inside") return null;

  const rootChildren = rootUids ?? index.root ?? [];
  const activeParentKey = findParentKey(index, activeUid);

  if (dropPosition === "inside") {
    if (isDescendant(index, activeUid, overUid)) return null;

    const nextIndex = cloneIndex(index);
    const currentSourceChildren = activeParentKey === "root"
      ? rootChildren
      : nextIndex[activeParentKey] ?? [];
    const sourceChildren = currentSourceChildren.filter((uid) => uid !== activeUid);
    const targetChildren = (nextIndex[overUid] ?? []).filter((uid) => uid !== activeUid);
    const nextTargetChildren = [...targetChildren, activeUid];

    if (activeParentKey === overUid && arraysEqual(nextIndex[overUid] ?? [], nextTargetChildren)) {
      return null;
    }

    nextIndex[activeParentKey] = activeParentKey === overUid ? nextTargetChildren : sourceChildren;
    nextIndex[overUid] = nextTargetChildren;

    const reorderRequests: PageReorderRequest[] = activeParentKey === overUid
      ? [{ parentUid: overUid, orderedUids: nextTargetChildren }]
      : [
          { parentUid: parentKeyToUid(activeParentKey), orderedUids: sourceChildren },
          { parentUid: overUid, orderedUids: nextTargetChildren },
        ];

    return {
      nextIndex,
      reorderRequests,
      targetParentUid: overUid,
      projectedDepth: parentKeyToDepth(index, overUid),
    };
  }

  if (!isRootDropUid(overUid) && isDescendant(index, activeUid, overUid)) return null;

  const sourceSiblings = activeParentKey === "root" ? rootChildren : index[activeParentKey] ?? [];
  const projectedDrop = resolveProjectedDrop(
    index,
    rootChildren,
    visibleRows,
    activeUid,
    overUid,
    dropPosition,
    projectedDepth
  );
  const targetParentKey = projectedDrop.parentKey;
  if (
    targetParentKey === activeUid ||
    (targetParentKey !== "root" && isDescendant(index, activeUid, targetParentKey))
  ) {
    return null;
  }

  const targetSiblings = targetParentKey === "root" ? rootChildren : index[targetParentKey] ?? [];
  if (!sourceSiblings.includes(activeUid)) return null;

  const sourceWithoutActive = sourceSiblings.filter((uid) => uid !== activeUid);
  const withoutActive = activeParentKey === targetParentKey
    ? sourceWithoutActive
    : targetSiblings.filter((uid) => uid !== activeUid);
  const overIndex = withoutActive.indexOf(overUid);
  const insertIndex = (() => {
    if (overUid === PAGE_ROOT_DROP_START_UID && targetParentKey === "root") {
      return 0;
    }

    if (overUid === PAGE_ROOT_DROP_TAIL_UID && targetParentKey === "root") {
      return withoutActive.length;
    }

    if (overIndex !== -1) {
      return dropPosition === "before" ? overIndex : overIndex + 1;
    }

    return findProjectedInsertIndex(
      visibleRows,
      activeUid,
      overUid,
      dropPosition,
      parentKeyToUid(targetParentKey),
      projectedDrop.depth,
      withoutActive
    );
  })();

  const nextSiblings = [...withoutActive];
  nextSiblings.splice(insertIndex, 0, activeUid);

  if (activeParentKey === targetParentKey && arraysEqual(sourceSiblings, nextSiblings)) return null;

  const nextIndex = cloneIndex(index);
  nextIndex[activeParentKey] = activeParentKey === targetParentKey ? nextSiblings : sourceWithoutActive;
  nextIndex[targetParentKey] = nextSiblings;

  const reorderRequests: PageReorderRequest[] = activeParentKey === targetParentKey
    ? [
        {
          parentUid: parentKeyToUid(activeParentKey),
          orderedUids: nextSiblings,
        },
      ]
    : [
        {
          parentUid: parentKeyToUid(activeParentKey),
          orderedUids: sourceWithoutActive,
        },
        {
          parentUid: parentKeyToUid(targetParentKey),
          orderedUids: nextSiblings,
        },
      ];

  return {
    nextIndex,
    reorderRequests,
    targetParentUid: parentKeyToUid(targetParentKey),
    projectedDepth: projectedDrop.depth,
  };
}
