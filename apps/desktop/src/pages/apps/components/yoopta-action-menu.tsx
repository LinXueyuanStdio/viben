import {
  CodeIcon,
  FileIcon,
  ImageIcon,
  TableIcon,
  TextIcon,
  VideoIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  LinkIcon,
  QuoteIcon,
  MinusIcon,
  AtSignIcon,
  ListCollapseIcon,
  ListOrderedIcon,
  PanelLeftIcon,
  GridIcon,
  TableOfContentsIcon,
  RadicalIcon,
  CheckSquareIcon,
  SmileIcon,
  AlertCircleIcon,
  type LucideIcon,
} from "lucide-react";
import { ActionMenuList } from "@yoopta/ui/action-menu-list";
import type { Placement } from "@floating-ui/dom";

const ACTION_MENU_ICONS: Record<string, LucideIcon> = {
  Paragraph: TextIcon,
  HeadingOne: Heading1Icon,
  HeadingTwo: Heading2Icon,
  HeadingThree: Heading3Icon,
  Code: CodeIcon,
  CodeGroup: CodeIcon,
  Embed: LinkIcon,
  Image: ImageIcon,
  Video: VideoIcon,
  Blockquote: QuoteIcon,
  TodoList: CheckSquareIcon,
  BulletedList: ListIcon,
  NumberedList: ListOrderedIcon,
  Table: TableIcon,
  Callout: AlertCircleIcon,
  File: FileIcon,
  Divider: MinusIcon,
  Accordion: ListCollapseIcon,
  Steps: ListOrderedIcon,
  Tabs: PanelLeftIcon,
  Carousel: GridIcon,
  TableOfContents: TableOfContentsIcon,
  MathBlock: RadicalIcon,
  Emoji: SmileIcon,
  Mention: AtSignIcon,
};

const BLOCK_CATEGORIES: Record<string, string> = {
  Paragraph: "Basic blocks",
  HeadingOne: "Basic blocks",
  HeadingTwo: "Basic blocks",
  HeadingThree: "Basic blocks",
  TodoList: "Basic blocks",
  BulletedList: "Basic blocks",
  NumberedList: "Basic blocks",
  Blockquote: "Basic blocks",
  Divider: "Basic blocks",
  Callout: "Basic blocks",
  Image: "Media",
  Video: "Media",
  File: "Media",
  Embed: "Media",
  Emoji: "Media",
  Code: "Code",
  CodeGroup: "Code",
  Table: "Advanced",
  Accordion: "Advanced",
  Steps: "Advanced",
  Tabs: "Advanced",
  Carousel: "Advanced",
  TableOfContents: "Advanced",
  MathBlock: "Advanced",
  Mention: "Inline",
};

const CATEGORY_ORDER = [
  "Basic blocks",
  "Media",
  "Code",
  "Advanced",
  "Inline",
  "Other",
];

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
                  const Icon = ACTION_MENU_ICONS[action.type];
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
