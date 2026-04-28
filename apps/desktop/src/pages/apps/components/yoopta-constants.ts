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
import i18n from "@/i18n";

export const BLOCK_ICONS: Record<string, LucideIcon> = {
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

export const BLOCK_CATEGORIES: Record<string, string> = {
  get Paragraph() { return i18n.t("editor.blockCategories.basicBlocks", "Basic blocks"); },
  get HeadingOne() { return i18n.t("editor.blockCategories.basicBlocks", "Basic blocks"); },
  get HeadingTwo() { return i18n.t("editor.blockCategories.basicBlocks", "Basic blocks"); },
  get HeadingThree() { return i18n.t("editor.blockCategories.basicBlocks", "Basic blocks"); },
  get TodoList() { return i18n.t("editor.blockCategories.basicBlocks", "Basic blocks"); },
  get BulletedList() { return i18n.t("editor.blockCategories.basicBlocks", "Basic blocks"); },
  get NumberedList() { return i18n.t("editor.blockCategories.basicBlocks", "Basic blocks"); },
  get Blockquote() { return i18n.t("editor.blockCategories.basicBlocks", "Basic blocks"); },
  get Divider() { return i18n.t("editor.blockCategories.basicBlocks", "Basic blocks"); },
  get Callout() { return i18n.t("editor.blockCategories.basicBlocks", "Basic blocks"); },
  get Image() { return i18n.t("editor.blockCategories.media", "Media"); },
  get Video() { return i18n.t("editor.blockCategories.media", "Media"); },
  get File() { return i18n.t("editor.blockCategories.media", "Media"); },
  get Embed() { return i18n.t("editor.blockCategories.media", "Media"); },
  get Emoji() { return i18n.t("editor.blockCategories.media", "Media"); },
  get Code() { return i18n.t("editor.blockCategories.code", "Code"); },
  get CodeGroup() { return i18n.t("editor.blockCategories.code", "Code"); },
  get Table() { return i18n.t("editor.blockCategories.advanced", "Advanced"); },
  get Accordion() { return i18n.t("editor.blockCategories.advanced", "Advanced"); },
  get Steps() { return i18n.t("editor.blockCategories.advanced", "Advanced"); },
  get Tabs() { return i18n.t("editor.blockCategories.advanced", "Advanced"); },
  get Carousel() { return i18n.t("editor.blockCategories.advanced", "Advanced"); },
  get TableOfContents() { return i18n.t("editor.blockCategories.advanced", "Advanced"); },
  get MathBlock() { return i18n.t("editor.blockCategories.advanced", "Advanced"); },
  get Mention() { return i18n.t("editor.blockCategories.inline", "Inline"); },
};

export function getCategoryOrder(): string[] {
  return [
    i18n.t("editor.blockCategories.basicBlocks", "Basic blocks"),
    i18n.t("editor.blockCategories.media", "Media"),
    i18n.t("editor.blockCategories.code", "Code"),
    i18n.t("editor.blockCategories.advanced", "Advanced"),
    i18n.t("editor.blockCategories.inline", "Inline"),
    i18n.t("editor.blockCategories.other", "Other"),
  ];
}

export const IS_MAC =
  typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

export const MOD_KEY = IS_MAC ? "\u2318" : "Ctrl";
