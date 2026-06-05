import { describe, it, expect } from "vitest";
import {
  SUPPORTED_IMAGE_MIMES,
  buildAttachmentNote,
} from "../attachment-blocks.js";
import type { Attachment } from "../../types.js";

function makeAtt(overrides: Partial<Attachment> = {}): Attachment {
  return {
    type: "image",
    filePath: "/tmp/test.jpg",
    fileName: "test.jpg",
    mimeType: "image/jpeg",
    size: 1024,
    ...overrides,
  };
}

describe("SUPPORTED_IMAGE_MIMES", () => {
  it("includes standard image formats", () => {
    expect(SUPPORTED_IMAGE_MIMES.has("image/jpeg")).toBe(true);
    expect(SUPPORTED_IMAGE_MIMES.has("image/png")).toBe(true);
    expect(SUPPORTED_IMAGE_MIMES.has("image/gif")).toBe(true);
    expect(SUPPORTED_IMAGE_MIMES.has("image/webp")).toBe(true);
  });

  it("includes modern image formats", () => {
    expect(SUPPORTED_IMAGE_MIMES.has("image/avif")).toBe(true);
    expect(SUPPORTED_IMAGE_MIMES.has("image/heic")).toBe(true);
    expect(SUPPORTED_IMAGE_MIMES.has("image/heif")).toBe(true);
  });
});

describe("buildAttachmentNote", () => {
  const TEN_MB = 10 * 1024 * 1024;

  it("returns null when attachment should be included normally (image, supported MIME, not too large)", () => {
    const att = makeAtt({ size: 1024, mimeType: "image/jpeg" });
    const note = buildAttachmentNote(att, { image: true, audio: false });
    expect(note).toBeNull();
  });

  it("returns size-exceeded message when attachment is too large", () => {
    const att = makeAtt({ size: TEN_MB + 1, fileName: "big-photo.jpg" });
    const note = buildAttachmentNote(att, { image: true, audio: false });
    expect(note).toMatch(/too large/);
    expect(note).toMatch(/big-photo\.jpg/);
    expect(note).toMatch(/10MB limit/);
  });

  it("returns unsupported-format message for unsupported image MIME", () => {
    const att = makeAtt({ mimeType: "image/tiff" });
    const note = buildAttachmentNote(att, { image: true, audio: false });
    expect(note).toMatch(/not supported/);
    expect(note).toMatch(/image\/tiff/);
  });

  it("returns null for avif image (now supported)", () => {
    const att = makeAtt({ mimeType: "image/avif", size: 1024 });
    const note = buildAttachmentNote(att, { image: true, audio: false });
    expect(note).toBeNull();
  });

  it("returns null for heic image (now supported)", () => {
    const att = makeAtt({ mimeType: "image/heic", size: 1024 });
    const note = buildAttachmentNote(att, { image: true, audio: false });
    expect(note).toBeNull();
  });

  it("returns null for audio when capabilities support it and not too large", () => {
    const att = makeAtt({ type: "audio", mimeType: "audio/wav", size: 1024 });
    const note = buildAttachmentNote(att, { image: false, audio: true });
    expect(note).toBeNull();
  });

  it("returns size-exceeded message for large audio", () => {
    const att = makeAtt({ type: "audio", mimeType: "audio/wav", fileName: "voice.wav", size: TEN_MB + 1 });
    const note = buildAttachmentNote(att, { image: false, audio: true });
    expect(note).toMatch(/too large/);
    expect(note).toMatch(/voice\.wav/);
  });
});
