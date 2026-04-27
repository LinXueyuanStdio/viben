import { ActionMenuList } from "@yoopta/ui/action-menu-list";
import type { Placement } from "@floating-ui/dom";
import { BLOCK_ICONS, BLOCK_CATEGORIES, CATEGORY_ORDER } from "./yoopta-constants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: HTMLButtonElement | null;
  placement: Placement;
};

export const YooptaActionMenuList = ({
  open,
  onOpenChange,
  anchor,
  placement,
}: Props) => {
  return (
    <ActionMenuList
      open={open}
      anchor={anchor}
      onOpenChange={onOpenChange}
      view="small"
      placement={placement}
    >
      {({ actions, selectedAction, onSelect, empty }) => {
        if (empty) {
          return (
            <ActionMenuList.Content>
              <ActionMenuList.Empty>
                No actions available
              </ActionMenuList.Empty>
            </ActionMenuList.Content>
          );
        }

        // Group actions by category
        const grouped = new Map<string, typeof actions>();
        for (const action of actions) {
          const category = BLOCK_CATEGORIES[action.type] || "Other";
          if (!grouped.has(category)) grouped.set(category, []);
          grouped.get(category)!.push(action);
        }

        // Sort groups by CATEGORY_ORDER
        const sortedGroups = [...grouped.entries()].sort(
          (a, b) =>
            CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]),
        );

        return (
          <ActionMenuList.Content>
            {sortedGroups.map(([category, items]) => (
              <ActionMenuList.Group key={category}>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    color: "hsl(var(--yoopta-ui-muted-foreground))",
                    padding: "0.375rem 0.5rem 0.125rem",
                    userSelect: "none",
                  }}
                >
                  {category}
                </div>
                {items.map((action) => {
                  const Icon = BLOCK_ICONS[action.type];
                  return (
                    <ActionMenuList.Item
                      key={action.type}
                      action={action}
                      selected={
                        action.type === selectedAction?.type
                      }
                      icon={
                        Icon ? (
                          <Icon width={16} height={16} />
                        ) : undefined
                      }
                      onClick={() => onSelect(action.type)}
                    />
                  );
                })}
              </ActionMenuList.Group>
            ))}
          </ActionMenuList.Content>
        );
      }}
    </ActionMenuList>
  );
};
