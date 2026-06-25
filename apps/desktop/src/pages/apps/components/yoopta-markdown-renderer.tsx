import { memo, useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Editor, { type OnChange, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  ImageIcon as ImageLucideIcon,
  Loader2,
  MoreHorizontalIcon,
  SmilePlus,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CoverPicker } from "@/components/ui/cover-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconDisplay, IconPicker } from "@/components/ui/icon-picker";
import { getGatewayUrl } from "@/lib/gateway/config";
import { updatePageConfig, updatePageContent } from "@/lib/gateway/modules/pages";
import type { IconData, PageWidth } from "@/lib/gateway/types/page";
import { cn } from "@/lib/utils";
import { GRADIENT_COLORS } from "@/lib/gradient-colors";
import { pageKeys, useApplyPageTemplate, usePageTemplates } from "@/hooks/use-pages";
import { useTheme } from "@/hooks/use-theme";
import {
  extractPageNavigation,
  type PageNavigationExtract,
} from "@/navigation/page-navigation-extractor";
import { EmptyMarkdownPageCard } from "./empty-markdown-page-card";
import {
  isMarkdownBodyEmpty,
  stripYamlFrontmatter,
  type PageCreationMode,
} from "./empty-markdown-page-utils";
import { PageAiCreateCompact } from "./page-ai-create-compact";
import { PageImportDialog } from "./page-import-dialog";
import { PageTemplateDialog } from "./page-template-dialog";
import { usePageAiCreation } from "./use-page-ai-creation";

const SOLID_COLOR_MAP: Record<string, string> = {
  "warm-gray": "#d6d3d1",
  slate: "#94a3b8",
  stone: "#a8a29e",
  neutral: "#a3a3a3",
};

const SAVE_DEBOUNCE_MS = 1000;
const EMPTY_PAGE_REAPPEAR_BUFFER_MS = 250;
const EMPTY_PAGE_INTERACTIVE_SELECTOR =
  "input, textarea, select, button, [role='button'], [contenteditable='true'], [data-empty-page-action='true']";

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
type WordCount = { words: number; characters: number };

function isEmptyPageInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(EMPTY_PAGE_INTERACTIVE_SELECTOR) !== null;
}

function hasAnyMarkdownBodyInput(markdown: string | null | undefined): boolean {
  return stripYamlFrontmatter(markdown ?? "").length > 0;
}

function parseCoverBackground(cover: string): React.CSSProperties {
  if (cover.startsWith("gradient:")) {
    const key = cover.slice(9) as keyof typeof GRADIENT_COLORS;
    const gradient = GRADIENT_COLORS[key];
    if (gradient) return { background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` };
  }
  if (cover.startsWith("solid:")) {
    const color = SOLID_COLOR_MAP[cover.slice(6)];
    if (color) return { background: color };
  }
  return {};
}

function countMarkdown(markdown: string): WordCount {
  const text = stripYamlFrontmatter(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_\-[\]()`~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    words: text ? text.split(/\s+/).length : 0,
    characters: text.length,
  };
}

function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 100);
}

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
  updatedAt?: string;
  onTitleChange?: (newTitle: string) => void;
  onNavigationExtract?: (extract: PageNavigationExtract) => void;
  onOpenPage?: (pageUid: string) => void;
  onOpenWeb?: (url: string, title?: string) => void;
  headerPortal?: HTMLElement | null;
  autoFocusTitle?: boolean;
}

