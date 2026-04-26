/**
 * TiptapMarkdownRenderer
 *
 * A Notion-like tiptap markdown editor with:
 * - BubbleMenu (floating toolbar on text selection)
 * - Slash commands (/) for inserting blocks
 * - TaskList/TaskItem (todo checkboxes)
 * - Details/collapsible blocks
 * - Debounced auto-save to SKILL.md via gateway API
 */

import "./tiptap-editor.css";
import { useCallback, useRef, useEffect, useState } from "react";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Details, DetailsSummary, DetailsContent } from "@tiptap/extension-details";
import { Mathematics } from "@tiptap/extension-mathematics";
import "katex/dist/katex.min.css";
import { CodeBlockWithLanguage, lowlight } from "./tiptap-code-block";
import { Youtube } from "@tiptap/extension-youtube";
import Audio from "@tiptap/extension-audio";
import { CharacterCount } from "@tiptap/extension-character-count";
import { Mention } from "@tiptap/extension-mention";
import { cn } from "@/lib/utils";
import { getGatewayUrl } from "@/lib/gateway/config";
import { updatePageContent } from "@/lib/gateway/modules/pages";
import { EditorBubbleMenu } from "./tiptap-bubble-menu";
import { EditorSlashMenu } from "./tiptap-slash-menu";
import { Callout } from "./tiptap-callout";

const SAVE_DEBOUNCE_MS = 1000;

const NotionKeyboardShortcuts = Extension.create({
  name: "notionKeyboardShortcuts",

  addKeyboardShortcuts() {
    return {
      // Empty heading + Enter → convert to paragraph
      Enter: () => {
        const { state } = this.editor;
        const { $from } = state.selection;
        const node = $from.parent;

        if (node.type.name === "heading" && node.content.size === 0) {
          return this.editor.chain().focus().setParagraph().run();
        }
        return false;
      },
      // Block type switching (Cmd+Shift+number)
      "Mod-Shift-0": () => this.editor.chain().focus().setParagraph().run(),
      "Mod-Shift-1": () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
      "Mod-Shift-2": () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
      "Mod-Shift-3": () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
      "Mod-Shift-4": () => this.editor.chain().focus().toggleTaskList().run(),
      "Mod-Shift-5": () => this.editor.chain().focus().toggleBulletList().run(),
      "Mod-Shift-6": () => this.editor.chain().focus().toggleOrderedList().run(),
      "Mod-Shift-7": () => this.editor.chain().focus().insertContent({
        type: "callout",
        attrs: { type: "default", emoji: "\uD83D\uDCA1" },
        content: [{ type: "paragraph" }],
      }).run(),
      "Mod-Shift-8": () => this.editor.chain().focus().toggleCodeBlock().run(),
      "Mod-Shift-9": () => this.editor.chain().focus().toggleBlockquote().run(),
      // Duplicate block
      "Mod-d": () => {
        const { state } = this.editor;
        const { $from } = state.selection;
        // Get the top-level node at cursor
        const pos = $from.before(1);
        const node = state.doc.nodeAt(pos);
        if (node) {
          const endPos = pos + node.nodeSize;
          this.editor.chain().focus().insertContentAt(endPos, node.toJSON()).run();
          return true;
        }
        return false;
      },
      // Prevent Tab from leaving editor - use for list indentation
      Tab: () => {
        if (this.editor.can().sinkListItem("listItem")) {
          return this.editor.chain().focus().sinkListItem("listItem").run();
        }
        if (this.editor.can().sinkListItem("taskItem")) {
          return this.editor.chain().focus().sinkListItem("taskItem").run();
        }
        return false;
      },
      "Shift-Tab": () => {
        if (this.editor.can().liftListItem("listItem")) {
          return this.editor.chain().focus().liftListItem("listItem").run();
        }
        if (this.editor.can().liftListItem("taskItem")) {
          return this.editor.chain().focus().liftListItem("taskItem").run();
        }
        return false;
      },
    };
  },
});

