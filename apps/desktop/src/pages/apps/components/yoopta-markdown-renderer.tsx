import "./yoopta-editor.css";
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { pageKeys } from "@/hooks/use-pages";
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
import { CoverPicker } from "@/components/ui/cover-picker";
import { GRADIENT_COLORS } from "@/lib/gradient-colors";
import { YooptaTocSidebar } from "./yoopta-toc-sidebar";
import { ensureBlockFocus } from "./yoopta-focus-utils";
import {
  collectPageNavigationFromDom,
  extractPageNavigation,
  type PageNavigationExtract,
} from "@/navigation/page-navigation-extractor";
import { getPageHref } from "@/pages/apps/utils/page-href";

const SOLID_COLOR_MAP: Record<string, string> = {
  "warm-gray": "#d6d3d1", slate: "#94a3b8", stone: "#a8a29e", neutral: "#a3a3a3",
};

/** Parse a cover value into CSS background style. */
function parseCoverBackground(cover: string): React.CSSProperties {
  if (cover.startsWith("gradient:")) {
    const key = cover.slice(9) as keyof typeof GRADIENT_COLORS;
    const g = GRADIENT_COLORS[key];
    if (g) return { background: `linear-gradient(135deg, ${g.from}, ${g.to})` };
  }
  if (cover.startsWith("solid:")) {
    const color = SOLID_COLOR_MAP[cover.slice(6)];
    if (color) return { background: color };
  }
  // URL — use as background-image for img tag (handled separately)
  return {};
}

const SAVE_DEBOUNCE_MS = 1000;

const EDITOR_STYLES = {
  width: "100%",
};

export interface YooptaMarkdownRendererProps {
  content: string;
  className?: string;
  workspaceId?: string;
  workspacePath?: string;
  uid?: string;
  editable?: boolean;
  title?: string;
  icon?: IconData | null;
  cover?: string | null;
  pageWidth?: PageWidth;
  showToc?: boolean;
  /** ISO timestamp of the page's last modification */
  updatedAt?: string;
  onTitleChange?: (newTitle: string) => void;
  onNavigationExtract?: (extract: PageNavigationExtract) => void;
  onOpenPage?: (pageUid: string) => void;
  onOpenWeb?: (url: string, title?: string) => void;
  /** Portal target for editor header buttons. If provided, header renders into this DOM element instead of inside the editor. */
  headerPortal?: HTMLElement | null;
}

