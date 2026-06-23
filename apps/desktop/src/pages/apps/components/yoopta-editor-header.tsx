import { useState, useCallback, useEffect, memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "@/lib/utils";
import {
  FileTextIcon,
  CodeIcon,
  Undo2Icon,
  Redo2Icon,
  PrinterIcon,
  MoreHorizontalIcon,
  CopyIcon,
  CheckIcon,
  LockIcon,
  UnlockIcon,
  KeyboardIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  MaximizeIcon,
  ListTreeIcon,
} from "lucide-react";
import { html } from "@yoopta/exports";
import { serializeMarkdown } from "./yoopta-markdown";
import type { YooEditor } from "@yoopta/editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { PageWidth } from "@/lib/gateway/types/page";
import { IS_MAC } from "@viben/editor";

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type WordCount = { words: number; characters: number };

type YooptaEditorHeaderProps = {
  editor: YooEditor;
  title?: string;
  pageWidth?: PageWidth;
  showToc?: boolean;
  saveStatus?: SaveStatus;
  wordCount?: WordCount;
  updatedAt?: string;
  onPageWidthChange?: (width: PageWidth) => void;
  onShowTocChange?: (show: boolean) => void;
};

export const YooptaEditorHeader = memo(function YooptaEditorHeader({ editor, title, pageWidth = "default", showToc = false, saveStatus = "idle", wordCount, updatedAt, onPageWidthChange, onShowTocChange }: YooptaEditorHeaderProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isLocked, setIsLocked] = useState(editor.readOnly);
  const [, forceUpdate] = useState(0);

  // Subscribe to editor changes to keep undo/redo state fresh (debounced 100ms)
  const forceUpdateTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const onChange = () => {
      clearTimeout(forceUpdateTimerRef.current);
      forceUpdateTimerRef.current = setTimeout(() => forceUpdate((n) => n + 1), 100);
    };
    editor.on("change", onChange);
    return () => {
      editor.off("change", onChange);
      clearTimeout(forceUpdateTimerRef.current);
    };
  }, [editor]);

  // Sync isLocked with external readOnly changes
  useEffect(() => {
    setIsLocked(editor.readOnly);
  }, [editor.readOnly]);

  const filename = title || "document";

  const handleExportMarkdown = useCallback(() => {
    try {
      const md = serializeMarkdown(editor, editor.children);
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.md`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      // Delay cleanup to allow download to start
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error("Export markdown failed:", err);
    }
  }, [editor, filename]);

  const handleExportHTML = useCallback(() => {
    try {
      const htmlStr = html.serialize(editor, editor.children);
      const blob = new Blob([htmlStr], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.html`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error("Export HTML failed:", err);
    }
  }, [editor, filename]);

  const handleCopyMarkdown = useCallback(() => {
    try {
      const md = serializeMarkdown(editor, editor.children);
      navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy markdown failed:", err);
    }
  }, [editor]);

  const handleUndo = useCallback(() => {
    editor.undo();
  }, [editor]);

  const handleRedo = useCallback(() => {
    editor.redo();
  }, [editor]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleToggleLock = useCallback(() => {
    editor.readOnly = !editor.readOnly;
    setIsLocked(editor.readOnly);
  }, [editor]);

  const isMac = IS_MAC;
  const canUndo = editor.historyStack.undos.length > 0;
  const canRedo = editor.historyStack.redos.length > 0;

  return (
    <div role="toolbar" aria-label={t("editor.header.editorActions")} className="flex items-center justify-end gap-1">
      {saveStatus !== "idle" && (
        <span
          aria-live="polite"
          className={`text-xs mr-auto ${saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground/50'}`}
        >
          {saveStatus === 'pending' && t("editor.header.editing")}
          {saveStatus === 'saving' && t("editor.header.saving")}
          {saveStatus === 'saved' && t("editor.header.saved")}
          {saveStatus === 'error' && t("editor.header.saveFailed")}
        </span>
      )}
      <button
        type="button"
        onClick={handleUndo}
        disabled={!canUndo}
        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title={t("editor.header.undo", { shortcut: `${isMac ? '\u2318' : 'Ctrl'}+Z` })}
        aria-label={t("editor.header.undo", { shortcut: `${isMac ? '\u2318' : 'Ctrl'}+Z` })}
      >
        <Undo2Icon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleRedo}
        disabled={!canRedo}
        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title={t("editor.header.redo", { shortcut: `${isMac ? '\u2318' : 'Ctrl'}+Shift+Z` })}
        aria-label={t("editor.header.redo", { shortcut: `${isMac ? '\u2318' : 'Ctrl'}+Shift+Z` })}
      >
        <Redo2Icon className="h-4 w-4" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
            title={t("editor.header.moreOptions")}
            aria-label={t("editor.header.moreOptions")}
          >
            <MoreHorizontalIcon className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={handleExportMarkdown}>
            <FileTextIcon className="mr-2 h-4 w-4" />
            {t("editor.header.exportMarkdown")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleExportHTML}>
            <CodeIcon className="mr-2 h-4 w-4" />
            {t("editor.header.exportHtml")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleCopyMarkdown}>
            {copied ? (
              <CheckIcon className="mr-2 h-4 w-4 text-green-500" />
            ) : (
              <CopyIcon className="mr-2 h-4 w-4" />
            )}
            {copied ? t("editor.header.copied") : t("editor.header.copyAsMarkdown")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handlePrint}>
            <PrinterIcon className="mr-2 h-4 w-4" />
            {t("editor.header.print")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleToggleLock}>
            {isLocked ? (
              <UnlockIcon className="mr-2 h-4 w-4" />
            ) : (
              <LockIcon className="mr-2 h-4 w-4" />
            )}
            {isLocked ? t("editor.header.unlockEditing") : t("editor.header.lockEditing")}
          </DropdownMenuItem>
          {onPageWidthChange && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onPageWidthChange("default")}>
                <AlignLeftIcon className="mr-2 h-4 w-4" />
                <span className="flex items-center justify-between flex-1">
                  {t("editor.header.defaultWidth")}
                  {pageWidth === "default" && <CheckIcon className="ml-2 h-3.5 w-3.5" />}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPageWidthChange("wide")}>
                <AlignCenterIcon className="mr-2 h-4 w-4" />
                <span className="flex items-center justify-between flex-1">
                  {t("editor.header.wideLayout")}
                  {pageWidth === "wide" && <CheckIcon className="ml-2 h-3.5 w-3.5" />}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPageWidthChange("full")}>
                <MaximizeIcon className="mr-2 h-4 w-4" />
                <span className="flex items-center justify-between flex-1">
                  {t("editor.header.fullWidth")}
                  {pageWidth === "full" && <CheckIcon className="ml-2 h-3.5 w-3.5" />}
                </span>
              </DropdownMenuItem>
            </>
          )}
          {onShowTocChange && (
            <DropdownMenuItem onSelect={() => onShowTocChange(!showToc)}>
              <ListTreeIcon className="mr-2 h-4 w-4" />
              {showToc ? t("editor.header.hideToc") : t("editor.header.showToc")}
            </DropdownMenuItem>
          )}
          {(wordCount || updatedAt) && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground space-y-0.5">
                {wordCount && (
                  <div>{t("editor.header.wordCount", { words: wordCount.words, characters: wordCount.characters })}</div>
                )}
                {updatedAt && (
                  <div>{t("editor.header.lastEdited", { time: formatRelativeTime(updatedAt) })}</div>
                )}
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
            title={t("editor.header.keyboardShortcuts")}
            aria-label={t("editor.header.keyboardShortcuts")}
          >
            <KeyboardIcon className="h-4 w-4" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("editor.header.keyboardShortcuts")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <ShortcutSection title={t("editor.header.shortcuts.textFormatting")}>
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+B`} label={t("editor.header.shortcuts.bold")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+I`} label={t("editor.header.shortcuts.italic")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+U`} label={t("editor.header.shortcuts.underline")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+E`} label={t("editor.header.shortcuts.inlineCode")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+S`} label={t("editor.header.shortcuts.strikethrough")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+H`} label={t("editor.header.shortcuts.highlight")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+K`} label={t("editor.header.shortcuts.insertLink")} />
            </ShortcutSection>
            <ShortcutSection title={t("editor.header.shortcuts.blockTypes")}>
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+0`} label={t("editor.header.shortcuts.text")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+1`} label={t("editor.header.shortcuts.heading1")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+2`} label={t("editor.header.shortcuts.heading2")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+3`} label={t("editor.header.shortcuts.heading3")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+4`} label={t("editor.header.shortcuts.todoList")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+5`} label={t("editor.header.shortcuts.bulletedList")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+6`} label={t("editor.header.shortcuts.numberedList")} />
            </ShortcutSection>
            <ShortcutSection title={t("editor.header.shortcuts.blockActions")}>
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+/`} label={t("editor.header.shortcuts.openSlashMenu")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Enter`} label={t("editor.header.shortcuts.toggleCheckbox")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+↑`} label={t("editor.header.shortcuts.moveBlockUp")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+↓`} label={t("editor.header.shortcuts.moveBlockDown")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+D`} label={t("editor.header.shortcuts.duplicateBlock")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+⌫`} label={t("editor.header.shortcuts.deleteBlock")} />
              <Shortcut keys="Tab" label={t("editor.header.shortcuts.indent")} />
              <Shortcut keys="Shift+Tab" label={t("editor.header.shortcuts.outdent")} />
            </ShortcutSection>
            <ShortcutSection title={t("editor.header.shortcuts.markdownShortcuts")}>
              <Shortcut keys="# " label={t("editor.header.shortcuts.heading1")} />
              <Shortcut keys="## " label={t("editor.header.shortcuts.heading2")} />
              <Shortcut keys="### " label={t("editor.header.shortcuts.heading3")} />
              <Shortcut keys="- " label={t("editor.header.shortcuts.bulletedList")} />
              <Shortcut keys="1. " label={t("editor.header.shortcuts.numberedList")} />
              <Shortcut keys="[] " label={t("editor.header.shortcuts.todoList")} />
              <Shortcut keys="> " label={t("editor.header.shortcuts.quote")} />
              <Shortcut keys="--- " label={t("editor.header.shortcuts.divider")} />
              <Shortcut keys="```" label={t("editor.header.shortcuts.codeBlock")} />
            </ShortcutSection>
            <ShortcutSection title={t("editor.header.shortcuts.general")}>
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+S`} label={t("editor.header.shortcuts.save")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Z`} label={t("editor.header.shortcuts.undo")} />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+Z`} label={t("editor.header.shortcuts.redo")} />
            </ShortcutSection>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

function ShortcutSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-medium text-muted-foreground mb-2">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-foreground">{label}</span>
      <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono text-muted-foreground">
        {keys}
      </kbd>
    </div>
  );
}
