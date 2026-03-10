/**
 * Code Formatter - Generates code-index.md
 */

import type { CodeIndex, KeyFile, PackageInfo } from '../types';

export class CodeFormatter {
  private codeIndex: CodeIndex;

  constructor(codeIndex: CodeIndex) {
    this.codeIndex = codeIndex;
  }

  format(): string {
    const lines: string[] = [];

    lines.push('# Code Index');
    lines.push('');
    lines.push(`> 自动生成于 ${new Date().toISOString().split('T')[0]}，请勿手动编辑`);
    lines.push('');

    // Packages section
    if (this.codeIndex.packages.length > 0) {
      lines.push('## Packages');
      lines.push('');

      for (const pkg of this.codeIndex.packages) {
        lines.push(...this.formatPackage(pkg));
        lines.push('');
      }
    }

    // Apps section
    if (this.codeIndex.apps.length > 0) {
      lines.push('## Apps');
      lines.push('');

      lines.push('| App | 路径 | 类型 | 框架 | 描述 |');
      lines.push('|-----|------|------|------|------|');

      for (const app of this.codeIndex.apps) {
        const framework = app.framework || '-';
        const description = app.description || '-';
        lines.push(
          `| ${app.name} | \`${app.path}\` | ${app.type} | ${framework} | ${description} |`
        );
      }
      lines.push('');
    }

    // Key Files section
    const keyFilesByType = this.groupKeyFilesByType();

    if (Object.keys(keyFilesByType).length > 0) {
      lines.push('## Key Files');
      lines.push('');

      for (const [type, files] of Object.entries(keyFilesByType)) {
        lines.push(`### ${this.formatFileType(type)}`);
        lines.push('');
        lines.push('| 文件 | 描述 | 导出数 |');
        lines.push('|------|------|--------|');

        for (const file of files) {
          const desc = file.description || file.purpose || '-';
          const exportCount = file.exports?.length || 0;
          lines.push(`| \`${file.path}\` | ${desc} | ${exportCount} |`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private formatPackage(pkg: PackageInfo): string[] {
    const lines: string[] = [];

    lines.push(`### ${pkg.name}`);
    lines.push('');
    lines.push(`**路径**: \`${pkg.path}\``);

    if (pkg.description) {
      lines.push(`**描述**: ${pkg.description}`);
    }

    lines.push('');

    // Entry points
    if (pkg.entryPoints.length > 0) {
      lines.push('**入口文件**:');
      for (const entry of pkg.entryPoints) {
        lines.push(`- \`${entry}\``);
      }
      lines.push('');
    }

    // Main exports
    if (pkg.exports.length > 0) {
      lines.push('**主要导出**:');
      for (const exp of pkg.exports.slice(0, 10)) {
        const typeLabel = this.formatExportType(exp.type);
        lines.push(`- \`${exp.name}\` (${typeLabel})`);
      }
      if (pkg.exports.length > 10) {
        lines.push(`- ... 及其他 ${pkg.exports.length - 10} 个导出`);
      }
      lines.push('');
    }

    // Internal dependencies
    if (pkg.dependencies.length > 0) {
      lines.push('**内部依赖**:');
      for (const dep of pkg.dependencies) {
        lines.push(`- \`${dep}\``);
      }
      lines.push('');
    }

    lines.push('---');

    return lines;
  }

  private groupKeyFilesByType(): Record<string, KeyFile[]> {
    const grouped: Record<string, KeyFile[]> = {};

    for (const file of this.codeIndex.keyFiles) {
      if (!grouped[file.type]) {
        grouped[file.type] = [];
      }
      grouped[file.type].push(file);
    }

    return grouped;
  }

  private formatFileType(type: string): string {
    const labels: Record<string, string> = {
      entry: '入口文件 (Entry)',
      config: '配置文件 (Config)',
      core: '核心文件 (Core)',
      util: '工具文件 (Util)',
    };
    return labels[type] || type;
  }

  private formatExportType(type: string): string {
    const labels: Record<string, string> = {
      function: 'fn',
      class: 'class',
      const: 'const',
      type: 'type',
      interface: 'interface',
      default: 'default',
    };
    return labels[type] || type;
  }
}
