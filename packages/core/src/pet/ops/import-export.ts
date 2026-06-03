// packages/core/src/pet/ops/import-export.ts
import AdmZip from "adm-zip";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Pet, PetMetadata } from "../types";
import { getPetDir, PET_LIMITS } from "../paths";
import { PetError } from "./types";
import { isPathSafe } from "./storage";

/** Allowed file extensions */
const ALLOWED_EXTENSIONS = new Set<string>(PET_LIMITS.ALLOWED_EXTENSIONS);

/** Validate zip entry path safety */
function isZipEntrySafe(entryPath: string): boolean {
  if (entryPath.includes("..")) return false;
  if (entryPath.startsWith("/")) return false;
  const ext = extname(entryPath).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

/** Import Pet from a zip file */
export async function importPet(zipPath: string): Promise<Pet> {
  // Check file exists
  if (!existsSync(zipPath)) {
    throw new PetError(`File not found: ${zipPath}`, "INVALID_ZIP");
  }

  // Check file size
  const stats = await stat(zipPath);
  if (stats.size > PET_LIMITS.MAX_ZIP_SIZE) {
    throw new PetError("Zip file too large", "FILE_TOO_LARGE");
  }

  // Parse zip to get pet.json
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const petJsonEntry = entries.find((entry) => entry.entryName === "pet.json" || entry.entryName.endsWith("/pet.json"));

  if (!petJsonEntry) {
    throw new PetError("pet.json not found in zip", "INVALID_PET_FORMAT");
  }

  const petJsonContent = petJsonEntry.getData();
  const metadata = JSON.parse(petJsonContent.toString()) as PetMetadata;

  if (!metadata.id || !metadata.displayName || !metadata.spritesheetPath) {
    throw new PetError("Invalid pet.json format", "INVALID_PET_FORMAT");
  }

  // Calculate total extracted size
  let totalSize = 0;
  for (const entry of entries) {
    if (!entry.isDirectory) {
      totalSize += entry.header.size;
    }
  }
  if (totalSize > PET_LIMITS.MAX_EXTRACTED_SIZE) {
    throw new PetError("Extracted content too large", "FILE_TOO_LARGE");
  }

  // Create target directory
  const petDir = getPetDir(metadata.id);
  await mkdir(petDir, { recursive: true });

  // Extract files (with security checks)
  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const relativePath = entry.entryName.replace(/^[^/]+\//, ""); // Remove top-level directory
    if (!relativePath || !isZipEntrySafe(relativePath)) continue;
    if (!isPathSafe(petDir, relativePath)) continue;

    const targetPath = join(petDir, relativePath);
    const targetDir = join(targetPath, "..");
    await mkdir(targetDir, { recursive: true });

    const content = entry.getData();
    await writeFile(targetPath, content);
  }

  return {
    id: metadata.id,
    metadata,
    localPath: petDir,
    spritesheetUrl: join(petDir, metadata.spritesheetPath),
    isBuiltin: false,
    installedAt: new Date().toISOString(),
  };
}

/** Export Pet to a zip file */
export async function exportPet(petId: string, outPath: string): Promise<string> {
  const petDir = getPetDir(petId);

  if (!existsSync(petDir)) {
    throw new PetError(`Pet "${petId}" not found`, "PET_NOT_FOUND");
  }

  // Dynamic import archiver
  const archiver = (await import("archiver")).default;

  const output = createWriteStream(outPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.pipe(output);
  archive.directory(petDir, petId);

  await archive.finalize();
  await new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
  });

  return outPath;
}
