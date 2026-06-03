// packages/core/src/pet/ops/storage.ts
import { existsSync } from "node:fs";
import { readdir, rm, stat, lstat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readYaml, writeYaml, readJson, ensureDir } from "../../config/yaml";
import type { Pet, PetConfig, PetMetadata } from "../types";
import { DEFAULT_PET_CONFIG } from "../types";
import { getPetsDir, getPetConfigPath, getPetDir, getPetMetadataPath } from "../paths";
import { PetError } from "./types";

/** 读取 Pet 配置 */
export async function readPetConfig(): Promise<PetConfig> {
  const config = await readYaml<Partial<PetConfig>>(getPetConfigPath());
  return {
    ...DEFAULT_PET_CONFIG,
    ...config,
    preferences: {
      ...DEFAULT_PET_CONFIG.preferences,
      ...config?.preferences,
    },
  };
}

/** 写入 Pet 配置 */
export async function writePetConfig(config: PetConfig): Promise<void> {
  await ensureDir(getPetsDir());
  await writeYaml(getPetConfigPath(), config);
}

/** 更新 Pet 配置（合并） */
export async function updatePetConfig(updates: Partial<PetConfig>): Promise<PetConfig> {
  const current = await readPetConfig();
  const updated: PetConfig = {
    ...current,
    ...updates,
    preferences: updates.preferences
      ? { ...current.preferences, ...updates.preferences }
      : current.preferences,
  };
  await writePetConfig(updated);
  return updated;
}

/** 验证路径安全（防止路径穿越） */
export function isPathSafe(basePath: string, targetPath: string): boolean {
  const resolvedBase = resolve(basePath);
  const resolvedTarget = resolve(basePath, targetPath);
  return resolvedTarget.startsWith(resolvedBase + "/") || resolvedTarget === resolvedBase;
}

/** 读取 Pet 元数据 */
export async function readPetMetadata(petId: string): Promise<PetMetadata | null> {
  const metadataPath = getPetMetadataPath(petId);
  if (!existsSync(metadataPath)) {
    return null;
  }
  const metadata = await readJson<PetMetadata>(metadataPath);
  return metadata ?? null;
}

/** 列出已安装的 Pet（用户目录） */
export async function listInstalledPets(): Promise<Pet[]> {
  const petsDir = getPetsDir();
  if (!existsSync(petsDir)) {
    return [];
  }

  const entries = await readdir(petsDir, { withFileTypes: true });
  const pets: Pet[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    const metadata = await readPetMetadata(entry.name);
    if (!metadata) continue;

    const petDir = getPetDir(entry.name);
    const stats = await stat(petDir);

    pets.push({
      id: entry.name,
      metadata,
      localPath: petDir,
      spritesheetUrl: join(petDir, metadata.spritesheetPath),
      isBuiltin: false,
      installedAt: stats.birthtime.toISOString(),
    });
  }

  return pets;
}

/** 删除已安装的 Pet */
export async function removeInstalledPet(petId: string): Promise<void> {
  const petDir = getPetDir(petId);

  if (!existsSync(petDir)) {
    throw new PetError(`Pet "${petId}" not found`, "PET_NOT_FOUND");
  }

  // 检查是否为 symlink（安全检查）
  const stats = await lstat(petDir);
  if (stats.isSymbolicLink()) {
    throw new PetError("Cannot remove symlinked pet", "INVALID_PET_FORMAT");
  }

  await rm(petDir, { recursive: true, force: true });
}
