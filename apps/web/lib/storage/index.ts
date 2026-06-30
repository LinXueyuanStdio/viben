import { VercelBlobStorage } from './vercel-blob';
import { HuggingFaceStorage } from './huggingface';
import { LocalStorage } from './local';
import type { StorageProvider } from './types';

export * from './types';
export { VercelBlobStorage } from './vercel-blob';
export { HuggingFaceStorage } from './huggingface';
export { LocalStorage } from './local';

let storageInstance: StorageProvider | null = null;

function resolveProvider(): string {
  if (process.env.STORAGE_PROVIDER) return process.env.STORAGE_PROVIDER;
  // Auto-detect: Vercel Blob when BLOB_READ_WRITE_TOKEN is set
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'vercel-blob';
  // Default to local
  return 'local';
}

export function getStorage(): StorageProvider {
  if (storageInstance) {
    return storageInstance;
  }

  const provider = resolveProvider();

  switch (provider) {
    case 'vercel-blob': {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (!token) {
        throw new Error('BLOB_READ_WRITE_TOKEN is required for Vercel Blob storage');
      }
      storageInstance = new VercelBlobStorage({ token });
      break;
    }

    case 'huggingface':
      if (!process.env.HF_TOKEN || !process.env.HF_REPO_ID) {
        throw new Error('HF_TOKEN and HF_REPO_ID are required for HuggingFace storage');
      }
      storageInstance = new HuggingFaceStorage({
        token: process.env.HF_TOKEN,
        repoId: process.env.HF_REPO_ID,
        repoType: (process.env.HF_REPO_TYPE as 'space' | 'dataset' | 'model') || 'dataset',
      });
      break;

    case 'local':
    default:
      storageInstance = new LocalStorage({
        basePath: process.env.LOCAL_STORAGE_PATH || './uploads',
        baseUrl: process.env.LOCAL_STORAGE_URL || '/uploads',
      });
      break;
  }

  return storageInstance;
}

// Helper function to reset storage instance (useful for testing)
export function resetStorage(): void {
  storageInstance = null;
}
