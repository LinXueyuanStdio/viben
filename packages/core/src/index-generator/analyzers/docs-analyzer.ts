/**
 * Docs Analyzer - Analyzes documentation structure
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DocCategory, DocInfo, DocsIndex } from '../types';
import { DOC_CATEGORIES, DOC_EXTENSIONS, SKIP_DIRS } from '../constants';

export class DocsAnalyzer {
  private projectDir: string;
  private docsDir: string;

  constructor(projectDir: string) {
    this.projectDir = path.resolve(projectDir);
    this.docsDir = path.join(this.projectDir, 'docs');
  }

  async analyze(): Promise<DocsIndex> {
    if (!fs.existsSync(this.docsDir)) {
      return {
        categories: [],
        totalCount: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    const allDocs = this.collectDocs();
    const categories = this.categorizeDocsByPath(allDocs);

    return {
      categories,
      totalCount: allDocs.length,
      lastUpdated: new Date().toISOString(),
    };
  }

  private collectDocs(): DocInfo[] {
    const docs: DocInfo[] = [];

    this.walkDirectory(this.docsDir, (filePath) => {
      const ext = path.extname(filePath);
      if (!DOC_EXTENSIONS.has(ext)) return;

      const docInfo = this.extractDocInfo(filePath);
      if (docInfo) {
        docs.push(docInfo);
      }
    });

    // Sort by lastModified descending
    docs.sort(
      (a, b) =>
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );

    return docs;
  }

  private extractDocInfo(filePath: string): DocInfo | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(this.projectDir, filePath);
      const relativeToDocsPath = path.relative(this.docsDir, filePath);

      // Extract title (first # heading)
      const titleLine = lines.find((l) => l.startsWith('# '));
      const title = titleLine
        ? titleLine.slice(2).trim()
        : path.basename(filePath, path.extname(filePath));

      // Extract description (first non-empty paragraph after title)
      let description = '';
      const titleIndex = titleLine ? lines.indexOf(titleLine) : -1;
      if (titleIndex >= 0) {
        for (let i = titleIndex + 1; i < lines.length; i++) {
          const line = lines[i].trim();
          // Skip empty lines, headings, and special markdown
          if (!line) continue;
          if (line.startsWith('#')) continue;
          if (line.startsWith('>')) {
            // Extract from blockquote if it's descriptive
            description = line.slice(1).trim().slice(0, 200);
            break;
          }
          if (line.startsWith('-') || line.startsWith('*')) continue;
          if (line.startsWith('```')) continue;
          if (line.startsWith('|')) continue;

          description = line.slice(0, 200);
          break;
        }
      }

      // Extract headings (## level)
      const headings = lines
        .filter((l) => l.startsWith('## '))
        .map((l) => l.slice(3).trim());

      // Word count
      const wordCount = content
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/`[^`]+`/g, '') // Remove inline code
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      // Last modified
      const stats = fs.statSync(filePath);
      const lastModified = stats.mtime.toISOString();

      return {
        path: filePath,
        relativePath: relativeToDocsPath,
        title,
        description,
        headings,
        wordCount,
        lastModified,
      };
    } catch {
      return null;
    }
  }

  private categorizeDocsByPath(docs: DocInfo[]): DocCategory[] {
    const categoryMap = new Map<string, DocInfo[]>();

    for (const doc of docs) {
      const categoryKey = this.getCategoryKey(doc.relativePath);
      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, []);
      }
      categoryMap.get(categoryKey)!.push(doc);
    }

    const categories: DocCategory[] = [];

    // Sort categories by predefined order
    const sortedKeys = Array.from(categoryMap.keys()).sort((a, b) => {
      const orderA = Object.keys(DOC_CATEGORIES).indexOf(a);
      const orderB = Object.keys(DOC_CATEGORIES).indexOf(b);
      if (orderA === -1 && orderB === -1) return a.localeCompare(b);
      if (orderA === -1) return 1;
      if (orderB === -1) return -1;
      return orderA - orderB;
    });

    for (const key of sortedKeys) {
      const categoryDocs = categoryMap.get(key)!;
      categories.push({
        name: key,
        path: path.join('docs', key),
        description: DOC_CATEGORIES[key] || this.inferCategoryDescription(key),
        documents: categoryDocs,
      });
    }

    return categories;
  }

  private getCategoryKey(relativePath: string): string {
    const parts = relativePath.split(path.sep);

    // Try to match predefined categories (longest match first)
    const sortedCategories = Object.keys(DOC_CATEGORIES).sort(
      (a, b) => b.length - a.length
    );

    for (const category of sortedCategories) {
      const categoryParts = category.split('/');
      let matches = true;

      for (let i = 0; i < categoryParts.length; i++) {
        if (parts[i] !== categoryParts[i]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return category;
      }
    }

    // Fall back to first directory level
    if (parts.length > 1) {
      return parts[0];
    }

    return 'root';
  }

  private inferCategoryDescription(categoryKey: string): string {
    // Simple inference based on directory name
    const name = categoryKey.split('/').pop() || categoryKey;
    const titleCase = name.charAt(0).toUpperCase() + name.slice(1);
    return `${titleCase} 文档`;
  }

  private walkDirectory(
    dir: string,
    callback: (filePath: string) => void
  ): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          this.walkDirectory(fullPath, callback);
        } else if (entry.isFile()) {
          callback(fullPath);
        }
      }
    } catch {
      // Ignore permission errors
    }
  }
}
