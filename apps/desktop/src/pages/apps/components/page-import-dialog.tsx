import { useRef, useState } from "react";
import { FileCode2, FileText, Globe2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type PageImportKind = "url" | "markdown_file" | "html_file";

export interface PageImportDialogProps {
  open: boolean;
  isImporting?: boolean;
  onOpenChange: (open: boolean) => void;
  onImportUrl?: (url: string) => void;
  onImportFile?: (kind: Extract<PageImportKind, "markdown_file" | "html_file">, file: File) => void;
}

export function PageImportDialog({
  open,
  isImporting = false,
  onOpenChange,
  onImportUrl,
  onImportFile,
}: PageImportDialogProps) {
  const [url, setUrl] = useState("");
  const markdownInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);

  const handleUrlImport = () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    onImportUrl?.(trimmedUrl);
  };

  const handleFileChange = (
    kind: Extract<PageImportKind, "markdown_file" | "html_file">,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    onImportFile?.(kind, file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>选择导入方式</DialogTitle>
          <DialogDescription>从网络连接或本地文件导入当前页面。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <section className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Globe2 className="size-4 text-muted-foreground" />
              <span>从网络连接导入</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/article"
                disabled={isImporting}
              />
              <Button
                type="button"
                onClick={handleUrlImport}
                disabled={isImporting || !url.trim()}
              >
                {isImporting && <Loader2 className="size-4 animate-spin" />}
                开始导入
              </Button>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-border p-4">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => markdownInputRef.current?.click()}
              disabled={isImporting || !onImportFile}
            >
              <FileText className="size-4 text-muted-foreground" />
              <span>导入 Markdown 文件</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => htmlInputRef.current?.click()}
              disabled={isImporting || !onImportFile}
            >
              <FileCode2 className="size-4 text-muted-foreground" />
              <span>导入 HTML 文件</span>
            </button>
          </section>

          <input
            ref={markdownInputRef}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            className="hidden"
            onChange={(event) => handleFileChange("markdown_file", event)}
          />
          <input
            ref={htmlInputRef}
            type="file"
            accept=".html,.htm,text/html"
            className="hidden"
            onChange={(event) => handleFileChange("html_file", event)}
          />

          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
