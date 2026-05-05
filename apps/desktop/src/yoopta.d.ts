declare module "@yoopta/editor" {
  import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";
  import type { Editor as SlateEditor } from "slate";

  export type SlateElementTextNode = {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    code?: boolean;
    strike?: boolean;
    highlight?: unknown;
  };

  export type SlateElement<K extends string = string, T = Record<string, unknown>> = {
    id: string;
    type: K;
    children: Array<SlateElement | SlateElementTextNode>;
    props?: T;
  };

  export type YooptaBlockBaseMeta = {
    order: number;
    depth: number;
    align?: "left" | "center" | "right";
  };

  export type YooptaBlockData<T = SlateElement> = {
    id: string;
    value: T[];
    type: string;
    meta: YooptaBlockBaseMeta;
  };

  export type YooptaContentValue = Record<string, YooptaBlockData>;
  export type YooptaPath = {
    current: number | null;
    selected?: number[] | null;
    selection?: unknown;
    source?: null | "selection-box" | "native-selection" | "mousemove" | "keyboard" | "copy-paste";
  };

  export type PluginElement<TKeys = string, TProps = Record<string, unknown>> = {
    render?: (props: unknown) => ReactElement;
    props?: { nodeType?: "block" | "inline" | "void" | "inlineVoid" } & TProps;
    asRoot?: boolean;
    children?: TKeys[];
    injectElementsFromPlugins?: string[];
    rootPlugin?: string;
    placeholder?: string;
  };

  export type PluginElementsMap = Record<string, PluginElement>;
  export type YooptaPluginShape = {
    type: string;
    elements: PluginElementsMap;
    options?: {
      display?: {
        title?: string;
        description?: string;
        icon?: ReactNode;
      };
    };
    parsers?: {
      markdown?: {
        serialize?: (
          element: SlateElement,
          content: string,
          blockMetaData?: YooptaBlockBaseMeta,
          editor?: YooEditor,
          blockData?: YooptaBlockData,
        ) => string;
      };
    };
  };

  export class YooptaPlugin<
    TElementMap extends Record<string, SlateElement> = Record<string, SlateElement>,
    TOptions = Record<string, unknown>,
  > {
    get getPlugin(): YooptaPluginShape;
    extend(options: unknown): YooptaPlugin<TElementMap, TOptions>;
  }

  export type YooEditor = {
    id: string;
    readOnly: boolean;
    refElement: HTMLElement | null;
    path: YooptaPath;
    children: YooptaContentValue;
    formats: Record<string, boolean | undefined>;
    plugins: Record<string, YooptaPluginShape>;
    blockEditorsMap: Record<string, SlateEditor>;
    historyStack: {
      undos: unknown[];
      redos: unknown[];
    };
    isEmpty: () => boolean;
    getEditorValue: () => YooptaContentValue;
    setEditorValue: (value: YooptaContentValue) => void;
    setPath: (path: YooptaPath) => void;
    insertBlock: (type: string, options?: Record<string, unknown>) => string | undefined;
    updateBlock: (options: Record<string, unknown>) => void;
    deleteBlock: (options?: Record<string, unknown>) => void;
    duplicateBlock: (options?: Record<string, unknown>) => void;
    toggleBlock: (type: string, options?: Record<string, unknown>) => void;
    increaseBlockDepth: (options?: Record<string, unknown>) => void;
    decreaseBlockDepth: (options?: Record<string, unknown>) => void;
    moveBlock: (blockId: string, order: number) => void;
    focusBlock: (options?: Record<string, unknown>) => void;
    applyTransforms: (operations: unknown[]) => void;
    batchOperations: (fn: () => void) => void;
    withoutSavingHistory: (fn: () => void) => void;
    undo: () => void;
    redo: () => void;
    on: (event: string, fn: (...args: unknown[]) => void) => void;
    off: (event: string, fn: (...args: unknown[]) => void) => void;
    emit: (event: string, payload: unknown) => void;
    focus: () => void;
    blur: (options?: Record<string, unknown>) => void;
    isFocused: () => boolean;
  };

  export type CreateYooptaEditorOptions = {
    id?: string;
    plugins: readonly YooptaPlugin[];
    marks?: unknown[];
    value?: YooptaContentValue;
    readOnly?: boolean;
  };

  export type YooptaOnChangeOptions = {
    operations: unknown[];
  };

  export type RenderBlockProps = {
    block: YooptaBlockData;
    children: ReactNode;
    blockId: string;
  };

  export type YooptaEditorProps = {
    editor: YooEditor;
    onChange?: (value: YooptaContentValue, options: YooptaOnChangeOptions) => void;
    onPathChange?: (path: YooptaPath) => void;
    autoFocus?: boolean;
    className?: string;
    children?: ReactNode;
    placeholder?: string;
    style?: CSSProperties;
    renderBlock?: (props: RenderBlockProps) => ReactNode;
  };

  const YooptaEditor: (props: YooptaEditorProps) => ReactElement | null;
  export default YooptaEditor;

  export function createYooptaEditor(options: CreateYooptaEditorOptions): YooEditor;
  export function useYooptaEditor(): YooEditor;
  export function useYooptaReadOnly(): boolean;
  export function getRootBlockElement(elements: PluginElementsMap): PluginElement | undefined;
  export function getRootBlockElementType(elements: PluginElementsMap): string | undefined;

  export const Blocks: {
    getBlock: (editor: YooEditor, options: Record<string, unknown>) => YooptaBlockData | null;
    getBlockSlate: (editor: YooEditor, options: Record<string, unknown>) => SlateEditor | null;
    moveBlock: (editor: YooEditor, blockId: string, order: number) => void;
    toggleBlock: (editor: YooEditor, type: string, options?: Record<string, unknown>) => void;
  };

  export const Marks: {
    add: (editor: YooEditor, options: Record<string, unknown>) => void;
    toggle: (editor: YooEditor, options: Record<string, unknown>) => void;
    isActive: (editor: YooEditor, options: Record<string, unknown>) => boolean;
    getValue: (editor: YooEditor, options: Record<string, unknown>) => unknown;
  };
}

