import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GripVertical, PlusIcon } from "lucide-react";
import { Blocks, useYooptaEditor } from "@yoopta/editor";
import { DragHandle } from "@yoopta/ui/block-dnd";
import { YooptaBlockOptions } from "./yoopta-block-options";
import { ensureBlockFocus } from "./yoopta-focus-utils";

/**
 * Dispatch a synthetic "/" keydown event on the editor's focused contenteditable
 * element to trigger the SlashCommandMenu (which listens for native DOM keydown).
 */
function dispatchSlashKeyEvent(editor: ReturnType<typeof useYooptaEditor>) {
  const target =
    document.activeElement?.closest("[contenteditable]") ??
    editor.refElement?.querySelector("[contenteditable]");
  if (!target) return;

  const event = new KeyboardEvent("keydown", {
    key: "/",
    code: "Slash",
    keyCode: 191,
    which: 191,
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  target.dispatchEvent(event);
}

/**
 * Get the visual top offset for a block element, accounting for margin collapse
 * from inner rendered elements (e.g. headings with margin-top).
 */
function getBlockMarginOffset(blockElement: HTMLElement): number {
  const renderedElement = blockElement.querySelector("[data-element-type]") as HTMLElement | null;
  if (!renderedElement) return 0;
  const style = window.getComputedStyle(renderedElement);
  return parseFloat(style.marginTop) || 0;
}

/**
 * Find the DOM element for a block by its order index.
 */
function findBlockElementByOrder(
  editor: ReturnType<typeof useYooptaEditor>,
  order: number,
): { element: HTMLElement; id: string } | null {
  if (!editor.refElement) return null;
  const blockId = Object.keys(editor.children).find(
    (id) => editor.children[id]?.meta.order === order,
  );
  if (!blockId) return null;
  const el = editor.refElement.querySelector<HTMLElement>(
    `[data-yoopta-block-id="${blockId}"]`,
  );
  return el ? { element: el, id: blockId } : null;
}

/**
 * Notion-style floating block actions.
 *
 * Design:
 * - A single global floating container that is never removed from the DOM.
 * - Tracks the hovered block via mousemove; only top changes (vertical slide).
 * - Also follows the focused block when path.current changes (e.g. Enter key).
 * - left is fixed relative to the editor left edge (no horizontal slide animation).
 * - Hides with opacity fade when the mouse leaves all blocks.
 * - "Frozen" mode when BlockOptions menu is open (stops tracking hover).
 * - Considers picker/popover overlays — doesn't hide when mouse is over them.
 */
export const YooptaFloatingBlockActions = () => {
  const { t } = useTranslation();
  const editor = useYooptaEditor();
  const containerRef = useRef<HTMLDivElement>(null);

  // Callback ref (useState setter) for drag handle — stable identity, triggers
  // re-render when element mounts so BlockOptions receives a non-null anchor.
  // setState functions are stable across renders, so DragHandle won't infinite-loop.
  const [dragHandleEl, setDragHandleEl] = useState<HTMLButtonElement | null>(null);

  // Current tracked block (hovered or focused)
  const [blockId, setBlockId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  // Position: top/left in fixed coordinates (mutated directly for performance)
  const posRef = useRef({ top: 0, left: 0 });

  // Block options menu state
  const [blockOptionsOpen, setBlockOptionsOpen] = useState(false);

  // ── Position update ──────────────────────────────────────────────────────
  const updatePosition = useCallback((blockElement: HTMLElement) => {
    const rect = blockElement.getBoundingClientRect();
    const marginOffset = getBlockMarginOffset(blockElement);

    posRef.current.top = rect.top + marginOffset;

    // left is always relative to editor left edge — consistent X position
    if (editor.refElement) {
      const editorRect = editor.refElement.getBoundingClientRect();
      const containerWidth = containerRef.current?.offsetWidth ?? 52;
      posRef.current.left = editorRect.left - containerWidth - 4;
    }

    if (containerRef.current) {
      containerRef.current.style.top = `${posRef.current.top}px`;
      containerRef.current.style.left = `${posRef.current.left}px`;
    }
  }, [editor]);

  // ── Find closest block to mouse Y ─────────────────────────────────────────
  const findClosestBlock = useCallback(
    (mouseY: number): { element: HTMLElement; id: string } | null => {
      if (!editor.refElement) return null;

      const blocks = editor.refElement.querySelectorAll<HTMLElement>("[data-yoopta-block]");
      const viewportHeight = window.innerHeight;
      let closestBlock: HTMLElement | null = null;
      let closestId: string | null = null;
      let minDistance = Infinity;

      for (const blockElement of blocks) {
        const rect = blockElement.getBoundingClientRect();

        // Skip blocks far outside viewport
        if (rect.bottom < -100 || rect.top > viewportHeight + 100) continue;

        // Mouse is within block bounds — exact match
        if (mouseY >= rect.top && mouseY <= rect.bottom) {
          const id = blockElement.getAttribute("data-yoopta-block-id");
          if (id && editor.children[id]) {
            return { element: blockElement, id };
          }
        }

        // Distance to closest edge
        const distance = mouseY < rect.top ? rect.top - mouseY : mouseY - rect.bottom;
        if (distance < minDistance) {
          minDistance = distance;
          closestBlock = blockElement;
          closestId = blockElement.getAttribute("data-yoopta-block-id");
        }
      }

      // Only snap if within 60px of nearest block
      if (closestBlock && closestId && minDistance <= 60 && editor.children[closestId]) {
        return { element: closestBlock, id: closestId };
      }

      return null;
    },
    [editor],
  );

  // ── Follow focused block on path change ────────────────────────────────────
  // When user presses Enter or navigates with arrows, path.current changes.
  // Move the floating handle to the newly focused block so it stays in sync.
  useEffect(() => {
    if (editor.readOnly || blockOptionsOpen) return;

    const handlePathChange = () => {
      const current = editor.path.current;
      if (typeof current !== "number") return;

      // Small delay to let React render any newly created block DOM
      requestAnimationFrame(() => {
        const found = findBlockElementByOrder(editor, current);
        if (found) {
          setBlockId(found.id);
          updatePosition(found.element);
          setVisible(true);
        }
      });
    };

    editor.on("path-change", handlePathChange);
    return () => {
      editor.off("path-change", handlePathChange);
    };
  }, [editor, blockOptionsOpen, updatePosition]);

  // ── Mouse move handler ─────────────────────────────────────────────────────
  useEffect(() => {
    if (editor.readOnly) return;

    let rafId: number | null = null;

    const handleMouseMove = (event: MouseEvent) => {
      // Don't track while block options menu is open (frozen)
      if (blockOptionsOpen) return;

      if (rafId) return; // throttle via rAF
      rafId = requestAnimationFrame(() => {
        rafId = null;

        const target = event.target as HTMLElement;

        // If hovering directly over our floating action buttons, keep state
        if (containerRef.current?.contains(target)) return;

        // If mouse is over a picker/popover/overlay (portalled to body), keep state
        if (
          target.closest("[data-radix-popper-content-wrapper]") ||
          target.closest("[data-floating-ui-portal]") ||
          target.closest(".yoopta-ui-block-options")
        ) {
          return;
        }

        const isInsideEditor = editor.refElement?.contains(target);

        // Check if mouse is in the left "gutter" zone — the vertical strip
        // to the left of the editor where the floating buttons appear.
        const editorRect = editor.refElement?.getBoundingClientRect();
        const isInGutter = editorRect && (
          event.clientX >= editorRect.left - 80 &&
          event.clientX < editorRect.left &&
          event.clientY >= editorRect.top &&
          event.clientY <= editorRect.bottom
        );

        // Outside editor AND outside gutter — hide
        if (!isInsideEditor && !isInGutter) {
          setVisible(false);
          return;
        }

        const closest = findClosestBlock(event.clientY);

        if (closest) {
          setBlockId(closest.id);
          updatePosition(closest.element);
          setVisible(true);
        } else {
          setVisible(false);
        }
      });
    };

    const handleScroll = () => {
      if (blockOptionsOpen) return;
      setVisible(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("scroll", handleScroll, true);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [editor, blockOptionsOpen, findClosestBlock, updatePosition]);

  // ── Plus button ──────────────────────────────────────────────────────────
  const onPlusClick = useCallback(
    (id: string | null) => {
      if (!id) return;
      const floatingBlock = Blocks.getBlock(editor, { id });
      if (!floatingBlock) return;

      const nextOrder = floatingBlock.meta.order + 1;
      // Don't use focus: true — Yoopta's focusBlock uses setTimeout(0) + ReactEditor.focus
      // which silently fails if DOM isn't ready. Use ensureBlockFocus instead.
      const newId = editor.insertBlock("Paragraph", { at: nextOrder });
      if (newId) {
        ensureBlockFocus(editor, newId, () => {
          // Dispatch slash key only after DOM focus is confirmed
          dispatchSlashKeyEvent(editor);
        });
      }
    },
    [editor],
  );

  // ── Drag handle click → toggle block options ──────────────────────────────
  const onDragClick = useCallback(
    (id: string | null) => {
      if (!id) return;
      const block = Blocks.getBlock(editor, { id });
      if (!block) return;
      editor.setPath({ current: block.meta.order });

      setBlockOptionsOpen((prev) => !prev);
    },
    [editor, dragHandleEl],
  );

  // ── Styles ────────────────────────────────────────────────────────────────
  const isShown = visible || blockOptionsOpen;

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    top: posRef.current.top,
    left: posRef.current.left,
    zIndex: 250,
    display: "inline-flex",
    alignItems: "center",
    gap: 1,
    padding: 3,
    background: "var(--background)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    opacity: isShown ? 1 : 0,
    pointerEvents: isShown ? "auto" : "none",
    // Only vertical slide + opacity fade — no horizontal animation (Notion behavior)
    transition: "top 120ms ease-out, opacity 100ms ease-out",
    willChange: "top, opacity",
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      contentEditable={false}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="yoopta-ui-floating-action-button"
        onClick={() => onPlusClick(blockId)}
        title={t("editor.blockActions.addBlock")}
        aria-label={t("editor.blockActions.addBlock")}
      >
        <PlusIcon />
      </button>
      <DragHandle blockId={blockId} ref={setDragHandleEl} asChild>
        <button
          type="button"
          className="yoopta-ui-floating-action-button"
          onClick={() => onDragClick(blockId)}
          title={t("editor.blockActions.dragToReorder")}
          aria-label={t("editor.blockActions.dragToReorder")}
        >
          <GripVertical />
        </button>
      </DragHandle>

      {/* BlockOptions — anchor directly on dragHandleRef (valid because
          blockOptionsOpen freezes mousemove, keeping container visible) */}
      <YooptaBlockOptions
        open={blockOptionsOpen}
        onOpenChange={setBlockOptionsOpen}
        blockId={blockId}
        anchor={dragHandleEl}
      />
    </div>
  );
};
