// apps/desktop/src/pages/settings/pet-section/import-dialog.tsx
import { useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { importPetZip } from "./api";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleImport = async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      await importPetZip(path);
      onImported();
      onClose();
      setPath("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">导入 Pet</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Zip 文件路径</label>
            <input
              type="text"
              placeholder="/path/to/pet.zip"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              className="rounded-md border px-4 py-2 text-sm"
              onClick={onClose}
            >
              取消
            </button>
            <button
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              disabled={!path || loading}
              onClick={handleImport}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              导入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
