import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CSSProperties, ReactNode } from "react";
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useMergeRefs,
  useTransitionStyles,
} from "@floating-ui/react";
import { useBlockActions } from "@yoopta/ui/block-options";
import { Blocks, useYooptaEditor } from "@yoopta/editor";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUpIcon,
  ArrowDownIcon,
  Check,
  ChevronRightIcon,
  IndentIncreaseIcon,
  IndentDecreaseIcon,
} from "lucide-react";
import { YooptaActionMenuList } from "./yoopta-action-menu";
import { IS_MAC, MOD_KEY } from "./yoopta-constants";

// ─── Local BlockOptions primitives ───────────────────────────────────────────
// Replaces npm BlockOptions.Content / Group / Item / Separator / Label
// to avoid FloatingOverlay lockScroll containing-block offset bug.

type BlockOptionsContentProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: HTMLElement | null;
};

/**
 * Custom replacement for npm BlockOptions.Content.
 * Key differences:
 * - Portals to document.body (no root → body), NOT editor.refElement
 * - No FloatingOverlay lockScroll (avoids containing-block transform offset)
 * - Uses useDismiss for outside click/escape handling
 */
const BlockOptionsContent = forwardRef<HTMLDivElement, BlockOptionsContentProps>(
  (
    {
      children,
      className = "",
      style,
      side = "right",
      align = "start",
      sideOffset = 5,
      open,
      onOpenChange,
      anchor,
    },
    forwardedRef,
  ) => {
    const placement =
      align === "center" ? side : (`${side}-${align}` as const);

    const { refs, floatingStyles, context } = useFloating({
      elements: { reference: anchor },
      placement,
      open,
      onOpenChange,
      middleware: [offset(sideOffset), flip(), shift({ padding: 8 })],
      whileElementsMounted: autoUpdate,
      strategy: "fixed",
    });

    const { isMounted, styles: transitionStyles } = useTransitionStyles(
      context,
      {
        duration: 150,
        initial: { opacity: 0 },
        open: { opacity: 1 },
        close: { opacity: 0 },
      },
    );

    const dismiss = useDismiss(context, {
      outsidePress: true,
      escapeKey: true,
    });

    const { getFloatingProps } = useInteractions([dismiss]);

    const contentRef = useMergeRefs([refs.setFloating, forwardedRef]);

    if (!isMounted) return null;

    return (
      <FloatingPortal>
        <FloatingFocusManager context={context} modal={false}>
          <div
            ref={contentRef}
            role="menu"
            aria-orientation="vertical"
            className={`yoopta-ui-block-options ${className}`}
            style={{ ...floatingStyles, ...style, ...transitionStyles }}
            contentEditable={false}
            {...getFloatingProps({
              onClick: (e) => e.stopPropagation(),
              onMouseDown: (e) => e.stopPropagation(),
            })}
          >
            {children}
          </div>
        </FloatingFocusManager>
      </FloatingPortal>
    );
  },
);
BlockOptionsContent.displayName = "BlockOptionsContent";

const BlockOptionsGroup = forwardRef<
  HTMLDivElement,
  { children: ReactNode; className?: string }
>(({ children, className = "" }, ref) => (
  <div
    ref={ref}
    role="group"
    className={`yoopta-ui-block-options-group ${className}`}
  >
    {children}
  </div>
));
BlockOptionsGroup.displayName = "BlockOptionsGroup";

