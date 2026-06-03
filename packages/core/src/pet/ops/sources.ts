// packages/core/src/pet/ops/sources.ts
import { readYaml, writeYaml, ensureDir } from "../../config/yaml";
import { getPetsDir, getPetSourcesPath } from "../paths";
import type { PetSource, PetSourcesFile } from "./types";
import { DEFAULT_SOURCES, PetError } from "./types";

/** 读取来源配置 */
export async function readSources(): Promise<PetSource[]> {
  const file = await readYaml<PetSourcesFile>(getPetSourcesPath());
  if (!file?.sources) {
    return [...DEFAULT_SOURCES];
  }
  // 确保内置来源始终存在
  const sourceNames = new Set(file.sources.map((s) => s.name));
  const merged = [...file.sources];
  for (const builtin of DEFAULT_SOURCES) {
    if (!sourceNames.has(builtin.name)) {
      merged.push(builtin);
    }
  }
  return merged;
}

/** 写入来源配置 */
async function writeSources(sources: PetSource[]): Promise<void> {
  await ensureDir(getPetsDir());
  await writeYaml<PetSourcesFile>(getPetSourcesPath(), { sources });
}

/** 验证 URL 格式（必须是 HTTPS） */
function isValidSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** 添加来源 */
export async function addSource(name: string, url: string): Promise<PetSource> {
  if (!isValidSourceUrl(url)) {
    throw new PetError("Invalid URL, must be HTTPS", "INVALID_URL");
  }

  const sources = await readSources();
  if (sources.some((s) => s.name === name)) {
    throw new PetError(`Source "${name}" already exists`, "SOURCE_EXISTS");
  }

  const newSource: PetSource = {
    name,
    url,
    enabled: true,
    builtin: false,
  };

  sources.push(newSource);
  await writeSources(sources);
  return newSource;
}

/** 删除来源 */
export async function removeSource(name: string): Promise<void> {
  const sources = await readSources();
  const source = sources.find((s) => s.name === name);

  if (!source) {
    throw new PetError(`Source "${name}" not found`, "SOURCE_NOT_FOUND");
  }

  if (source.builtin) {
    throw new PetError("Cannot remove builtin source", "SOURCE_IS_BUILTIN");
  }

  const filtered = sources.filter((s) => s.name !== name);
  await writeSources(filtered);
}

/** 设置来源启用状态 */
export async function setSourceEnabled(name: string, enabled: boolean): Promise<void> {
  const sources = await readSources();
  const source = sources.find((s) => s.name === name);

  if (!source) {
    throw new PetError(`Source "${name}" not found`, "SOURCE_NOT_FOUND");
  }

  source.enabled = enabled;
  await writeSources(sources);
}

/** 获取单个来源 */
export async function getSource(name: string): Promise<PetSource | null> {
  const sources = await readSources();
  return sources.find((s) => s.name === name) ?? null;
}
