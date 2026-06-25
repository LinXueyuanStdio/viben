import { Editor, Range as SlateRange, Transforms, type Point } from "slate";
import { ReactEditor, type ReactEditor as SlateReactEditor } from "slate-react";
import { Blocks, type YooEditor } from "@yoopta/editor";

export type VerticalDirection = "up" | "down";

export type RectLike = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

export type BlockOrderEntry = {
  id: string;
  order: number;
};

export type VerticalNavigationTarget = {
  blockId: string;
  placement: "start" | "end";
  x: number;
};

export type TextLineMetrics = {
  text: string;
  rect: RectLike;
};

export type TargetLineCoordinates = {
  x: number;
  y: number;
};

const LINE_OVERLAP_TOLERANCE = 2;
const EDGE_TOLERANCE = 2;

export function groupRectsByVisualLine(rects: RectLike[]): RectLike[] {
  const visibleRects = rects
    .filter((rect) => rect.width >= 0 && rect.height > 0)
    .sort((a, b) => (Math.abs(a.top - b.top) <= LINE_OVERLAP_TOLERANCE ? a.left - b.left : a.top - b.top));

  const lines: RectLike[] = [];

  for (const rect of visibleRects) {
    const line = lines.find((candidate) => rectsOverlapVertically(candidate, rect));
    if (!line) {
      lines.push({ ...rect });
      continue;
    }

    line.top = Math.min(line.top, rect.top);
    line.bottom = Math.max(line.bottom, rect.bottom);
    line.left = Math.min(line.left, rect.left);
    line.right = Math.max(line.right, rect.right);
    line.width = line.right - line.left;
    line.height = line.bottom - line.top;
  }

  return lines;
}

export function findVerticalNavigationTarget(options: {
  direction: VerticalDirection;
  currentBlockId: string;
  caretRect: RectLike;
  visualLines: RectLike[];
  blocks: BlockOrderEntry[];
}): VerticalNavigationTarget | null {
  const { direction, currentBlockId, caretRect, visualLines, blocks } = options;
  if (visualLines.length === 0) return null;

  const currentLineIndex = getCaretLineIndex(caretRect, visualLines);
  if (currentLineIndex === -1) return null;

  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);
  const currentBlockIndex = sortedBlocks.findIndex((block) => block.id === currentBlockId);
  if (currentBlockIndex === -1) return null;

  const caretX = getCaretX(caretRect);

  if (direction === "up" && currentLineIndex === 0) {
    const previousBlock = sortedBlocks[currentBlockIndex - 1];
    return previousBlock ? { blockId: previousBlock.id, placement: "end", x: caretX } : null;
  }

  if (direction === "down" && currentLineIndex === visualLines.length - 1) {
    const nextBlock = sortedBlocks[currentBlockIndex + 1];
    return nextBlock ? { blockId: nextBlock.id, placement: "start", x: caretX } : null;
  }

  return null;
}

export function handleYooptaVerticalNavigation(editor: YooEditor, event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }

  const direction = event.key === "ArrowUp" ? "up" : event.key === "ArrowDown" ? "down" : null;
  if (!direction || editor.path.current === null) return false;

  const currentBlockId = getBlockIdAtOrder(editor, editor.path.current);
  if (!currentBlockId) return false;

  const currentSlate = getBlockSlate(editor, currentBlockId);
  if (!currentSlate?.selection || !SlateRange.isCollapsed(currentSlate.selection)) return false;

  const currentEditable = getBlockEditableElement(editor, currentBlockId);
  if (!currentEditable) return false;

  const domSelection = window.getSelection();
  if (!domSelection || domSelection.rangeCount === 0) return false;

  const range = domSelection.getRangeAt(0);
  if (!currentEditable.contains(range.commonAncestorContainer)) return false;

  const caretRect = getCaretRect(range);
  if (!caretRect) return false;

  const target = findVerticalNavigationTarget({
    direction,
    currentBlockId,
    caretRect,
    visualLines: getElementVisualLines(currentEditable),
    blocks: getOrderedBlocks(editor),
  });
  if (!target) return false;

  const targetPoint = getTargetPoint(editor, target);
  if (!targetPoint) return false;

  event.preventDefault();
  const targetSlate = getBlockSlate(editor, target.blockId);
  if (!targetSlate) return false;

  Transforms.select(targetSlate, targetPoint);
  ReactEditor.focus(targetSlate);
  editor.setPath({ current: editor.children[target.blockId]?.meta.order ?? null });
  syncDomSelection(targetSlate);
  return true;
}

function getTargetPoint(editor: YooEditor, target: VerticalNavigationTarget): Point | null {
  const slate = getBlockSlate(editor, target.blockId);
  const editable = getBlockEditableElement(editor, target.blockId);
  if (!slate || !editable) return null;

  const edgePoint = getEdgePoint(slate, target.placement);
  if (!edgePoint) return null;

  const edgeRect = getPointRect(slate, edgePoint);
  const visualLines = getElementVisualLines(editable);
  const targetLine = target.placement === "start" ? visualLines[0] : visualLines[visualLines.length - 1];
  const fallbackRect = edgeRect ?? editable.getBoundingClientRect();
  const { x, y } = getTargetLineCoordinates({
    placement: target.placement,
    targetX: target.x,
    targetLine,
    fallbackRect,
  });

  return getSlatePointAtCoordinates(slate, x, y, editable) ?? edgePoint;
}

