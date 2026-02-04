import crypto from 'crypto';
import type {
  StorageProvider,
  UploadOptions,
  UploadResult,
  FileInfo,
} from './types';

const HF_API_URL = 'https://huggingface.co/api';
const HF_SPACES_URL = 'https://huggingface.co/spaces';

interface HuggingFaceConfig {
  token: string;
  repoId: string; // Format: username/repo-name
  repoType?: 'space' | 'dataset' | 'model';
}

export class HuggingFaceStorage implements StorageProvider {
  private token: string;
  private repoId: string;
  private repoType: string;

  constructor(config: HuggingFaceConfig) {
    this.token = config.token;
    this.repoId = config.repoId;
    this.repoType = config.repoType || 'dataset';
  }

  async upload(
    path: string,
    content: Buffer | string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const url = `${HF_API_URL}/repos/${this.repoId}/upload/${path}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': options?.contentType || 'application/octet-stream',
      },
      body: buffer,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload to HuggingFace: ${error}`);
    }

    return {
      url: this.getUrl(path),
      checksum,
      size: buffer.length,
    };
  }

  async download(path: string): Promise<Buffer> {
    const url = this.getUrl(path);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download from HuggingFace: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(path: string): Promise<void> {
    const url = `${HF_API_URL}/repos/${this.repoId}/delete/${path}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Failed to delete from HuggingFace: ${error}`);
    }
  }

  async list(prefix: string): Promise<FileInfo[]> {
    const url = `${HF_API_URL}/repos/${this.repoId}/tree/main/${prefix}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to list files from HuggingFace: ${response.statusText}`);
    }

    const files = (await response.json()) as Array<{
      path: string;
      size: number;
      lastModified?: string;
    }>;

    return files.map((file) => ({
      name: file.path.split('/').pop() || file.path,
      path: file.path,
      size: file.size,
      lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
      url: this.getUrl(file.path),
    }));
  }

  async exists(path: string): Promise<boolean> {
    const info = await this.getInfo(path);
    return info !== null;
  }

  async getInfo(path: string): Promise<FileInfo | null> {
    const url = `${HF_API_URL}/repos/${this.repoId}/tree/main/${path}`;

    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentLength = response.headers.get('content-length');
    const lastModified = response.headers.get('last-modified');

    return {
      name: path.split('/').pop() || path,
      path,
      size: contentLength ? parseInt(contentLength, 10) : 0,
      lastModified: lastModified ? new Date(lastModified) : new Date(),
      url: this.getUrl(path),
    };
  }

  getUrl(path: string): string {
    // For datasets/models, use the resolve endpoint
    if (this.repoType === 'dataset') {
      return `https://huggingface.co/datasets/${this.repoId}/resolve/main/${path}`;
    }
    if (this.repoType === 'model') {
      return `https://huggingface.co/${this.repoId}/resolve/main/${path}`;
    }
    // For spaces
    return `${HF_SPACES_URL}/${this.repoId}/resolve/main/${path}`;
  }
}
