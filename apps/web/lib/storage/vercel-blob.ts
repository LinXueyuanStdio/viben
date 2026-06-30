/**
 * Vercel Blob Storage Provider
 *
 * Uses the official @vercel/blob SDK. The SDK reads BLOB_READ_WRITE_TOKEN
 * from the environment automatically. Supports both public and private stores.
 */

import { put, del, list, head } from '@vercel/blob';
import crypto from 'crypto';
import type { StorageProvider, UploadOptions, UploadResult, FileInfo } from './types';

export class VercelBlobStorage implements StorageProvider {
  async upload(
    filePath: string,
    content: Buffer | string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const result = await put(filePath, buffer, {
      access: 'private',
      contentType: options?.contentType,
    });

    return { url: result.url, checksum, size: buffer.length };
  }

  async download(filePath: string): Promise<Buffer> {
    const blob = await head(filePath);
    const res = await fetch(blob.url);
    if (!res.ok) throw new Error(`Vercel Blob download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(filePath: string): Promise<void> {
    await del(filePath);
  }

  async list(prefix: string): Promise<FileInfo[]> {
    const result = await list({ prefix });
    return result.blobs.map((blob) => ({
      name: blob.pathname.split('/').pop() || '',
      path: blob.pathname,
      size: blob.size,
      lastModified: new Date(blob.uploadedAt),
      url: blob.url,
    }));
  }

  async exists(filePath: string): Promise<boolean> {
    try { await head(filePath); return true; } catch { return false; }
  }

  async getInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const blob = await head(filePath);
      return {
        name: blob.pathname.split('/').pop() || '',
        path: blob.pathname,
        size: blob.size,
        lastModified: new Date(blob.uploadedAt),
        url: blob.url,
      };
    } catch {
      return null;
    }
  }

  getUrl(_filePath: string): string {
    return ''; // SDK returns URLs at upload time
  }
}
