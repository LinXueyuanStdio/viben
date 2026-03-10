/**
 * Index Generator
 *
 * Generates project context index files for AI agents and developers.
 *
 * Output files:
 * - overview.md: Project overview with tech stack and structure
 * - code-index.md: Code structure with packages, apps, and key files
 * - docs-index.md: Documentation index organized by category
 */

export { IndexBuilder } from './builder';
export { CodeAnalyzer } from './analyzers/code-analyzer';
export { DocsAnalyzer } from './analyzers/docs-analyzer';
export { AIEnhancer, AIEnhancerError } from './enhancers/ai-enhancer';
export { CodeFormatter } from './formatters/code-formatter';
export { DocsFormatter } from './formatters/docs-formatter';
export { OverviewFormatter } from './formatters/overview-formatter';

export type {
  // Code Index Types
  CodeIndex,
  TechStack,
  PackageInfo,
  AppInfo,
  KeyFile,
  ExportInfo,
  DirectoryNode,
  // Docs Index Types
  DocsIndex,
  DocCategory,
  DocInfo,
  // AI Types
  EnhanceRequest,
  EnhanceResult,
  ImportanceScore,
  // Builder Types
  IndexBuilderOptions,
  GenerateResult,
} from './types';

export {
  SKIP_DIRS,
  CODE_EXTENSIONS,
  DOC_EXTENSIONS,
  AI_THRESHOLD,
  MAX_AI_FILES,
  DOC_CATEGORIES,
} from './constants';
