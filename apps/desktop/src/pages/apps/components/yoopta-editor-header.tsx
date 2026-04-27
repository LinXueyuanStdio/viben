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

type YooptaEditorHeaderProps = {
  editor: YooEditor;
  title?: string;
};

export const YooptaEditorHeader = ({ editor, title }: YooptaEditorHeaderProps) => {
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
      a.click();
      URL.revokeObjectURL(url);
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
      a.click();
      URL.revokeObjectURL(url);
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

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
  const canUndo = editor.historyStack.undos.length > 0;
  const canRedo = editor.historyStack.redos.length > 0;

  return (
    <div role="toolbar" aria-label="Editor actions" className="yoopta-editor-header flex items-center justify-end gap-1 px-4 py-2">
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
          <DropdownMenuItem onClick={handleExportMarkdown}>
            <FileTextIcon className="mr-2 h-4 w-4" />
            Export Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportHTML}>
            <CodeIcon className="mr-2 h-4 w-4" />
            Export HTML
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyMarkdown}>
            {copied ? (
              <CheckIcon className="mr-2 h-4 w-4 text-green-500" />
            ) : (
              <CopyIcon className="mr-2 h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy as Markdown"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handlePrint}>
            <PrinterIcon className="mr-2 h-4 w-4" />
            Print
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleToggleLock}>
            {isLocked ? (
              <UnlockIcon className="mr-2 h-4 w-4" />
            ) : (
              <LockIcon className="mr-2 h-4 w-4" />
            )}
            {isLocked ? "Unlock editing" : "Lock editing"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
