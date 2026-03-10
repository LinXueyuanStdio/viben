/**
 * Overview Formatter - Generates overview.md
 */

import type { CodeIndex, DirectoryNode, DocsIndex } from '../types';

export class OverviewFormatter {
  private codeIndex: CodeIndex;
  private docsIndex: DocsIndex;

  constructor(codeIndex: CodeIndex, docsIndex: DocsIndex) {
    this.codeIndex = codeIndex;
    this.docsIndex = docsIndex;
  }

  format(): string {
    const lines: string[] = [];

    lines.push('# Project Overview');
    lines.push('');
    lines.push(`> 自动生成于 ${new Date().toISOString().split('T')[0]}，请勿手动编辑`);
    lines.push('');

    // Tech Stack
    lines.push('## 技术栈');
    lines.push('');
    lines.push(...this.formatTechStack());
    lines.push('');

    // Project Structure
    lines.push('## 项目结构');
    lines.push('');
    lines.push('```');
    lines.push(...this.formatDirectoryTree(this.codeIndex.directories, ''));
    lines.push('```');
    lines.push('');

    // Module Dependencies
    if (this.codeIndex.packages.length > 1) {
      lines.push('## 模块依赖');
      lines.push('');
      lines.push(...this.formatDependencies());
      lines.push('');
    }

    // Quick Navigation
    lines.push('## 快速导航');
    lines.push('');
    lines.push('- [代码索引](./code-index.md)');
    lines.push('- [文档索引](./docs-index.md)');
    lines.push('');

    // Stats
    lines.push('## 统计信息');
    lines.push('');
    lines.push(`- **Apps**: ${this.codeIndex.apps.length}`);
    lines.push(`- **Packages**: ${this.codeIndex.packages.length}`);
    lines.push(`- **关键文件**: ${this.codeIndex.keyFiles.length}`);
    lines.push(`- **文档数量**: ${this.docsIndex.totalCount}`);

    return lines.join('\n');
  }

  private formatTechStack(): string[] {
    const lines: string[] = [];
    const { techStack } = this.codeIndex;

    lines.push('| 类型 | 技术 |');
    lines.push('|------|------|');

    if (techStack.languages.length > 0) {
      lines.push(`| 语言 | ${techStack.languages.join(', ')} |`);
    }

    if (techStack.frameworks.length > 0) {
      lines.push(`| 框架 | ${techStack.frameworks.join(', ')} |`);
    }

    if (techStack.buildTools.length > 0) {
      lines.push(`| 构建 | ${techStack.buildTools.join(', ')} |`);
    }

    return lines;
  }

  private formatDirectoryTree(node: DirectoryNode, prefix: string): string[] {
    const lines: string[] = [];
    const isRoot = !prefix;

    if (isRoot) {
      lines.push(`${node.name || 'project'}/`);
    }

    if (!node.children) return lines;

    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const isLast = i === children.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const newPrefix = prefix + (isLast ? '    ' : '│   ');

      const suffix = child.type === 'dir' ? '/' : '';
      const comment = this.getDirectoryComment(child.path);
      const commentStr = comment ? `  # ${comment}` : '';

      lines.push(`${prefix}${connector}${child.name}${suffix}${commentStr}`);

      if (child.children && child.children.length > 0) {
        lines.push(...this.formatDirectoryTree(child, newPrefix));
      }
    }

    return lines;
  }

  private getDirectoryComment(dirPath: string): string {
    // Find matching app or package
    for (const app of this.codeIndex.apps) {
      if (app.path === dirPath) {
        const framework = app.framework ? ` (${app.framework})` : '';
        return `${app.type}${framework}`;
      }
    }

    for (const pkg of this.codeIndex.packages) {
      if (pkg.path === dirPath) {
        return pkg.description || pkg.name;
      }
    }

    // Default comments for known directories
    const comments: Record<string, string> = {
      apps: 'Applications',
      packages: 'Shared packages',
      docs: 'Documentation',
      scripts: 'Build scripts',
      '.viben: 'Viben workspace',
    };

    return comments[dirPath] || '';
  }

  private formatDependencies(): string[] {
    const lines: string[] = [];
    const pkgMap = new Map<string, string[]>();

    // Build dependency map
    for (const pkg of this.codeIndex.packages) {
      if (pkg.dependencies.length > 0) {
        pkgMap.set(pkg.name, pkg.dependencies);
      }
    }

    // Also add app dependencies
    for (const app of this.codeIndex.apps) {
      // Apps typically depend on packages - we'll show this relationship
      const appDeps = this.codeIndex.packages
        .filter((pkg) => pkg.name.startsWith('@'))
        .map((pkg) => pkg.name);
      if (appDeps.length > 0) {
        pkgMap.set(app.name, appDeps.slice(0, 3)); // Limit to 3
      }
    }

    if (pkgMap.size === 0) {
      lines.push('暂无模块间依赖。');
      return lines;
    }

    lines.push('```mermaid');
    lines.push('graph LR');

    for (const [pkg, deps] of pkgMap) {
      const shortName = this.shortenPackageName(pkg);
      for (const dep of deps) {
        const shortDep = this.shortenPackageName(dep);
        lines.push(`    ${shortName} --> ${shortDep}`);
      }
    }

    lines.push('```');

    return lines;
  }

  private shortenPackageName(name: string): string {
    // @viben/core -> core
    // viben-desktop -> desktop
    return name
      .replace(/^@\w+\//, '')
      .replace(/^viben-/, '')
      .replace(/-/g, '_');
  }
}
