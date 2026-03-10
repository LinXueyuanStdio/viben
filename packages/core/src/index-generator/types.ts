/**
 * Type definitions for Index Generator
 */

// ============================================================================
// Code Index Types
// ============================================================================

export interface TechStack {
  languages: string[];
  frameworks: string[];
  buildTools: string[];
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'const' | 'type' | 'interface' | 'default';
  description?: string;
}

export interface PackageInfo {
  name: string;
  path: string;
  description: string;
  entryPoints: string[];
  exports: ExportInfo[];
  dependencies: string[];
}

export interface AppInfo {
  name: string;
  path: string;
  description: string;
  type: 'web' | 'desktop' | 'mobile' | 'cli' | 'other';
  framework?: string;
}

export interface KeyFile {
  path: string;
  type: 'entry' | 'config' | 'core' | 'util';
  description: string;
  exports?: string[];
  lineCount?: number;
  purpose?: string;
}

export interface DirectoryNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  description?: string;
  children?: DirectoryNode[];
}

export interface CodeIndex {
  techStack: TechStack;
  packages: PackageInfo[];
  apps: AppInfo[];
  keyFiles: KeyFile[];
  directories: DirectoryNode;
}

// ============================================================================
// Docs Index Types
// ============================================================================

export interface DocInfo {
  path: string;
  relativePath: string;
  title: string;
  description: string;
  headings: string[];
  wordCount: number;
  lastModified: string;
}

export interface DocCategory {
  name: string;
  path: string;
  description: string;
  documents: DocInfo[];
}

export interface DocsIndex {
  categories: DocCategory[];
  totalCount: number;
  lastUpdated: string;
}

// ============================================================================
// AI Enhancer Types
// ============================================================================

export interface EnhanceRequest {
  path: string;
  content: string;
  exports: string[];
}

export interface EnhanceResult {
  description: string;
  purpose: string;
  keyExports: Array<{
    name: string;
    description: string;
  }>;
}

export interface ImportanceScore {
  path: string;
  score: number;
  reasons: string[];
}

// ============================================================================
// Builder Types
// ============================================================================

export interface IndexBuilderOptions {
  projectDir: string;
  outputDir: string;
  enableAI: boolean;
  verbose: boolean;
}

export interface GenerateResult {
  success: boolean;
  outputDir: string;
  files: string[];
  duration: number;
  errors?: string[];
}
