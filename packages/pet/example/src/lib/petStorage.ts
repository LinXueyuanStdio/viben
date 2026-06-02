/**
 * localStorage-based storage system for custom pets.
 * Allows users to create, modify, delete, import, and export their own pets.
 */

// =============================================================================
// Types
// =============================================================================

export interface CustomPet {
  id: string;
  displayName: string;
  description: string;
  accent: string;
  greeting: string;
  spritesheetDataUrl: string; // base64 encoded spritesheet image
  createdAt: number;
  updatedAt: number;
}

interface StoredPets {
  pets: CustomPet[];
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'viben-custom-pets';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique ID for new pets.
 * Uses crypto.randomUUID if available, otherwise falls back to a timestamp-based ID.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random suffix
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomSuffix}`;
}

/**
 * Load pets from localStorage.
 */
function loadPets(): CustomPet[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const data = JSON.parse(stored) as StoredPets;
    return data.pets ?? [];
  } catch {
    // JSON parse error or other issue - return empty array
    return [];
  }
}

/**
 * Save pets to localStorage.
 */
function savePets(pets: CustomPet[]): void {
  try {
    const data: StoredPets = { pets };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // localStorage might be full or disabled
    throw new Error(`Failed to save pets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the pet storage.
 * For localStorage, this is essentially a no-op but provides consistent API.
 */
export async function initPetStorage(): Promise<void> {
  // Verify localStorage is available
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
  } catch {
    throw new Error('localStorage is not available. Custom pets cannot be stored.');
  }
}

/**
 * Get all custom pets from storage.
 * Returns an array of CustomPet objects sorted by creation date (newest first).
 */
export async function getAllCustomPets(): Promise<CustomPet[]> {
  const pets = loadPets();
  // Sort by creation date, newest first
  pets.sort((a, b) => b.createdAt - a.createdAt);
  return pets;
}

/**
 * Get a single custom pet by ID.
 * Returns null if the pet doesn't exist.
 */
export async function getCustomPet(id: string): Promise<CustomPet | null> {
  const pets = loadPets();
  return pets.find(p => p.id === id) ?? null;
}

/**
 * Save a custom pet to storage.
 * If the pet has no ID, a new one will be generated.
 * If the pet already exists, it will be updated.
 */
export async function saveCustomPet(pet: CustomPet): Promise<void> {
  const now = Date.now();

  // Ensure the pet has an ID
  const petToSave: CustomPet = {
    ...pet,
    id: pet.id || generateId(),
    createdAt: pet.createdAt || now,
    updatedAt: now,
  };

  // Validate required fields
  if (!petToSave.displayName?.trim()) {
    throw new Error('Pet display name is required');
  }
  if (!petToSave.spritesheetDataUrl) {
    throw new Error('Pet spritesheet is required');
  }

  const pets = loadPets();
  const existingIndex = pets.findIndex(p => p.id === petToSave.id);

  if (existingIndex >= 0) {
    // Update existing pet
    pets[existingIndex] = petToSave;
  } else {
    // Add new pet
    pets.push(petToSave);
  }

  savePets(pets);
}

/**
 * Delete a custom pet by ID.
 */
export async function deleteCustomPet(id: string): Promise<void> {
  const pets = loadPets();
  const filteredPets = pets.filter(p => p.id !== id);

  if (filteredPets.length === pets.length) {
    // Pet not found, but we don't throw - just silently succeed
    return;
  }

  savePets(filteredPets);
}

/**
 * Export a custom pet as a JSON Blob for downloading.
 * Throws an error if the pet doesn't exist.
 */
