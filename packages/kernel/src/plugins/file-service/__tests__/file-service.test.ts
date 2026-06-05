import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileService } from "../file-service.js";

describe("FileService", () => {
  let service: FileService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "viben-test-"));
    service = new FileService(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("saveFile", () => {
    it("saves file and returns Attachment with correct metadata", async () => {
      const data = Buffer.from("hello world");
      const att = await service.saveFile("s1", "test.txt", data, "text/plain");

      expect(att.type).toBe("file");
      expect(att.fileName).toBe("test.txt");
      expect(att.mimeType).toBe("text/plain");
      expect(att.size).toBe(11);
      expect(fs.existsSync(att.filePath)).toBe(true);
      expect(fs.readFileSync(att.filePath).toString()).toBe("hello world");
    });

    it("saves image with correct type", async () => {
      const att = await service.saveFile("s1", "photo.png", Buffer.from("x"), "image/png");
      expect(att.type).toBe("image");
    });

    it("saves audio with correct type", async () => {
      const att = await service.saveFile("s1", "voice.ogg", Buffer.from("x"), "audio/ogg");
      expect(att.type).toBe("audio");
    });

    it("creates session subdirectory", async () => {
      const att = await service.saveFile("session-abc", "f.txt", Buffer.from("x"), "text/plain");
      expect(att.filePath).toContain("session-abc");
    });
  });

  describe("resolveFile", () => {
    it("returns Attachment for existing file", async () => {
      const filePath = path.join(tmpDir, "test.jpg");
      fs.writeFileSync(filePath, "fake jpeg");

      const att = await service.resolveFile(filePath);
      expect(att).not.toBeNull();
      expect(att!.type).toBe("image");
      expect(att!.mimeType).toBe("image/jpeg");
      expect(att!.size).toBe(9);
    });

    it("returns null for non-existent file", async () => {
      const att = await service.resolveFile("/nonexistent/file.txt");
      expect(att).toBeNull();
    });
  });

  describe("cleanupOldFiles", () => {
    it("removes directories older than maxAgeDays", async () => {
      // Create session dirs with old timestamps
      const oldDir = path.join(tmpDir, "old-session");
      const newDir = path.join(tmpDir, "new-session");
      fs.mkdirSync(oldDir);
      fs.mkdirSync(newDir);
      fs.writeFileSync(path.join(oldDir, "file.txt"), "data");
      fs.writeFileSync(path.join(newDir, "file.txt"), "data");

      // Set oldDir mtime to 60 days ago
      const pastDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      fs.utimesSync(oldDir, pastDate, pastDate);

      const removed = await service.cleanupOldFiles(30);
      expect(removed).toBe(1);
      expect(fs.existsSync(oldDir)).toBe(false);
      expect(fs.existsSync(newDir)).toBe(true);
    });

    it("returns 0 when baseDir does not exist", async () => {
      const nonexistent = new FileService("/tmp/nonexistent-" + Date.now());
      const removed = await nonexistent.cleanupOldFiles(30);
      expect(removed).toBe(0);
    });

    it("skips non-directory entries", async () => {
      fs.writeFileSync(path.join(tmpDir, "regular-file.txt"), "data");
      const removed = await service.cleanupOldFiles(0);
      expect(removed).toBe(0);
    });
  });

  describe("extensionFromMime", () => {
    it("maps common image types", () => {
      expect(FileService.extensionFromMime("image/jpeg")).toBe(".jpg");
      expect(FileService.extensionFromMime("image/png")).toBe(".png");
      expect(FileService.extensionFromMime("image/webp")).toBe(".webp");
    });

    it("maps common audio types", () => {
      expect(FileService.extensionFromMime("audio/ogg")).toBe(".ogg");
      expect(FileService.extensionFromMime("audio/mpeg")).toBe(".mp3");
    });

    it("returns .bin for unknown types", () => {
      expect(FileService.extensionFromMime("application/octet-stream")).toBe(".bin");
    });
  });
});