export function YooptaMarkdownRenderer({
  content,
  className,
  workspaceId,
  workspacePath,
  uid,
  editable,
  title,
  icon,
  cover,
  pageWidth,
  showToc,
  updatedAt,
  onTitleChange,
  onNavigationExtract,
  onOpenPage,
  onOpenWeb,
  headerPortal,
}: YooptaMarkdownRendererProps) {
  const { t } = useTranslation();
  const canSave = !!(workspacePath && uid);
  const isEditable = editable ?? canSave;
  const queryClient = useQueryClient();

  const containerBoxRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const [wordCount, setWordCount] = useState({ words: 0, characters: 0 });
  const deferredWordCount = useDeferredValue(wordCount);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const saveStatusRef = useRef(saveStatus);
  saveStatusRef.current = saveStatus;
  // Initialize to empty so the first useEffect always triggers deserialization
  const lastContentRef = useRef<string>("");
  const frontmatterRef = useRef<string>("");
  const [pageTitle, setPageTitle] = useState(title || "");
  const [pageIcon, setPageIcon] = useState<IconData | null>(icon ?? null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconAnchorRef = useRef<HTMLDivElement | null>(null);
  // Single CoverPicker instance — lifted to editor level (like IconPicker)
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [coverPickerAlign, setCoverPickerAlign] = useState<"start" | "center" | "end">("start");
  const coverPickerAnchorRef = useRef<HTMLElement | null>(null);
  const iconSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPageWidth, setCurrentPageWidth] = useState<PageWidth>(pageWidth || "default");
  const [currentShowToc, setCurrentShowToc] = useState(showToc ?? false);
  const configSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync props to local state — single effect to reduce per-render overhead
  useEffect(() => { setPageTitle(title || ""); }, [title]);
  useEffect(() => { setPageIcon(icon ?? null); }, [icon]);
  useEffect(() => { setCurrentPageWidth(pageWidth || "default"); }, [pageWidth]);
  useEffect(() => { setCurrentShowToc(showToc ?? false); }, [showToc]);

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
      if (!canSave) return;
      if (iconSaveTimerRef.current) clearTimeout(iconSaveTimerRef.current);
      iconSaveTimerRef.current = setTimeout(async () => {
        try {
          const baseUrl = getGatewayUrl();
          await updatePageConfig(baseUrl, {
            workspace_path: workspacePath!,
            uid: uid!,
            icon: iconData,
          });
          // Invalidate page list cache so sidebar tree updates
          queryClient.invalidateQueries({
            queryKey: pageKeys.list(workspacePath!),
          });
        } catch (err) {
          console.error("[YooptaMarkdownRenderer] icon save failed:", err);
        }
      }, 500);
    },
    [canSave, workspacePath, uid, queryClient]
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
            uid: uid!,
            ...updates,
          });
        } catch (err) {
          console.error("[YooptaMarkdownRenderer] layout config save failed:", err);
        }
      }, 300);
    },
    [canSave, workspacePath, uid]
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
  const coverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync cover from props
  useEffect(() => {
    setCoverUrl(cover || null);
  }, [cover]);

  const persistCover = useCallback(
    (url: string | null) => {
      if (!canSave) return;
      if (coverSaveTimerRef.current) clearTimeout(coverSaveTimerRef.current);
      coverSaveTimerRef.current = setTimeout(async () => {
        try {
          const baseUrl = getGatewayUrl();
          await updatePageConfig(baseUrl, {
            workspace_path: workspacePath!,
            uid: uid!,
            cover: url,
          });
          // Invalidate page cache so other views reflect the cover change
          queryClient.invalidateQueries({
            queryKey: pageKeys.list(workspacePath!),
          });
        } catch (err) {
          console.error("[YooptaMarkdownRenderer] cover save failed:", err);
        }
      }, 500);
    },
    [canSave, workspacePath, uid, queryClient]
  );

  const handleCoverChange = useCallback(
    (newCover: string | null) => {
      setCoverUrl(newCover);
      persistCover(newCover);
    },
    [persistCover]
  );

  /** Open the single CoverPicker, anchoring to the given element. */
  const openCoverPicker = useCallback(
    (anchor: HTMLElement, align: "start" | "center" | "end" = "start") => {
      coverPickerAnchorRef.current = anchor;
      setCoverPickerAlign(align);
      setShowCoverPicker(true);
    },
    []
  );

  const handleIconChange = useCallback(
    (iconData: IconData | null) => {
      setPageIcon(iconData);
      persistIcon(iconData);
    },
    [persistIcon]
  );

  const openIconPicker = useCallback(() => setShowIconPicker(true), []);

  const plugins = useMemo(() => {
    if (!workspacePath || !uid) return createYooptaPlugins();
    const baseUrl = getGatewayUrl();
    const uploadFn = async (file: File) => {
      const result = await uploadPageAsset(baseUrl, workspacePath, uid, file);
      if (!result.success || !result.url) {
        throw new Error(result.error || "Upload failed");
      }
      return `${baseUrl}${result.url}`;
    };
    const searchPagesFn = async (query: string) => {
      const result = await listPages(baseUrl, workspacePath);
      const q = query.toLowerCase();
      return result.pages
        .filter((p) => p.name.toLowerCase().includes(q) || p.uid.toLowerCase().includes(q))
        .map((p) => ({ id: p.uid, name: p.name, avatar: '' }));
    };
    return createYooptaPlugins({
      uploadAsset: uploadFn,
      searchPages: searchPagesFn,
      buildPageHref: workspaceId ? (pageUid) => getPageHref(workspaceId, pageUid) : undefined,
      buildPageMeta: () => ({ includeInPageIndex: true }),
    });
  }, [workspaceId, workspacePath, uid]);

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

  useEffect(() => {
    if (!uid || !onNavigationExtract) return;
    onNavigationExtract(extractPageNavigation(uid, content));
  }, [content, onNavigationExtract, uid]);

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
  // Stash the latest YooptaContentValue so serialization happens inside the debounce callback,
  // not synchronously on every keystroke.
  const pendingValueRef = useRef<YooptaContentValue | null>(null);

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
        await updatePageContent(baseUrl, workspacePath!, uid!, md);
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
    [canSave, workspacePath, uid]
  );

  // Debounced save: serialization happens here (once per debounce window) instead of on every keystroke.
  const debouncedSave = useCallback(
    () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        const val = pendingValueRef.current;
        if (!val) return;
        pendingValueRef.current = null;
        try {
          const md = serializeMarkdown(editor, val, frontmatterRef.current);
          lastContentRef.current = md;
          handleSave(md);
        } catch (err) {
          console.error("[YooptaMarkdownRenderer] serialize failed:", err);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [editor, handleSave]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (iconSaveTimerRef.current) clearTimeout(iconSaveTimerRef.current);
      if (coverSaveTimerRef.current) clearTimeout(coverSaveTimerRef.current);
      if (configSaveTimerRef.current) clearTimeout(configSaveTimerRef.current);
      if (wordCountTimerRef.current) clearTimeout(wordCountTimerRef.current);
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
        // Defer serialization off the keydown event to avoid blocking input
        setTimeout(() => {
          const md = serializeMarkdown(editor, editor.children, frontmatterRef.current);
          lastContentRef.current = md;
          handleSave(md);
        }, 0);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canSave, editor, handleSave]);

  // Handle Chinese IME slash variants to trigger slash command menu.
  // ／ (U+FF0F) — full-width solidus, 、(U+3001) — ideographic comma (common on Chinese IME / key)
  // IME input bypasses keydown (isComposing=true), so we intercept at input/compositionend level.
  // Attach to document level so we don't depend on editor.refElement mounting timing.
  // Filter events by checking if the target is inside the editor.
  useEffect(() => {
    if (!isEditable) return;

    const CJK_SLASH_CHARS = new Set(["／", "\uFF0F", "、", "\u3001"]);
    const isCjkSlash = (ch: string | null | undefined) => ch != null && CJK_SLASH_CHARS.has(ch);

    const isInsideEditor = (target: EventTarget | null) => {
      if (!target || !(target instanceof Node)) return false;
      const refEl = editor.refElement;
      return refEl ? refEl.contains(target) : false;
    };

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
      if (trimmed.length === 1 && isCjkSlash(trimmed)) {
        Transforms.delete(slate, {
          at: { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: blockText.length } },
        });
        setTimeout(() => {
          const target =
            document.activeElement?.closest("[contenteditable]") ??
            editor.refElement?.querySelector("[contenteditable]");
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
      if (!isInsideEditor(e.target)) return;
      const data = (e as InputEvent).data;
      if (isCjkSlash(data)) {
        tryConvertFullWidthSlash();
      }
    };

    const handleCompositionEnd = (e: Event) => {
      if (!isInsideEditor(e.target)) return;
      const data = (e as CompositionEvent).data;
      if (isCjkSlash(data)) {
        setTimeout(tryConvertFullWidthSlash, 10);
      }
    };

    document.addEventListener("input", handleInput, true);
    document.addEventListener("compositionend", handleCompositionEnd, true);
    return () => {
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("compositionend", handleCompositionEnd, true);
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

  // Ref to stabilize wordCount — only triggers state update when values actually change
  const wordCountRef = useRef({ words: 0, characters: 0 });
  // Debounce word count computation to avoid running on every keystroke
  const wordCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // onChange handler for auto-save and word count
  const handleChange = useCallback(
    (value: YooptaContentValue, _options: { operations: unknown[] }) => {
      // Update word count — debounced separately so the expensive text extraction
      // doesn't run on every single keystroke
      if (wordCountTimerRef.current) clearTimeout(wordCountTimerRef.current);
      wordCountTimerRef.current = setTimeout(() => {
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
          if (words !== wordCountRef.current.words || characters !== wordCountRef.current.characters) {
            const next = { words, characters };
            wordCountRef.current = next;
            startTransition(() => setWordCount(next));
          }
        } catch {
          // ignore count errors
        }
      }, 300);

      // Auto-save: stash value reference; serialization happens inside debouncedSave
      if (canSave) {
        pendingValueRef.current = value;
        // Only transition to 'pending' if not already in a saving/pending state — avoids
        // scheduling a React state update on every single keystroke.
        const status = saveStatusRef.current;
        if (status === 'idle' || status === 'saved') {
          startTransition(() => setSaveStatus('pending'));
        }
        debouncedSave();
      }
    },
    [canSave, debouncedSave]
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

  // Notion behavior: click on empty area below content → focus or create last block.
  // Uses ensureBlockFocus for reliable DOM-level focus that doesn't depend on
  // Yoopta's internal setTimeout(0) timing.
  const contentWidthClass = useMemo(
    () => currentPageWidth === "full" ? "max-w-full" : currentPageWidth === "wide" ? "max-w-6xl" : "max-w-4xl",
    [currentPageWidth]
  );

  // Memoize editor children to avoid recreating JSX on every parent render
  const editorChildren = useMemo(() => {
    if (!isEditable && !currentShowToc) return null;
    return (
      <>
        {isEditable && <YooptaToolbar />}
        {isEditable && <YooptaFloatingBlockActions />}
        {isEditable && <YooptaSlashCommandMenu />}
        {isEditable && <SelectionBox selectionBoxElement={containerBoxRef} />}
        {isEditable && <MentionDropdown />}
        {isEditable && <EmojiDropdown />}
        {currentShowToc && <YooptaTocSidebar className="yoopta-toc-panel" />}
      </>
    );
  }, [isEditable, currentShowToc]);

  const handleEmptyAreaClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditable) return;

    const blockIds = Object.keys(editor.children);
    const totalBlocks = blockIds.length;
    if (totalBlocks === 0) {
      const newId = editor.insertBlock("Paragraph");
      if (newId) ensureBlockFocus(editor, newId);
      return;
    }

    // Find the last block by highest order
    let lastBlockId: string | null = null;
    let maxOrder = -1;
    for (const id of blockIds) {
      const order = editor.children[id]?.meta.order ?? -1;
      if (order > maxOrder) {
        maxOrder = order;
        lastBlockId = id;
      }
    }
    if (!lastBlockId) return;

    const lastBlock = Blocks.getBlock(editor, { id: lastBlockId });
    if (!lastBlock) return;

    // Check if last block is an empty paragraph
    const isEmptyParagraph = lastBlock.type === "Paragraph" && (() => {
      const slate = Blocks.getBlockSlate(editor, { id: lastBlockId! });
      if (!slate?.children?.[0]) return true;
      const text = (slate.children as any[])
        .map((node: any) => node.children?.map((c: any) => c.text || "").join("") || "")
        .join("");
      return text.trim() === "";
    })();

    if (isEmptyParagraph) {
      ensureBlockFocus(editor, lastBlockId);
    } else {
      const newId = editor.insertBlock("Paragraph", { at: maxOrder + 1 });
      if (newId) ensureBlockFocus(editor, newId);
    }
  }, [isEditable, editor]);

  useEffect(() => {
    if (!uid || !onNavigationExtract || !containerBoxRef.current) return;
    onNavigationExtract(collectPageNavigationFromDom(containerBoxRef.current, uid));
  }, [editor.children, onNavigationExtract, uid]);

  const handleContentClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const mention = target.closest<HTMLElement>("[data-mention-type='page'][data-mention-id']");
      if (mention?.dataset.mentionId && onOpenPage) {
        event.preventDefault();
        event.stopPropagation();
        onOpenPage(mention.dataset.mentionId);
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      const href = anchor?.getAttribute("href");
      if (!href) return;

      if (/^https?:\/\//i.test(href)) {
        if (!workspaceId) return;
        event.preventDefault();
        event.stopPropagation();
        onOpenWeb?.(href, anchor?.textContent?.trim() || undefined);
        return;
      }

      if (onOpenPage) {
        event.preventDefault();
        event.stopPropagation();
        onOpenPage(href.replace(/^pages\//, "").replace(/\/SKILL\.md$/i, ""));
      }
    },
    [onOpenPage, onOpenWeb, workspaceId]
  );

  return (
    <div
      onClickCapture={handleContentClick}
      className={cn(
        "yoopta-notion-editor w-full mx-auto relative",
        contentWidthClass,
        className
      )}
    >
      <YooptaErrorBoundary>
        {/* Editor header: portal to breadcrumb bar if available, otherwise render in-place */}
        {headerPortal ? createPortal(
          <YooptaEditorHeader
            editor={editor}
            title={pageTitle || title}
            pageWidth={currentPageWidth}
            showToc={currentShowToc}
            saveStatus={canSave ? saveStatus : undefined}
            wordCount={deferredWordCount}
            updatedAt={updatedAt}
            onPageWidthChange={canSave ? handlePageWidthChange : undefined}
            onShowTocChange={canSave ? handleShowTocChange : undefined}
          />,
          headerPortal
        ) : (
          <YooptaEditorHeader
            editor={editor}
            title={pageTitle || title}
            pageWidth={currentPageWidth}
            showToc={currentShowToc}
            saveStatus={canSave ? saveStatus : undefined}
            wordCount={deferredWordCount}
            updatedAt={updatedAt}
            onPageWidthChange={canSave ? handlePageWidthChange : undefined}
            onShowTocChange={canSave ? handleShowTocChange : undefined}
          />
        )}
        {/* Cover banner */}
        {coverUrl && (
          <CoverBanner
            coverUrl={coverUrl}
            isEditable={isEditable}
            contentWidthClass={contentWidthClass}
            onCoverChange={handleCoverChange}
            onOpenCoverPicker={openCoverPicker}
          />
        )}
        {isEditable && (
          <PageTitleArea
            pageIcon={pageIcon}
            pageTitle={pageTitle}
            coverUrl={coverUrl}
            workspacePath={workspacePath}
            iconAnchorRef={iconAnchorRef}
            onOpenIconPicker={openIconPicker}
            onOpenCoverPicker={openCoverPicker}
            onTitleChange={handleTitleChange}
            onTitleKeyDown={handleTitleKeyDown}
          />
        )}
        {/* Single IconPicker instance — positioned relative to iconAnchorRef */}
        {isEditable && (
          <IconPicker
            open={showIconPicker}
            onOpenChange={setShowIconPicker}
            anchorRef={iconAnchorRef}
            value={pageIcon}
            onChange={handleIconChange}
            workspacePath={workspacePath}
          />
        )}
        {/* Single CoverPicker instance — positioned relative to coverPickerAnchorRef */}
        {isEditable && (
          <CoverPicker
            open={showCoverPicker}
            onOpenChange={setShowCoverPicker}
            anchorRef={coverPickerAnchorRef}
            value={coverUrl}
            onChange={handleCoverChange}
            workspacePath={workspacePath}
            uid={uid}
            align={coverPickerAlign}
          />
        )}
        {!isEditable && (pageTitle || pageIcon) && (
          <div className={cn(
            "px-14 pb-2",
            coverUrl && pageIcon ? "-mt-6" : "pt-8"
          )}>
            {pageIcon && (
              <div className="yoopta-page-icon mb-1">
                <IconDisplay icon={pageIcon} size={78} workspacePath={workspacePath} />
              </div>
            )}
            {pageTitle && (
              <h1 className="text-4xl font-bold leading-tight text-foreground">{pageTitle}</h1>
            )}
          </div>
        )}
        {/* containerBoxRef wraps ONLY the editor + footer so SelectionBox's
            mousedown handler does not intercept clicks in PageTitleArea / CoverBanner.
            SelectionBox calls preventDefault() on mousedown for anything inside
            containerBoxRef but outside editor.refElement, which kills the
            subsequent click event that Radix PopoverTrigger relies on. */}
        <div ref={containerBoxRef}>
          <BlockDndContext editor={editor}>
            <YooptaEditor
              editor={editor}
              style={EDITOR_STYLES}
              renderBlock={renderBlock}
              placeholder={t("editor.renderer.placeholder")}
              onChange={handleChange}
            >
              {editorChildren}
            </YooptaEditor>
          </BlockDndContext>
        </div>
        {/* Notion behavior: click empty area below blocks → create / focus last block.
            MUST be outside containerBoxRef — SelectionBox calls preventDefault() on
            mousedown for anything inside containerBoxRef but outside editor.refElement. */}
        {isEditable && (
          <div
            className="min-h-[30vh] cursor-text"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleEmptyAreaClick}
          />
        )}
        {!isEditable && <div className="h-24" />}
      </YooptaErrorBoundary>
    </div>
  );
}

