import "./yoopta-editor.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YooptaEditor, {
  Blocks,
  Marks,
  createYooptaEditor,
  RenderBlockProps,
  SlateElement,
  YooptaContentValue,
  YooptaPlugin,
} from "@yoopta/editor";
import { deserializeMarkdown, serializeMarkdown } from "./yoopta-markdown";
import { withMentions } from "@yoopta/mention";
import { withEmoji } from "@yoopta/emoji";
import { applyTheme } from "@yoopta/themes-shadcn";
import { SelectionBox } from "@yoopta/ui/selection-box";
// @ts-ignore - subpath exports not resolved by moduleResolution
import { MentionDropdown } from '@yoopta/themes-shadcn/mention';
// @ts-ignore - subpath exports not resolved by moduleResolution
import { EmojiDropdown } from '@yoopta/themes-shadcn/emoji';
import { BlockDndContext, SortableBlock } from "@yoopta/ui/block-dnd";
import { Transforms } from "slate";
import { SmilePlus, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGatewayUrl } from "@/lib/gateway/config";
import { updatePageContent, uploadPageAsset, listPages } from "@/lib/gateway/modules/pages";
import { createYooptaPlugins } from "./yoopta-plugins";
import { YOOPTA_MARKS } from "./yoopta-marks";
import { YooptaToolbar } from "./yoopta-toolbar";
import { YooptaSlashCommandMenu } from "./yoopta-slash-menu";
import { YooptaFloatingBlockActions } from "./yoopta-block-actions";
import { YooptaEditorHeader } from "./yoopta-editor-header";
import { YooptaErrorBoundary } from "./yoopta-error-boundary";

const SAVE_DEBOUNCE_MS = 1000;

const EDITOR_STYLES = {
  width: "100%",
  paddingBottom: 100,
};

export interface YooptaMarkdownRendererProps {
  content: string;
  className?: string;
  workspacePath?: string;
  slug?: string;
  editable?: boolean;
  title?: string;
  onTitleChange?: (newTitle: string) => void;
}

