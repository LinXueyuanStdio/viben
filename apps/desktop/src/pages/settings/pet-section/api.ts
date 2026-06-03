// apps/desktop/src/pages/settings/pet-section/api.ts
const API_BASE = "http://127.0.0.1:18790";

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
  const res = await fetch(`${API_BASE}/api/pet/list`);
  if (!res.ok) throw new Error("Failed to fetch pets");
  return res.json();
}

export async function fetchPetConfig(): Promise<{ config: PetConfigResponse }> {
  const res = await fetch(`${API_BASE}/api/pet/config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

export async function updatePetConfig(config: Partial<PetConfigResponse>): Promise<{ config: PetConfigResponse }> {
  const res = await fetch(`${API_BASE}/api/pet/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to update config");
  return res.json();
}

export async function setCurrentPet(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/pet/set/${encodeURIComponent(id)}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to set pet");
}

export async function removePet(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/pet/remove/${encodeURIComponent(id)}`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to remove pet");
  }
}

export async function fetchCommunityPets(source?: string): Promise<{ pets: CommunityPetResponse[] }> {
  const url = source
    ? `${API_BASE}/api/pet/community?source=${encodeURIComponent(source)}`
    : `${API_BASE}/api/pet/community`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch community pets");
  return res.json();
}

export async function installPet(petId: string, source: string): Promise<{ pet: PetResponse }> {
  const res = await fetch(`${API_BASE}/api/pet/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pet_id: petId, source }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to install pet");
  }
  return res.json();
}

export async function fetchSources(): Promise<{ sources: PetSourceResponse[] }> {
  const res = await fetch(`${API_BASE}/api/pet/sources/list`);
  if (!res.ok) throw new Error("Failed to fetch sources");
  return res.json();
}

export async function addSource(name: string, url: string): Promise<{ source: PetSourceResponse }> {
  const res = await fetch(`${API_BASE}/api/pet/sources/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, url }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to add source");
  }
  return res.json();
}

export async function removeSource(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/pet/sources/remove/${encodeURIComponent(name)}`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to remove source");
  }
}

export async function importPetZip(path: string): Promise<{ pet: PetResponse }> {
  const res = await fetch(`${API_BASE}/api/pet/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to import pet");
  }
  return res.json();
}