declare module "@yoopta/exports" {
  import type { YooEditor, YooptaContentValue } from "@yoopta/editor";

  export const markdown: {
    deserialize: (editor: YooEditor, value: string) => YooptaContentValue;
    serialize: (editor: YooEditor, value: YooptaContentValue) => string;
  };
  export const html: {
    serialize: (editor: YooEditor, value: YooptaContentValue) => string;
    deserialize: (editor: YooEditor, value: string) => YooptaContentValue;
  };
}

declare module "@yoopta/ui/action-menu-list" {
  import type { ReactNode } from "react";
  import type { YooEditor } from "@yoopta/editor";

  export type ActionMenuItem = {
    type: string;
    title: string;
    description?: string;
    icon?: ReactNode;
  };

  export function mapActionMenuItems(editor: YooEditor): ActionMenuItem[];
  export function filterToggleActions(editor: YooEditor, type: string): boolean;
}

declare module "@yoopta/ui/block-dnd" {
  import type { ReactElement, ReactNode } from "react";
  import type { YooEditor, YooptaBlockData } from "@yoopta/editor";

  export type BlockDndContextProps = {
    editor: YooEditor;
    children: ReactNode;
    onDragStart?: (event: unknown, blocks: YooptaBlockData[]) => void;
    onDragEnd?: (event: unknown, moved: boolean) => void;
    renderDragOverlay?: (blocks: YooptaBlockData[]) => ReactNode;
    enableMultiDrag?: boolean;
  };
  export const BlockDndContext: (props: BlockDndContextProps) => ReactElement | null;

  export type SortableBlockProps = {
    id: string;
    index?: number;
    children: ReactNode;
    className?: string;
    disabled?: boolean;
    useDragHandle?: boolean;
  };
  export const SortableBlock: (props: SortableBlockProps) => ReactElement | null;

  export type DragHandleProps = {
    blockId: string | null;
    children: ReactNode;
    className?: string;
    onClick?: (event: MouseEvent) => void;
    asChild?: boolean;
  };
  export const DragHandle: (props: DragHandleProps & { ref?: React.Ref<HTMLButtonElement> }) => ReactElement | null;
}

declare module "@yoopta/ui/block-options" {
  export function useBlockActions(): {
    duplicateBlock: (blockId: string) => void;
    copyBlockLink: (blockId: string) => void;
    deleteBlock: (blockId: string) => void;
  };
}

declare module "@yoopta/ui/floating-toolbar" {
  import type { HTMLAttributes, ReactElement, ReactNode } from "react";

  type FloatingToolbarApi = {
    isOpen: boolean;
  };
  type FloatingToolbarRootProps = {
    children: ReactNode | ((api: FloatingToolbarApi) => ReactNode);
    frozen?: boolean;
    className?: string;
  };
  type FloatingToolbarButtonProps = {
    active?: boolean;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
  } & HTMLAttributes<HTMLButtonElement>;

  export const FloatingToolbar: {
    (props: FloatingToolbarRootProps): ReactElement | null;
    Root: (props: FloatingToolbarRootProps) => ReactElement | null;
    Content: (props: HTMLAttributes<HTMLDivElement>) => ReactElement | null;
    Group: (props: HTMLAttributes<HTMLDivElement>) => ReactElement | null;
    Separator: (props: HTMLAttributes<HTMLDivElement>) => ReactElement | null;
    Button: (props: FloatingToolbarButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => ReactElement | null;
  };
}

declare module "@yoopta/ui/highlight-color-picker" {
  import type { ReactElement } from "react";

