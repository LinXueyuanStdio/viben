// packages/core/src/pet/ops/types.ts

/** 来源定义 */
export interface PetSource {
  name: string;
  url: string;
  enabled: boolean;
  builtin: boolean;
}

/** 来源配置文件结构 */
export interface PetSourcesFile {
  sources: PetSource[];
}

/** 社区 Pet（远程列表项） */
export interface CommunityPet {
  id: string;
  displayName: string;
  description: string;
  author?: string;
  tags?: string[];
  thumbnailUrl?: string;
  downloadUrl: string;
  source: string;
}

/** 默认内置来源 */
export const DEFAULT_SOURCES: PetSource[] = [
  {
    name: "codex-pet-share",
    url: "https://ihzwckyzfcuktrljwpha.supabase.co/functions/v1/petshare",
    enabled: true,
    builtin: true,
  },
  {
    name: "j20-hatchery",
    url: "https://j20.nz/hatchery/api/pets.json",
    enabled: true,
    builtin: true,
  },
];

/** 错误码 */
export type PetErrorCode =
  | "PET_NOT_FOUND"
  | "PET_IS_BUILTIN"
  | "SOURCE_NOT_FOUND"
  | "SOURCE_IS_BUILTIN"
  | "SOURCE_EXISTS"
  | "INVALID_URL"
  | "DOWNLOAD_FAILED"
  | "INVALID_ZIP"
  | "INVALID_PET_FORMAT"
  | "FILE_TOO_LARGE";

/** Pet 操作错误 */
export class PetError extends Error {
  constructor(
    message: string,
    public code: PetErrorCode,
  ) {
    super(message);
    this.name = "PetError";
  }
}
