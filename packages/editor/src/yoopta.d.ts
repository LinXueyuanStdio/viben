declare module "@yoopta/editor" {
  import type { ReactElement, ReactNode } from "react";

  export type SlateElementTextNode = {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    code?: boolean;
    strike?: boolean;
    highlight?: unknown;
  };

  export type SlateElement<
    K extends string = string,
    T = Record<string, unknown>,
  > = {
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

  export type PluginSerializeParser = (
    element: SlateElement,
    content: string,
    blockMetaData?: YooptaBlockBaseMeta,
    editor?: YooEditor,
    blockData?: YooptaBlockData,
  ) => string;

  export type YooptaPluginShape = {
    type: string;
    elements: Record<string, unknown>;
    options?: Record<string, unknown>;
    parsers?: {
      markdown?: {
        serialize?: PluginSerializeParser;
      };
    };
  };

  export class YooptaPlugin<
    TElementMap extends Record<string, SlateElement> = Record<
      string,
      SlateElement
    >,
    TOptions = Record<string, unknown>,
  > {
    get getPlugin(): YooptaPluginShape;
    extend(options: unknown): YooptaPlugin<TElementMap, TOptions>;
  }

  export type CreateYooptaEditorOptions = {
    id?: string;
    plugins: readonly YooptaPlugin[];
    marks?: unknown[];
    value?: YooptaContentValue;
    readOnly?: boolean;
  };

  export type YooEditor = {
    id: string;
    readOnly: boolean;
    children: YooptaContentValue;
    plugins: Record<string, YooptaPluginShape>;
    getEditorValue: () => YooptaContentValue;
    setEditorValue: (value: YooptaContentValue) => void;
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
    onChange?: (
      value: YooptaContentValue,
      options: YooptaOnChangeOptions,
    ) => void;
    children?: ReactNode;
    placeholder?: string;
    renderBlock?: (props: RenderBlockProps) => ReactNode;
  };

  const YooptaEditor: (props: YooptaEditorProps) => ReactElement | null;
  export default YooptaEditor;

  export function createYooptaEditor(
    options: CreateYooptaEditorOptions,
  ): YooEditor;
}

declare module "@yoopta/exports" {
  import type { YooEditor, YooptaContentValue } from "@yoopta/editor";

  export const markdown: {
    deserialize: (editor: YooEditor, value: string) => YooptaContentValue;
    serialize: (editor: YooEditor, value: YooptaContentValue) => string;
  };
}

declare module "@yoopta/marks" {
  export const Bold: unknown;
  export const Italic: unknown;
  export const Underline: unknown;
  export const Strike: unknown;
  export const CodeMark: unknown;
  export const Highlight: unknown;
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

declare module "@yoopta/math" {
  import type { YooptaPlugin } from "@yoopta/editor";

  export const MathInline: YooptaPlugin;
  export const MathBlock: YooptaPlugin;
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

declare module "@yoopta/link" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/table" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/accordion" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/divider" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/embed" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/image" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/video" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/emoji" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/file" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/tabs" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/steps" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/carousel" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/mention" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}

declare module "@yoopta/table-of-contents" {
  import type { YooptaPlugin } from "@yoopta/editor";

  const plugin: YooptaPlugin;
  export default plugin;
}