type BlockOptionsItemProps = {
  children: ReactNode;
  onSelect?: (event: React.MouseEvent) => void;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
  variant?: "default" | "destructive";
  keepOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">;

const BlockOptionsItem = forwardRef<HTMLButtonElement, BlockOptionsItemProps>(
  (
    {
      children,
      onSelect,
      className = "",
      disabled,
      icon,
      variant = "default",
      keepOpen = false,
      onOpenChange,
      ...props
    },
    ref,
  ) => {
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;
        onSelect?.(e);
        if (!keepOpen) {
          onOpenChange?.(false);
        }
      },
      [disabled, onSelect, onOpenChange, keepOpen],
    );

    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        disabled={disabled}
        className={`yoopta-ui-block-options-button yoopta-ui-block-options-button-${variant} ${className}`}
        onClick={handleClick}
        {...props}
      >
        {icon && (
          <span className="yoopta-ui-block-options-button-icon">{icon}</span>
        )}
        <span className="yoopta-ui-block-options-button-text">{children}</span>
      </button>
    );
  },
);
BlockOptionsItem.displayName = "BlockOptionsItem";

const BlockOptionsSeparator = forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className = "" }, ref) => (
  <div
    ref={ref}
    role="separator"
    className={`yoopta-ui-block-options-separator ${className}`}
  />
));
BlockOptionsSeparator.displayName = "BlockOptionsSeparator";

const BlockOptionsLabel = forwardRef<
  HTMLDivElement,
  { children: ReactNode; className?: string }
>(({ children, className = "" }, ref) => (
  <div ref={ref} className={`yoopta-ui-block-options-label ${className}`}>
    {children}
  </div>
));
BlockOptionsLabel.displayName = "BlockOptionsLabel";

