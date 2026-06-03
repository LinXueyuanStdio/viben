# Pet Desktop UI 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 实现 Desktop 应用的 Pet 设置页面 (`apps/desktop/src/pages/settings/pet-section/`)

**Spec:** `docs/superpowers/specs/2026-06-03-pet-management-design.md`

**Depends on:** `2026-06-03-pet-02-gateway-cli.md` (必须先完成 Gateway 路由)

**Architecture:** 使用 React 组件 + Gateway API 调用，遵循 Desktop 应用现有的设置页面模式。

**Tech Stack:** React, TypeScript, lucide-react (图标), @viben/pet (Pet 组件), TailwindCSS

---

## 文件结构

```
apps/desktop/src/pages/settings/pet-section/
├── index.tsx                 # 主组件导出
├── pet-selector.tsx          # Pet 选择器（卡片网格）
├── pet-preview.tsx           # Pet 动画预览
├── community-browser.tsx     # 社区 Pet 浏览 & 安装
├── source-manager.tsx        # 来源管理
├── import-dialog.tsx         # 本地导入对话框
└── preferences-form.tsx      # 偏好设置（大小、位置）
```

---

## Task 1: 创建 API 调用工具函数

**Files:**
- Create: `apps/desktop/src/pages/settings/pet-section/api.ts`

- [ ] **Step 1: 创建 API 工具文件**

```typescript
// apps/desktop/src/pages/settings/pet-section/api.ts
const API_BASE = "http://127.0.0.1:18790";

export interface PetResponse {
  id: string;
  metadata: {
    id: string;
    display_name: string;
    description: string;
    spritesheet_path: string;
    author?: string;
    tags?: string[];
  };
  local_path: string;
  spritesheet_url: string;
  is_builtin: boolean;
}

export interface CommunityPetResponse {
  id: string;
  display_name: string;
  description: string;
  author?: string;
  tags?: string[];
  thumbnail_url?: string;
  download_url: string;
  source: string;
}

export interface PetConfigResponse {
  current: string | null;
  enabled: boolean;
  preferences: {
    size: number;
    position: { right: number; bottom: number };
  };
}

export interface PetSourceResponse {
  name: string;
  url: string;
  enabled: boolean;
  builtin: boolean;
}

export async function fetchPetList(): Promise<{ pets: PetResponse[]; current: string | null }> {
  const res = await fetch(`${API_BASE}/api/pet/list`);
  if (!res.ok) throw new Error("Failed to fetch pets");
  return res.json();
}

export async function fetchPetConfig(): Promise<{ config: PetConfigResponse }> {
  const res = await fetch(`${API_BASE}/api/pet/config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

export async function updatePetConfig(config: Partial<PetConfigResponse>): Promise<{ config: PetConfigResponse }> {
  const res = await fetch(`${API_BASE}/api/pet/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to update config");
  return res.json();
}

export async function setCurrentPet(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/pet/set/${encodeURIComponent(id)}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to set pet");
}

export async function removePet(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/pet/remove/${encodeURIComponent(id)}`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to remove pet");
  }
}

export async function fetchCommunityPets(source?: string): Promise<{ pets: CommunityPetResponse[] }> {
  const url = source
    ? `${API_BASE}/api/pet/community?source=${encodeURIComponent(source)}`
    : `${API_BASE}/api/pet/community`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch community pets");
  return res.json();
}

export async function installPet(petId: string, source: string): Promise<{ pet: PetResponse }> {
  const res = await fetch(`${API_BASE}/api/pet/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pet_id: petId, source }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to install pet");
  }
  return res.json();
}

export async function fetchSources(): Promise<{ sources: PetSourceResponse[] }> {
  const res = await fetch(`${API_BASE}/api/pet/sources/list`);
  if (!res.ok) throw new Error("Failed to fetch sources");
  return res.json();
}

export async function addSource(name: string, url: string): Promise<{ source: PetSourceResponse }> {
  const res = await fetch(`${API_BASE}/api/pet/sources/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, url }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to add source");
  }
  return res.json();
}

export async function removeSource(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/pet/sources/remove/${encodeURIComponent(name)}`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to remove source");
  }
}

export async function importPetZip(path: string): Promise<{ pet: PetResponse }> {
  const res = await fetch(`${API_BASE}/api/pet/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to import pet");
  }
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/pages/settings/pet-section/api.ts
git commit -m "feat(pet-ui): add API utility functions"
```

---

## Task 2: 创建 Pet 预览组件

**Files:**
- Create: `apps/desktop/src/pages/settings/pet-section/pet-preview.tsx`

- [ ] **Step 1: 创建预览组件**

```tsx
// apps/desktop/src/pages/settings/pet-section/pet-preview.tsx
import { PetSprite, STANDARD_ANIMATIONS } from "@viben/pet";
import type { PetResponse } from "./api";

interface PetPreviewProps {
  pet: PetResponse | null;
  size?: number;
}