const PasteLinkOnSelection = Extension.create({
  name: "pasteLinkOnSelection",

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("pasteLinkOnSelection"),
        props: {
          handlePaste(view, event) {
            const { state } = view;
            const { selection } = state;
            if (selection.empty) return false;

            const clipboardText = event.clipboardData?.getData("text/plain")?.trim();
            if (!clipboardText) return false;

            // Check if pasted text is a URL
            try {
              new URL(clipboardText);
            } catch {
              return false;
            }

            // It's a URL and we have selected text - create a link
            editor.chain().focus().setLink({ href: clipboardText }).run();
            return true;
          },
        },
      }),
    ];
  },
});

export interface TiptapMarkdownRendererProps {
  content: string;
  className?: string;
  /** Workspace path for saving */
  workspacePath?: string;
  /** Page slug for saving */
  slug?: string;
  /** Whether editing is enabled (default: true when workspacePath and slug are provided) */
  editable?: boolean;
}

export function TiptapMarkdownRenderer({
  content,
  className,
  workspacePath,
  slug,
  editable,
}: TiptapMarkdownRendererProps) {
  const canSave = !!(workspacePath && slug);
  const isEditable = editable ?? canSave;

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  const handleSave = useCallback(
    async (markdown: string) => {
      if (!canSave || isSavingRef.current) return;
      isSavingRef.current = true;
      try {
        const baseUrl = getGatewayUrl();
        await updatePageContent(baseUrl, workspacePath, slug, markdown);
      } catch (err) {
        console.error("[TiptapMarkdownRenderer] save failed:", err);
      } finally {
        isSavingRef.current = false;
      }
    },
    [canSave, workspacePath, slug],
  );

  const debouncedSave = useCallback(
    (markdown: string) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        handleSave(markdown);
      }, SAVE_DEBOUNCE_MS);
    },
    [handleSave],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          codeBlock: false, // replaced by CodeBlockLowlight
          link: {
            openOnClick: !isEditable,
          },
        }),
        Markdown,
        CodeBlockWithLanguage.configure({ lowlight }),
        Image,
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        Highlight.configure({ multicolor: true }),
        Placeholder.configure({
          includeChildren: true,
          placeholder: ({ node }) => {
            if (node.type.name === "heading") {
              return `Heading ${node.attrs.level}`;
            }
            if (node.type.name === "detailsSummary") {
              return "Toggle heading";
            }
            if (node.type.name === "listItem" || node.type.name === "taskItem") {
              return "List";
            }
            if (node.type.name === "blockquote") {
              return "Empty quote";
            }
            return 'Type "/" for commands...';
          },
        }),
        Typography,
        Color,
        TextStyle,
        Subscript,
        Superscript,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Details,
        DetailsSummary,
        DetailsContent,
        Mathematics.configure({
          katexOptions: { throwOnError: false },
        }),
        Youtube.configure({ inline: false, nocookie: true }),
        Audio,
        CharacterCount,
        Mention.configure({
          HTMLAttributes: { class: "mention" },
        }),
        Callout,
        NotionKeyboardShortcuts,
        PasteLinkOnSelection,
      ],
      content: content || "",
      contentType: "markdown",
      editable: isEditable,
      immediatelyRender: false,
      onUpdate: ({ editor: ed }) => {
        if (!canSave) return;
        const markdown = ed.getMarkdown();
        debouncedSave(markdown);
      },
    },
    [content],
  );

  return (
    <div
      className={cn(
        "tiptap-notion-editor",
        "max-w-none",
        className,
      )}
    >
      {editor && isEditable && <EditorBubbleMenu editor={editor} />}
      {editor && isEditable && <EditorSlashMenu editor={editor} />}
      <EditorContent editor={editor} />
      {editor && <WordCountFooter editor={editor} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Word count footer
// ---------------------------------------------------------------------------

function WordCountFooter({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  // Force re-render on editor update
  const [, setUpdateCount] = useState(0);

  useEffect(() => {
    const handler = () => setUpdateCount((c) => c + 1);
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor]);

  const characters = editor.storage.characterCount?.characters() ?? 0;
  const words = editor.storage.characterCount?.words() ?? 0;

  return (
    <div className="px-14 py-2 text-xs text-muted-foreground/60 select-none">
      {words} {words === 1 ? "word" : "words"} &middot; {characters}{" "}
      {characters === 1 ? "character" : "characters"}
    </div>
  );
}