/* ─── PageTitleArea ──────────────────────────────────────────────────────────
 * Extracted as a memo'd sub-component so that hover / icon-picker state
 * changes only re-render this lightweight area, NOT the heavy editor tree.
 * ──────────────────────────────────────────────────────────────────────── */

type PageTitleAreaProps = {
  pageIcon: IconData | null;
  pageTitle: string;
  coverUrl: string | null;
  workspacePath?: string;
  /** Ref attached to the icon display area so the parent-level IconPicker
   *  can position its Popover relative to the icon. */
  iconAnchorRef: React.RefObject<HTMLDivElement | null>;
  /** Open the parent-level IconPicker */
  onOpenIconPicker: () => void;
  /** Open the parent-level CoverPicker, anchored to the given element */
  onOpenCoverPicker: (anchor: HTMLElement, align?: "start" | "center" | "end") => void;
  onTitleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onTitleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

const PageTitleArea = memo(function PageTitleArea({
  pageIcon,
  pageTitle,
  coverUrl,
  workspacePath,
  iconAnchorRef,
  onOpenIconPicker,
  onOpenCoverPicker,
  onTitleChange,
  onTitleKeyDown,
}: PageTitleAreaProps) {
  const { t } = useTranslation();
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showActions = isTitleHovered;
  return (
    <div
      className={cn(
        "yoopta-page-title-area px-14 pb-2 relative",
        // Notion: icon overlaps cover bottom by ~24px when cover exists
        coverUrl && pageIcon ? "-mt-6" : "pt-8"
      )}
      onMouseEnter={() => {
        if (hoverLeaveTimerRef.current) { clearTimeout(hoverLeaveTimerRef.current); hoverLeaveTimerRef.current = null; }
        setIsTitleHovered(true);
      }}
      onMouseLeave={() => {
        hoverLeaveTimerRef.current = setTimeout(() => { setIsTitleHovered(false); }, 150);
      }}
    >
      {/* Page icon — Notion style: large, above title, overlaps cover.
          This div is the anchor for the parent-level IconPicker via iconAnchorRef. */}
      {pageIcon && (
        <div
          ref={iconAnchorRef}
          className="yoopta-page-icon mb-1 cursor-pointer group/icon relative inline-block"
          role="button"
          tabIndex={0}
          onClick={() => onOpenIconPicker()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpenIconPicker(); }}
        >
          {/* Notion-style hover: rounded bg overlay + slight scale */}
          <div className="rounded-lg p-1 -m-1 transition-all duration-150 group-hover/icon:bg-foreground/5 group-hover/icon:scale-105">
            <IconDisplay icon={pageIcon} size={78} workspacePath={workspacePath} />
          </div>
        </div>
      )}
      {/* When no icon, place a hidden anchor so IconPicker still has a position ref */}
      {!pageIcon && <div ref={iconAnchorRef} className="h-0 w-0" />}

      {/* Action row — Notion: between icon and title, visible on hover */}
      <div
        className={cn(
          "flex items-center gap-1 py-1 transition-opacity duration-150",
          showActions ? "opacity-100" : "opacity-0"
        )}
      >
        {!pageIcon && (
          <button
            type="button"
            className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted rounded transition-colors"
            onClick={() => onOpenIconPicker()}
          >
            <SmilePlus size={14} />
            <span>{t("editor.renderer.addIcon")}</span>
          </button>
        )}
        {pageIcon && (
          <button
            type="button"
            className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted rounded transition-colors"
            onClick={() => onOpenIconPicker()}
          >
            <SmilePlus size={14} />
            <span>{t("editor.renderer.changeIcon")}</span>
          </button>
        )}
        {!coverUrl && (
          <button
            type="button"
            className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted rounded transition-colors"
            onClick={(e) => onOpenCoverPicker(e.currentTarget)}
          >
            <ImageLucideIcon size={14} />
            <span>{t("editor.renderer.addCover")}</span>
          </button>
        )}
      </div>

      {/* Title textarea */}
      <textarea
        ref={titleRef}
        value={pageTitle}
        onChange={onTitleChange}
        onKeyDown={onTitleKeyDown}
        placeholder={t("editor.renderer.untitled")}
        rows={1}
        className="w-full resize-none overflow-hidden bg-transparent text-4xl font-bold leading-tight text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
        style={{ fieldSizing: "content" } as React.CSSProperties}
      />
    </div>
  );
});

