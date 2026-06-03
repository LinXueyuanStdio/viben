import type { PetConfig } from "@viben/pet";
import { STANDARD_ANIMATIONS, PET_DEFAULTS } from "@viben/pet";
import { readDir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { resolveResource } from "@tauri-apps/api/path";

interface RawPetJson {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
  author?: string;
}

const DEFAULT_ACCENTS: Record<string, string> = {
  tux: "#f5a623",
  clippit: "#4a90d9",
  dario: "#e74c3c",
};

const DEFAULT_GREETINGS: Record<string, string> = {
  tux: "Hey! Ready to write some code?",
  clippit: "It looks like you're coding. Need help?",
  dario: "Let's build something amazing!",
};

export async function loadPetFromPublic(petId: string): Promise<PetConfig> {
  const configUrl = `/pets/${petId}/pet.json`;

  const response = await fetch(configUrl);
  if (!response.ok) {
    throw new Error(`Failed to load pet "${petId}": ${response.status}`);
  }

  const raw = (await response.json()) as RawPetJson;
  const spritesheetUrl = `/pets/${petId}/${raw.spritesheetPath}`;

  return {
    id: raw.id,
    name: raw.displayName,
    description: raw.description,
    accent: DEFAULT_ACCENTS[raw.id] ?? "#6366f1",
    greeting: DEFAULT_GREETINGS[raw.id] ?? `Hi! I'm ${raw.displayName}.`,
    spritesheet: spritesheetUrl,
    atlas: {
      cols: 8,
      rows: 9,
      cellWidth: 192,
      cellHeight: 208,
      animations: STANDARD_ANIMATIONS,
    },
    ambient: PET_DEFAULTS.ambient,
    idleTimeoutMs: PET_DEFAULTS.idleTimeoutMs,
  };
}

/** 动态扫描 public/pets 目录获取内置 Pet ID 列表 */
export async function discoverBuiltinPets(): Promise<string[]> {
  try {
    // 在 Tauri 环境中使用文件系统 API 扫描
    const petsPath = await resolveResource("pets");
    const entries = await readDir(petsPath);
    return entries
      .filter((e) => e.isDirectory && e.name && !e.name.startsWith("."))
      .map((e) => e.name!)
      .sort();
  } catch {
    // 回退：尝试通过 HTTP 请求已知的 Pet（开发模式或 web 环境）
    const knownPets = [
      "clippit", "dario", "dentist", "nyako-shigure",
      "slavik", "tux", "yelling-dario", "yorha-sit-2b",
    ];
    const discovered: string[] = [];
    for (const id of knownPets) {
      try {
        const res = await fetch(`/pets/${id}/pet.json`, { method: "HEAD" });
        if (res.ok) discovered.push(id);
      } catch {
        // Skip unavailable pets
      }
    }
    return discovered;
  }
}

export interface BuiltinPetMetadata {
  id: string;
  display_name: string;
  description: string;
  author?: string;
  spritesheet_url: string;
  is_builtin: true;
}

/** 加载内置 Pet 的元数据（用于设置页面展示） */
export async function loadBuiltinPetMetadata(petId: string): Promise<BuiltinPetMetadata | null> {
  try {
    const configUrl = `/pets/${petId}/pet.json`;
    const response = await fetch(configUrl);
    if (!response.ok) return null;

    const raw = (await response.json()) as RawPetJson;
    return {
      id: raw.id,
      display_name: raw.displayName,
      description: raw.description,
      author: raw.author,
      spritesheet_url: `/pets/${petId}/${raw.spritesheetPath}`,
      is_builtin: true,
    };
  } catch {
    return null;
  }
}

/** 动态扫描并加载所有内置 Pet 的元数据 */
export async function loadAllBuiltinPets(): Promise<BuiltinPetMetadata[]> {
  const petIds = await discoverBuiltinPets();
  const results = await Promise.all(petIds.map(loadBuiltinPetMetadata));
  return results.filter((p): p is BuiltinPetMetadata => p !== null);
}