  export type HighlightColorPickerProps = {
    value?: {
      color?: string;
      backgroundColor?: string;
    };
    onChange?: (values: { color?: string; backgroundColor?: string }) => void;
    presets?: string[];
    showInput?: boolean;
    className?: string;
    children: ReactElement;
    placement?: "top" | "bottom" | "left" | "right";
    offset?: number;
  };
  export const HighlightColorPicker: (props: HighlightColorPickerProps) => ReactElement | null;
}

declare module "@yoopta/ui/selection-box" {
  import type { ReactElement } from "react";

  export type SelectionBoxProps = {
    selectionBoxElement?: HTMLElement | { current: HTMLElement | null } | null;
  };
  export const SelectionBox: (props: SelectionBoxProps) => ReactElement | null;
}

declare module "@yoopta/ui/slash-command-menu" {
  import type { ReactElement, ReactNode } from "react";

  export type SlashCommandItem = {
    id: string;
    title: string;
    description?: string;
    icon?: ReactNode;
    keywords?: string[];
    group?: string;
    disabled?: boolean;
    onSelect?: () => void;
  };
  export type SlashCommandRootChildrenProps = {
    groupedItems: Map<string, SlashCommandItem[]>;
    items: SlashCommandItem[];
  };
  export type SlashCommandRootProps = {
    children: ReactNode | ((props: SlashCommandRootChildrenProps) => ReactNode);
    items?: SlashCommandItem[];
    trigger?: string;
    onSelect?: (item: SlashCommandItem) => void;
    className?: string;
  };
  export const SlashCommandMenu: {
    (props: SlashCommandRootProps): ReactElement | null;
    Root: (props: SlashCommandRootProps) => ReactElement | null;
    Content: (props: { children?: ReactNode }) => ReactElement | null;
    List: (props: { children?: ReactNode }) => ReactElement | null;
    Empty: (props: { children?: ReactNode }) => ReactElement | null;
    Group: (props: { children?: ReactNode; heading?: string }) => ReactElement | null;
    Item: (props: {
      value: string;
      title: string;
      description?: string;
      icon?: ReactNode;
    }) => ReactElement | null;
    Footer: (props: Record<string, never>) => ReactElement | null;
  };
}

declare module "@yoopta/themes-shadcn" {
  export function applyTheme(theme: unknown): void;
}
declare module "@yoopta/themes-shadcn/*";

declare module "@yoopta/marks" {
  export const Bold: unknown;
  export const Italic: unknown;
  export const Underline: unknown;
  export const Strike: unknown;
  export const CodeMark: unknown;
  export const Highlight: unknown;
}

declare module "@yoopta/math" {
  import type { YooEditor, YooptaPlugin } from "@yoopta/editor";
  import type { Editor as SlateEditor } from "slate";

  export const MathInline: YooptaPlugin;
  export const MathBlock: YooptaPlugin;
  export const MathInlineCommands: {
    insertMathInline: (editor: YooEditor, value: string, options: { slate: SlateEditor }) => void;
  };
}

declare module "@yoopta/link" {
  import type { YooEditor, YooptaPlugin } from "@yoopta/editor";
  import type { Editor as SlateEditor } from "slate";

  const Link: YooptaPlugin;
  export default Link;
  export const LinkCommands: {
    deleteLink: (editor: YooEditor, options: { slate: SlateEditor }) => void;
    insertLink: (
      editor: YooEditor,
      options: {
        slate: SlateEditor;
        props: {
          url: string;
          title?: string;
          target?: string;
          rel?: string;
        };
      },
    ) => void;
  };
}

declare module "@yoopta/headings" {
  import type { YooptaPlugin } from "@yoopta/editor";

  export const HeadingOne: YooptaPlugin;
  export const HeadingTwo: YooptaPlugin;
  export const HeadingThree: YooptaPlugin;
}

declare module "@yoopta/lists" {
  import type { YooptaPlugin } from "@yoopta/editor";

  export const NumberedList: YooptaPlugin;
  export const BulletedList: YooptaPlugin;
  export const TodoList: YooptaPlugin;
}

declare module "@yoopta/mention" {
  import type { YooEditor, YooptaPlugin } from "@yoopta/editor";

  const Mention: YooptaPlugin;
  export default Mention;
  export function withMentions(editor: YooEditor): YooEditor;
}

declare module "@yoopta/emoji" {
  import type { YooEditor, YooptaPlugin } from "@yoopta/editor";

  const Emoji: YooptaPlugin;
  export default Emoji;
  export function withEmoji(editor: YooEditor): YooEditor;
}

declare module "@yoopta/paragraph" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/blockquote" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/callout" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/code" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugins: {
    Code: YooptaPlugin;
    CodeGroup: YooptaPlugin;
  };
  export const Code: YooptaPlugin;
  export const CodeGroup: YooptaPlugin;
  export default plugins;
}

declare module "@yoopta/divider" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/table" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/image" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/embed" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/video" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/file" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/accordion" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/steps" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/tabs" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/carousel" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/table-of-contents" {
  import type { YooptaPlugin } from "@yoopta/editor";
  const plugin: YooptaPlugin;
  export default plugin;
}
