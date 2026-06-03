import AdmZip from "adm-zip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importPet } from "./import-export";

vi.mock("unzipper", () => {
  throw new Error('Could not resolve: "@aws-sdk/client-s3"');
});

describe("importPet", () => {
  let tempDir: string;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    originalStateDir = process.env.VIBEN_STATE_DIR;
    tempDir = await mkdtemp(join(tmpdir(), "viben-pet-import-"));
    process.env.VIBEN_STATE_DIR = join(tempDir, "state");
  });

  afterEach(async () => {
    if (originalStateDir) {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }

    await rm(tempDir, { recursive: true, force: true });
  });

  it("imports a local pet zip without S3-only unzip dependencies", async () => {
    const zipPath = join(tempDir, "pet.zip");
    const zip = new AdmZip();
    zip.addFile(
      "pet.json",
      Buffer.from(JSON.stringify({
        id: "test-pet",
        displayName: "Test Pet",
        spritesheetPath: "sprite.png",
      })),
    );
    zip.addFile("sprite.png", Buffer.from("sprite-data"));
    zip.writeZip(zipPath);

    const pet = await importPet(zipPath);

    expect(pet.id).toBe("test-pet");
    expect(pet.metadata.displayName).toBe("Test Pet");
    expect(pet.metadata.spritesheetPath).toBe("sprite.png");
    await expect(stat(join(process.env.VIBEN_STATE_DIR!, "pets", "test-pet", "pet.json"))).resolves.toBeDefined();
    await expect(readFile(join(process.env.VIBEN_STATE_DIR!, "pets", "test-pet", "sprite.png"), "utf-8")).resolves.toBe("sprite-data");
  });
});
