# T12: Storage Backend

> Implement abstracted storage backend with HuggingFace implementation.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T12 |
| Dependencies | T4 (User API) |
| Effort | 5 points |
| Priority | P0 |

---

## Objectives

1. Define storage backend interface
2. Implement HuggingFace backend
3. Implement local filesystem backend (dev)
4. Add storage factory

---

## Deliverables

### 1. Storage Interface (`apps/web/lib/storage/types.ts`)

```typescript
export interface StorageResult {
  storageRef: string;
  checksum: string;
  size: number;
}

export interface StorageBackend {
  /**
   * Upload a file to storage
   */
  upload(
    packageId: string,
    version: string,
    file: Buffer,
    filename: string
  ): Promise<StorageResult>;

  /**
   * Download a file from storage
   */
  download(storageRef: string): Promise<Buffer>;

  /**
   * Get a signed download URL (temporary)
   */
  getDownloadUrl(storageRef: string, expiresIn?: number): Promise<string>;

  /**
   * Delete a file from storage
   */
  delete(storageRef: string): Promise<void>;

  /**
   * Check if file exists
   */
  exists(storageRef: string): Promise<boolean>;
}
```

### 2. HuggingFace Backend (`apps/web/lib/storage/huggingface.ts`)

```typescript
import type { StorageBackend, StorageResult } from './types';
import crypto from 'crypto';

const HF_TOKEN = process.env.HF_TOKEN!;
const HF_NAMESPACE = process.env.HF_NAMESPACE || 'browse-mcp';
const HF_REPO = `${HF_NAMESPACE}/packages`;

export class HuggingFaceBackend implements StorageBackend {
  private baseUrl = 'https://huggingface.co';
  private apiUrl = 'https://huggingface.co/api';

  async upload(
    packageId: string,
    version: string,
    file: Buffer,
    filename: string
  ): Promise<StorageResult> {
    const path = `${packageId}/${version}/${filename}`;

    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(file).digest('hex');

    // Upload to HuggingFace datasets
    const response = await fetch(
      `${this.apiUrl}/datasets/${HF_REPO}/upload/main/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/octet-stream',
        },
        body: file,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HuggingFace upload failed: ${error}`);
    }

    return {
      storageRef: `hf://${HF_REPO}/${path}`,
      checksum,
      size: file.length,
    };
  }

  async download(storageRef: string): Promise<Buffer> {
    const path = this.parseStorageRef(storageRef);

    const response = await fetch(
      `${this.baseUrl}/datasets/${HF_REPO}/resolve/main/${path}`,
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HuggingFace download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getDownloadUrl(storageRef: string, expiresIn = 3600): Promise<string> {
    const path = this.parseStorageRef(storageRef);

    // HuggingFace doesn't have signed URLs, return direct URL
    // For private repos, this would need authentication
    return `${this.baseUrl}/datasets/${HF_REPO}/resolve/main/${path}`;
  }

  async delete(storageRef: string): Promise<void> {
    const path = this.parseStorageRef(storageRef);

    const response = await fetch(
      `${this.apiUrl}/datasets/${HF_REPO}/delete/main/${path}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HuggingFace delete failed: ${response.status}`);
    }
  }

  async exists(storageRef: string): Promise<boolean> {
    const path = this.parseStorageRef(storageRef);

    const response = await fetch(
      `${this.baseUrl}/datasets/${HF_REPO}/resolve/main/${path}`,
      {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
        },
      }
    );

    return response.ok;
  }

  private parseStorageRef(ref: string): string {
    // Format: hf://namespace/repo/path
    const match = ref.match(/^hf:\/\/[^/]+\/[^/]+\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid storage ref: ${ref}`);
    }
    return match[1];
  }
}
```

### 3. Local Backend (`apps/web/lib/storage/local.ts`)

```typescript
import type { StorageBackend, StorageResult } from './types';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || './.storage';

export class LocalBackend implements StorageBackend {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(STORAGE_DIR);
  }

  async upload(
    packageId: string,
    version: string,
    file: Buffer,
    filename: string
  ): Promise<StorageResult> {
    const filePath = path.join(this.baseDir, packageId, version, filename);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, file);

    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(file).digest('hex');

    return {
      storageRef: `local://${packageId}/${version}/${filename}`,
      checksum,
      size: file.length,
    };
  }

  async download(storageRef: string): Promise<Buffer> {
    const filePath = this.getFilePath(storageRef);
    return fs.readFile(filePath);
  }

  async getDownloadUrl(storageRef: string, expiresIn = 3600): Promise<string> {
    // For local storage, return a relative URL that API will serve
    const relativePath = this.parseStorageRef(storageRef);
    return `/api/packages/files/${relativePath}`;
  }

  async delete(storageRef: string): Promise<void> {
    const filePath = this.getFilePath(storageRef);
    await fs.unlink(filePath);
  }

  async exists(storageRef: string): Promise<boolean> {
    const filePath = this.getFilePath(storageRef);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private parseStorageRef(ref: string): string {
    const match = ref.match(/^local:\/\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid storage ref: ${ref}`);
    }
    return match[1];
  }

  private getFilePath(storageRef: string): string {
    const relativePath = this.parseStorageRef(storageRef);
    return path.join(this.baseDir, relativePath);
  }
}
```

### 4. Storage Factory (`apps/web/lib/storage/index.ts`)

```typescript
import type { StorageBackend } from './types';
import { HuggingFaceBackend } from './huggingface';
import { LocalBackend } from './local';

export type { StorageBackend, StorageResult } from './types';

let storageInstance: StorageBackend | null = null;

export function getStorage(): StorageBackend {
  if (storageInstance) {
    return storageInstance;
  }

  const backend = process.env.STORAGE_BACKEND || 'huggingface';

  switch (backend) {
    case 'local':
      storageInstance = new LocalBackend();
      break;
    case 'huggingface':
    default:
      storageInstance = new HuggingFaceBackend();
      break;
  }

  return storageInstance;
}

// Export for direct usage
export const storage = {
  upload: (...args: Parameters<StorageBackend['upload']>) =>
    getStorage().upload(...args),
  download: (...args: Parameters<StorageBackend['download']>) =>
    getStorage().download(...args),
  getDownloadUrl: (...args: Parameters<StorageBackend['getDownloadUrl']>) =>
    getStorage().getDownloadUrl(...args),
  delete: (...args: Parameters<StorageBackend['delete']>) =>
    getStorage().delete(...args),
  exists: (...args: Parameters<StorageBackend['exists']>) =>
    getStorage().exists(...args),
};
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STORAGE_BACKEND` | No | `huggingface` (default) or `local` |
| `HF_TOKEN` | Yes* | HuggingFace API token |
| `HF_NAMESPACE` | No | HuggingFace namespace (default: `browse-mcp`) |
| `LOCAL_STORAGE_DIR` | No | Local storage directory (default: `./.storage`) |

*Required when using HuggingFace backend

---

## Storage Reference Format

```
# HuggingFace
hf://namespace/repo/packageId/version/filename

# Local
local://packageId/version/filename
```

---

## Usage Example

```typescript
import { storage } from '@/lib/storage';

// Upload
const file = Buffer.from('...');
const result = await storage.upload(
  'my-package',
  '1.0.0',
  file,
  'package.zip'
);
// result.storageRef = 'hf://browse-mcp/packages/my-package/1.0.0/package.zip'

// Download
const data = await storage.download(result.storageRef);

// Get URL for redirect
const url = await storage.getDownloadUrl(result.storageRef);

// Delete
await storage.delete(result.storageRef);
```

---

## Acceptance Criteria

- [ ] HuggingFace backend uploads files
- [ ] HuggingFace backend downloads files
- [ ] Local backend works for development
- [ ] Storage factory selects correct backend
- [ ] Checksums are calculated correctly
- [ ] Storage refs are parsed correctly
- [ ] Errors are handled properly

---

## Notes

- HuggingFace uses datasets API for file storage
- Local backend is for development/testing only
- Consider adding S3/R2 backend in future
- Storage refs are opaque to consumers