// ─── YooptaBlockOptions ─────────────────────────────────────────────────────

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
  const { t } = useTranslation();
  const editor = useYooptaEditor();
  const { duplicateBlock, copyBlockLink, deleteBlock } = useBlockActions();
  const turnIntoRef = useRef<HTMLButtonElement>(null);
  const [turnIntoOpen, setTurnIntoOpen] = useState(false);
  // Delayed close for Turn Into hover — gives user time to move mouse to submenu
  const turnIntoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTurnIntoClose = useCallback(() => {
    if (turnIntoCloseTimer.current) {
      clearTimeout(turnIntoCloseTimer.current);
      turnIntoCloseTimer.current = null;
    }
  }, []);

  const scheduleTurnIntoClose = useCallback(() => {
    cancelTurnIntoClose();
    turnIntoCloseTimer.current = setTimeout(() => {
      setTurnIntoOpen(false);
    }, 150); // 150ms grace period to move to submenu
  }, [cancelTurnIntoClose]);

  // Cleanup timer
  useEffect(() => () => cancelTurnIntoClose(), [cancelTurnIntoClose]);

  // Close Turn Into submenu when parent closes
  useEffect(() => {
    if (!open) {
      cancelTurnIntoClose();
      setTurnIntoOpen(false);
    }
  }, [open, cancelTurnIntoClose]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        cancelTurnIntoClose();
        setTurnIntoOpen(false);
      }
      onOpenChange?.(newOpen);
    },
    [onOpenChange, cancelTurnIntoClose],
  );

  const onActionMenuClose = (menuOpen: boolean) => {
    setTurnIntoOpen(menuOpen);
    if (!menuOpen) {
      onOpenChange?.(false);
    }
  };

  const onTurnInto = () => {
    cancelTurnIntoClose();
    setTurnIntoOpen((prev) => !prev);
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
      <BlockOptionsContent
        open={!!open}
        onOpenChange={handleOpenChange}
        anchor={anchor ?? null}
        side="right"
        align="start"
      >
        <BlockOptionsGroup>
          <BlockOptionsItem variant="destructive" onSelect={onDelete} onOpenChange={handleOpenChange}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {t("editor.blockOptions.delete")}
              <span className="text-muted-foreground/50 text-xs ml-4 font-mono">Del</span>
            </span>
          </BlockOptionsItem>
          <BlockOptionsItem onSelect={onDuplicate} onOpenChange={handleOpenChange}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {t("editor.blockOptions.duplicate")}
              <span className="text-muted-foreground/50 text-xs ml-4 font-mono">{MOD_KEY}+D</span>
            </span>
          </BlockOptionsItem>
          <BlockOptionsItem
            ref={turnIntoRef}
            onSelect={onTurnInto}
            keepOpen
            onOpenChange={handleOpenChange}
            onMouseEnter={() => {
              cancelTurnIntoClose();
              setTurnIntoOpen(true);
            }}
            onMouseLeave={() => {
              scheduleTurnIntoClose();
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {t("editor.blockOptions.turnInto")}
              <ChevronRightIcon size={14} className="text-muted-foreground/50" />
            </span>
          </BlockOptionsItem>
          <BlockOptionsItem onSelect={onCopyLink} onOpenChange={handleOpenChange}>
            {t("editor.blockOptions.copyLinkToBlock")}
          </BlockOptionsItem>
        </BlockOptionsGroup>
        <BlockOptionsSeparator />
        <BlockOptionsGroup>
          <BlockOptionsItem icon={<ArrowUpIcon size={16} />} onSelect={onMoveUp} onOpenChange={handleOpenChange}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {t("editor.blockOptions.moveUp")}
              <span className="text-muted-foreground/50 text-xs ml-4 font-mono">{IS_MAC ? '⌘⇧↑' : 'Ctrl+Shift+↑'}</span>
            </span>
          </BlockOptionsItem>
          <BlockOptionsItem icon={<ArrowDownIcon size={16} />} onSelect={onMoveDown} onOpenChange={handleOpenChange}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {t("editor.blockOptions.moveDown")}
              <span className="text-muted-foreground/50 text-xs ml-4 font-mono">{IS_MAC ? '⌘⇧↓' : 'Ctrl+Shift+↓'}</span>
            </span>
          </BlockOptionsItem>
          <BlockOptionsItem icon={<IndentIncreaseIcon size={16} />} onSelect={onIndent} onOpenChange={handleOpenChange}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {t("editor.blockOptions.indent")}
              <span className="text-muted-foreground/50 text-xs ml-4 font-mono">Tab</span>
            </span>
          </BlockOptionsItem>
          <BlockOptionsItem icon={<IndentDecreaseIcon size={16} />} onSelect={onOutdent} onOpenChange={handleOpenChange}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {t("editor.blockOptions.outdent")}
              <span className="text-muted-foreground/50 text-xs ml-4 font-mono">Shift+Tab</span>
            </span>
          </BlockOptionsItem>
        </BlockOptionsGroup>
        <BlockOptionsSeparator />
        <BlockOptionsGroup>
          <BlockOptionsLabel>{t("editor.blockOptions.align")}</BlockOptionsLabel>
          <BlockOptionsItem
            icon={<AlignLeft size={16} />}
            onSelect={() => onAlign("left")}
            onOpenChange={handleOpenChange}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {t("editor.blockOptions.alignLeft")}
              {currentAlign === "left" && <Check size={14} />}
            </span>
          </BlockOptionsItem>
          <BlockOptionsItem
            icon={<AlignCenter size={16} />}
            onSelect={() => onAlign("center")}
            onOpenChange={handleOpenChange}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {t("editor.blockOptions.alignCenter")}
              {currentAlign === "center" && <Check size={14} />}
            </span>
          </BlockOptionsItem>
          <BlockOptionsItem
            icon={<AlignRight size={16} />}
            onSelect={() => onAlign("right")}
            onOpenChange={handleOpenChange}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {t("editor.blockOptions.alignRight")}
              {currentAlign === "right" && <Check size={14} />}
            </span>
          </BlockOptionsItem>
        </BlockOptionsGroup>
      </BlockOptionsContent>

      {/* Turn Into submenu — uses YooptaActionMenuList (same as slash command menu) */}
      <YooptaActionMenuList
        placement="right-start"
        open={turnIntoOpen && !!open}
        onOpenChange={onActionMenuClose}
        anchor={turnIntoRef.current}
        onMouseEnter={cancelTurnIntoClose}
        onMouseLeave={scheduleTurnIntoClose}
      />
    </>
  );
};
