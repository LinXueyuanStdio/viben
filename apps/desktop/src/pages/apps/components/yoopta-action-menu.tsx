import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  useTransitionStyles,
} from "@floating-ui/react";
import {
  mapActionMenuItems,
  filterToggleActions,
} from "@yoopta/ui/action-menu-list";
import { getRootBlockElement, useYooptaEditor } from "@yoopta/editor";
import type { Placement } from "@floating-ui/dom";
import { BLOCK_ICONS, BLOCK_CATEGORIES, CATEGORY_ORDER } from "./yoopta-constants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: HTMLButtonElement | null;
  placement: Placement;
  /** Called when mouse enters the submenu panel (for hover intent) */
  onMouseEnter?: () => void;
  /** Called when mouse leaves the submenu panel (for hover intent) */
  onMouseLeave?: () => void;
};

type ActionMenuItem = {
  type: string;
  title: string;
  description?: string;
  icon?: unknown;
};

/**
 * YooptaActionMenuList — used for Turn Into submenu.
 *
 * Bypasses the npm ActionMenuList component entirely to avoid render-prop
 * issues when used as a controlled submenu. Computes actions directly from
 * the editor using mapActionMenuItems + filterToggleActions, and calls
 * editor.toggleBlock on select.
 *
 * Does NOT use npm CSS classes (yoopta-ui-action-menu-list-*) because they
 * rely on --yoopta-ui-* CSS variables that are not defined in our app.
 * Instead uses the same yoopta-ui-block-options classes + inline styles.
 */
export const YooptaActionMenuList = ({
  open,
  onOpenChange,
  anchor,
  placement,
  onMouseEnter,
  onMouseLeave,
}: Props) => {
  const editor = useYooptaEditor();

  // Compute actions directly from editor (same logic as ActionMenuListRoot)
  const actions: ActionMenuItem[] = useMemo(() => {
    if (!open) return [];
    return mapActionMenuItems(editor)
      .filter((item) => filterToggleActions(editor, item.type))
      .filter((item) => {
        const plugin = editor.plugins[item.type];
        if (!plugin) return false;
        const rootElement = getRootBlockElement(plugin.elements);
        return (
          rootElement?.props?.nodeType !== "inline" &&
          rootElement?.props?.nodeType !== "inlineVoid" &&
          rootElement?.props?.nodeType !== "void"
        );
      });
  }, [editor, open]);

  const [selectedAction] = useState<ActionMenuItem | null>(null);

  const onSelect = useCallback(
    (type: string) => {
      if (Array.isArray(editor.path.selected) && editor.path.selected.length > 0) {
        editor.batchOperations(() => {
          editor.path.selected!.forEach((selected) => {
            editor.toggleBlock(type, { preserveContent: true, focus: true, at: selected });
          });
        });
      } else {
        editor.toggleBlock(type, { preserveContent: true, focus: true, at: editor.path.current });
      }
      onOpenChange(false);
    },
    [editor, onOpenChange],
  );

  if (!open) return null;

  return (
    <ActionMenuFloatingContent
      open={open}
      onOpenChange={onOpenChange}
      anchor={anchor}
      placement={placement}
      actions={actions}
      selectedAction={selectedAction}
      onSelect={onSelect}
      empty={actions.length === 0}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
};

// ─── Local floating content ──────────────────────────────────────────────────

type ActionMenuFloatingContentProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: HTMLElement | null;
  placement: Placement;
  actions: ActionMenuItem[];
  selectedAction: ActionMenuItem | null;
  onSelect: (type: string) => void;
  empty: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

function ActionMenuFloatingContent({
  open,
  onOpenChange,
  anchor,
  placement,
  actions,
  selectedAction,
  onSelect,
  empty,
  onMouseEnter,
  onMouseLeave,
}: ActionMenuFloatingContentProps) {
  const { t } = useTranslation();
  const { refs, floatingStyles, context } = useFloating({
    elements: { reference: anchor },
    placement,
    open,
    onOpenChange,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    strategy: "fixed",
  });

  const { isMounted, styles: transitionStyles } = useTransitionStyles(
    context,
    {
      duration: 120,
      initial: { opacity: 0 },
      open: { opacity: 1 },
      close: { opacity: 0 },
    },
  );

  // Group actions by category
  const sortedGroups = useMemo(() => {
    const grouped = new Map<string, ActionMenuItem[]>();
    for (const action of actions) {
      const category = BLOCK_CATEGORIES[action.type] || "Other";
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category)!.push(action);
    }
    return [...grouped.entries()].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]),
    );
  }, [actions]);

  if (!isMounted) return null;

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        role="listbox"
        // Use local class (same as BlockOptions) — NOT npm yoopta-ui-action-menu-list-* classes
        // because those depend on --yoopta-ui-* CSS variables that don't exist in our app
        className="yoopta-ui-block-options"
        style={{
          ...floatingStyles,
          minWidth: 200,
          maxHeight: "min(400px, calc(100vh - 40px))",
          overflowY: "auto",
          overscrollBehavior: "contain",
          zIndex: 9999,
          padding: "0.25rem",
          ...transitionStyles,
        }}
        contentEditable={false}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {empty ? (
          <div style={{ padding: "0.5rem", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>
            {t("editor.actionMenu.noActionsAvailable")}
          </div>
        ) : (
          sortedGroups.map(([category, items]) => (
            <div key={category}>
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  color: "hsl(var(--muted-foreground))",
                  padding: "0.375rem 0.5rem 0.125rem",
                  userSelect: "none",
                }}
              >
                {category}
              </div>
              {items.map((action) => {
                const Icon = BLOCK_ICONS[action.type];
                const isSelected = action.type === selectedAction?.type;
                return (
                  <button
                    key={action.type}
                    type="button"
                    className="yoopta-ui-block-options-button"
                    data-action-menu-item-type={action.type}
                    data-selected={isSelected}
                    style={isSelected ? { background: "hsl(var(--accent))" } : undefined}
                    onClick={() => onSelect(action.type)}
                  >
                    {Icon && (
                      <span className="yoopta-ui-block-options-button-icon">
                        <Icon width={16} height={16} />
                      </span>
                    )}
                    <span className="yoopta-ui-block-options-button-text">
                      {action.title}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </FloatingPortal>
  );
}