export function YooptaMarkdownRenderer({
  content,
  className,
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
  headerPortal,
  autoFocusTitle = false,
}: YooptaMarkdownRendererProps) {
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const canSave = !!(workspacePath && uid);
  const isEditable = editable ?? canSave;
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const pendingContentRef = useRef<string | null>(null);
  const iconAnchorRef = useRef<HTMLDivElement | null>(null);
  const coverPickerAnchorRef = useRef<HTMLElement | null>(null);
  const iconSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emptyPageReappearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHadBodyInputRef = useRef(hasAnyMarkdownBodyInput(content));
  const previousBodyEmptyRef = useRef(isMarkdownBodyEmpty(content));
  const previousBodyHadInputRef = useRef(hasAnyMarkdownBodyInput(content));

  const [localContent, setLocalContent] = useState(content);
  const [pageTitle, setPageTitle] = useState(title || "");
  const [pageIcon, setPageIcon] = useState<IconData | null>(icon ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(cover || null);
  const [currentPageWidth, setCurrentPageWidth] = useState<PageWidth>(pageWidth || "default");
  const [currentShowToc, setCurrentShowToc] = useState(showToc ?? false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [coverPickerAlign, setCoverPickerAlign] = useState<"start" | "center" | "end">("start");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [copied, setCopied] = useState(false);
  const [isEmptyPageCardDismissed, setIsEmptyPageCardDismissed] = useState(false);

  const wordCount = useMemo(() => countMarkdown(localContent), [localContent]);
  const deferredWordCount = useDeferredValue(wordCount);
  const contentWidthClass = useMemo(
    () => currentPageWidth === "full" ? "max-w-full" : currentPageWidth === "wide" ? "max-w-6xl" : "max-w-4xl",
    [currentPageWidth]
  );
  const isBodyEmpty = isMarkdownBodyEmpty(localContent);
  const shouldShowEmptyPageCard = isEditable && isBodyEmpty && !isEmptyPageCardDismissed;
  const pageTemplates = usePageTemplates(workspacePath);
  const applyTemplate = useApplyPageTemplate();
  const aiCreation = usePageAiCreation();

  useEffect(() => {
    const nextBodyEmpty = isMarkdownBodyEmpty(content);
    if (emptyPageReappearTimerRef.current) {
      clearTimeout(emptyPageReappearTimerRef.current);
      emptyPageReappearTimerRef.current = null;
    }
    setLocalContent(content);
    previousBodyEmptyRef.current = nextBodyEmpty;
    previousBodyHadInputRef.current = hasAnyMarkdownBodyInput(content);
    hasHadBodyInputRef.current = previousBodyHadInputRef.current;
    setIsEmptyPageCardDismissed(false);
  }, [content]);
  useEffect(() => { setPageTitle(title || ""); }, [title]);
  useEffect(() => { setPageIcon(icon ?? null); }, [icon]);
  useEffect(() => { setCoverUrl(cover || null); }, [cover]);
  useEffect(() => { setCurrentPageWidth(pageWidth || "default"); }, [pageWidth]);
  useEffect(() => { setCurrentShowToc(showToc ?? false); }, [showToc]);

  useEffect(() => {
    if (!uid || !onNavigationExtract) return;
    onNavigationExtract(extractPageNavigation(uid, localContent));
  }, [localContent, onNavigationExtract, uid]);

  const handleSave = useCallback(
    async (markdown: string) => {
      if (!canSave) return;
      if (isSavingRef.current) {
        pendingContentRef.current = markdown;
        setSaveStatus("pending");
        return;
      }

      isSavingRef.current = true;
      setSaveStatus("saving");
      try {
        await updatePageContent(getGatewayUrl(), workspacePath!, uid!, markdown);
        setSaveStatus("saved");
        queryClient.invalidateQueries({ queryKey: pageKeys.detail(workspacePath!, uid!) });
        setTimeout(() => setSaveStatus((status) => status === "saved" ? "idle" : status), 1800);
      } catch (error) {
        console.error("[YooptaMarkdownRenderer] save failed:", error);
        setSaveStatus("error");
      } finally {
        isSavingRef.current = false;
        const pending = pendingContentRef.current;
        if (pending !== null) {
          pendingContentRef.current = null;
          void handleSave(pending);
        }
      }
    },
    [canSave, queryClient, uid, workspacePath]
  );

  const scheduleSave = useCallback(
    (markdown: string) => {
      if (!canSave) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveStatus((status) => status === "idle" || status === "saved" ? "pending" : status);
      saveTimerRef.current = setTimeout(() => {
        void handleSave(markdown);
      }, SAVE_DEBOUNCE_MS);
    },
    [canSave, handleSave]
  );

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void handleSave(localContent);
  }, [handleSave, localContent]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (iconSaveTimerRef.current) clearTimeout(iconSaveTimerRef.current);
      if (coverSaveTimerRef.current) clearTimeout(coverSaveTimerRef.current);
      if (configSaveTimerRef.current) clearTimeout(configSaveTimerRef.current);
      if (emptyPageReappearTimerRef.current) clearTimeout(emptyPageReappearTimerRef.current);
    };
  }, []);

  const handleMonacoMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      editor.addAction({
        id: "viben-save-markdown-page",
        label: "Save Markdown Page",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => {
          flushSave();
        },
      });
    },
    [flushSave]
  );

  const scheduleEmptyPageReappear = useCallback(() => {
    if (emptyPageReappearTimerRef.current) {
      clearTimeout(emptyPageReappearTimerRef.current);
    }
    emptyPageReappearTimerRef.current = setTimeout(() => {
      if (previousBodyEmptyRef.current) {
        setIsEmptyPageCardDismissed(false);
      }
      emptyPageReappearTimerRef.current = null;
    }, EMPTY_PAGE_REAPPEAR_BUFFER_MS);
  }, []);

  const handleContentChange: OnChange = useCallback(
    (nextValue) => {
      const nextContent = nextValue ?? "";
      const nextBodyEmpty = isMarkdownBodyEmpty(nextContent);
      const nextBodyHasInput = hasAnyMarkdownBodyInput(nextContent);
      if (nextBodyHasInput) {
        if (emptyPageReappearTimerRef.current) {
          clearTimeout(emptyPageReappearTimerRef.current);
          emptyPageReappearTimerRef.current = null;
        }
        hasHadBodyInputRef.current = true;
      }
      if (nextBodyEmpty && hasHadBodyInputRef.current && previousBodyHadInputRef.current) {
        scheduleEmptyPageReappear();
      }
      previousBodyEmptyRef.current = nextBodyEmpty;
      previousBodyHadInputRef.current = nextBodyHasInput;
      setLocalContent(nextContent);
      scheduleSave(nextContent);
    },
    [scheduleEmptyPageReappear, scheduleSave]
  );

  const handleEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isEditable || !isBodyEmpty || !isEmptyPageCardDismissed) return;
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      scheduleEmptyPageReappear();
    },
    [isBodyEmpty, isEditable, isEmptyPageCardDismissed, scheduleEmptyPageReappear]
  );

  const focusEditor = useCallback(() => {
    editorRef.current?.focus();
  }, []);

  const enterEditor = useCallback(() => {
    if (!isEditable) return;
    setIsEmptyPageCardDismissed(true);
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      editor?.focus();
      editor?.setPosition({ lineNumber: 1, column: 1 });
    });
  }, [isEditable]);

  const handleEmptyPageKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter") return;
      if (isEmptyPageInteractiveTarget(event.target)) {
        return;
      }
      event.preventDefault();
      enterEditor();
    },
    [enterEditor]
  );

  const handleEmptyPageClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isEmptyPageInteractiveTarget(event.target)) {
        return;
      }
      enterEditor();
    },
    [enterEditor]
  );

  useEffect(() => {
    if (!shouldShowEmptyPageCard || aiCreation.isCreating) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (isEmptyPageInteractiveTarget(event.target)) {
        return;
      }
      event.preventDefault();
      enterEditor();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [aiCreation.isCreating, enterEditor, shouldShowEmptyPageCard]);

  const handleTitleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newTitle = event.target.value.replace(/\n/g, "");
      setPageTitle(newTitle);
      onTitleChange?.(newTitle);
    },
    [onTitleChange]
  );

  const handleTitleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        focusEditor();
      }
    },
    [focusEditor]
  );

  const persistIcon = useCallback(
    (iconData: IconData | null) => {
      if (!canSave) return;
      if (iconSaveTimerRef.current) clearTimeout(iconSaveTimerRef.current);
      iconSaveTimerRef.current = setTimeout(async () => {
        try {
          await updatePageConfig(getGatewayUrl(), {
            workspace_path: workspacePath!,
            uid: uid!,
            icon: iconData,
          });
          queryClient.invalidateQueries({ queryKey: pageKeys.list(workspacePath!) });
          queryClient.invalidateQueries({ queryKey: pageKeys.detail(workspacePath!, uid!) });
        } catch (error) {
          console.error("[YooptaMarkdownRenderer] icon save failed:", error);
        }
      }, 500);
    },
    [canSave, queryClient, uid, workspacePath]
  );

  const persistCover = useCallback(
    (nextCover: string | null) => {
      if (!canSave) return;
      if (coverSaveTimerRef.current) clearTimeout(coverSaveTimerRef.current);
      coverSaveTimerRef.current = setTimeout(async () => {
        try {
          await updatePageConfig(getGatewayUrl(), {
            workspace_path: workspacePath!,
            uid: uid!,
            cover: nextCover,
          });
          queryClient.invalidateQueries({ queryKey: pageKeys.list(workspacePath!) });
          queryClient.invalidateQueries({ queryKey: pageKeys.detail(workspacePath!, uid!) });
        } catch (error) {
          console.error("[YooptaMarkdownRenderer] cover save failed:", error);
        }
      }, 500);
    },
    [canSave, queryClient, uid, workspacePath]
  );

  const persistLayoutConfig = useCallback(
    (updates: { page_width?: PageWidth | null; show_toc?: boolean | null }) => {
      if (!canSave) return;
      if (configSaveTimerRef.current) clearTimeout(configSaveTimerRef.current);
      configSaveTimerRef.current = setTimeout(async () => {
        try {
          await updatePageConfig(getGatewayUrl(), {
            workspace_path: workspacePath!,
            uid: uid!,
            ...updates,
          });
        } catch (error) {
          console.error("[YooptaMarkdownRenderer] layout config save failed:", error);
        }
      }, 300);
    },
    [canSave, uid, workspacePath]
  );

  const handleIconChange = useCallback(
    (iconData: IconData | null) => {
      setPageIcon(iconData);
      persistIcon(iconData);
    },
    [persistIcon]
  );

  const handleCoverChange = useCallback(
    (nextCover: string | null) => {
      setCoverUrl(nextCover);
      persistCover(nextCover);
    },
    [persistCover]
  );

  const openCoverPicker = useCallback((anchor: HTMLElement, align: "start" | "center" | "end" = "start") => {
    coverPickerAnchorRef.current = anchor;
    setCoverPickerAlign(align);
    setShowCoverPicker(true);
  }, []);

  const handlePageWidthChange = useCallback(
    (width: PageWidth) => {
      setCurrentPageWidth(width);
      persistLayoutConfig({ page_width: width });
    },
    [persistLayoutConfig]
  );

  const handleShowTocChange = useCallback(
    (enabled: boolean) => {
      setCurrentShowToc(enabled);
      persistLayoutConfig({ show_toc: enabled });
    },
    [persistLayoutConfig]
  );

  const handleApplyTemplate = useCallback(
    async (templateId: string) => {
      if (!workspacePath || !uid) return;
      const result = await applyTemplate.mutateAsync({
        workspace_path: workspacePath,
        uid,
        template_id: templateId,
      });
      if (result.page?.skill_content !== undefined) {
        setLocalContent(result.page.skill_content);
      }
      setTemplateDialogOpen(false);
    },
    [applyTemplate, uid, workspacePath]
  );

  const replaceContent = useCallback(
    (nextContent: string) => {
      const nextBodyEmpty = isMarkdownBodyEmpty(nextContent);
      if (emptyPageReappearTimerRef.current) {
        clearTimeout(emptyPageReappearTimerRef.current);
        emptyPageReappearTimerRef.current = null;
      }
      if (!nextBodyEmpty) {
        hasHadBodyInputRef.current = true;
        setIsEmptyPageCardDismissed(true);
      } else if (hasHadBodyInputRef.current) {
        setIsEmptyPageCardDismissed(false);
      }
      previousBodyEmptyRef.current = nextBodyEmpty;
      previousBodyHadInputRef.current = hasAnyMarkdownBodyInput(nextContent);
      setLocalContent(nextContent);
      void handleSave(nextContent);
    },
    [handleSave]
  );

  const handleImportUrl = useCallback(
    (_url: string) => {
      console.warn("[YooptaMarkdownRenderer] URL import is not implemented yet.");
      setImportDialogOpen(false);
    },
    []
  );

  const handleImportFile = useCallback(
    async (kind: "markdown_file" | "html_file", file: File) => {
      const fileContent = await file.text();
      if (kind === "markdown_file") {
        replaceContent(stripYamlFrontmatter(fileContent).trimStart());
      } else {
        console.warn("[YooptaMarkdownRenderer] HTML import is not implemented yet.", file.name);
      }
      setImportDialogOpen(false);
    },
    [replaceContent]
  );

  const handleAiCreate = useCallback(
    (prompt: string, mode: PageCreationMode) => {
      void aiCreation.start(prompt, mode);
    },
    [aiCreation]
  );

  const header = (
    <MarkdownEditorHeader
      title={pageTitle || title}
      saveStatus={canSave ? saveStatus : undefined}
      wordCount={deferredWordCount}
      updatedAt={updatedAt}
      markdown={localContent}
      pageWidth={currentPageWidth}
      showToc={currentShowToc}
      onCopy={() => {
        void navigator.clipboard.writeText(localContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      onExport={() => downloadText(`${pageTitle || title || "document"}.md`, localContent, "text/markdown")}
      copied={copied}
      onPageWidthChange={canSave ? handlePageWidthChange : undefined}
      onShowTocChange={canSave ? handleShowTocChange : undefined}
    />
  );

  return (
    <div
      className={cn(
        "yoopta-notion-editor mx-auto flex h-full min-h-0 w-full flex-col bg-background",
        contentWidthClass,
        className
      )}
    >
      {headerPortal ? createPortal(header, headerPortal) : header}

      {coverUrl && (
        <CoverBanner
          coverUrl={coverUrl}
          isEditable={isEditable}
          contentWidthClass={contentWidthClass}
          onCoverChange={handleCoverChange}
          onOpenCoverPicker={openCoverPicker}
        />
      )}

      {isEditable ? (
        <PageTitleArea
          pageIcon={pageIcon}
          pageTitle={pageTitle}
          coverUrl={coverUrl}
          workspacePath={workspacePath}
          iconAnchorRef={iconAnchorRef}
          onOpenIconPicker={() => setShowIconPicker(true)}
          onOpenCoverPicker={openCoverPicker}
          onTitleChange={handleTitleChange}
          onTitleKeyDown={handleTitleKeyDown}
          autoFocusTitle={autoFocusTitle}
        />
      ) : (
        (pageTitle || pageIcon) && (
          <div className={cn("px-14 pb-2", coverUrl && pageIcon ? "-mt-6" : "pt-8")}>
            {pageIcon && (
              <div className="mb-1">
                <IconDisplay icon={pageIcon} size={78} workspacePath={workspacePath} />
              </div>
            )}
            {pageTitle && (
              <h1 className="text-4xl font-bold leading-tight text-foreground">{pageTitle}</h1>
            )}
          </div>
        )
      )}

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

      {shouldShowEmptyPageCard && !aiCreation.isCreating && (
        <div
          role="presentation"
          tabIndex={0}
          className="min-h-[420px] outline-none"
          onClick={handleEmptyPageClick}
          onKeyDown={handleEmptyPageKeyDown}
        >
          <EmptyMarkdownPageCard
            isCreating={applyTemplate.isPending}
            onStartEditing={enterEditor}
            onCreateFromTemplate={() => setTemplateDialogOpen(true)}
            onImportPage={() => setImportDialogOpen(true)}
            onAiCreate={handleAiCreate}
          />
        </div>
      )}

      {aiCreation.isCreating && (
        <PageAiCreateCompact
          mode={aiCreation.state.mode}
          input={aiCreation.state.prompt}
          onStop={aiCreation.stop}
          onDismiss={aiCreation.dismiss}
        />
      )}

      <div
        className={cn("flex min-h-0 flex-1 px-14 pb-10", shouldShowEmptyPageCard && "sr-only")}
        onKeyDown={handleEditorKeyDown}
      >
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background">
          <Editor
            height="100%"
            language="markdown"
            value={localContent}
            theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
            onMount={handleMonacoMount}
            onChange={isEditable ? handleContentChange : undefined}
            loading={
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            }
            options={{
              readOnly: !isEditable,
              minimap: { enabled: false },
              wordWrap: "on",
              wrappingIndent: "same",
              lineNumbers: "on",
              lineNumbersMinChars: 3,
              lineDecorationsWidth: 0,
              glyphMargin: false,
              folding: true,
              foldingHighlight: false,
              showFoldingControls: "mouseover",
              automaticLayout: true,
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorSmoothCaretAnimation: "on",
              renderLineHighlight: isEditable ? "gutter" : "none",
              renderWhitespace: "selection",
              renderControlCharacters: false,
              fontSize: 15,
              lineHeight: 24,
              tabSize: 2,
              insertSpaces: true,
              detectIndentation: false,
              padding: { top: 18, bottom: 18 },
              overviewRulerBorder: false,
              renderValidationDecorations: "off",
              quickSuggestions: false,
              suggestOnTriggerCharacters: false,
              acceptSuggestionOnCommitCharacter: false,
              wordBasedSuggestions: "off",
              contextmenu: true,
              links: true,
              mouseWheelZoom: false,
              scrollbar: {
                vertical: "auto",
                horizontal: "hidden",
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 0,
                alwaysConsumeMouseWheel: false,
              },
            }}
          />
        </div>
      </div>

      {workspacePath && uid && (
        <PageTemplateDialog
          open={templateDialogOpen}
          templates={pageTemplates.data ?? []}
          isLoading={pageTemplates.isLoading}
          isApplying={applyTemplate.isPending}
          onOpenChange={setTemplateDialogOpen}
          onApplyTemplate={handleApplyTemplate}
        />
      )}
      <PageImportDialog
        open={importDialogOpen}
        isImporting={saveStatus === "saving"}
        onOpenChange={setImportDialogOpen}
        onImportUrl={handleImportUrl}
        onImportFile={handleImportFile}
      />
    </div>
  );
}

type MarkdownEditorHeaderProps = {
  title?: string;
  saveStatus?: SaveStatus;
  wordCount: WordCount;
  updatedAt?: string;
  markdown: string;
  pageWidth: PageWidth;
  showToc: boolean;
  copied: boolean;
  onCopy: () => void;
  onExport: () => void;
  onPageWidthChange?: (width: PageWidth) => void;
  onShowTocChange?: (show: boolean) => void;
};

function MarkdownEditorHeader({
  saveStatus = "idle",
  wordCount,
  updatedAt,
  pageWidth,
  showToc,
  copied,
  onCopy,
  onExport,
  onPageWidthChange,
  onShowTocChange,
}: MarkdownEditorHeaderProps) {
  const { t } = useTranslation();

  return (
    <div role="toolbar" aria-label={t("editor.header.editorActions", "Editor actions")} className="flex items-center justify-end gap-1">
      {saveStatus !== "idle" && (
        <span
          aria-live="polite"
          className={cn("mr-auto text-xs", saveStatus === "error" ? "text-destructive" : "text-muted-foreground/60")}
        >
          {saveStatus === "pending" && t("editor.header.editing", "Editing")}
          {saveStatus === "saving" && t("editor.header.saving", "Saving...")}
          {saveStatus === "saved" && t("editor.header.saved", "Saved")}
          {saveStatus === "error" && t("editor.header.saveFailed", "Save failed")}
        </span>
      )}
      <span className="mr-2 hidden text-xs text-muted-foreground/60 md:inline">
        {wordCount.words} words · {wordCount.characters} chars
        {updatedAt ? ` · ${new Date(updatedAt).toLocaleString()}` : ""}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            title={t("editor.header.moreOptions", "More options")}
            aria-label={t("editor.header.moreOptions", "More options")}
          >
            <MoreHorizontalIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onExport}>
            <DownloadIcon className="mr-2 size-4" />
            {t("editor.header.exportMarkdown", "Export Markdown")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCopy}>
            {copied ? <CheckIcon className="mr-2 size-4 text-green-500" /> : <CopyIcon className="mr-2 size-4" />}
            {copied ? t("editor.header.copied", "Copied") : t("editor.header.copyAsMarkdown", "Copy as Markdown")}
          </DropdownMenuItem>
          {(onPageWidthChange || onShowTocChange) && <DropdownMenuSeparator />}
          {onPageWidthChange && (
            <>
              <DropdownMenuItem onSelect={() => onPageWidthChange("default")}>
                <FileTextIcon className="mr-2 size-4" />
                <span className="flex flex-1 items-center justify-between">
                  {t("editor.header.defaultWidth", "Default width")}
                  {pageWidth === "default" && <CheckIcon className="ml-2 size-3.5" />}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPageWidthChange("wide")}>
                <FileTextIcon className="mr-2 size-4" />
                <span className="flex flex-1 items-center justify-between">
                  {t("editor.header.wideLayout", "Wide layout")}
                  {pageWidth === "wide" && <CheckIcon className="ml-2 size-3.5" />}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPageWidthChange("full")}>
                <FileTextIcon className="mr-2 size-4" />
                <span className="flex flex-1 items-center justify-between">
                  {t("editor.header.fullWidth", "Full width")}
                  {pageWidth === "full" && <CheckIcon className="ml-2 size-3.5" />}
                </span>
              </DropdownMenuItem>
            </>
          )}
          {onShowTocChange && (
            <DropdownMenuItem onSelect={() => onShowTocChange(!showToc)}>
              <FileTextIcon className="mr-2 size-4" />
              {showToc ? t("editor.header.hideToc", "Hide table of contents") : t("editor.header.showToc", "Show table of contents")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
  autoFocusTitle?: boolean;
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
  autoFocusTitle = false,
}: PageTitleAreaProps) {
  const { t } = useTranslation();
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoFocusTitle) return;

    const frame = requestAnimationFrame(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    });

    return () => cancelAnimationFrame(frame);
  }, [autoFocusTitle]);

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
            <span>{t("editor.renderer.addIcon", "Add icon")}</span>
          </button>
        )}
        {pageIcon && (
          <button
            type="button"
            className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted rounded transition-colors"
            onClick={() => onOpenIconPicker()}
          >
            <SmilePlus size={14} />
            <span>{t("editor.renderer.changeIcon", "Change icon")}</span>
          </button>
        )}
        {!coverUrl && (
          <button
            type="button"
            className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted rounded transition-colors"
            onClick={(e) => onOpenCoverPicker(e.currentTarget)}
          >
            <ImageLucideIcon size={14} />
            <span>{t("editor.renderer.addCover", "Add cover")}</span>
          </button>
        )}
      </div>

      {/* Title textarea */}
      <textarea
        ref={titleRef}
        value={pageTitle}
        onChange={onTitleChange}
        onKeyDown={onTitleKeyDown}
        placeholder={t("editor.renderer.untitled", "Untitled")}
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
          alt={t("editor.renderer.pageCover", "Page cover")}
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
              {t("editor.renderer.changeCover", "Change cover")}
            </button>
            <button
              type="button"
              onClick={() => onCoverChange(null)}
              className="rounded bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur-sm hover:bg-background/90 transition-colors"
            >
              {t("editor.renderer.remove", "Remove")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