export async function exportCustomPet(id: string): Promise<Blob> {
  const pet = await getCustomPet(id);
  if (!pet) {
    throw new Error(`Pet with ID "${id}" not found`);
  }

  const exportData = {
    version: 1, // Export format version for future compatibility
    type: 'viben-custom-pet',
    pet: pet,
    exportedAt: Date.now(),
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
}

/**
 * Import a custom pet from a JSON file.
 * Generates a new ID for the imported pet to avoid conflicts.
 * Returns the imported pet with its new ID.
 */
export async function importCustomPet(file: File): Promise<CustomPet> {
  // Validate file type
  if (!file.type.includes('json') && !file.name.endsWith('.json')) {
    throw new Error('Invalid file type. Please select a JSON file.');
  }

  // Read file contents
  const text = await file.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file. Please select a valid pet export file.');
  }

  // Validate export format
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid pet export format');
  }

  const exportData = data as Record<string, unknown>;

  // Check for version 1 export format
  if (exportData.type === 'viben-custom-pet' && exportData.version === 1) {
    const petData = exportData.pet as Partial<CustomPet>;
    if (!petData || typeof petData !== 'object') {
      throw new Error('Invalid pet data in export file');
    }
    return await importPetData(petData);
  }

  // Try to import as raw pet data (for backwards compatibility)
  if ('displayName' in exportData || 'spritesheetDataUrl' in exportData) {
    return await importPetData(exportData as Partial<CustomPet>);
  }

  throw new Error('Unrecognized pet export format');
}

/**
 * Internal helper to import and validate pet data.
 */
async function importPetData(petData: Partial<CustomPet>): Promise<CustomPet> {
  // Validate required fields
  if (!petData.displayName?.trim()) {
    throw new Error('Imported pet is missing display name');
  }
  if (!petData.spritesheetDataUrl) {
    throw new Error('Imported pet is missing spritesheet data');
  }

  const now = Date.now();

  // Create new pet with new ID (to avoid conflicts)
  const importedPet: CustomPet = {
    id: generateId(),
    displayName: petData.displayName.trim(),
    description: petData.description?.trim() ?? '',
    accent: petData.accent ?? '#f5a623',
    greeting: petData.greeting?.trim() ?? `Hi! I'm ${petData.displayName.trim()}!`,
    spritesheetDataUrl: petData.spritesheetDataUrl,
    createdAt: now,
    updatedAt: now,
  };

  // Save the imported pet
  await saveCustomPet(importedPet);

  return importedPet;
}

/**
 * Create a new custom pet with the given data.
 * Returns the created pet with generated ID and timestamps.
 */
export async function createCustomPet(
  data: Omit<CustomPet, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CustomPet> {
  const now = Date.now();
  const newPet: CustomPet = {
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  await saveCustomPet(newPet);
  return newPet;
}

/**
 * Update an existing custom pet.
 * Only updates the provided fields, preserving others.
 * Throws an error if the pet doesn't exist.
 */
export async function updateCustomPet(
  id: string,
  updates: Partial<Omit<CustomPet, 'id' | 'createdAt'>>
): Promise<CustomPet> {
  const existing = await getCustomPet(id);
  if (!existing) {
    throw new Error(`Pet with ID "${id}" not found`);
  }

  const updatedPet: CustomPet = {
    ...existing,
    ...updates,
    id, // Ensure ID is not changed
    createdAt: existing.createdAt, // Preserve original creation time
    updatedAt: Date.now(),
  };

  await saveCustomPet(updatedPet);
  return updatedPet;
}

/**
 * Check if a pet with the given ID exists.
 */
export async function hasCustomPet(id: string): Promise<boolean> {
  const pet = await getCustomPet(id);
  return pet !== null;
}

/**
 * Get the count of custom pets in storage.
 */
export async function getCustomPetCount(): Promise<number> {
  const pets = loadPets();
  return pets.length;
}

/**
 * Clear all custom pets from storage.
 * Use with caution - this cannot be undone.
 */
export async function clearAllCustomPets(): Promise<void> {
  savePets([]);
}

/**
 * Download a pet export file.
 * Convenience function that creates a download link for the exported pet.
 */
export async function downloadCustomPet(id: string, filename?: string): Promise<void> {
  const pet = await getCustomPet(id);
  if (!pet) {
    throw new Error(`Pet with ID "${id}" not found`);
  }

  const blob = await exportCustomPet(id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename ?? `${pet.displayName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get storage usage information.
 * Useful for displaying how much space custom pets are using.
 */
export function getStorageUsage(): { used: number; available: number; pets: number } {
  const pets = loadPets();
  const stored = localStorage.getItem(STORAGE_KEY) ?? '';
  const usedBytes = new Blob([stored]).size;

  // Most browsers have a 5MB limit per origin for localStorage
  const estimatedLimit = 5 * 1024 * 1024; // 5MB in bytes

  return {
    used: usedBytes,
    available: Math.max(0, estimatedLimit - usedBytes),
    pets: pets.length,
  };
}
