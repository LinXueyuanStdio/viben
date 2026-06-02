import type { PetConfig } from "@viben/pet";
import { STANDARD_ANIMATIONS, PET_DEFAULTS } from "@viben/pet";

interface RawPetJson {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
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

export const AVAILABLE_PETS = ["tux"] as const;
export type AvailablePetId = (typeof AVAILABLE_PETS)[number];
