/**
 * Unit tests for lib/output.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { OutputContext } from '../../src/types';
import {
  successResponse,
  errorResponse,
  output,
  outputKeyValue,
  outputTable,
  formatDate,
  verbose,
  debug,
} from '../../src/lib/output';

describe('output.ts', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogOutput: string[];

  beforeEach(() => {
    consoleLogOutput = [];
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      consoleLogOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('successResponse', () => {
    it('should create a success response with data', () => {
      const response = successResponse({ value: 42 });
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ value: 42 });
      expect(response.error).toBeUndefined();
    });

    it('should create a success response with null data', () => {
      const response = successResponse(null);
      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });
  });

  describe('errorResponse', () => {
    it('should create an error response', () => {
      const response = errorResponse('TEST_ERROR', 'Something went wrong');
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('TEST_ERROR');
      expect(response.error?.message).toBe('Something went wrong');
    });

    it('should include details if provided', () => {
      const response = errorResponse('TEST_ERROR', 'Error', { extra: 'info' });
      expect(response.error?.details).toEqual({ extra: 'info' });
    });
  });

  describe('output', () => {
    it('should output JSON when json mode is enabled', () => {
      const ctx: OutputContext = { json: true, verbose: false, quiet: false };
      const response = successResponse({ test: 'data' });
      let humanCalled = false;

      output(ctx, response, () => {
        humanCalled = true;
      });

      expect(humanCalled).toBe(false);
      expect(consoleLogOutput.length).toBe(1);
      const parsed = JSON.parse(consoleLogOutput[0]);
      expect(parsed.success).toBe(true);
      expect(parsed.data.test).toBe('data');
    });

    it('should call humanFn when not in json mode', () => {
      const ctx: OutputContext = { json: false, verbose: false, quiet: false };
      const response = successResponse({ test: 'data' });
      let humanCalled = false;

      output(ctx, response, () => {
        humanCalled = true;
      });

      expect(humanCalled).toBe(true);
    });

    it('should suppress output in quiet mode for success', () => {
      const ctx: OutputContext = { json: false, verbose: false, quiet: true };
      const response = successResponse({ test: 'data' });
      let humanCalled = false;

      output(ctx, response, () => {
        humanCalled = true;
      });

      expect(humanCalled).toBe(false);
    });

    it('should still output in quiet mode for errors', () => {
      const ctx: OutputContext = { json: false, verbose: false, quiet: true };
      const response = errorResponse('ERR', 'error message');
      let humanCalled = false;

      output(ctx, response, () => {
        humanCalled = true;
      });

      expect(humanCalled).toBe(true);
    });
  });

  describe('outputKeyValue', () => {
    it('should output JSON in json mode', () => {
      const ctx: OutputContext = { json: true, verbose: false, quiet: false };
      const items = [
        { key: 'name', value: 'test' },
        { key: 'version', value: '1.0' },
      ];

      outputKeyValue(ctx, items);

      const parsed = JSON.parse(consoleLogOutput[0]);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].key).toBe('name');
    });

    it('should output formatted key=value pairs in human mode', () => {
      const ctx: OutputContext = { json: false, verbose: false, quiet: false };
      const items = [{ key: 'name', value: 'test' }];

      outputKeyValue(ctx, items);

      // Output should contain key and value
      expect(consoleLogOutput[0]).toContain('name');
      expect(consoleLogOutput[0]).toContain('test');
    });

    it('should include origin when provided', () => {
      const ctx: OutputContext = { json: false, verbose: false, quiet: false };
      const items = [{ key: 'name', value: 'test', origin: 'workspace' }];

      outputKeyValue(ctx, items);

      expect(consoleLogOutput[0]).toContain('workspace');
    });
  });

  describe('outputTable', () => {
    it('should output JSON array of objects in json mode', () => {
      const ctx: OutputContext = { json: true, verbose: false, quiet: false };
      const headers = ['Name', 'Value'];
      const rows = [
        ['item1', '100'],
        ['item2', '200'],
      ];

      outputTable(ctx, headers, rows);

      const parsed = JSON.parse(consoleLogOutput[0]);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('item1');
      expect(parsed[0].value).toBe('100');
    });

    it('should output formatted table in human mode', () => {
      const ctx: OutputContext = { json: false, verbose: false, quiet: false };
      const headers = ['Name', 'Value'];
      const rows = [['item1', '100']];

      outputTable(ctx, headers, rows);

      // Should have at least header and separator
      expect(consoleLogOutput.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('formatDate', () => {
    it('should return (unknown) for undefined', () => {
      const result = formatDate(undefined);
      expect(result).toContain('unknown');
    });

    it('should format recent dates as relative', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const result = formatDate(fiveMinutesAgo.toISOString());
      expect(result).toMatch(/\d+m ago/);
    });

    it('should format hours ago', () => {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const result = formatDate(threeHoursAgo.toISOString());
      expect(result).toMatch(/\d+h ago/);
    });

    it('should format days ago', () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const result = formatDate(threeDaysAgo.toISOString());
      expect(result).toMatch(/\d+d ago/);
    });

    it('should format old dates as locale date string', () => {
      const oldDate = new Date('2020-01-15').toISOString();
      const result = formatDate(oldDate);
      // Should not contain "ago"
      expect(result).not.toContain('ago');
    });
  });

  describe('verbose', () => {
    it('should output in verbose mode', () => {
      const ctx: OutputContext = { json: false, verbose: true, quiet: false };
      verbose(ctx, 'test message');
      expect(consoleLogOutput.some(line => line.includes('test message'))).toBe(true);
    });

    it('should not output when not in verbose mode', () => {
      const ctx: OutputContext = { json: false, verbose: false, quiet: false };
      verbose(ctx, 'test message');
      expect(consoleLogOutput.length).toBe(0);
    });

    it('should not output in json mode even if verbose', () => {
      const ctx: OutputContext = { json: true, verbose: true, quiet: false };
      verbose(ctx, 'test message');
      expect(consoleLogOutput.length).toBe(0);
    });
  });

  describe('debug', () => {
    it('should output in verbose mode', () => {
      const ctx: OutputContext = { json: false, verbose: true, quiet: false };
      debug(ctx, 'debug message');
      expect(consoleLogOutput.some(line => line.includes('debug message'))).toBe(true);
    });

    it('should not output when not in verbose mode', () => {
      const ctx: OutputContext = { json: false, verbose: false, quiet: false };
      debug(ctx, 'debug message');
      expect(consoleLogOutput.length).toBe(0);
    });
  });
});