/* ─── CoverBanner ────────────────────────────────────────────────────────────
 * Extracted as memo'd sub-component. Renders either a gradient/solid color
 * or an image cover, with hover overlay for Change/Remove actions.
 * ──────────────────────────────────────────────────────────────────────── */

type CoverBannerProps = {
  coverUrl: string;
  isEditable: boolean;
  /** Tailwind max-w class matching the parent editor container (e.g. "max-w-4xl") */
  contentWidthClass: string;
  onCoverChange: (cover: string | null) => void;
  /** Open the parent-level CoverPicker, anchored to the given element */
  onOpenCoverPicker: (anchor: HTMLElement, align?: "start" | "center" | "end") => void;
};

const CoverBanner = memo(function CoverBanner({
  coverUrl,
  isEditable,
  contentWidthClass,
  onCoverChange,
  onOpenCoverPicker,
}: CoverBannerProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isColorCover = coverUrl.startsWith("gradient:") || coverUrl.startsWith("solid:");
  const bgStyle = isColorCover ? parseCoverBackground(coverUrl) : undefined;

  return (
    <div
      className="yoopta-cover-area relative"
      style={{ height: 280, width: "100vw", marginLeft: "calc(50% - 50vw)" }}
      onMouseEnter={() => {
        if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        hoverTimerRef.current = setTimeout(() => setIsHovered(false), 150);
      }}
    >
      {isColorCover ? (
        <div className="h-full w-full" style={bgStyle} />
      ) : (
        <img
          src={coverUrl}
          alt={t("editor.renderer.pageCover")}
          className="h-full w-full object-cover"
        />
      )}
      {/* Button overlay — constrained to content width via inner wrapper */}
      {isEditable && (
        <div className={cn(
          "absolute bottom-2 right-0 left-0 mx-auto flex justify-end px-2 z-10 transition-opacity",
          contentWidthClass,
          isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur-sm hover:bg-background/90 transition-colors"
              onClick={(e) => onOpenCoverPicker(e.currentTarget, "end")}
            >
              {t("editor.renderer.changeCover")}
            </button>
            <button
              type="button"
              onClick={() => onCoverChange(null)}
              className="rounded bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur-sm hover:bg-background/90 transition-colors"
            >
              {t("editor.renderer.remove")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