export function YooptaMarkdownRenderer({
  content,
  className,
  workspacePath,
  slug,
  editable,
  title,
  onTitleChange,
}: YooptaMarkdownRendererProps) {
  const canSave = !!(workspacePath && slug);
  const isEditable = editable ?? canSave;

  const containerBoxRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const [wordCount, setWordCount] = useState({ words: 0, characters: 0 });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const lastContentRef = useRef<string>(content);
  const frontmatterRef = useRef<string>("");
  const [pageTitle, setPageTitle] = useState(title || "");
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [pageIcon, setPageIcon] = useState<string>("");
  const [showEmojiInput, setShowEmojiInput] = useState(false);
  const emojiInputRef = useRef<HTMLInputElement>(null);

  // Sync title from props
  useEffect(() => {
    setPageTitle(title || "");
  }, [title]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newTitle = e.target.value.replace(/\n/g, "");
      setPageTitle(newTitle);
      onTitleChange?.(newTitle);
    },
    [onTitleChange]
  );

  const handleEmojiInputConfirm = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      setPageIcon(trimmed);
      setShowEmojiInput(false);
    },
    []
  );

  const handleAddIconClick = useCallback(() => {
    setShowEmojiInput(true);
    // Focus the input after it renders
    setTimeout(() => emojiInputRef.current?.focus(), 0);
  }, []);

  const handleAddCoverClick = useCallback(() => {
    console.log("[YooptaMarkdownRenderer] Add cover clicked (placeholder)");
  }, []);

  const handleIconClick = useCallback(() => {
    setShowEmojiInput(true);
    setTimeout(() => emojiInputRef.current?.focus(), 0);
  }, []);

  const handleRemoveIcon = useCallback(() => {
    setPageIcon("");
    setShowEmojiInput(false);
  }, []);

  const plugins = useMemo(() => {
    if (!workspacePath || !slug) return createYooptaPlugins();
    const baseUrl = getGatewayUrl();
    const uploadFn = async (file: File) => {
      const result = await uploadPageAsset(baseUrl, workspacePath, slug, file);
      if (!result.success || !result.url) {
        throw new Error(result.error || "Upload failed");
      }
      return `${baseUrl}${result.url}`;
    };
    const searchPagesFn = async (query: string) => {
      const result = await listPages(baseUrl, workspacePath);
      const q = query.toLowerCase();
      return result.pages
        .filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
        .map((p) => ({ id: p.slug, name: p.name, avatar: '' }));
    };
    return createYooptaPlugins(uploadFn, searchPagesFn);
  }, [workspacePath, slug]);

  const editor = useMemo(() => {
    return withEmoji(
      withMentions(
        createYooptaEditor({
          plugins: applyTheme(plugins) as unknown as YooptaPlugin<
            Record<string, SlateElement>,
            unknown
          >[],
          marks: YOOPTA_MARKS,
          readOnly: !isEditable,
        })
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugins]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        try {
          editor.focus();
        } catch {
          // ignore
        }
      }
    },
    [editor]
  );

  // Sync readOnly state when isEditable changes
  useEffect(() => {
    if (editor.readOnly !== !isEditable) {
      editor.readOnly = !isEditable;
    }
  }, [editor, isEditable]);

  // Load initial markdown content
  useEffect(() => {
    if (content && content !== lastContentRef.current) {
      lastContentRef.current = content;
      try {
        const { value, frontmatter } = deserializeMarkdown(editor, content);
        frontmatterRef.current = frontmatter;
        editor.withoutSavingHistory(() => {
          editor.setEditorValue(value);
        });
      } catch (err) {
        console.error("[YooptaMarkdownRenderer] deserialize failed:", err);
      }
    }
  }, [editor, content]);

  // Auto-focus the editor on mount (Notion behavior)
  useEffect(() => {
    if (!isEditable) return;
    const timer = setTimeout(() => {
      try {
        editor.focus();
      } catch {
        // ignore focus errors during initialization
      }
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save handler
  const handleSave = useCallback(
    async (md: string) => {
      if (!canSave || isSavingRef.current) return;
      isSavingRef.current = true;
      setSaveStatus('saving');
      try {
        const baseUrl = getGatewayUrl();
        await updatePageContent(baseUrl, workspacePath!, slug!, md);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 2000);
      } catch (err) {
        console.error("[YooptaMarkdownRenderer] save failed:", err);
        setSaveStatus('error');
      } finally {
        isSavingRef.current = false;
      }
    },
    [canSave, workspacePath, slug]
  );

  const debouncedSave = useCallback(
    (md: string) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        handleSave(md);
      }, SAVE_DEBOUNCE_MS);
    },
    [handleSave]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Cmd+S / Ctrl+S manual save shortcut
  useEffect(() => {
    if (!canSave) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        // Flush any pending debounced save immediately
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        const md = serializeMarkdown(editor, editor.children, frontmatterRef.current);
        lastContentRef.current = md;
        handleSave(md);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canSave, editor, handleSave]);

  // Notion-style keyboard shortcuts for block type switching, block movement, and highlight
  useEffect(() => {
    if (!isEditable) return;

    const BLOCK_TYPE_MAP: Record<string, string> = {
      "0": "Paragraph",
      "1": "HeadingOne",
      "2": "HeadingTwo",
      "3": "HeadingThree",
      "4": "TodoList",
      "5": "BulletedList",
      "6": "NumberedList",
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+/ or Ctrl+/ - Open slash command menu
      if (isMod && !e.shiftKey && e.key === "/") {
        e.preventDefault();
        if (editor.path.current === null) return;
        const currentOrder = editor.path.current;
        const currentBlockId = Object.keys(editor.children).find(
          (id) => editor.children[id]?.meta.order === currentOrder
        );
        if (currentBlockId) {
          const slate = Blocks.getBlockSlate(editor, { id: currentBlockId });
          if (slate) {
            Transforms.insertText(slate, '/');
          }
        }
        return;
      }

      // Cmd+Enter or Ctrl+Enter - Toggle TodoList checkbox
      if (isMod && !e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        if (editor.path.current === null) return;
        const currentOrder = editor.path.current;
        const currentBlockId = Object.keys(editor.children).find(
          (id) => editor.children[id]?.meta.order === currentOrder
        );
        if (!currentBlockId) return;
        const block = Blocks.getBlock(editor, { id: currentBlockId });
        if (!block || block.type !== "TodoList") return;
        const slate = Blocks.getBlockSlate(editor, { id: currentBlockId });
        if (!slate || !slate.children[0]) return;
        const element = slate.children[0] as any;
        if (element.props?.checked !== undefined) {
          Transforms.setNodes(slate, { props: { ...element.props, checked: !element.props.checked } } as any, { at: [0] });
        }
        return;
      }

      if (!isMod || !e.shiftKey) return;

      // Block type switching: Cmd+Shift+0..6
      const blockType = BLOCK_TYPE_MAP[e.key];
      if (blockType) {
        e.preventDefault();
        if (editor.path.current === null) return;
        Blocks.toggleBlock(editor, blockType, {
          at: editor.path.current,
          focus: true,
        });
        return;
      }

      // Highlight toggle: Cmd+Shift+H
      if (e.key === "H" || e.key === "h") {
        e.preventDefault();
        if (editor.path.current === null) return;
        Marks.toggle(editor, { type: "highlight" });
        return;
      }

      // Block movement: Cmd+Shift+ArrowUp / ArrowDown
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        if (editor.path.current === null) return;

        const currentOrder = editor.path.current;
        const currentBlockId = Object.keys(editor.children).find(
          (id) => editor.children[id]?.meta.order === currentOrder
        );
        if (!currentBlockId) return;

        if (e.key === "ArrowUp") {
          if (currentOrder <= 0) return;
          Blocks.moveBlock(editor, currentBlockId, currentOrder - 1);
        } else {
          const totalBlocks = Object.keys(editor.children).length;
          if (currentOrder >= totalBlocks - 1) return;
          Blocks.moveBlock(editor, currentBlockId, currentOrder + 2);
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isEditable, editor]);

  // onChange handler for auto-save and word count
  const handleChange = useCallback(
    (value: YooptaContentValue, _options: { operations: unknown[] }) => {
      // Update word count
      try {
        const text = Object.values(value)
          .map((block) => {
            if (!block?.value) return "";
            return block.value
              .map((el: any) => {
                if (!el?.children) return "";
                return el.children.map((child: any) => child.text || "").join("");
              })
              .join(" ");
          })
          .join(" ")
          .trim();
        const words = text ? text.split(/\s+/).length : 0;
        const characters = text.length;
        setWordCount({ words, characters });
      } catch {
        // ignore count errors
      }

      // Auto-save
      if (canSave) {
        try {
          setSaveStatus('pending');
          const md = serializeMarkdown(editor, value, frontmatterRef.current);
          lastContentRef.current = md;
          debouncedSave(md);
        } catch (err) {
          console.error("[YooptaMarkdownRenderer] serialize failed:", err);
        }
      }
    },
    [canSave, editor, debouncedSave]
  );

  const renderBlock = useCallback(
    ({ children, blockId }: RenderBlockProps) => {
      return (
        <SortableBlock id={blockId} useDragHandle>
          {children}
        </SortableBlock>
      );
    },
    []
  );

  return (
    <div
      ref={containerBoxRef}
      className={cn("yoopta-notion-editor w-full max-w-4xl mx-auto relative", className)}
    >
      <YooptaErrorBoundary>
        <YooptaEditorHeader editor={editor} title={pageTitle || title} />
        {isEditable && (
          <div className="yoopta-page-title-area px-14 pt-8 pb-2 relative">
            {/* Hover-revealed action row */}
            <div className="yoopta-page-title-actions flex items-center gap-1 pb-2">
              {!pageIcon && (
                <button
                  type="button"
                  onClick={handleAddIconClick}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted rounded transition-colors"
                >
                  <SmilePlus size={14} />
                  <span>Add icon</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleAddCoverClick}
                className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted rounded transition-colors"
              >
                <ImageIcon size={14} />
                <span>Add cover</span>
              </button>
            </div>

            {/* Emoji input popover */}
            {showEmojiInput && (
              <div className="yoopta-emoji-input mb-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={emojiInputRef}
                    type="text"
                    placeholder="Type emoji"
                    defaultValue={pageIcon}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleEmojiInputConfirm(e.currentTarget.value);
                      }
                      if (e.key === "Escape") {
                        setShowEmojiInput(false);
                      }
                    }}
                    onBlur={(e) => {
                      handleEmojiInputConfirm(e.currentTarget.value);
                    }}
                  />
                  {pageIcon && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleRemoveIcon}
                      className="text-xs text-muted-foreground/60 hover:text-destructive transition-colors whitespace-nowrap"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Page icon display */}
            {pageIcon && (
              <div
                className="yoopta-page-icon mb-2"
                style={{ fontSize: 60 }}
                onClick={handleIconClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleIconClick();
                  }
                }}
              >
                {pageIcon}
              </div>
            )}

            {/* Title textarea */}
            <textarea
              ref={titleRef}
              value={pageTitle}
              onChange={handleTitleChange}
              onKeyDown={handleTitleKeyDown}
              placeholder="Untitled"
              rows={1}
              className="w-full resize-none overflow-hidden bg-transparent text-4xl font-bold leading-tight text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
          </div>
        )}
        {!isEditable && (pageTitle || pageIcon) && (
          <div className="px-14 pt-8 pb-2">
            {pageIcon && (
              <div className="mb-2" style={{ fontSize: 60, lineHeight: 1 }}>
                {pageIcon}
              </div>
            )}
            {pageTitle && (
              <h1 className="text-4xl font-bold leading-tight text-foreground">{pageTitle}</h1>
            )}
          </div>
        )}
        <BlockDndContext editor={editor}>
          <YooptaEditor
            editor={editor}
            style={EDITOR_STYLES}
            renderBlock={renderBlock}
            placeholder="Type / to open menu, or start typing..."
            onChange={handleChange}
          >
            {isEditable && <YooptaToolbar />}
            {isEditable && <YooptaFloatingBlockActions />}
            {isEditable && <YooptaSlashCommandMenu />}
            {isEditable && <SelectionBox selectionBoxElement={containerBoxRef} />}
            {isEditable && <MentionDropdown />}
            {isEditable && <EmojiDropdown />}
          </YooptaEditor>
        </BlockDndContext>
        <div className="yoopta-editor-footer px-14 py-2 text-xs text-muted-foreground/60 select-none flex items-center justify-between">
          <span>
            {wordCount.words} {wordCount.words === 1 ? "word" : "words"} &middot;{" "}
            {wordCount.characters} {wordCount.characters === 1 ? "character" : "characters"}
          </span>
          {canSave && (
            <span aria-live="polite" className={saveStatus === 'error' ? 'text-destructive' : ''}>
              {saveStatus === 'pending' && 'Editing...'}
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'error' && 'Save failed'}
            </span>
          )}
        </div>
      </YooptaErrorBoundary>
    </div>
  );
}
