import "./yoopta-editor.css";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { SmilePlus, ImageIcon as ImageLucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGatewayUrl } from "@/lib/gateway/config";
import { updatePageContent, updatePageConfig, uploadPageAsset, listPages } from "@/lib/gateway/modules/pages";
import type { IconData, PageWidth } from "@/lib/gateway/types/page";
import { createYooptaPlugins } from "./yoopta-plugins";
import { YOOPTA_MARKS } from "./yoopta-marks";
import { YooptaToolbar } from "./yoopta-toolbar";
import { YooptaSlashCommandMenu } from "./yoopta-slash-menu";
import { YooptaFloatingBlockActions } from "./yoopta-block-actions";
import { YooptaEditorHeader } from "./yoopta-editor-header";
import { YooptaErrorBoundary } from "./yoopta-error-boundary";
import { IconPicker, IconDisplay } from "@/components/ui/icon-picker";
import { YooptaTocSidebar } from "./yoopta-toc-sidebar";

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
  icon?: IconData | null;
  cover?: string | null;
  pageWidth?: PageWidth;
  showToc?: boolean;
  onTitleChange?: (newTitle: string) => void;
  /** Portal target for editor header buttons. If provided, header renders into this DOM element instead of inside the editor. */
  headerPortal?: HTMLElement | null;
}