export function PetPreview({ pet, size = 96 }: PetPreviewProps) {
  if (!pet) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-muted"
        style={{ width: size, height: size }}
      >
        <span className="text-muted-foreground text-sm">No Pet</span>
      </div>
    );
  }

  const petConfig = {
    id: pet.id,
    name: pet.metadata.display_name,
    description: pet.metadata.description,
    accent: "#f5a623",
    greeting: "",
    spritesheet: pet.spritesheet_url,
    atlas: {
      cols: 8,
      rows: 9,
      cellWidth: 192,
      cellHeight: 208,
      animations: STANDARD_ANIMATIONS,
    },
  };

  return <PetSprite pet={petConfig} rowId="idle" size={size} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/pages/settings/pet-section/pet-preview.tsx
git commit -m "feat(pet-ui): add PetPreview component"
```

---

## Task 3: 创建 Pet 选择器组件

**Files:**
- Create: `apps/desktop/src/pages/settings/pet-section/pet-selector.tsx`

- [ ] **Step 1: 创建选择器组件**

```tsx
// apps/desktop/src/pages/settings/pet-section/pet-selector.tsx
import { Check, Trash2 } from "lucide-react";
import { PetPreview } from "./pet-preview";
import type { PetResponse } from "./api";

interface PetSelectorProps {
  pets: PetResponse[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function PetSelector({ pets, currentId, onSelect, onRemove }: PetSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
      {pets.map((pet) => (
        <div
          key={pet.id}
          className={`group relative cursor-pointer rounded-lg border-2 p-2 transition-colors ${
            currentId === pet.id
              ? "border-primary bg-primary/10"
              : "border-transparent hover:border-muted-foreground/30"
          }`}
          onClick={() => onSelect(pet.id)}
        >
          <div className="flex flex-col items-center gap-1">
            <PetPreview pet={pet} size={48} />
            <span className="text-xs truncate w-full text-center">{pet.metadata.display_name}</span>
          </div>

          {currentId === pet.id && (
            <div className="absolute -top-1 -right-1 rounded-full bg-primary p-0.5">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}

          {!pet.is_builtin && (
            <button
              className="absolute top-1 right-1 hidden rounded p-1 hover:bg-destructive/20 group-hover:block"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(pet.id);
              }}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/pages/settings/pet-section/pet-selector.tsx
git commit -m "feat(pet-ui): add PetSelector component"
```

---

## Task 4: 创建偏好设置表单

**Files:**
- Create: `apps/desktop/src/pages/settings/pet-section/preferences-form.tsx`

- [ ] **Step 1: 创建表单组件**

```tsx
// apps/desktop/src/pages/settings/pet-section/preferences-form.tsx
import type { PetConfigResponse } from "./api";

interface PreferencesFormProps {
  config: PetConfigResponse;
  onChange: (updates: Partial<PetConfigResponse>) => void;
}

export function PreferencesForm({ config, onChange }: PreferencesFormProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">大小</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={48}
            max={192}
            value={config.preferences.size}
            onChange={(e) =>
              onChange({
                preferences: { ...config.preferences, size: Number(e.target.value) },
              })
            }
            className="w-32"
          />
          <span className="text-sm text-muted-foreground w-12">{config.preferences.size}px</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/pages/settings/pet-section/preferences-form.tsx
git commit -m "feat(pet-ui): add PreferencesForm component"
```

---

## Task 5: 创建社区浏览器组件

**Files:**
- Create: `apps/desktop/src/pages/settings/pet-section/community-browser.tsx`

- [ ] **Step 1: 创建社区浏览器**

```tsx
// apps/desktop/src/pages/settings/pet-section/community-browser.tsx
import { useState, useEffect } from "react";
import { Download, Search, Loader2 } from "lucide-react";
import { fetchCommunityPets, installPet, fetchSources } from "./api";
import type { CommunityPetResponse, PetSourceResponse } from "./api";

interface CommunityBrowserProps {
  onInstalled: () => void;
}

export function CommunityBrowser({ onInstalled }: CommunityBrowserProps) {
  const [pets, setPets] = useState<CommunityPetResponse[]>([]);
  const [sources, setSources] = useState<PetSourceResponse[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSources().then((data) => setSources(data.sources)).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchCommunityPets(selectedSource || undefined)
      .then((data) => setPets(data.pets))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedSource]);

  const filteredPets = searchQuery
    ? pets.filter(
        (p) =>
          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.display_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pets;

  const handleInstall = async (pet: CommunityPetResponse) => {
    setInstalling(pet.id);
    try {
      await installPet(pet.id, pet.source);
      onInstalled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Install failed");
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm"
          />
        </div>
        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">全部来源</option>
          {sources.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {filteredPets.map((pet) => (
            <div
              key={`${pet.source}-${pet.id}`}
              className="rounded-lg border p-2 flex flex-col items-center gap-1"
            >
              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-lg">
                {pet.display_name.charAt(0)}
              </div>
              <span className="text-xs truncate w-full text-center">{pet.display_name}</span>
              <button
                className="mt-1 flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
                disabled={installing === pet.id}
                onClick={() => handleInstall(pet)}
              >
                {installing === pet.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                安装
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/pages/settings/pet-section/community-browser.tsx
git commit -m "feat(pet-ui): add CommunityBrowser component"
```

---

## Task 6: 创建来源管理组件

**Files:**
- Create: `apps/desktop/src/pages/settings/pet-section/source-manager.tsx`

- [ ] **Step 1: 创建来源管理器**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/pages/settings/pet-section/source-manager.tsx
git commit -m "feat(pet-ui): add SourceManager component"
```

---

## Task 7: 创建导入对话框组件

**Files:**
- Create: `apps/desktop/src/pages/settings/pet-section/import-dialog.tsx`

- [ ] **Step 1: 创建导入对话框**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/pages/settings/pet-section/import-dialog.tsx
git commit -m "feat(pet-ui): add ImportDialog component"
```

---

## Task 8: 创建主设置页面组件

**Files:**
- Create: `apps/desktop/src/pages/settings/pet-section/index.tsx`

- [ ] **Step 1: 创建主组件**

```tsx
// apps/desktop/src/pages/settings/pet-section/index.tsx
import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { PetPreview } from "./pet-preview";
import { PetSelector } from "./pet-selector";
import { PreferencesForm } from "./preferences-form";
import { CommunityBrowser } from "./community-browser";
import { SourceManager } from "./source-manager";
import { ImportDialog } from "./import-dialog";
import {
  fetchPetList,
  fetchPetConfig,
  updatePetConfig,
  setCurrentPet,
  removePet,
} from "./api";
import type { PetResponse, PetConfigResponse } from "./api";

export function PetSection() {
  const [pets, setPets] = useState<PetResponse[]>([]);
  const [config, setConfig] = useState<PetConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [petData, configData] = await Promise.all([fetchPetList(), fetchPetConfig()]);
      setPets(petData.pets);
      setConfig(configData.config);
    } catch (e) {
      console.error("Failed to load pet data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectPet = async (id: string) => {
    try {
      await setCurrentPet(id);
      setConfig((c) => (c ? { ...c, current: id } : c));
    } catch (e) {
      console.error("Failed to set pet:", e);
    }
  };

  const handleRemovePet = async (id: string) => {
    if (!confirm(`确定要删除 Pet "${id}" 吗？此操作不可撤销。`)) return;
    try {
      await removePet(id);
      loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove pet");
    }
  };

  const handleConfigChange = async (updates: Partial<PetConfigResponse>) => {
    if (!config) return;
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    try {
      await updatePetConfig(updates);
    } catch (e) {
      console.error("Failed to update config:", e);
    }
  };

  const currentPet = pets.find((p) => p.id === config?.current) ?? null;

  if (loading || !config) {
    return <div className="p-4 text-center text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6 p-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Pet 设置</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => handleConfigChange({ enabled: e.target.checked })}
          />
          <span className="text-sm">启用 Pet</span>
        </label>
      </div>

      {/* 当前 Pet 预览 */}
      <div className="flex gap-4">
        <PetPreview pet={currentPet} size={config.preferences.size} />
        <div className="flex-1">
          <div className="text-lg font-medium">
            {currentPet?.metadata.display_name ?? "未选择"}
          </div>
          <div className="text-sm text-muted-foreground">
            {currentPet?.metadata.description ?? "请选择一个 Pet"}
          </div>
          {config && <PreferencesForm config={config} onChange={handleConfigChange} />}
        </div>
      </div>

      {/* 已安装 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium">已安装</h3>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowImport(true)}
            >
              <Upload className="h-4 w-4" />
              导入
            </button>
            <button
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              onClick={loadData}
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
          </div>
        </div>
        <PetSelector
          pets={pets}
          currentId={config.current}
          onSelect={handleSelectPet}
          onRemove={handleRemovePet}
        />
      </div>

      {/* 社区 Pet */}
      <div>
        <h3 className="text-lg font-medium mb-2">社区 Pet</h3>
        <CommunityBrowser onInstalled={loadData} />
      </div>

      {/* 来源管理 */}
      <SourceManager />

      {/* 导入对话框 */}
      <ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={loadData}
      />
    </div>
  );
}

export default PetSection;
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/pages/settings/pet-section/index.tsx
git commit -m "feat(pet-ui): add main PetSection component"
```

---

## Task 9: 集成到设置页面

**Files:**
- Modify: `apps/desktop/src/pages/settings/index.tsx`

- [ ] **Step 1: 在设置页面中添加 Pet 部分**

找到设置页面的 tabs 或 sections 配置，添加 Pet 部分：

```tsx
import { PetSection } from "./pet-section";

// 在合适的位置添加 PetSection 组件渲染
// 具体位置取决于现有的设置页面结构
```

- [ ] **Step 2: 验证 Desktop 应用构建**

Run: `cd /root/viben/apps/desktop && pnpm build`
Expected: 构建成功

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/pages/settings/index.tsx
git commit -m "feat(pet-ui): integrate PetSection into settings page"
```
