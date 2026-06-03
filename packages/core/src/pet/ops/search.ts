// packages/core/src/pet/ops/search.ts
import type { CommunityPet } from "./types";
import { listCommunityPets } from "./sync";

/** 搜索社区 Pet（按关键词匹配 id、displayName、description、tags） */
export async function searchCommunityPets(query: string): Promise<CommunityPet[]> {
  const allPets = await listCommunityPets();
  const lowerQuery = query.toLowerCase();

  return allPets.filter((pet) => {
    if ((pet.id ?? "").toLowerCase().includes(lowerQuery)) return true;
    if ((pet.displayName ?? "").toLowerCase().includes(lowerQuery)) return true;
    if ((pet.description ?? "").toLowerCase().includes(lowerQuery)) return true;
    if (pet.author?.toLowerCase().includes(lowerQuery)) return true;
    if (pet.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))) return true;
    return false;
  });
}

/** 获取单个社区 Pet 预览信息 */
export async function previewCommunityPet(
  petId: string,
  sourceName?: string,
): Promise<CommunityPet | null> {
  const pets = await listCommunityPets(sourceName);
  return pets.find((p) => p.id === petId) ?? null;
}
