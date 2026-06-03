// packages/core/src/pet/ops/sync.ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pet, PetMetadata } from "../types";
import { getPetDir, getPetMetadataPath, PET_LIMITS } from "../paths";
import type { CommunityPet, PetSource } from "./types";
import { PetError } from "./types";
import { readSources, getSource } from "./sources";
import { proxyFetch } from "../../http";

/** 从 Codex Pet Share 获取列表 */
async function fetchFromPetShare(source: PetSource): Promise<CommunityPet[]> {
  const url = `${source.url}/api/pets?pageSize=100`;
  const response = await proxyFetch(url, { signal: AbortSignal.timeout(PET_LIMITS.DOWNLOAD_TIMEOUT) });
  if (!response.ok) {
    throw new PetError(`Failed to fetch from ${source.name}: ${response.status}`, "DOWNLOAD_FAILED");
  }
  const data = await response.json() as { pets?: Array<{ id: string; name: string; description?: string; author?: string; tags?: string[]; thumbnailUrl?: string; downloadUrl: string }> };
  return (data.pets ?? []).map((p) => ({
    id: p.id,
    displayName: p.name,
    description: p.description ?? "",
    author: p.author,
    tags: p.tags,
    thumbnailUrl: p.thumbnailUrl,
    downloadUrl: p.downloadUrl,
    source: source.name,
  }));
}

/** j20 Hatchery API 响应格式 */
interface HatcheryPet {
  id: string;
  displayName?: string;
  description?: string;
  authorLabel?: string;
  keywords?: string;
  petJsonUrl?: string;
  previewUrl?: string;
}

/** 从 j20 Hatchery 获取列表 */
async function fetchFromHatchery(source: PetSource): Promise<CommunityPet[]> {
  const response = await proxyFetch(source.url, { signal: AbortSignal.timeout(PET_LIMITS.DOWNLOAD_TIMEOUT) });
  if (!response.ok) {
    throw new PetError(`Failed to fetch from ${source.name}: ${response.status}`, "DOWNLOAD_FAILED");
  }
  const data = await response.json() as { count?: number; pets?: HatcheryPet[] } | HatcheryPet[];
  // j20 API 返回 {count, pets} 格式
  const pets = Array.isArray(data) ? data : (data.pets ?? []);
  return pets.map((p) => ({
    id: p.id,
    displayName: p.displayName ?? p.id,
    description: p.description ?? "",
    author: p.authorLabel,
    tags: p.keywords?.split(",").map((t) => t.trim()).filter(Boolean),
    thumbnailUrl: p.previewUrl,
    downloadUrl: p.petJsonUrl?.replace(/\/pet\.json.*$/, "") ?? "",
    source: source.name,
  }));
}

/** 从单个来源获取 Pet 列表 */
export async function fetchFromSource(source: PetSource): Promise<CommunityPet[]> {
  if (source.name === "codex-pet-share") {
    return fetchFromPetShare(source);
  }
  if (source.name === "j20-hatchery") {
    return fetchFromHatchery(source);
  }
  // 自定义来源：尝试 hatchery 格式
  return fetchFromHatchery(source);
}

/** 列出社区 Pet（可按来源筛选） */
export async function listCommunityPets(sourceFilter?: string): Promise<CommunityPet[]> {
  const sources = await readSources();
  const enabledSources = sources.filter((s) => s.enabled);
  const targetSources = sourceFilter
    ? enabledSources.filter((s) => s.name === sourceFilter)
    : enabledSources;

  const results: CommunityPet[] = [];
  for (const source of targetSources) {
    try {
      const pets = await fetchFromSource(source);
      results.push(...pets);
    } catch (e) {
      console.warn(`Failed to fetch from ${source.name}:`, e);
    }
  }
  return results;
}

/** Validate petId to prevent path traversal */
function isValidPetId(petId: string): boolean {
  // Must not contain path separators or traversal patterns
  if (petId.includes("/") || petId.includes("\\") || petId.includes("..")) {
    return false;
  }
  // Must not be empty or only dots
  if (!petId || petId === "." || petId === "..") {
    return false;
  }
  return true;
}

/** Validate spritesheetPath to prevent path traversal */
function isValidSpritesheetPath(path: string): boolean {
  // Must not contain path traversal
  if (path.includes("..")) {
    return false;
  }
  // Must not be absolute
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) {
    return false;
  }
  // Must have allowed extension
  const ext = path.toLowerCase().split(".").pop();
  return ext === "webp" || ext === "png" || ext === "gif";
}

/** 下载并安装 Pet */
export async function installPet(petId: string, sourceName: string): Promise<Pet> {
  // Validate petId to prevent path traversal
  if (!isValidPetId(petId)) {
    throw new PetError(`Invalid pet ID: "${petId}"`, "INVALID_PET_FORMAT");
  }

  const source = await getSource(sourceName);
  if (!source) {
    throw new PetError(`Source "${sourceName}" not found`, "SOURCE_NOT_FOUND");
  }

  // 获取社区列表找到下载 URL
  const communityPets = await fetchFromSource(source);
  const communityPet = communityPets.find((p) => p.id === petId);
  if (!communityPet) {
    throw new PetError(`Pet "${petId}" not found in source "${sourceName}"`, "PET_NOT_FOUND");
  }

  // 下载 pet.json
  const petJsonUrl = communityPet.downloadUrl.endsWith("/")
    ? `${communityPet.downloadUrl}pet.json`
    : `${communityPet.downloadUrl}/pet.json`;

  const metadataResponse = await proxyFetch(petJsonUrl, { signal: AbortSignal.timeout(PET_LIMITS.DOWNLOAD_TIMEOUT) });
  if (!metadataResponse.ok) {
    throw new PetError(`Failed to download pet.json: ${metadataResponse.status}`, "DOWNLOAD_FAILED");
  }
  const metadata = await metadataResponse.json() as PetMetadata;

  // Validate spritesheetPath to prevent path traversal
  if (!isValidSpritesheetPath(metadata.spritesheetPath)) {
    throw new PetError(`Invalid spritesheet path: "${metadata.spritesheetPath}"`, "INVALID_PET_FORMAT");
  }

  // 下载 spritesheet
  const spritesheetUrl = communityPet.downloadUrl.endsWith("/")
    ? `${communityPet.downloadUrl}${metadata.spritesheetPath}`
    : `${communityPet.downloadUrl}/${metadata.spritesheetPath}`;

  const spritesheetResponse = await proxyFetch(spritesheetUrl, { signal: AbortSignal.timeout(PET_LIMITS.DOWNLOAD_TIMEOUT) });
  if (!spritesheetResponse.ok) {
    throw new PetError(`Failed to download spritesheet: ${spritesheetResponse.status}`, "DOWNLOAD_FAILED");
  }

  // 检查大小
  const contentLength = spritesheetResponse.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > PET_LIMITS.MAX_FILE_SIZE) {
    throw new PetError("Spritesheet file too large", "FILE_TOO_LARGE");
  }

  const spritesheetBuffer = Buffer.from(await spritesheetResponse.arrayBuffer());

  // 保存到本地
  const petDir = getPetDir(petId);
  await mkdir(petDir, { recursive: true });
  await writeFile(getPetMetadataPath(petId), JSON.stringify(metadata, null, 2));
  await writeFile(join(petDir, metadata.spritesheetPath), spritesheetBuffer);

  return {
    id: petId,
    metadata,
    localPath: petDir,
    spritesheetUrl: join(petDir, metadata.spritesheetPath),
    isBuiltin: false,
    installedAt: new Date().toISOString(),
  };
}
