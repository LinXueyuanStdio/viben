// packages/core/src/pet/paths.ts
import { join } from "node:path";
import { getStateDir } from "../config/paths";

/** Pet 根目录 ~/.viben/pets/ */
export function getPetsDir(): string {
  return join(getStateDir(), "pets");
}

/** Pet 配置文件路径 ~/.viben/pets/config.yaml */
export function getPetConfigPath(): string {
  return join(getPetsDir(), "config.yaml");
}

/** Pet 来源配置文件路径 ~/.viben/pets/sources.yaml */
export function getPetSourcesPath(): string {
  return join(getPetsDir(), "sources.yaml");
}

/** 获取特定 Pet 的目录 ~/.viben/pets/<id>/ */
export function getPetDir(petId: string): string {
  return join(getPetsDir(), petId);
}

/** 获取 Pet 的 pet.json 路径 */
export function getPetMetadataPath(petId: string): string {
  return join(getPetDir(petId), "pet.json");
}

/** 安全限制常量 */
export const PET_LIMITS = {
  MAX_ZIP_SIZE: 50 * 1024 * 1024,        // 50MB
  MAX_EXTRACTED_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_FILE_SIZE: 10 * 1024 * 1024,       // 10MB
  DOWNLOAD_TIMEOUT: 30000,                // 30s
  ALLOWED_EXTENSIONS: [".json", ".webp", ".png", ".gif"],
} as const;
