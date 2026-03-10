/**
 * Code Analyzer - Analyzes project code structure
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  AppInfo,
  CodeIndex,
  DirectoryNode,
  ExportInfo,
  KeyFile,
  PackageInfo,
  TechStack,
} from '../types';
import {
  CODE_EXTENSIONS,
  CONFIG_FILE_PATTERNS,
  ENTRY_FILE_PATTERNS,
  SKIP_DIRS,
  TECH_DETECTION,
} from '../constants';

export class CodeAnalyzer {
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = path.resolve(projectDir);
  }

  async analyze(): Promise<CodeIndex> {
    const techStack = await this.detectTechStack();
    const packages = await this.discoverPackages();
    const apps = await this.discoverApps();
    const keyFiles = await this.findKeyFiles();
    const directories = this.buildDirectoryTree();

    return {
      techStack,
      packages,
      apps,
      keyFiles,
      directories,
    };
  }

  private async detectTechStack(): Promise<TechStack> {
    const result: TechStack = {
      languages: [],
      frameworks: [],
      buildTools: [],
    };

    // Check root package.json for dependencies
    const packageJsonPath = path.join(this.projectDir, 'package.json');
    let packageJson: Record<string, unknown> = {};
    if (fs.existsSync(packageJsonPath)) {
      try {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      } catch {
        // Ignore parse errors
      }
    }

    const allDeps = {
      ...(packageJson.dependencies as Record<string, string> | undefined),
      ...(packageJson.devDependencies as Record<string, string> | undefined),
    };

    // Detect frameworks from dependencies
    for (const [framework, patterns] of Object.entries(
      TECH_DETECTION.frameworks
    )) {
      for (const pattern of patterns) {
        if (pattern instanceof RegExp) {
          if (Object.keys(allDeps).some((dep) => pattern.test(dep))) {
            result.frameworks.push(framework);
            break;
          }
        }
      }
    }

    // Detect build tools from files
    const rootFiles = fs.readdirSync(this.projectDir);
    for (const [tool, patterns] of Object.entries(TECH_DETECTION.buildTools)) {
      for (const pattern of patterns) {
        if (pattern instanceof RegExp) {
          if (rootFiles.some((file) => pattern.test(file))) {
            result.buildTools.push(tool);
            break;
          }
        }
      }
    }

    // Detect languages from file extensions
    const detectedLangs = new Set<string>();
    this.walkDirectory(this.projectDir, (filePath) => {
      const ext = path.extname(filePath);
      for (const [lang, patterns] of Object.entries(
        TECH_DETECTION.languages
      )) {
        for (const pattern of patterns) {
          if (pattern instanceof RegExp && pattern.test(filePath)) {
            detectedLangs.add(lang);
          }
        }
      }
    });
    result.languages = Array.from(detectedLangs);

    return result;
  }

  private async discoverPackages(): Promise<PackageInfo[]> {
    const packages: PackageInfo[] = [];
    const packagesDir = path.join(this.projectDir, 'packages');

    if (!fs.existsSync(packagesDir)) {
      return packages;
    }

    const dirs = fs.readdirSync(packagesDir);
    for (const dir of dirs) {
      const pkgPath = path.join(packagesDir, dir);
      const pkgJsonPath = path.join(pkgPath, 'package.json');

      if (!fs.existsSync(pkgJsonPath)) continue;

      try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const entryPoints = this.findEntryPoints(pkgPath);
        const exports = this.extractExports(pkgPath, entryPoints);
        const dependencies = this.extractInternalDeps(pkgJson, packages);

        packages.push({
          name: pkgJson.name || dir,
          path: `packages/${dir}`,
          description: pkgJson.description || '',
          entryPoints,
          exports,
          dependencies,
        });
      } catch {
        // Skip invalid packages
      }
    }

    return packages;
  }

  private async discoverApps(): Promise<AppInfo[]> {
    const apps: AppInfo[] = [];
    const appsDir = path.join(this.projectDir, 'apps');

    if (!fs.existsSync(appsDir)) {
      return apps;
    }

    const dirs = fs.readdirSync(appsDir);
    for (const dir of dirs) {
      const appPath = path.join(appsDir, dir);
      const pkgJsonPath = path.join(appPath, 'package.json');

      if (!fs.existsSync(pkgJsonPath)) continue;

      try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const appType = this.detectAppType(appPath, pkgJson);

        apps.push({
          name: pkgJson.name || dir,
          path: `apps/${dir}`,
          description: pkgJson.description || '',
          type: appType.type,
          framework: appType.framework,
        });
      } catch {
        // Skip invalid apps
      }
    }

    return apps;
  }

  private detectAppType(
    appPath: string,
    pkgJson: Record<string, unknown>
  ): { type: AppInfo['type']; framework?: string } {
    const deps = {
      ...(pkgJson.dependencies as Record<string, string> | undefined),
      ...(pkgJson.devDependencies as Record<string, string> | undefined),
    };

    // Check for Tauri
    if (
      fs.existsSync(path.join(appPath, 'src-tauri')) ||
      deps['@tauri-apps/api']
    ) {
      return { type: 'desktop', framework: 'Tauri' };
    }

    // Check for Next.js
    if (deps['next']) {
      return { type: 'web', framework: 'Next.js' };
    }

    // Check for React Native
    if (deps['react-native']) {
      return { type: 'mobile', framework: 'React Native' };
    }

    // Check for CLI
    if (pkgJson.bin) {
      return { type: 'cli' };
    }

    return { type: 'web' };
  }

  private async findKeyFiles(): Promise<KeyFile[]> {
    const keyFiles: KeyFile[] = [];

    this.walkDirectory(this.projectDir, (filePath) => {
      const relativePath = path.relative(this.projectDir, filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath);

      if (!CODE_EXTENSIONS.has(ext)) return;

      // Check if entry file
      const isEntry = ENTRY_FILE_PATTERNS.some((pattern) =>
        pattern.test(fileName)
      );

      // Check if config file
      const isConfig = CONFIG_FILE_PATTERNS.some((pattern) =>
        pattern.test(relativePath)
      );

      // Check if in core directory
      const isCore =
        relativePath.includes('/core/') || relativePath.includes('/lib/');

      if (isEntry || isConfig || isCore) {
        const content = this.safeReadFile(filePath);
        const exports = this.extractExportNames(content);
        const lineCount = content.split('\n').length;

        keyFiles.push({
          path: relativePath,
          type: isEntry ? 'entry' : isConfig ? 'config' : 'core',
          description: this.extractFirstComment(content),
          exports,
          lineCount,
        });
      }
    });

    // Sort by importance (entry > config > core)
    const typeOrder = { entry: 0, config: 1, core: 2, util: 3 };
    keyFiles.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

    return keyFiles.slice(0, 100); // Limit to 100 files
  }

  private buildDirectoryTree(): DirectoryNode {
    return this.buildNode(this.projectDir, 0, 2);
  }

  private buildNode(
    dirPath: string,
    depth: number,
    maxDepth: number
  ): DirectoryNode {
    const name = path.basename(dirPath);
    const relativePath = path.relative(this.projectDir, dirPath);

    const node: DirectoryNode = {
      name,
      path: relativePath || '.',
      type: 'dir',
    };

    if (depth >= maxDepth) return node;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const children: DirectoryNode[] = [];

      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.viben') continue;

        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          children.push(this.buildNode(entryPath, depth + 1, maxDepth));
        }
      }

      if (children.length > 0) {
        node.children = children.sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch {
      // Ignore permission errors
    }

    return node;
  }

  private findEntryPoints(pkgPath: string): string[] {
    const entryPoints: string[] = [];
    const srcDir = path.join(pkgPath, 'src');

    if (fs.existsSync(srcDir)) {
      const files = fs.readdirSync(srcDir);
      for (const file of files) {
        if (ENTRY_FILE_PATTERNS.some((pattern) => pattern.test(file))) {
          entryPoints.push(`src/${file}`);
        }
      }
    }

    // Check root level too
    const rootFiles = fs.readdirSync(pkgPath);
    for (const file of rootFiles) {
      if (ENTRY_FILE_PATTERNS.some((pattern) => pattern.test(file))) {
        entryPoints.push(file);
      }
    }

    return entryPoints;
  }

  private extractExports(
    pkgPath: string,
    entryPoints: string[]
  ): ExportInfo[] {
    const exports: ExportInfo[] = [];

    for (const entry of entryPoints) {
      const filePath = path.join(pkgPath, entry);
      if (!fs.existsSync(filePath)) continue;

      const content = this.safeReadFile(filePath);
      const names = this.extractExportNames(content);

      for (const name of names) {
        const type = this.inferExportType(content, name);
        exports.push({ name, type });
      }
    }

    return exports.slice(0, 20); // Limit exports
  }

  private extractExportNames(content: string): string[] {
    const names: string[] = [];
    const patterns = [
      /export\s+(?:async\s+)?function\s+(\w+)/g,
      /export\s+class\s+(\w+)/g,
      /export\s+const\s+(\w+)/g,
      /export\s+(?:type|interface)\s+(\w+)/g,
      /export\s+\{\s*([^}]+)\s*\}/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (pattern.source.includes('{')) {
          // Handle named exports
          const exported = match[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]);
          names.push(...exported);
        } else {
          names.push(match[1]);
        }
      }
    }

    return [...new Set(names)];
  }

  private inferExportType(
    content: string,
    name: string
  ): ExportInfo['type'] {
    if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}`).test(content)) {
      return 'function';
    }
    if (new RegExp(`export\\s+class\\s+${name}`).test(content)) {
      return 'class';
    }
    if (new RegExp(`export\\s+type\\s+${name}`).test(content)) {
      return 'type';
    }
    if (new RegExp(`export\\s+interface\\s+${name}`).test(content)) {
      return 'interface';
    }
    if (new RegExp(`export\\s+default`).test(content) && name === 'default') {
      return 'default';
    }
    return 'const';
  }

  private extractInternalDeps(
    pkgJson: Record<string, unknown>,
    existingPackages: PackageInfo[]
  ): string[] {
    const deps = Object.keys({
      ...(pkgJson.dependencies as Record<string, string> | undefined),
      ...(pkgJson.devDependencies as Record<string, string> | undefined),
    });

    const internalNames = existingPackages.map((p) => p.name);
    return deps.filter((dep) => internalNames.includes(dep));
  }

  private extractFirstComment(content: string): string {
    // Try to extract JSDoc or block comment at start
    const match = content.match(/^\/\*\*?\s*([\s\S]*?)\*\//);
    if (match) {
      return match[1]
        .replace(/^\s*\*\s?/gm, '')
        .split('\n')[0]
        .trim()
        .slice(0, 100);
    }

    // Try single line comment
    const lineMatch = content.match(/^\/\/\s*(.+)/);
    if (lineMatch) {
      return lineMatch[1].trim().slice(0, 100);
    }

    return '';
  }

  private walkDirectory(dir: string, callback: (filePath: string) => void): void {
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

  private safeReadFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  }
}
