import { useState, useCallback, useEffect } from "react";
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
import { IS_MAC } from "./yoopta-constants";

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type YooptaEditorHeaderProps = {
  editor: YooEditor;
  title?: string;
  pageWidth?: PageWidth;
  showToc?: boolean;
  saveStatus?: SaveStatus;
  onPageWidthChange?: (width: PageWidth) => void;
  onShowTocChange?: (show: boolean) => void;
};

export const YooptaEditorHeader = ({ editor, title, pageWidth = "default", showToc = false, saveStatus = "idle", onPageWidthChange, onShowTocChange }: YooptaEditorHeaderProps) => {
  const [copied, setCopied] = useState(false);
  const [isLocked, setIsLocked] = useState(editor.readOnly);
  const [, forceUpdate] = useState(0);

  // Subscribe to editor changes to keep undo/redo state fresh
  useEffect(() => {
    const onChange = () => forceUpdate((n) => n + 1);
    editor.on("change", onChange);
    return () => {
      editor.off("change", onChange);
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
    <div role="toolbar" aria-label="Editor actions" className="flex items-center justify-end gap-1">
      {saveStatus !== "idle" && (
        <span
          aria-live="polite"
          className={`text-xs mr-auto ${saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground/50'}`}
        >
          {saveStatus === 'pending' && 'Editing...'}
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Save failed'}
        </span>
      )}
      <button
        type="button"
        onClick={handleUndo}
        disabled={!canUndo}
        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title={`Undo (${isMac ? '\u2318' : 'Ctrl'}+Z)`}
        aria-label={`Undo (${isMac ? '\u2318' : 'Ctrl'}+Z)`}
      >
        <Undo2Icon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleRedo}
        disabled={!canRedo}
        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title={`Redo (${isMac ? '\u2318' : 'Ctrl'}+Shift+Z)`}
        aria-label={`Redo (${isMac ? '\u2318' : 'Ctrl'}+Shift+Z)`}
      >
        <Redo2Icon className="h-4 w-4" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
            title="More options"
            aria-label="More options"
          >
            <MoreHorizontalIcon className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={handleExportMarkdown}>
            <FileTextIcon className="mr-2 h-4 w-4" />
            Export Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleExportHTML}>
            <CodeIcon className="mr-2 h-4 w-4" />
            Export HTML
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleCopyMarkdown}>
            {copied ? (
              <CheckIcon className="mr-2 h-4 w-4 text-green-500" />
            ) : (
              <CopyIcon className="mr-2 h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy as Markdown"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handlePrint}>
            <PrinterIcon className="mr-2 h-4 w-4" />
            Print
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleToggleLock}>
            {isLocked ? (
              <UnlockIcon className="mr-2 h-4 w-4" />
            ) : (
              <LockIcon className="mr-2 h-4 w-4" />
            )}
            {isLocked ? "Unlock editing" : "Lock editing"}
          </DropdownMenuItem>
          {onPageWidthChange && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onPageWidthChange("default")}>
                <AlignLeftIcon className="mr-2 h-4 w-4" />
                <span className="flex items-center justify-between flex-1">
                  Default width
                  {pageWidth === "default" && <CheckIcon className="ml-2 h-3.5 w-3.5" />}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPageWidthChange("wide")}>
                <AlignCenterIcon className="mr-2 h-4 w-4" />
                <span className="flex items-center justify-between flex-1">
                  Wide layout
                  {pageWidth === "wide" && <CheckIcon className="ml-2 h-3.5 w-3.5" />}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPageWidthChange("full")}>
                <MaximizeIcon className="mr-2 h-4 w-4" />
                <span className="flex items-center justify-between flex-1">
                  Full width
                  {pageWidth === "full" && <CheckIcon className="ml-2 h-3.5 w-3.5" />}
                </span>
              </DropdownMenuItem>
            </>
          )}
          {onShowTocChange && (
            <DropdownMenuItem onSelect={() => onShowTocChange(!showToc)}>
              <ListTreeIcon className="mr-2 h-4 w-4" />
              {showToc ? "Hide table of contents" : "Show table of contents"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
          >
            <KeyboardIcon className="h-4 w-4" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <ShortcutSection title="Text formatting">
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+B`} label="Bold" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+I`} label="Italic" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+U`} label="Underline" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+E`} label="Inline code" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+S`} label="Strikethrough" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+H`} label="Highlight" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+K`} label="Insert link" />
            </ShortcutSection>
            <ShortcutSection title="Block types">
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+0`} label="Text" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+1`} label="Heading 1" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+2`} label="Heading 2" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+3`} label="Heading 3" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+4`} label="To-do list" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+5`} label="Bulleted list" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+6`} label="Numbered list" />
            </ShortcutSection>
            <ShortcutSection title="Block actions">
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+/`} label="Open slash menu" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Enter`} label="Toggle checkbox" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+↑`} label="Move block up" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+↓`} label="Move block down" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+D`} label="Duplicate block" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+⌫`} label="Delete block" />
              <Shortcut keys="Tab" label="Indent" />
              <Shortcut keys="Shift+Tab" label="Outdent" />
            </ShortcutSection>
            <ShortcutSection title="Markdown shortcuts">
              <Shortcut keys="# " label="Heading 1" />
              <Shortcut keys="## " label="Heading 2" />
              <Shortcut keys="### " label="Heading 3" />
              <Shortcut keys="- " label="Bulleted list" />
              <Shortcut keys="1. " label="Numbered list" />
              <Shortcut keys="[] " label="To-do list" />
              <Shortcut keys="> " label="Quote" />
              <Shortcut keys="--- " label="Divider" />
              <Shortcut keys="```" label="Code block" />
            </ShortcutSection>
            <ShortcutSection title="General">
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+S`} label="Save" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Z`} label="Undo" />
              <Shortcut keys={`${isMac ? '⌘' : 'Ctrl'}+Shift+Z`} label="Redo" />
            </ShortcutSection>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

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
