import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, PlusIcon } from "lucide-react";
import { Blocks, useYooptaEditor } from "@yoopta/editor";
import { FloatingBlockActions } from "@yoopta/ui/floating-block-actions";
import { DragHandle } from "@yoopta/ui/block-dnd";
import { YooptaBlockOptions } from "./yoopta-block-options";

/**
 * Dispatch a synthetic "/" keydown event on the editor's focused contenteditable
 * element to trigger the SlashCommandMenu (which listens for native DOM keydown).
 */
function dispatchSlashKeyEvent(editor: ReturnType<typeof useYooptaEditor>) {
  // Find the focused contenteditable inside the editor
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
 * Create a virtual anchor element that captures the bounding rect at the moment of click.
 * This avoids the issue where FloatingBlockActions' drag handle button can return (0,0)
 * when the panel hides (opacity: 0, pointerEvents: none).
 */
function createVirtualAnchor(rect: DOMRect): HTMLElement {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.top = `${rect.top}px`;
  el.style.left = `${rect.left}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.pointerEvents = "none";
  el.style.opacity = "0";
  document.body.appendChild(el);
  return el;
}

export const YooptaFloatingBlockActions = () => {
  const editor = useYooptaEditor();
  const dragHandleRef = useRef<HTMLButtonElement>(null);
  const [blockOptionsOpen, setBlockOptionsOpen] = useState(false);
  // Capture the blockId at the moment the menu opens so it stays stable
  const [frozenBlockId, setFrozenBlockId] = useState<string | null>(null);
  // Virtual anchor element that captures position at the moment of click
  const virtualAnchorRef = useRef<HTMLElement | null>(null);

  const cleanupVirtualAnchor = useCallback(() => {
    if (virtualAnchorRef.current) {
      virtualAnchorRef.current.remove();
      virtualAnchorRef.current = null;
    }
  }, []);

  // Cleanup virtual anchor on unmount to prevent DOM leaks
  useEffect(() => {
    return () => {
      if (virtualAnchorRef.current) {
        virtualAnchorRef.current.remove();
      }
    };
  }, []);

  const onPlusClick = useCallback((blockId: string | null) => {
    if (!blockId) return;
    const floatingBlock = Blocks.getBlock(editor, { id: blockId });
    if (!floatingBlock) return;

    const nextOrder = floatingBlock.meta.order + 1;
    editor.insertBlock("Paragraph", { at: nextOrder, focus: true });

    // Trigger slash command menu via synthetic KeyboardEvent
    // SlashCommandMenu listens for native DOM keydown, so Transforms.insertText won't work
    setTimeout(() => {
      dispatchSlashKeyEvent(editor);
    }, 50);
  }, [editor]);

  const onDragClick = useCallback((blockId: string | null) => {
    if (!blockId) return;
    // If already open for same block, toggle it off
    if (blockOptionsOpen && frozenBlockId === blockId) {
      setBlockOptionsOpen(false);
      setFrozenBlockId(null);
      cleanupVirtualAnchor();
      return;
    }
    const block = Blocks.getBlock(editor, { id: blockId });
    if (!block) return;
    editor.setPath({ current: block.meta.order });

    // Capture the drag handle's position NOW (before the panel might hide)
    cleanupVirtualAnchor();
    if (dragHandleRef.current) {
      const rect = dragHandleRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        virtualAnchorRef.current = createVirtualAnchor(rect);
      }
    }

    setFrozenBlockId(blockId);
    setBlockOptionsOpen(true);
  }, [editor, blockOptionsOpen, frozenBlockId, cleanupVirtualAnchor]);

  const onBlockOptionsChange = useCallback((open: boolean) => {
    setBlockOptionsOpen(open);
    if (!open) {
      setFrozenBlockId(null);
      cleanupVirtualAnchor();
    }
  }, [cleanupVirtualAnchor]);

  // Use virtual anchor if available, otherwise fall back to drag handle ref
  const anchorElement = blockOptionsOpen
    ? (virtualAnchorRef.current ?? dragHandleRef.current)
    : dragHandleRef.current;

  return (
    <FloatingBlockActions frozen={blockOptionsOpen}>
      {({ blockId }) => {
        // Use frozen blockId when menu is open, otherwise use the live hovered blockId
        const activeBlockId = blockOptionsOpen && frozenBlockId ? frozenBlockId : blockId;
        return (
          <>
            <FloatingBlockActions.Button
              onClick={() => onPlusClick(blockId)}
              title="Add block"
              aria-label="Add block"
            >
              <PlusIcon />
            </FloatingBlockActions.Button>
            <DragHandle blockId={activeBlockId} ref={dragHandleRef} asChild>
              <FloatingBlockActions.Button
                onClick={() => onDragClick(blockId)}
                title="Drag to reorder"
                aria-label="Drag to reorder"
              >
                <GripVertical />
              </FloatingBlockActions.Button>
            </DragHandle>

            <YooptaBlockOptions
              open={blockOptionsOpen}
              onOpenChange={onBlockOptionsChange}
              blockId={activeBlockId}
              anchor={anchorElement}
            />
          </>
        );
      }}
    </FloatingBlockActions>
  );
};