export function YooptaMarkdownRenderer({
  content,
  className,
  workspacePath,
  slug,
  editable,
  title,
  icon,
  cover,
  pageWidth,
  showToc,
  onTitleChange,
  headerPortal,
}: YooptaMarkdownRendererProps) {
  const canSave = !!(workspacePath && slug);
  const isEditable = editable ?? canSave;
  console.log("[DEBUG:Renderer] props:", { editable, canSave, isEditable, workspacePath, slug, icon, cover, pageWidth, showToc });

  const containerBoxRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const [wordCount, setWordCount] = useState({ words: 0, characters: 0 });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  // Initialize to empty so the first useEffect always triggers deserialization
  const lastContentRef = useRef<string>("");
  const frontmatterRef = useRef<string>("");
  const [pageTitle, setPageTitle] = useState(title || "");
  const [pageIcon, setPageIcon] = useState<IconData | null>(icon ?? null);
  const iconSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPageWidth, setCurrentPageWidth] = useState<PageWidth>(pageWidth || "default");
  const [currentShowToc, setCurrentShowToc] = useState(showToc ?? false);
  const configSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync title from props
  useEffect(() => {
    setPageTitle(title || "");
  }, [title]);

  // Sync icon from props
  useEffect(() => {
    setPageIcon(icon ?? null);
  }, [icon]);

  // Sync page width/toc from props
  useEffect(() => {
    setCurrentPageWidth(pageWidth || "default");
  }, [pageWidth]);
  useEffect(() => {
    setCurrentShowToc(showToc ?? false);
  }, [showToc]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newTitle = e.target.value.replace(/\n/g, "");
      setPageTitle(newTitle);
      onTitleChange?.(newTitle);
    },
    [onTitleChange]
  );

  const persistIcon = useCallback(
    (iconData: IconData | null) => {
      console.log("[DEBUG:AddIcon] persistIcon called, icon:", iconData, "canSave:", canSave);
      if (!canSave) return;
      if (iconSaveTimerRef.current) clearTimeout(iconSaveTimerRef.current);
      iconSaveTimerRef.current = setTimeout(async () => {
        try {
          const baseUrl = getGatewayUrl();
          await updatePageConfig(baseUrl, {
            workspace_path: workspacePath!,
            slug: slug!,
            icon: iconData,
          });
        } catch (err) {
          console.error("[YooptaMarkdownRenderer] icon save failed:", err);
        }
      }, 500);
    },
    [canSave, workspacePath, slug]
  );

  const persistLayoutConfig = useCallback(
    (updates: { page_width?: PageWidth | null; show_toc?: boolean | null }) => {
      if (!canSave) return;
      if (configSaveTimerRef.current) clearTimeout(configSaveTimerRef.current);
      configSaveTimerRef.current = setTimeout(async () => {
        try {
          const baseUrl = getGatewayUrl();
          await updatePageConfig(baseUrl, {
            workspace_path: workspacePath!,
            slug: slug!,
            ...updates,
          });
        } catch (err) {
          console.error("[YooptaMarkdownRenderer] layout config save failed:", err);
        }
      }, 300);
    },
    [canSave, workspacePath, slug]
  );

  const handlePageWidthChange = useCallback(
    (width: PageWidth) => {
      setCurrentPageWidth(width);
      persistLayoutConfig({ page_width: width });
    },
    [persistLayoutConfig]
  );

  const handleShowTocChange = useCallback(
    (show: boolean) => {
      setCurrentShowToc(show);
      persistLayoutConfig({ show_toc: show });
    },
    [persistLayoutConfig]
  );

  const [coverUrl, setCoverUrl] = useState<string | null>(cover || null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync cover from props
  useEffect(() => {
    setCoverUrl(cover || null);
  }, [cover]);

  const handleAddCoverClick = useCallback(() => {
    console.log("[DEBUG:AddCover] clicked, coverInputRef.current:", coverInputRef.current);
    coverInputRef.current?.click();
  }, []);

  const persistCover = useCallback(
    (url: string | null) => {
      if (!canSave) return;
      if (coverSaveTimerRef.current) clearTimeout(coverSaveTimerRef.current);
      coverSaveTimerRef.current = setTimeout(async () => {
        try {
          const baseUrl = getGatewayUrl();
          await updatePageConfig(baseUrl, {
            workspace_path: workspacePath!,
            slug: slug!,
            cover: url,
          });
        } catch (err) {
          console.error("[YooptaMarkdownRenderer] cover save failed:", err);
        }
      }, 500);
    },
    [canSave, workspacePath, slug]
  );

  const handleCoverFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      console.log("[DEBUG:AddCover] file input changed, file:", file?.name, file?.size);
      if (!file) return;
      e.target.value = "";

      if (!canSave) {
        setCoverUrl(URL.createObjectURL(file));
        return;
      }

      try {
        const baseUrl = getGatewayUrl();
        const result = await uploadPageAsset(baseUrl, workspacePath!, slug!, file);
        if (result.success && result.url) {
          const fullUrl = `${baseUrl}${result.url}`;
          setCoverUrl(fullUrl);
          persistCover(fullUrl);
        }
      } catch (err) {
        console.error("[YooptaMarkdownRenderer] cover upload failed:", err);
      }
    },
    [canSave, workspacePath, slug, persistCover]
  );

  const handleRemoveCover = useCallback(() => {
    setCoverUrl(null);
    persistCover(null);
  }, [persistCover]);

  const handleIconChange = useCallback(
    (iconData: IconData | null) => {
      console.log("[DEBUG:AddIcon] handleIconChange:", iconData);
      setPageIcon(iconData);
      persistIcon(iconData);
    },
    [persistIcon]
  );

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

  // Auto-save handler — uses dirty flag to avoid losing edits during a save
  const pendingContentRef = useRef<string | null>(null);

  const handleSave = useCallback(
    async (md: string) => {
      if (!canSave) return;
      if (isSavingRef.current) {
        // A save is in flight — stash the latest content so it's saved when the current save finishes
        pendingContentRef.current = md;
        setSaveStatus('pending');
        return;
      }
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
        // Flush any content that arrived while we were saving
        const pending = pendingContentRef.current;
        if (pending !== null) {
          pendingContentRef.current = null;
          handleSave(pending);
        }
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (iconSaveTimerRef.current) clearTimeout(iconSaveTimerRef.current);
      if (coverSaveTimerRef.current) clearTimeout(coverSaveTimerRef.current);
      if (configSaveTimerRef.current) clearTimeout(configSaveTimerRef.current);
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

  // Handle Chinese full-width slash ／ (U+FF0F) to trigger slash command menu.
  // IME input bypasses keydown (isComposing=true), so we intercept at input/compositionend level.
  useEffect(() => {
    if (!isEditable) return;
    const refEl = editor.refElement;
    if (!refEl) return;

    const tryConvertFullWidthSlash = () => {
      if (editor.path.current === null) return;
      const currentBlockId = Object.keys(editor.children).find(
        (id) => editor.children[id]?.meta.order === editor.path.current
      );
      if (!currentBlockId) return;
      const slate = Blocks.getBlockSlate(editor, { id: currentBlockId });
      if (!slate?.selection) return;

      const blockText = slate.children
        .map((node: any) => node.children?.map((c: any) => c.text || "").join("") || "")
        .join("");

      const trimmed = blockText.trim();
      if (trimmed === "／" || trimmed === "\uFF0F") {
        // Delete the full-width slash and dispatch a real "/" keydown
        Transforms.delete(slate, {
          at: { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: blockText.length } },
        });
        setTimeout(() => {
          const target =
            document.activeElement?.closest("[contenteditable]") ??
            refEl.querySelector("[contenteditable]");
          if (target) {
            target.dispatchEvent(new KeyboardEvent("keydown", {
              key: "/", code: "Slash", keyCode: 191, which: 191,
              bubbles: true, cancelable: true, composed: true,
            }));
          }
        }, 0);
      }
    };

    const handleInput = (e: Event) => {
      const data = (e as InputEvent).data;
      if (data === "／" || data === "\uFF0F") {
        tryConvertFullWidthSlash();
      }
    };

    // compositionend fires after IME commits text — backup for IME variants
    // that don't produce a separate input event with data="／"
    const handleCompositionEnd = (e: CompositionEvent) => {
      if (e.data === "／" || e.data === "\uFF0F") {
        // Delay slightly to let Slate process the committed text first
        setTimeout(tryConvertFullWidthSlash, 10);
      }
    };

    refEl.addEventListener("input", handleInput, true);
    refEl.addEventListener("compositionend", handleCompositionEnd, true);
    return () => {
      refEl.removeEventListener("input", handleInput, true);
      refEl.removeEventListener("compositionend", handleCompositionEnd, true);
    };
  }, [isEditable, editor]);

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
      // Escape - blur editor (Notion behavior)
      if (e.key === "Escape") {
        try {
          (document.activeElement as HTMLElement)?.blur();
        } catch {
          // ignore
        }
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+/ or Ctrl+/ - Open slash command menu
      if (isMod && !e.shiftKey && e.key === "/") {
        e.preventDefault();
        if (editor.path.current === null) return;
        // Dispatch a synthetic "/" keydown on the editor's contenteditable
        // SlashCommandMenu listens for native DOM keydown, not Slate transforms
        const target =
          document.activeElement?.closest("[contenteditable]") ??
          editor.refElement?.querySelector("[contenteditable]");
        if (target) {
          const syntheticEvent = new KeyboardEvent("keydown", {
            key: "/",
            code: "Slash",
            keyCode: 191,
            which: 191,
            bubbles: true,
            cancelable: true,
            composed: true,
          });
          target.dispatchEvent(syntheticEvent);
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

      // Cmd+D or Ctrl+D - Duplicate current block
      if (isMod && !e.shiftKey && e.code === "KeyD") {
        e.preventDefault();
        if (editor.path.current === null) return;
        editor.duplicateBlock({ focus: true });
        return;
      }

      // Cmd+Backspace or Ctrl+Backspace - Delete current block
      if (isMod && !e.shiftKey && e.key === "Backspace") {
        // Don't delete the only remaining block
        if (Object.keys(editor.children).length <= 1) return;
        if (editor.path.current === null) return;
        e.preventDefault();
        editor.deleteBlock({ focusTarget: "previous" });
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

      // Highlight toggle: Cmd+Shift+H (use e.code for keyboard layout independence)
      if (e.code === "KeyH") {
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
      className={cn(
        "yoopta-notion-editor w-full mx-auto relative",
        currentPageWidth === "full" ? "max-w-full" : currentPageWidth === "wide" ? "max-w-6xl" : "max-w-4xl",
        className
      )}
    >
      <YooptaErrorBoundary>
        {/* Editor header: portal to breadcrumb bar if available, otherwise render in-place */}
        {(() => {
          const headerEl = (
            <YooptaEditorHeader
              editor={editor}
              title={pageTitle || title}
              pageWidth={currentPageWidth}
              showToc={currentShowToc}
              saveStatus={canSave ? saveStatus : undefined}
              onPageWidthChange={canSave ? handlePageWidthChange : undefined}
              onShowTocChange={canSave ? handleShowTocChange : undefined}
            />
          );
          return headerPortal ? createPortal(headerEl, headerPortal) : headerEl;
        })()}
        {/* Hidden file input for cover image */}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="absolute opacity-0 w-0 h-0 overflow-hidden"
          onChange={handleCoverFileChange}
          tabIndex={-1}
        />
        {/* Cover image banner */}
        {coverUrl && (
          <div className="yoopta-cover-area group relative w-full" style={{ height: 280 }}>
            <img
              src={coverUrl}
              alt="Page cover"
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={handleAddCoverClick}
                className="rounded bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur-sm hover:bg-background/90 transition-colors"
              >
                Change cover
              </button>
              {isEditable && (
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  className="rounded bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur-sm hover:bg-background/90 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
        {isEditable && (
          <PageTitleArea
            pageIcon={pageIcon}
            pageTitle={pageTitle}
            coverUrl={coverUrl}
            workspacePath={workspacePath}
            onIconChange={handleIconChange}
            onAddCoverClick={handleAddCoverClick}
            onTitleChange={handleTitleChange}
            onTitleKeyDown={handleTitleKeyDown}
          />
        )}
        {!isEditable && (pageTitle || pageIcon) && (
          <div className="px-14 pt-8 pb-2">
            {pageIcon && (
              <div className="yoopta-page-icon mb-2">
                <IconDisplay icon={pageIcon} size={60} workspacePath={workspacePath} />
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
            {currentShowToc && (
              <YooptaTocSidebar className="yoopta-toc-panel" />
            )}
          </YooptaEditor>
        </BlockDndContext>
        <div className="yoopta-editor-footer px-14 py-2 text-xs text-muted-foreground/60 select-none">
          <span>
            {wordCount.words} {wordCount.words === 1 ? "word" : "words"} &middot;{" "}
            {wordCount.characters} {wordCount.characters === 1 ? "character" : "characters"}
          </span>
        </div>
      </YooptaErrorBoundary>
    </div>
  );
}
