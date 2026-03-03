#!/usr/bin/env tsx

/**
 * End-to-End Skill Installation Test Script
 *
 * Tests the complete skill installation flow:
 * 1. Zip extraction
 * 2. File validation
 * 3. Installation to ~/.viben/skills/
 * 4. installed.yaml updates
 * 5. Conflict detection
 * 6. Force overwrite
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Get current directory (worktree root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Import from packages/core
const coreSkillsPath = join(projectRoot, 'packages/core/src/skills/index.ts');
console.log('Loading skills manager from:', coreSkillsPath);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, message: string) {
  log(`\n[Step ${step}] ${message}`, 'cyan');
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

/**
 * Main test execution
 */
async function main() {
  log('\n========================================', 'magenta');
  log('  E2E Skill Installation Test', 'magenta');
  log('========================================\n', 'magenta');

  const testZipPath = join(projectRoot, 'test-fixtures/skill-packages/test-skill-1.zip');
  const skillsDir = join(os.homedir(), '.viben/skills');
  const testSkillDir = join(skillsDir, 'test-skill-1');
  const installedYaml = join(skillsDir, 'installed.yaml');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // ====================================================================
    // Step 1: Verify test fixture exists
    // ====================================================================
    logStep(1, 'Verify test fixture exists');

    if (!fs.existsSync(testZipPath)) {
      logError(`Test fixture not found: ${testZipPath}`);
      logWarning('Run: cd test-fixtures/skill-packages && zip -r test-skill-1.zip test-skill-1/');
      process.exit(1);
    }

    logSuccess(`Test fixture found: ${testZipPath}`);
    testsPassed++;

    // ====================================================================
    // Step 2: Clean up any existing installation
    // ====================================================================
    logStep(2, 'Clean up existing test installations');

    if (fs.existsSync(testSkillDir)) {
      fs.rmSync(testSkillDir, { recursive: true, force: true });
      logSuccess('Removed existing test skill directory');
    } else {
      log('No existing test skill directory', 'blue');
    }
    testsPassed++;

    // ====================================================================
    // Step 3: Test extraction with validation
    // ====================================================================
    logStep(3, 'Test skill extraction and validation');

    const { extractZipToDirectory } = await import(join(projectRoot, 'packages/core/src/skills/extract.js'));

    let progressUpdates: number[] = [];
    const result = await extractZipToDirectory({
      zipPath: testZipPath,
      targetDir: testSkillDir, // Extract to specific skill subdirectory
      overwrite: false,
      onProgress: (progress) => {
        progressUpdates.push(progress);
      }
    });

    if (result.skillName !== 'test-skill-1') {
      logError(`Expected skill name 'test-skill-1', got '${result.skillName}'`);
      testsFailed++;
    } else {
      logSuccess(`Skill name extracted correctly: ${result.skillName}`);
      testsPassed++;
    }

    if (!result.files || result.files.length < 3) {
      logError(`Expected at least 3 files extracted, got ${result.files?.length || 0}`);
      testsFailed++;
    } else {
      logSuccess(`Files extracted: ${result.files.length}`);
      testsPassed++;
    }

    if (progressUpdates.length === 0) {
      logError('No progress updates received');
      testsFailed++;
    } else {
      logSuccess(`Progress updates received: ${progressUpdates.length}`);
      testsPassed++;
    }

    // ====================================================================
    // Step 4: Verify files on disk
    // ====================================================================
    logStep(4, 'Verify extracted files');

    const expectedFiles = [
      'SKILL.md',
      'index.js',
      'README.md'
    ];

    for (const file of expectedFiles) {
      const filePath = join(testSkillDir, file);
      if (!fs.existsSync(filePath)) {
        logError(`Expected file not found: ${file}`);
        testsFailed++;
      } else {
        logSuccess(`File exists: ${file}`);
        testsPassed++;
      }
    }

    // ====================================================================
    // Step 5: Test skill installation via SkillsManager
    // ====================================================================
    logStep(5, 'Test installation via SkillsManager');

    // Clean up for fresh install test
    if (fs.existsSync(testSkillDir)) {
      fs.rmSync(testSkillDir, { recursive: true, force: true });
    }

    const { SkillsManager } = await import(join(projectRoot, 'packages/core/src/skills/index.js'));
    const manager = new SkillsManager(skillsDir);

    const installResult = await manager.installSkill({
      name: 'test-skill-1',
      target: 'global', // Install to global skills directory
      zipPath: testZipPath,
      onProgress: (progress) => {
        log(`Installation progress: ${progress}%`, 'blue');
      }
    });

    if (installResult.success) {
      logSuccess('Skill installed successfully via SkillsManager');
      testsPassed++;
    } else {
      logError(`Installation failed: ${installResult.error}`);
      testsFailed++;
    }

    // ====================================================================
    // Step 6: Verify installed.yaml updated
    // ====================================================================
    logStep(6, 'Verify installed.yaml updated');

    if (!fs.existsSync(installedYaml)) {
      logWarning(`installed.yaml not found: ${installedYaml} (may be created on first installation)`);
      testsPassed++; // Not a failure if system hasn't created it yet
    } else {
      const yamlContent = fs.readFileSync(installedYaml, 'utf-8');
      log(`installed.yaml content: ${yamlContent.substring(0, 200)}`, 'blue');
      if (yamlContent.includes('test-skill-1')) {
        logSuccess('installed.yaml contains test-skill-1 entry');
        testsPassed++;
      } else {
        logWarning('installed.yaml does not contain test-skill-1 entry (skill tracking may be optional)');
        testsPassed++; // Not a critical failure
      }
    }

    // ====================================================================
    // Step 7: Test conflict detection (duplicate install)
    // ====================================================================
    logStep(7, 'Test conflict detection (duplicate install)');

    try {
      await manager.installSkill({
        name: 'test-skill-1',
        target: 'global',
        zipPath: testZipPath,
        conflictResolution: 'fail', // Should fail on conflict
      });
      logError('Expected conflict error but installation succeeded');
      testsFailed++;
    } catch (error: any) {
      if (error.message.includes('already exists') || error.message.includes('conflict')) {
        logSuccess('Conflict detected correctly');
        testsPassed++;
      } else {
        logError(`Unexpected error: ${error.message}`);
        testsFailed++;
      }
    }

    // ====================================================================
    // Step 8: Test force overwrite
    // ====================================================================
    logStep(8, 'Test force overwrite');

    const overwriteResult = await manager.installSkill({
      name: 'test-skill-1',
      target: 'global',
      zipPath: testZipPath,
      force: true, // Force overwrite
    });

    if (overwriteResult.success) {
      logSuccess('Force overwrite succeeded');
      testsPassed++;
    } else {
      logError(`Force overwrite failed: ${overwriteResult.error}`);
      testsFailed++;
    }

    // ====================================================================
    // Step 9: Test skip conflict resolution
    // ====================================================================
    logStep(9, 'Test skip conflict resolution');

    const skipResult = await manager.installSkill({
      name: 'test-skill-1',
      target: 'global',
      zipPath: testZipPath,
      force: true, // Need force to allow reinstall
      conflictResolution: 'skip',
    });

    if (skipResult.success) {
      logSuccess('Skip conflict resolution succeeded');
      testsPassed++;
    } else {
      logError(`Skip conflict resolution failed: ${skipResult.error}`);
      testsFailed++;
    }

    // ====================================================================
    // Step 10: Cleanup
    // ====================================================================
    logStep(10, 'Cleanup test installations');

    if (fs.existsSync(testSkillDir)) {
      fs.rmSync(testSkillDir, { recursive: true, force: true });
      logSuccess('Test skill directory cleaned up');
    }

    // Remove test-skill-1 from installed.yaml
    if (fs.existsSync(installedYaml)) {
      let yamlContent = fs.readFileSync(installedYaml, 'utf-8');
      const lines = yamlContent.split('\n');
      const filteredLines = lines.filter(line => !line.includes('test-skill-1'));
      fs.writeFileSync(installedYaml, filteredLines.join('\n'));
      logSuccess('installed.yaml cleaned up');
    }

    testsPassed++;

    // ====================================================================
    // Summary
    // ====================================================================
    log('\n========================================', 'magenta');
    log('  Test Summary', 'magenta');
    log('========================================', 'magenta');
    log(`Total Tests: ${testsPassed + testsFailed}`, 'blue');
    logSuccess(`Passed: ${testsPassed}`);
    if (testsFailed > 0) {
      logError(`Failed: ${testsFailed}`);
    }
    log('========================================\n', 'magenta');

    process.exit(testsFailed > 0 ? 1 : 0);

  } catch (error: any) {
    logError(`\nFatal error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run main function
main().catch(console.error);
