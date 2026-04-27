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
import { SlashCommandMenu } from "@yoopta/ui/slash-command-menu";

const COMMAND_MENU_ICONS: Record<string, LucideIcon> = {
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

export const YooptaSlashCommandMenu = () => (
  <SlashCommandMenu>
    {(props) => {
      // Group items by category
      const grouped = new Map<string, typeof props.items>();
      for (const item of props.items) {
        const category = BLOCK_CATEGORIES[item.id] || "Other";
        if (!grouped.has(category)) grouped.set(category, []);
        grouped.get(category)!.push(item);
      }

      // Sort groups by CATEGORY_ORDER
      const sortedGroups = [...grouped.entries()].sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]),
      );

      return (
        <SlashCommandMenu.Content>
          <SlashCommandMenu.List>
            <SlashCommandMenu.Empty>No blocks found</SlashCommandMenu.Empty>
            {sortedGroups.map(([category, items]) => (
              <SlashCommandMenu.Group key={category} heading={category}>
                {items.map((item) => {
                  const Icon = COMMAND_MENU_ICONS[item.id];
                  return (
                    <SlashCommandMenu.Item
                      key={item.id}
                      value={item.id}
                      title={item.title}
                      description={item.description}
                      icon={Icon ? <Icon width={20} height={20} /> : null}
                    />
                  );
                })}
              </SlashCommandMenu.Group>
            ))}
          </SlashCommandMenu.List>
          <SlashCommandMenu.Footer />
        </SlashCommandMenu.Content>
      );
    }}
  </SlashCommandMenu>
);