export function getTargetLineCoordinates(options: {
  placement: "start" | "end";
  targetX: number;
  targetLine?: RectLike;
  fallbackRect: RectLike;
}): TargetLineCoordinates {
  const { placement, targetX, targetLine, fallbackRect } = options;
  if (targetLine) {
    return {
      x: clamp(targetX, targetLine.left, targetLine.right),
      y: targetLine.top + targetLine.height / 2,
    };
  }

  return {
    x: clamp(targetX, fallbackRect.left, fallbackRect.right),
    y: placement === "start" ? fallbackRect.top + 1 : fallbackRect.bottom - 1,
  };
}

export function findClosestTextOffsetForX(
  line: TextLineMetrics,
  x: number,
): number {
  const textLength = line.text.length;
  if (textLength === 0) return 0;

  const width = Math.max(line.rect.width, 0);
  if (width === 0 || x <= line.rect.left) return 0;
  if (x >= line.rect.right) return textLength;

  const ratio = (x - line.rect.left) / width;
  return Math.max(0, Math.min(textLength, Math.round(textLength * ratio)));
}

function getEdgePoint(slate: SlateReactEditor, placement: "start" | "end"): Point | null {
  try {
    return placement === "start" ? Editor.start(slate, []) : Editor.end(slate, []);
  } catch {
    return null;
  }
}

function getSlatePointAtCoordinates(
  slate: SlateReactEditor,
  x: number,
  y: number,
  expectedRoot?: HTMLElement,
): Point | null {
  const domRange = getCaretRangeFromPoint(x, y);
  if (!domRange) return null;
  if (expectedRoot && !expectedRoot.contains(domRange.startContainer)) return null;

  try {
    return ReactEditor.toSlatePoint(
      slate,
      [domRange.startContainer, domRange.startOffset],
      { exactMatch: false, suppressThrow: true },
    );
  } catch {
    return null;
  }
}

function getCaretRangeFromPoint(x: number, y: number): Range | null {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    if (!position) return null;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  return doc.caretRangeFromPoint?.(x, y) ?? null;
}

function getPointRect(slate: SlateReactEditor, point: Point): DOMRect | null {
  try {
    const range = ReactEditor.toDOMRange(slate, { anchor: point, focus: point });
    return getCaretRect(range);
  } catch {
    return null;
  }
}

function syncDomSelection(slate: SlateReactEditor) {
  requestAnimationFrame(() => {
    try {
      if (!slate.selection) return;
      const domRange = ReactEditor.toDOMRange(slate, slate.selection);
      const domSelection = window.getSelection();
      domSelection?.removeAllRanges();
      domSelection?.addRange(domRange);
    } catch {
      // DOM selection may be unavailable during remounts.
    }
  });
}

function getCaretRect(range: Range): DOMRect | null {
  const collapsedRange = range.cloneRange();
  collapsedRange.collapse(true);

  const rect = collapsedRange.getBoundingClientRect();
  if (rect.height > 0) return rect;

  const fallbackRect = collapsedRange.getClientRects()[0];
  if (fallbackRect?.height > 0) return fallbackRect;

  return null;
}

function getElementVisualLines(element: HTMLElement): RectLike[] {
  const range = document.createRange();
  range.selectNodeContents(element);
  const lines = groupRectsByVisualLine(Array.from(range.getClientRects()));
  range.detach();
  return lines;
}

function getBlockEditableElement(editor: YooEditor, blockId: string): HTMLElement | null {
  return editor.refElement?.querySelector(
    `[data-yoopta-block-id="${CSS.escape(blockId)}"] [contenteditable="true"]`,
  ) ?? null;
}

function getBlockSlate(editor: YooEditor, blockId: string): SlateReactEditor | null {
  return Blocks.getBlockSlate(editor, { id: blockId }) as SlateReactEditor | null;
}

function getOrderedBlocks(editor: YooEditor): BlockOrderEntry[] {
  return Object.entries(editor.children).map(([id, block]) => ({ id, order: block.meta.order }));
}

function getBlockIdAtOrder(editor: YooEditor, order: number): string | null {
  return Object.keys(editor.children).find((id) => editor.children[id]?.meta.order === order) ?? null;
}

function getCaretLineIndex(caretRect: RectLike, lines: RectLike[]): number {
  const caretMiddle = (caretRect.top + caretRect.bottom) / 2;
  const containingLine = lines.findIndex((line) => caretMiddle >= line.top - EDGE_TOLERANCE && caretMiddle <= line.bottom + EDGE_TOLERANCE);
  if (containingLine !== -1) return containingLine;

  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  lines.forEach((line, index) => {
    const lineMiddle = (line.top + line.bottom) / 2;
    const distance = Math.abs(lineMiddle - caretMiddle);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

function rectsOverlapVertically(a: RectLike, b: RectLike): boolean {
  return Math.max(a.top, b.top) <= Math.min(a.bottom, b.bottom) + LINE_OVERLAP_TOLERANCE;
}

function getCaretX(rect: RectLike): number {
  return rect.left;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}
