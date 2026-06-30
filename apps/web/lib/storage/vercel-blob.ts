/**
 * Vercel Blob Storage Provider
 *
 * Best practice for file uploads on Vercel. Uses @vercel/blob SDK.
 * Requires BLOB_READ_WRITE_TOKEN env var (auto-set by Vercel when
 * Blob storage is connected to the project).
 *
 * Docs: https://vercel.com/docs/storage/vercel-blob
 */

import crypto from 'crypto';
import type {
  StorageProvider,
  UploadOptions,
  UploadResult,
  FileInfo,
} from './types';

export class VercelBlobStorage implements StorageProvider {
  private token: string;

  constructor(config: { token: string }) {
    this.token = config.token;
  }

  async upload(
    filePath: string,
    content: Buffer | string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const res = await fetch(
      `https://blob.vercel-storage.com/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': options?.contentType || 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
          ...(options?.contentType ? { 'Content-Type': options.contentType } : {}),
        },
        body: buffer,
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Vercel Blob upload failed: ${res.status} ${text}`);
    }

    const data = await res.json();

    return {
      url: data.url,
      checksum,
      size: buffer.length,
    };
  }

  async download(filePath: string): Promise<Buffer> {
    const res = await fetch(
      `https://blob.vercel-storage.com/${filePath}`,
      { headers: { Authorization: `Bearer ${this.token}` } }
    );

    if (!res.ok) {
      throw new Error(`Vercel Blob download failed: ${res.status}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  async delete(filePath: string): Promise<void> {
    const res = await fetch(
      `https://blob.vercel-storage.com/${filePath}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.token}` },
      }
    );

    if (!res.ok && res.status !== 404) {
      throw new Error(`Vercel Blob delete failed: ${res.status}`);
    }
  }

  async list(prefix: string): Promise<FileInfo[]> {
    const params = new URLSearchParams({ prefix, mode: 'expanded' });
    const res = await fetch(
      `https://blob.vercel-storage.com/?${params.toString()}`,
      { headers: { Authorization: `Bearer ${this.token}` } }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const blobs = data.blobs || [];

    return blobs.map((blob: any) => ({
      name: blob.pathname.split('/').pop() || '',
      path: blob.pathname,
      size: blob.size,
      lastModified: new Date(blob.uploadedAt),
      url: blob.url,
    }));
  }

  async exists(filePath: string): Promise<boolean> {
    const res = await fetch(
      `https://blob.vercel-storage.com/?prefix=${encodeURIComponent(filePath)}&limit=1`,
      { headers: { Authorization: `Bearer ${this.token}` } }
    );

    if (!res.ok) return false;

    const data = await res.json();
    const blobs = data.blobs || [];
    return blobs.some((b: any) => b.pathname === filePath);
  }

  async getInfo(filePath: string): Promise<FileInfo | null> {
    const res = await fetch(
      `https://blob.vercel-storage.com/?prefix=${encodeURIComponent(filePath)}&limit=1&mode=expanded`,
      { headers: { Authorization: `Bearer ${this.token}` } }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const blob = (data.blobs || []).find((b: any) => b.pathname === filePath);

    if (!blob) return null;

    return {
      name: blob.pathname.split('/').pop() || '',
      path: blob.pathname,
      size: blob.size,
      lastModified: new Date(blob.uploadedAt),
      url: blob.url,
    };
  }

  getUrl(filePath: string): string {
    // Vercel Blob URLs are returned at upload time; for direct URL construction
    // we return the store URL which redirects to the actual file
    return `https://blob.vercel-storage.com/${filePath}`;
  }
}
