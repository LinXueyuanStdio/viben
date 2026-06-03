// apps/desktop/src/pages/settings/pet-section/source-manager.tsx
import { useState, useEffect } from "react";
import { Plus, Trash2, Globe } from "lucide-react";
import { fetchSources, addSource, removeSource } from "./api";
import type { PetSourceResponse } from "./api";

export function SourceManager() {
  const [sources, setSources] = useState<PetSourceResponse[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadSources = async () => {
    try {
      const data = await fetchSources();
      setSources(data.sources);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sources");
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleAdd = async () => {
    if (!newName || !newUrl) return;
    setError(null);
    try {
      await addSource(newName, newUrl);
      setNewName("");
      setNewUrl("");
      setShowAdd(false);
      loadSources();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add source");
    }
  };

  const handleRemove = async (name: string) => {
    if (!confirm(`确定要删除来源 "${name}" 吗？`)) return;
    try {
      await removeSource(name);
      loadSources();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove source");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">来源管理</h4>
        <button
          className="flex items-center gap-1 text-sm text-primary hover:underline"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="h-4 w-4" />
          添加来源
        </button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {showAdd && (
        <div className="flex gap-2 rounded-lg border p-2">
          <input
            placeholder="名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded border bg-background px-2 py-1 text-sm"
          />
          <input
            placeholder="URL (https://...)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-[2] rounded border bg-background px-2 py-1 text-sm"
          />
          <button
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
            onClick={handleAdd}
          >
            添加
          </button>
        </div>
      )}

      <div className="space-y-1">
        {sources.map((source) => (
          <div
            key={source.name}
            className="flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{source.name}</span>
              {source.builtin && (
                <span className="text-xs text-muted-foreground">(内置)</span>
              )}
            </div>
            {!source.builtin && (
              <button
                className="text-destructive hover:text-destructive/80"
                onClick={() => handleRemove(source.name)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
