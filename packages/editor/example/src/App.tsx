import "@viben/editor/yoopta/editor.css";

import MonacoEditor from "@monaco-editor/react";
import {
  BlockDndContext,
  EmojiDropdown,
  MentionDropdown,
  SelectionBox,
  SortableBlock,
  YooptaEditor,
  createCjkSlashInputHandler,
  createYooptaEditor,
  createYooptaKeyDownHandler,
  createYooptaPlugins,
  deserializeMarkdown,
  ensureBlockFocus,
  focusOrCreateParagraph,
  serializeMarkdown,
  type RenderBlockProps,
  type YooptaContentValue,
  type YooptaPlugin,
  YOOPTA_MARKS,
  YooptaFloatingBlockActions,
  YooptaSlashCommandMenu,
  YooptaToolbar,
  applyTheme,
  withEmoji,
  withMentions,
} from "@viben/editor";
import { Check, FileText, RefreshCw, SplitSquareVertical } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";

import { SAMPLE_MARKDOWN } from "./sample-markdown";

const EDITOR_STYLE = {
  width: "100%",
  minHeight: "100%",
};

type SyncSource = "markdown" | "editor";

function App() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const [frontmatter, setFrontmatter] = useState("");
  const [syncSource, setSyncSource] = useState<SyncSource>("markdown");
  const [blockCount, setBlockCount] = useState(0);
  const editorShellRef = useRef<HTMLDivElement>(null);
  const selectionBoxRef = useRef<HTMLDivElement>(null);
  const lastMarkdownRef = useRef(SAMPLE_MARKDOWN);
  const syncingFromMarkdownRef = useRef(false);
  const editorSerializeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markdownDeserializeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const plugins = useMemo(() => createYooptaPlugins(), []);
  const editor = useMemo(
    () =>
      withEmoji(
        withMentions(
          createYooptaEditor({
            plugins: applyTheme(plugins) as unknown as YooptaPlugin[],
            marks: YOOPTA_MARKS,
          }),
        ),
      ),
    [plugins],
  );

  const deserializeIntoEditor = useCallback(
    (nextMarkdown: string) => {
      try {
        const { value, frontmatter: nextFrontmatter } = deserializeMarkdown(editor, nextMarkdown);
        syncingFromMarkdownRef.current = true;
        editor.withoutSavingHistory(() => {
          editor.setEditorValue(value);
        });
        setFrontmatter(nextFrontmatter);
        setBlockCount(Object.keys(value).length);
        lastMarkdownRef.current = nextMarkdown;

        requestAnimationFrame(() => {
          editorShellRef.current?.classList.add("is-syncing-from-markdown");
          window.setTimeout(() => {
            editorShellRef.current?.classList.remove("is-syncing-from-markdown");
          }, 260);
          syncingFromMarkdownRef.current = false;
        });
      } catch (error) {
        console.error("[editor-example] markdown deserialize failed", error);
        syncingFromMarkdownRef.current = false;
      }
    },
    [editor],
  );

  useEffect(() => {
    deserializeIntoEditor(markdown);
  }, [deserializeIntoEditor]);

  const scheduleMarkdownToEditor = useCallback(
    (nextMarkdown: string) => {
      if (markdownDeserializeTimerRef.current) clearTimeout(markdownDeserializeTimerRef.current);
      markdownDeserializeTimerRef.current = setTimeout(() => {
        deserializeIntoEditor(nextMarkdown);
      }, 90);
    },
    [deserializeIntoEditor],
  );

  const handleMarkdownChange = useCallback(
    (value?: string) => {
      const nextMarkdown = value ?? "";
      setMarkdown(nextMarkdown);
      setSyncSource("markdown");
      scheduleMarkdownToEditor(nextMarkdown);
    },
    [scheduleMarkdownToEditor],
  );

  const handleEditorChange = useCallback(
    (value: YooptaContentValue) => {
      if (syncingFromMarkdownRef.current) return;
      setBlockCount(Object.keys(value).length);
      if (editorSerializeTimerRef.current) clearTimeout(editorSerializeTimerRef.current);
      editorSerializeTimerRef.current = setTimeout(() => {
        try {
          const nextMarkdown = serializeMarkdown(editor, value, frontmatter);
          if (nextMarkdown === lastMarkdownRef.current) return;
          lastMarkdownRef.current = nextMarkdown;
          setSyncSource("editor");
          startTransition(() => setMarkdown(nextMarkdown));
        } catch (error) {
          console.error("[editor-example] markdown serialize failed", error);
        }
      }, 120);
    },
    [editor, frontmatter],
  );

  useEffect(() => {
    const handleKeyDown = createYooptaKeyDownHandler(editor);
    const handleInput = createCjkSlashInputHandler(editor);
    const handleCompositionEnd = (event: Event) => {
      window.setTimeout(() => handleInput(event), 10);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("compositionend", handleCompositionEnd, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("compositionend", handleCompositionEnd, true);
    };
  }, [editor]);

  useEffect(() => {
    return () => {
      if (editorSerializeTimerRef.current) clearTimeout(editorSerializeTimerRef.current);
      if (markdownDeserializeTimerRef.current) clearTimeout(markdownDeserializeTimerRef.current);
    };
  }, []);

  const handleEditorSurfacePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[contenteditable='true'], button, a, input, textarea, select, [role='button'], [data-radix-popper-content-wrapper]")) {
        return;
      }

      event.preventDefault();
      focusOrCreateParagraph(editor);
    },
    [editor],
  );

  const renderBlock = useCallback(
    ({ children, blockId }: RenderBlockProps) => (
      <SortableBlock id={blockId} useDragHandle>
        <div
          className="demo-block-focus"
          onFocusCapture={() => {
            const blockElement = editor.refElement?.querySelector(
              `[data-yoopta-block-id="${CSS.escape(blockId)}"]`,
            );
            blockElement?.classList.remove("demo-block-focus-pulse");
            requestAnimationFrame(() => blockElement?.classList.add("demo-block-focus-pulse"));
          }}
        >
          {children}
        </div>
      </SortableBlock>
    ),
    [editor],
  );

  const resetSample = useCallback(() => {
    handleMarkdownChange(SAMPLE_MARKDOWN);
  }, [handleMarkdownChange]);

  const clearMarkdown = useCallback(() => {
    handleMarkdownChange("");
  }, [handleMarkdownChange]);

  const focusEditor = useCallback(() => {
    const firstBlockId = Object.keys(editor.children)
      .sort((a, b) => (editor.children[a]?.meta.order ?? 0) - (editor.children[b]?.meta.order ?? 0))[0];
    if (firstBlockId) ensureBlockFocus(editor, firstBlockId);
    else focusOrCreateParagraph(editor);
  }, [editor]);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <SplitSquareVertical size={18} />
          <span>Editor Markdown Sync Demo</span>
        </div>
        <div className="status-row">
          <span className="status-pill">
            <Check size={14} />
            {syncSource === "markdown" ? "markdown_to_editor" : "editor_to_markdown"}
          </span>
          <span className="status-pill">
            <FileText size={14} />
            {blockCount} blocks
          </span>
          <button type="button" onClick={resetSample}>
            <RefreshCw size={15} />
            Reset
          </button>
          <button type="button" onClick={clearMarkdown}>Clear</button>
          <button type="button" onClick={focusEditor}>Focus editor</button>
        </div>
      </header>

      <section className="workspace">
        <div className="pane markdown-pane">
          <div className="pane-title">Markdown</div>
          <MonacoEditor
            height="100%"
            language="markdown"
            theme="vs-dark"
            value={markdown}
            options={{
              minimap: { enabled: false },
              wordWrap: "on",
              lineNumbers: "on",
              fontSize: 14,
              fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', monospace",
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              smoothScrolling: true,
              automaticLayout: true,
            }}
            onChange={handleMarkdownChange}
          />
        </div>

        <div className="pane editor-pane" onPointerDown={handleEditorSurfacePointerDown}>
          <div className="pane-title">Yoopta Blocks</div>
          <div className="editor-scroll">
            <div ref={editorShellRef} className="yoopta-notion-editor demo-editor-shell">
              <div ref={selectionBoxRef} className="demo-selection-scope">
                <BlockDndContext editor={editor}>
                  <YooptaEditor
                    editor={editor}
                    style={EDITOR_STYLE}
                    renderBlock={renderBlock}
                    placeholder="Type '/' for commands"
                    onChange={handleEditorChange}
                  >
                    <YooptaToolbar />
                    <YooptaFloatingBlockActions />
                    <YooptaSlashCommandMenu />
                    <SelectionBox selectionBoxElement={selectionBoxRef} />
                    <MentionDropdown />
                    <EmojiDropdown />
                  </YooptaEditor>
                </BlockDndContext>
              </div>
              {markdown.trim().length === 0 && (
                <button type="button" className="empty-page-button" onClick={() => focusOrCreateParagraph(editor)}>
                  Blank page
                </button>
              )}
              <div className="editor-click-catcher" onClick={() => focusOrCreateParagraph(editor)} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
