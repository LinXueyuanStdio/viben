import { useEffect, useRef, useState } from "react";
import { BlockOptions, useBlockActions } from "@yoopta/ui/block-options";
import { Blocks, useYooptaEditor } from "@yoopta/editor";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUpIcon,
  ArrowDownIcon,
  Check,
  IndentIncreaseIcon,
  IndentDecreaseIcon,
} from "lucide-react";
import { YooptaActionMenuList } from "./yoopta-action-menu";
import { IS_MAC, MOD_KEY } from "./yoopta-constants";

type YooptaBlockOptionsProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  blockId: string | null;
  anchor?: HTMLElement | null;
};

export const YooptaBlockOptions = ({
  open,
  onOpenChange,
  blockId,
  anchor,
}: YooptaBlockOptionsProps) => {
  const editor = useYooptaEditor();
  const { duplicateBlock, copyBlockLink, deleteBlock } = useBlockActions();
  const turnIntoRef = useRef<HTMLButtonElement>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  const onTurnInto = () => {
    setActionMenuOpen(true);
  };

  const onActionMenuClose = (menuOpen: boolean) => {
    setActionMenuOpen(menuOpen);
    if (!menuOpen) {
      onOpenChange?.(false);
    }
  };

  const onDuplicate = () => {
    if (!blockId) return;
    duplicateBlock(blockId);
    onOpenChange?.(false);
  };

  const onCopyLink = () => {
    if (!blockId) return;
    copyBlockLink(blockId);
    onOpenChange?.(false);
  };

  const onMoveUp = () => {
    if (!blockId) return;
    const block = Blocks.getBlock(editor, { id: blockId });
    if (!block || block.meta.order === 0) return;
    editor.moveBlock(blockId, block.meta.order - 1);
    onOpenChange?.(false);
  };

  const onMoveDown = () => {
    if (!blockId) return;
    const block = Blocks.getBlock(editor, { id: blockId });
    if (!block) return;
    const blockCount = Object.keys(editor.children).length;
    if (block.meta.order >= blockCount - 1) return;
    editor.moveBlock(blockId, block.meta.order + 2);
    onOpenChange?.(false);
  };

  const onIndent = () => {
    if (!blockId) return;
    editor.increaseBlockDepth({ blockId });
    onOpenChange?.(false);
  };

  const onOutdent = () => {
    if (!blockId) return;
    const block = Blocks.getBlock(editor, { id: blockId });
    if (!block || block.meta.depth === 0) return;
    editor.decreaseBlockDepth({ blockId });
    onOpenChange?.(false);
  };

  const onDelete = () => {
    if (!blockId) return;
    deleteBlock(blockId);
    onOpenChange?.(false);
  };

  const currentBlock = blockId
    ? Blocks.getBlock(editor, { id: blockId })
    : null;
  const currentAlign = currentBlock?.meta.align ?? "left";

  const onAlign = (align: "left" | "center" | "right") => {
    if (!blockId) return;
    const block = Blocks.getBlock(editor, { id: blockId });
    if (!block) return;
    editor.applyTransforms([
      {
        type: "set_block_meta",
        id: blockId,
        properties: { align },
        prevProperties: { align: block.meta.align },
      },
    ]);
    onOpenChange?.(false);
  };

  // Debug: log menu DOM position at different timing points
  useEffect(() => {
    if (!open) return;

    const logMenuState = (label: string) => {
      const menuEl = document.querySelector(".yoopta-ui-block-options") as HTMLElement | null;
      if (menuEl) {
        const cs = window.getComputedStyle(menuEl);
        console.log(`[YooptaBlockOptions] ${label}`, {
          menuRect: menuEl.getBoundingClientRect(),
          inlineStyle: menuEl.style.cssText,
          computedTransform: cs.transform,
          computedOpacity: cs.opacity,
        });

        // Check ALL ancestors for containing-block properties
        let el: HTMLElement | null = menuEl.parentElement;
        const ancestors: string[] = [];
        while (el) {
          const s = window.getComputedStyle(el);
          if ((s.transform && s.transform !== "none") ||
              (s.willChange && s.willChange !== "auto") ||
              (s.contain && s.contain !== "none")) {
            ancestors.push(`<${el.tagName} class="${el.className?.toString().slice(0, 40)}"> transform=${s.transform} willChange=${s.willChange} contain=${s.contain}`);
          }
          el = el.parentElement;
        }
        if (ancestors.length > 0) {
          console.log(`[YooptaBlockOptions] ${label} CONTAINING BLOCK ancestors:`, ancestors);
        }
      } else {
        console.log(`[YooptaBlockOptions] ${label}: menu NOT in DOM`);
      }
    };

    // Frame 0 — synchronous (useEffect fires after DOM commit)
    logMenuState("FRAME-0 (useEffect sync)");

    // Frame 1 — next animation frame
    const raf1 = requestAnimationFrame(() => {
      logMenuState("FRAME-1 (rAF)");

      // Frame 2 — second animation frame
      const raf2 = requestAnimationFrame(() => {
        logMenuState("FRAME-2 (rAF2)");
      });
      return () => cancelAnimationFrame(raf2);
    });

    // Frame delayed — 100ms
    const timer = setTimeout(() => logMenuState("FRAME-delayed (100ms)"), 100);

    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(timer);
    };
  }, [open]);

  // Debug: log anchor positioning info and containing block analysis
  if (open) {
    // Check ancestor chain for containing-block-creating CSS properties
    const containingBlockInfo: string[] = [];
    let el = editor.refElement as HTMLElement | null;
    while (el) {
      const cs = window.getComputedStyle(el);
      const transform = cs.transform;
      const willChange = cs.willChange;
      const filter = cs.filter;
      const backdropFilter = cs.backdropFilter;
      const contain = cs.contain;
      const perspective = cs.perspective;
      if (
        (transform && transform !== "none") ||
        (willChange && willChange !== "auto" && /transform|perspective|filter/.test(willChange)) ||
        (filter && filter !== "none") ||
        (backdropFilter && backdropFilter !== "none") ||
        (contain && contain !== "none" && /paint|layout/.test(contain)) ||
        (perspective && perspective !== "none")
      ) {
        containingBlockInfo.push(
          `${el.tagName}.${el.className?.toString().slice(0, 60)} → transform:${transform}, willChange:${willChange}, filter:${filter}, backdropFilter:${backdropFilter}, contain:${contain}, perspective:${perspective}`
        );
      }
      el = el.parentElement;
    }

    console.log("[YooptaBlockOptions] render open", {
      anchor,
      anchorRect: anchor?.getBoundingClientRect(),
      blockId,
      editorRefElement: editor.refElement,
      editorRefElementRect: editor.refElement?.getBoundingClientRect(),
      containingBlockAncestors: containingBlockInfo,
    });
  }

  return (
    <>
      <BlockOptions open={open} onOpenChange={onOpenChange} anchor={anchor}>
        <BlockOptions.Content side="right" align="start">
          <BlockOptions.Group>
            <BlockOptions.Item variant="destructive" onSelect={onDelete}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Delete
                <span className="text-muted-foreground/50 text-xs ml-4 font-mono">Del</span>
              </span>
            </BlockOptions.Item>
            <BlockOptions.Item onSelect={onDuplicate}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Duplicate
                <span className="text-muted-foreground/50 text-xs ml-4 font-mono">{MOD_KEY}+D</span>
              </span>
            </BlockOptions.Item>
            <BlockOptions.Item ref={turnIntoRef} onSelect={onTurnInto} keepOpen>
              Turn into
            </BlockOptions.Item>
            <BlockOptions.Item onSelect={onCopyLink}>
              Copy link to block
            </BlockOptions.Item>
          </BlockOptions.Group>
          <BlockOptions.Separator />
          <BlockOptions.Group>
            <BlockOptions.Item icon={<ArrowUpIcon size={16} />} onSelect={onMoveUp}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Move up
                <span className="text-muted-foreground/50 text-xs ml-4 font-mono">{IS_MAC ? '⌘⇧↑' : 'Ctrl+Shift+↑'}</span>
              </span>
            </BlockOptions.Item>
            <BlockOptions.Item icon={<ArrowDownIcon size={16} />} onSelect={onMoveDown}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Move down
                <span className="text-muted-foreground/50 text-xs ml-4 font-mono">{IS_MAC ? '⌘⇧↓' : 'Ctrl+Shift+↓'}</span>
              </span>
            </BlockOptions.Item>
            <BlockOptions.Item icon={<IndentIncreaseIcon size={16} />} onSelect={onIndent}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Indent
                <span className="text-muted-foreground/50 text-xs ml-4 font-mono">Tab</span>
              </span>
            </BlockOptions.Item>
            <BlockOptions.Item icon={<IndentDecreaseIcon size={16} />} onSelect={onOutdent}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Outdent
                <span className="text-muted-foreground/50 text-xs ml-4 font-mono">Shift+Tab</span>
              </span>
            </BlockOptions.Item>
          </BlockOptions.Group>
          <BlockOptions.Separator />
          <BlockOptions.Group>
            <BlockOptions.Label>Align</BlockOptions.Label>
            <BlockOptions.Item
              icon={<AlignLeft size={16} />}
              onSelect={() => onAlign("left")}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Left
                {currentAlign === "left" && <Check size={14} />}
              </span>
            </BlockOptions.Item>
            <BlockOptions.Item
              icon={<AlignCenter size={16} />}
              onSelect={() => onAlign("center")}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Center
                {currentAlign === "center" && <Check size={14} />}
              </span>
            </BlockOptions.Item>
            <BlockOptions.Item
              icon={<AlignRight size={16} />}
              onSelect={() => onAlign("right")}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Right
                {currentAlign === "right" && <Check size={14} />}
              </span>
            </BlockOptions.Item>
          </BlockOptions.Group>
        </BlockOptions.Content>
      </BlockOptions>
      <YooptaActionMenuList
        placement="right-start"
        open={actionMenuOpen}
        onOpenChange={onActionMenuClose}
        anchor={turnIntoRef.current}
      />
    </>
  );
};
