/**
 * Docs Formatter - Generates docs-index.md
 */

import * as path from 'path';
import type { DocCategory, DocsIndex } from '../types';

export class DocsFormatter {
  private docsIndex: DocsIndex;

  constructor(docsIndex: DocsIndex) {
    this.docsIndex = docsIndex;
  }

  format(): string {
    const lines: string[] = [];

    lines.push('# Documentation Index');
    lines.push('');
    lines.push(
      `> 自动生成于 ${new Date().toISOString().split('T')[0]} | 共 ${this.docsIndex.totalCount} 篇文档`
    );
    lines.push('');

    if (this.docsIndex.categories.length === 0) {
      lines.push('暂无文档。');
      return lines.join('\n');
    }

    // Group categories by top-level
    const grouped = this.groupByTopLevel();

    for (const [topLevel, categories] of Object.entries(grouped)) {
      lines.push(`## ${this.formatTopLevelName(topLevel)}`);
      lines.push('');

      for (const category of categories) {
        lines.push(...this.formatCategory(category, topLevel));
      }
    }

    return lines.join('\n');
  }

  private groupByTopLevel(): Record<string, DocCategory[]> {
    const grouped: Record<string, DocCategory[]> = {};

    for (const category of this.docsIndex.categories) {
      const topLevel = category.name.split('/')[0] || 'root';
      if (!grouped[topLevel]) {
        grouped[topLevel] = [];
      }
      grouped[topLevel].push(category);
    }

    return grouped;
  }

  private formatCategory(category: DocCategory, topLevel: string): string[] {
    const lines: string[] = [];

    // Only show sub-heading if category has sub-path
    const subPath = category.name.replace(`${topLevel}/`, '');
    if (subPath && subPath !== category.name) {
      lines.push(`### ${category.description} (${subPath}/)`);
    } else if (category.name !== topLevel) {
      lines.push(`### ${category.description}`);
    }

    lines.push('');

    if (category.documents.length === 0) {
      lines.push('暂无文档。');
      lines.push('');
      return lines;
    }

    // Table header
    lines.push('| 文档 | 描述 |');
    lines.push('|------|------|');

    for (const doc of category.documents) {
      const fileName = path.basename(doc.relativePath);
      const linkPath = `../${doc.relativePath}`;
      const description = this.truncate(doc.description, 60) || '-';

      lines.push(`| [${fileName}](${linkPath}) | ${description} |`);
    }

    lines.push('');
    return lines;
  }

  private formatTopLevelName(topLevel: string): string {
    const names: Record<string, string> = {
      specs: '规范文档 (specs/)',
      plans: '设计文档 (plans/)',
      work: '工作文档 (work/)',
      'design-system': '设计系统 (design-system/)',
      root: '根目录文档',
    };
    return names[topLevel] || `${topLevel}/`;
  }

  private truncate(str: string, maxLen: number): string {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + '...';
  }
}
