import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('cmdSetup', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-setup-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes config.json with correct fields when --dir flag provided', async () => {
    const { cmdSetup } = await import('../setup.js');
    await cmdSetup(
      ['--dir', '/tmp/my-workspace', '--agent', 'claude-code', '--run-mode', 'daemon'],
      tmpDir,
    );

    const configPath = path.join(tmpDir, 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.workspace).toBeUndefined();
    expect(config.defaultAgent).toBe('claude-code');
    expect(config.runMode).toBe('daemon');
    expect(config.autoStart).toBe(false);
  });

  it('ignores unknown flags like --workspace (handled upstream in cli.ts)', async () => {
    // --workspace deprecation is now handled in cli.ts before cmdSetup is called.
    // cmdSetup receives the resolved instanceRoot and ignores --workspace in args.
    const { cmdSetup } = await import('../setup.js');
    await cmdSetup(
      ['--workspace', '/tmp/my-workspace', '--agent', 'claude-code', '--run-mode', 'daemon'],
      tmpDir,
    );

    const configPath = path.join(tmpDir, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.workspace).toBeUndefined();
    expect(config.defaultAgent).toBe('claude-code');
  });

  it('uses first agent when comma-separated agents passed', async () => {
    const { cmdSetup } = await import('../setup.js');
    await cmdSetup(['--dir', '/tmp/ws', '--agent', 'claude-code,gemini'], tmpDir);

    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'));
    expect(config.defaultAgent).toBe('claude-code');
  });

  it('outputs JSON result when --json flag is passed', async () => {
    const { captureJsonOutput, expectValidJsonSuccess } = await import('./helpers/json-test-utils.js');
    const { cmdSetup } = await import('../setup.js');
    const result = await captureJsonOutput(async () => {
      await cmdSetup(
        ['--dir', '/tmp/ws', '--agent', 'claude-code', '--json'],
        tmpDir,
      );
    });
    expect(result.exitCode).toBe(0);
    const data = expectValidJsonSuccess(result.stdout);
    expect(data).toHaveProperty('configPath');
    expect((data.configPath as string)).toContain('config.json');
  });

  it('exits with code 1 when --agent is missing', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit called'); }) as any);

    const { cmdSetup } = await import('../setup.js');
    await expect(cmdSetup(['--dir', '/tmp/ws'], tmpDir)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
