// apps/desktop/src/pages/settings/pet-section/api.ts
import { getGatewayClient } from "@/lib/gateway";

export interface PetResponse {
  id: string;
  metadata: {
    id: string;
    display_name: string;
    description: string;
    spritesheet_path: string;
    author?: string;
    tags?: string[];
    source?: string;
    source_url?: string;
  };
  local_path: string;
  spritesheet_url: string;
  is_builtin: boolean;
}

export interface CommunityPetResponse {
  id: string;
  display_name: string;
  description: string;
  author?: string;
  tags?: string[];
  thumbnail_url?: string;
  download_url: string;
  source: string;
}

export interface PetConfigResponse {
  current: string | null;
  enabled: boolean;
  preferences: {
    size: number;
    position: { right: number; bottom: number };
  };
}

export interface PetSourceResponse {
  name: string;
  url: string;
  enabled: boolean;
  builtin: boolean;
}

export async function fetchPetList(): Promise<{ pets: PetResponse[]; current: string | null }> {
  return getGatewayClient().get<{ pets: PetResponse[]; current: string | null }>("/api/pet/list");
}

export async function fetchPetConfig(): Promise<{ config: PetConfigResponse }> {
  return getGatewayClient().get<{ config: PetConfigResponse }>("/api/pet/config");
}

export async function updatePetConfig(config: Partial<PetConfigResponse>): Promise<{ config: PetConfigResponse }> {
  return getGatewayClient().request<{ config: PetConfigResponse }>("/api/pet/config", {
    method: "PUT",
    body: config,
  });
}

export async function setCurrentPet(id: string): Promise<void> {
  await getGatewayClient().request<void>(`/api/pet/set/${encodeURIComponent(id)}`, {
    method: "POST",
    responseType: "none",
  });
}

export async function removePet(id: string): Promise<void> {
  await getGatewayClient().request<void>(`/api/pet/remove/${encodeURIComponent(id)}`, {
    method: "POST",
    responseType: "none",
  });
}

export async function fetchCommunityPets(source?: string): Promise<{ pets: CommunityPetResponse[] }> {
  const query = source ? `?${new URLSearchParams({ source }).toString()}` : "";
  return getGatewayClient().get<{ pets: CommunityPetResponse[] }>(`/api/pet/community${query}`);
}

export async function installPet(petId: string, source: string): Promise<{ pet: PetResponse }> {
  return getGatewayClient().post<{ pet: PetResponse }>("/api/pet/install", { pet_id: petId, source });
}

export async function fetchSources(): Promise<{ sources: PetSourceResponse[] }> {
  return getGatewayClient().get<{ sources: PetSourceResponse[] }>("/api/pet/sources/list");
}

export async function addSource(name: string, url: string): Promise<{ source: PetSourceResponse }> {
  return getGatewayClient().post<{ source: PetSourceResponse }>("/api/pet/sources/add", { name, url });
}

export async function removeSource(name: string): Promise<void> {
  await getGatewayClient().request<void>(`/api/pet/sources/remove/${encodeURIComponent(name)}`, {
    method: "POST",
    responseType: "none",
  });
}

export async function importPetZip(path: string): Promise<{ pet: PetResponse }> {
  return getGatewayClient().post<{ pet: PetResponse }>("/api/pet/import", { path });
}
