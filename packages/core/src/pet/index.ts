// packages/core/src/pet/index.ts
import type { Pet, PetConfig } from "./types";
import type { CommunityPet, PetSource } from "./ops/types";
import {
  readPetConfig,
  updatePetConfig,
  listInstalledPets,
  readPetMetadata,
  removeInstalledPet,
} from "./ops/storage";
import {
  readSources,
  addSource as addSourceOp,
  removeSource as removeSourceOp,
  setSourceEnabled as setSourceEnabledOp,
} from "./ops/sources";
import { listCommunityPets as listCommunityPetsOp, installPet as installPetOp } from "./ops/sync";
import { searchCommunityPets as searchCommunityPetsOp, previewCommunityPet } from "./ops/search";
import { importPet as importPetOp, exportPet as exportPetOp } from "./ops/import-export";
import { getPetDir } from "./paths";
import { join } from "node:path";

// Re-export types
export * from "./types";
export * from "./ops/types";
export * from "./paths";

/** Pet 管理器 - 管理已安装的 Pet（内置 Pet 由前端处理） */
export class PetManager {
  // ========== 配置管理 ==========

  async getConfig(): Promise<PetConfig> {
    return readPetConfig();
  }

  async setConfig(updates: Partial<PetConfig>): Promise<PetConfig> {
    return updatePetConfig(updates);
  }

  async setCurrent(petId: string | null): Promise<void> {
    await updatePetConfig({ current: petId });
  }

  // ========== Pet CRUD ==========

  /** 列出已安装的 Pet（不包括内置 Pet，内置 Pet 由前端从 public/pets 加载） */
  async listPets(): Promise<Pet[]> {
    return listInstalledPets();
  }

  async getPet(id: string): Promise<Pet | null> {
    const metadata = await readPetMetadata(id);
    if (!metadata) return null;

    const petDir = getPetDir(id);
    return {
      id,
      metadata,
      localPath: petDir,
      spritesheetUrl: join(petDir, metadata.spritesheetPath),
      isBuiltin: false,
    };
  }

  async removePet(id: string): Promise<void> {
    await removeInstalledPet(id);

    // 如果删除的是当前 Pet，清空选择
    const config = await this.getConfig();
    if (config.current === id) {
      await this.setCurrent(null);
    }
  }

  // ========== 社区 ==========

  async listCommunityPets(sourceFilter?: string): Promise<CommunityPet[]> {
    return listCommunityPetsOp(sourceFilter);
  }

  async searchCommunityPets(query: string): Promise<CommunityPet[]> {
    return searchCommunityPetsOp(query);
  }

  async previewPet(petId: string, source?: string): Promise<CommunityPet | null> {
    return previewCommunityPet(petId, source);
  }

  async installPet(petId: string, source: string): Promise<Pet> {
    return installPetOp(petId, source);
  }

  // ========== 导入导出 ==========

  async importPet(zipPath: string): Promise<Pet> {
    return importPetOp(zipPath);
  }

  async exportPet(petId: string, outPath: string): Promise<string> {
    return exportPetOp(petId, outPath);
  }

  // ========== 来源管理 ==========

  async listSources(): Promise<PetSource[]> {
    return readSources();
  }

  async addSource(name: string, url: string): Promise<PetSource> {
    return addSourceOp(name, url);
  }

  async removeSource(name: string): Promise<void> {
    return removeSourceOp(name);
  }

  async setSourceEnabled(name: string, enabled: boolean): Promise<void> {
    return setSourceEnabledOp(name, enabled);
  }
}

/** 单例实例 */
export const petManager = new PetManager();
