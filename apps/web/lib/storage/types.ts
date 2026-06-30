export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  url: string;
  checksum: string;
  size: number;
  /** Vercel Blob pathname, used to construct proxy URL */
  pathname?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  url: string;
}

export interface StorageProvider {
  /**
   * Upload a file to storage
   */
  upload(
    path: string,
    content: Buffer | string,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Download a file from storage
   */
  download(path: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   */
  delete(path: string): Promise<void>;

  /**
   * List files in a directory
   */
  list(prefix: string): Promise<FileInfo[]>;

  /**
   * Check if a file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file information
   */
  getInfo(path: string): Promise<FileInfo | null>;

  /**
   * Get a public URL for a file
   */
  getUrl(path: string): string;
}

export type EntityType = 'mcp' | 'skill';

export interface PackageFile {
  entityType: EntityType;
  entityId: string;
  version: string;
  filename: string;
}

export function getPackagePath(file: PackageFile): string {
  return `${file.entityType}/${file.entityId}/${file.version}/${file.filename}`;
}

export function parsePackagePath(path: string): PackageFile | null {
  const parts = path.split('/');
  if (parts.length < 4) return null;

  const [entityType, entityId, version, ...rest] = parts;
  if (entityType !== 'mcp' && entityType !== 'skill') return null;

  return {
    entityType,
    entityId,
    version,
    filename: rest.join('/'),
  };
}
