// apps/desktop/src/pages/settings/pet-section/index.tsx
import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
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
import { loadAllBuiltinPets } from "@/lib/pet-loader";

async function notifyPetWindow() {
  try {
    const petWindow = await WebviewWindow.getByLabel("pet-window");
    if (petWindow) {
      // Reload the pet window to pick up new config
      await petWindow.emit("pet-config-changed");
    }
  } catch {
    // Ignore errors
  }
}

export function PetSection() {
  const [pets, setPets] = useState<PetResponse[]>([]);
  const [config, setConfig] = useState<PetConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [petData, configData, builtinPets] = await Promise.all([
        fetchPetList(),
        fetchPetConfig(),
        loadAllBuiltinPets(),
      ]);
      // 合并内置 Pet 和已安装 Pet（去重）
      const installedIds = new Set(petData.pets.map((p) => p.id));
      const builtinPetsResponse: PetResponse[] = builtinPets
        .filter((p) => !installedIds.has(p.id))
        .map((p) => ({
          id: p.id,
          metadata: {
            id: p.id,
            display_name: p.display_name,
            description: p.description,
            spritesheet_path: p.spritesheet_url,
            author: p.author,
            tags: [],
            source: "builtin",
            source_url: "",
          },
          local_path: "",
          spritesheet_url: p.spritesheet_url,
          is_builtin: true,
        }));
      setPets([...builtinPetsResponse, ...petData.pets]);
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
      // Notify pet window about the change
      await notifyPetWindow();
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
      // Notify pet window about config changes
      await notifyPetWindow();
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
