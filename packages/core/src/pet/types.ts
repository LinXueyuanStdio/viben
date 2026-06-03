// packages/core/src/pet/types.ts

/** Pet 元数据（与 pet.json 对应） */
export interface PetMetadata {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
  author?: string;
  tags?: string[];
  source?: string;
  sourceUrl?: string;
}

/** Pet 完整信息（含本地路径） */
export interface Pet {
  id: string;
  metadata: PetMetadata;
  localPath: string;
  spritesheetUrl: string;
  isBuiltin: boolean;
  installedAt?: string;
}

/** Pet 偏好设置 */
export interface PetPreferences {
  size: number;
  position: { right: number; bottom: number };
}

/** 全局配置 */
export interface PetConfig {
  current: string | null;
  enabled: boolean;
  preferences: PetPreferences;
}

/** 默认配置 */
export const DEFAULT_PET_CONFIG: PetConfig = {
  current: null,
  enabled: true,
  preferences: {
    size: 96,
    position: { right: 24, bottom: 24 },
  },
};
