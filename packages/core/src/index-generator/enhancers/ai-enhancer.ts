/**
 * AI Enhancer - Enhances file descriptions using AI
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EnhanceRequest, EnhanceResult, KeyFile } from '../types';
import { AI_THRESHOLD, MAX_AI_FILES, MAX_CONTENT_PREVIEW } from '../constants';

export class AIEnhancerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIEnhancerError';
  }
}

export class AIEnhancer {
  private projectDir: string;

  constructor(projectDir?: string) {
    this.projectDir = projectDir || process.cwd();
  }

  /**
   * Calculate importance score for a file
   */
  calculateImportance(file: KeyFile): number {
    let score = 0;
    const reasons: string[] = [];

    // Entry files +30
    if (/index\.(ts|tsx|js|jsx)$/.test(file.path)) {
      score += 30;
      reasons.push('entry file');
    }
    if (/main\.(ts|tsx|js|jsx|py)$/.test(file.path)) {
      score += 30;
      reasons.push('main file');
    }

    // Export count +2/each, max +20
    const exportCount = file.exports?.length || 0;
    const exportScore = Math.min(exportCount * 2, 20);
    if (exportScore > 0) {
      score += exportScore;
      reasons.push(`${exportCount} exports`);
    }

    // Core directories +20
    if (file.path.includes('/core/')) {
      score += 20;
      reasons.push('core directory');
    }
    if (file.path.includes('/lib/')) {
      score += 15;
      reasons.push('lib directory');
    }

    // Config files +10
    if (file.type === 'config') {
      score += 10;
      reasons.push('config file');
    }

    // Large files +10
    if (file.lineCount && file.lineCount > 200) {
      score += 10;
      reasons.push('large file');
    }

    return score;
  }

  /**
   * Filter files that need AI enhancement
   */
  filterImportantFiles(files: KeyFile[]): KeyFile[] {
    return files
      .map((f) => ({ file: f, score: this.calculateImportance(f) }))
      .filter(({ score }) => score >= AI_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_AI_FILES)
      .map(({ file }) => file);
  }

  /**
   * Enhance files with AI-generated descriptions
   */
  async enhance(files: KeyFile[]): Promise<Map<string, EnhanceResult>> {
    const results = new Map<string, EnhanceResult>();

    // Prepare requests
    const requests: EnhanceRequest[] = [];
    for (const file of files) {
      const filePath = path.join(this.projectDir, file.path);
      if (!fs.existsSync(filePath)) continue;

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        requests.push({
          path: file.path,
          content: content.slice(0, MAX_CONTENT_PREVIEW),
          exports: file.exports || [],
        });
      } catch {
        // Skip unreadable files
      }
    }

    if (requests.length === 0) {
      return results;
    }

    // For now, use static analysis as fallback
    // AI enhancement can be added later with actual API integration
    for (const request of requests) {
      const result = this.staticEnhance(request);
      results.set(request.path, result);
    }

    return results;
  }

  /**
   * Static enhancement fallback (no AI)
   */
  private staticEnhance(request: EnhanceRequest): EnhanceResult {
    const { content, exports } = request;

    // Try to extract description from comments
    let description = '';
    let purpose = '';

    // Check for file-level JSDoc
    const jsdocMatch = content.match(/^\/\*\*\s*([\s\S]*?)\*\//);
    if (jsdocMatch) {
      const comment = jsdocMatch[1]
        .replace(/^\s*\*\s?/gm, '')
        .trim();
      const lines = comment.split('\n');
      description = lines[0] || '';
      purpose = lines.slice(1).join(' ').trim().slice(0, 200);
    }

    // Try single-line comment
    if (!description) {
      const lineMatch = content.match(/^\/\/\s*(.+)/);
      if (lineMatch) {
        description = lineMatch[1].trim();
      }
    }

    // Infer from exports
    if (!description && exports.length > 0) {
      description = `Exports: ${exports.slice(0, 5).join(', ')}`;
    }

    // Infer purpose from path
    if (!purpose) {
      const fileName = path.basename(request.path, path.extname(request.path));
      purpose = `${fileName} module`;
    }

    // Extract key exports with basic descriptions
    const keyExports = exports.slice(0, 5).map((name) => ({
      name,
      description: this.inferExportDescription(content, name),
    }));

    return {
      description: description.slice(0, 200),
      purpose: purpose.slice(0, 200),
      keyExports,
    };
  }

  /**
   * Try to infer export description from code
   */
  private inferExportDescription(content: string, name: string): string {
    // Look for JSDoc comment before export
    const pattern = new RegExp(
      `\\/\\*\\*\\s*([\\s\\S]*?)\\*\\/\\s*export[^]*?${name}`,
      'm'
    );
    const match = content.match(pattern);

    if (match) {
      const comment = match[1]
        .replace(/^\s*\*\s?/gm, '')
        .trim()
        .split('\n')[0];
      return comment.slice(0, 100);
    }

    return '';
  }
}
