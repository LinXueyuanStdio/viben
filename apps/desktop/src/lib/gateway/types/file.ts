/**
 * File Operations Types
 * 文件操作类型定义
 */

// ============================================================================
// File Entry Types
// ============================================================================

/** File entry from directory listing */
export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_file: boolean;
  is_symlink: boolean;
  size: number;
  created_at: string;
  modified_at: string;
  extension?: string;
}

/** Response for listing files */
export interface FileListResponse {
  path: string;
  entries: FileEntry[];
  total: number;
}

/** Response for reading file content */
export interface FileContentResponse {
  path: string;
  content: string;
  size: number;
  encoding: string;
}

