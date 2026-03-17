import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type {
  StorageProvider,
  UploadOptions,
  UploadResult,
  FileInfo,
} from './types';

interface LocalStorageConfig {
  basePath: string;
  baseUrl: string;
}

export class LocalStorage implements StorageProvider {
  private basePath: string;
  private baseUrl: string;

  constructor(config: LocalStorageConfig) {
    this.basePath = config.basePath;
    this.baseUrl = config.baseUrl;
  }

  async upload(
    filePath: string,
    content: Buffer | string,
     
    _options?: UploadOptions
  ): Promise<UploadResult> {
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const fullPath = path.join(this.basePath, filePath);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return {
      url: this.getUrl(filePath),
      checksum,
      size: buffer.length,
    };
  }

  async download(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, filePath);
    return fs.readFile(fullPath);
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async list(prefix: string): Promise<FileInfo[]> {
    const dirPath = path.join(this.basePath, prefix);

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files: FileInfo[] = [];

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(prefix, entry.name);
          const fullPath = path.join(this.basePath, filePath);
          const stats = await fs.stat(fullPath);

          files.push({
            name: entry.name,
            path: filePath,
            size: stats.size,
            lastModified: stats.mtime,
            url: this.getUrl(filePath),
          });
        }
      }

      return files;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getInfo(filePath: string): Promise<FileInfo | null> {
    const fullPath = path.join(this.basePath, filePath);

    try {
      const stats = await fs.stat(fullPath);

      return {
        name: path.basename(filePath),
        path: filePath,
        size: stats.size,
        lastModified: stats.mtime,
        url: this.getUrl(filePath),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  getUrl(filePath: string): string {
    return `${this.baseUrl}/${filePath}`;
  }
}
