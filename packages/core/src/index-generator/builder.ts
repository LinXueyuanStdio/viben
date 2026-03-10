/**
 * Index Builder - Main orchestrator for index generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodeAnalyzer } from './analyzers/code-analyzer';
import { DocsAnalyzer } from './analyzers/docs-analyzer';
import { AIEnhancer, AIEnhancerError } from './enhancers/ai-enhancer';
import { CodeFormatter } from './formatters/code-formatter';
import { DocsFormatter } from './formatters/docs-formatter';
import { OverviewFormatter } from './formatters/overview-formatter';
import type {
  CodeIndex,
  EnhanceResult,
  GenerateResult,
  IndexBuilderOptions,
  KeyFile,
} from './types';

export class IndexBuilder {
  private codeAnalyzer: CodeAnalyzer;
  private docsAnalyzer: DocsAnalyzer;
  private aiEnhancer: AIEnhancer | null;
  private options: IndexBuilderOptions;

  constructor(options: IndexBuilderOptions) {
    this.options = {
      ...options,
      projectDir: path.resolve(options.projectDir),
      outputDir: path.resolve(options.projectDir, options.outputDir),
    };

    this.codeAnalyzer = new CodeAnalyzer(this.options.projectDir);
    this.docsAnalyzer = new DocsAnalyzer(this.options.projectDir);
    this.aiEnhancer = options.enableAI
      ? new AIEnhancer(this.options.projectDir)
      : null;
  }

  async generate(): Promise<GenerateResult> {
    const startTime = Date.now();
    const files: string[] = [];
    const errors: string[] = [];

    try {
      // 1. Analyze code structure
      this.log('🔍 Analyzing project structure...');
      const codeIndex = await this.codeAnalyzer.analyze();
      this.log(
        `   Found ${codeIndex.apps.length} apps, ${codeIndex.packages.length} packages`
      );

      // 2. Analyze documentation
      this.log('📄 Scanning documentation...');
      const docsIndex = await this.docsAnalyzer.analyze();
      this.log(`   Found ${docsIndex.totalCount} markdown files`);

      // 3. AI enhancement (optional)
      if (this.aiEnhancer) {
        try {
          const importantFiles = this.aiEnhancer.filterImportantFiles(
            codeIndex.keyFiles
          );
          this.log(
            `🤖 Enhancing with AI (${importantFiles.length} important files)...`
          );

          const enhanced = await this.aiEnhancer.enhance(importantFiles);
          this.applyEnhancements(codeIndex, enhanced);

          for (const filePath of enhanced.keys()) {
            this.log(`   ✓ ${filePath}`, true);
          }
        } catch (error) {
          if (error instanceof AIEnhancerError) {
            this.log('⚠️ AI enhancement failed, using static analysis only');
            errors.push(`AI enhancement failed: ${error.message}`);
          } else {
            throw error;
          }
        }
      }

      // 4. Generate output files
      this.log('📝 Generating index files...');
      await fs.promises.mkdir(this.options.outputDir, { recursive: true });

      // Generate overview.md
      const overviewFormatter = new OverviewFormatter(codeIndex, docsIndex);
      const overviewPath = await this.writeFile(
        'overview.md',
        overviewFormatter.format()
      );
      files.push(overviewPath);

      // Generate code-index.md
      const codeFormatter = new CodeFormatter(codeIndex);
      const codePath = await this.writeFile(
        'code-index.md',
        codeFormatter.format()
      );
      files.push(codePath);

      // Generate docs-index.md
      const docsFormatter = new DocsFormatter(docsIndex);
      const docsPath = await this.writeFile(
        'docs-index.md',
        docsFormatter.format()
      );
      files.push(docsPath);

      const duration = Date.now() - startTime;

      this.log('');
      this.log('✅ Index generated successfully!');
      this.log(`   Output: ${this.options.outputDir}`);
      this.log(`   Files: ${files.length}`);
      this.log(`   Time: ${(duration / 1000).toFixed(1)}s`);

      return {
        success: true,
        outputDir: this.options.outputDir,
        files,
        duration,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      errors.push(message);

      this.log(`❌ Failed: ${message}`);

      return {
        success: false,
        outputDir: this.options.outputDir,
        files,
        duration,
        errors,
      };
    }
  }

  private applyEnhancements(
    codeIndex: CodeIndex,
    enhanced: Map<string, EnhanceResult>
  ): void {
    for (const file of codeIndex.keyFiles) {
      const result = enhanced.get(file.path);
      if (result) {
        if (result.description) {
          file.description = result.description;
        }
        if (result.purpose) {
          file.purpose = result.purpose;
        }
      }
    }
  }

  private async writeFile(name: string, content: string): Promise<string> {
    const filePath = path.join(this.options.outputDir, name);
    await fs.promises.writeFile(filePath, content, 'utf-8');
    this.log(`   ✓ ${path.relative(this.options.projectDir, filePath)}`);
    return filePath;
  }

  private log(message: string, verboseOnly = false): void {
    if (verboseOnly && !this.options.verbose) {
      return;
    }
    console.log(message);
  }
}
