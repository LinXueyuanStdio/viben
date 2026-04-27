import { useRef, useState } from "react";
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

type YooptaBlockOptionsProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  blockId: string | null;
  anchor?: HTMLButtonElement | null;
};

export const YooptaBlockOptions = ({
  open,
  onOpenChange,
  blockId,
  anchor,
}: YooptaBlockOptionsProps) => {
  const editor = useYooptaEditor();
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
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

  return (
    <>
      <BlockOptions open={open} onOpenChange={onOpenChange} anchor={anchor}>
        <BlockOptions.Content side="right" align="end">
          <BlockOptions.Group>
            <BlockOptions.Item ref={turnIntoRef} onSelect={onTurnInto} keepOpen>
              Turn into
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
          <BlockOptions.Separator />
          <BlockOptions.Group>
            <BlockOptions.Item icon={<ArrowUpIcon size={16} />} onSelect={onMoveUp}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Move up
                <span className="text-muted-foreground/50 text-xs ml-4 font-mono">{isMac ? '⌘⇧↑' : 'Ctrl+Shift+↑'}</span>
              </span>
            </BlockOptions.Item>
            <BlockOptions.Item icon={<ArrowDownIcon size={16} />} onSelect={onMoveDown}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Move down
                <span className="text-muted-foreground/50 text-xs ml-4 font-mono">{isMac ? '⌘⇧↓' : 'Ctrl+Shift+↓'}</span>
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
            <BlockOptions.Item onSelect={onDuplicate}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Duplicate
                <span className="text-muted-foreground/50 text-xs ml-4 font-mono">{isMac ? '\u2318' : 'Ctrl'}+D</span>
              </span>
            </BlockOptions.Item>
            <BlockOptions.Item onSelect={onCopyLink}>
              Copy link to block
            </BlockOptions.Item>
            <BlockOptions.Item variant="destructive" onSelect={onDelete}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Delete
                <span className="text-muted-foreground/50 text-xs ml-4 font-mono">Del</span>
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
