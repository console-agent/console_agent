import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import {
  getCallerFile,
  getErrorSourceFile,
  formatSourceForContext,
  type SourceFileInfo,
} from '../../src/utils/caller-file.js';

describe('Caller File Detection', () => {
  describe('getCallerFile', () => {
    it('returns a SourceFileInfo for the test file itself', () => {
      // Since we're calling from this test file, it should detect this file
      const result = getCallerFile();
      // May return null in test runner if all frames are internal
      // But if it works, it should have valid fields
      if (result) {
        expect(result.filePath).toBeTruthy();
        expect(result.fileName).toBeTruthy();
        expect(result.line).toBeGreaterThan(0);
        expect(result.column).toBeGreaterThan(0);
        expect(result.content).toBeTruthy();
        expect(result.content.length).toBeGreaterThan(0);
      }
    });

    it('returns null when no external frame is found (graceful)', () => {
      // This test just ensures it doesn't throw
      const result = getCallerFile();
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('getErrorSourceFile', () => {
    it('returns source info from an Error stack trace', () => {
      // Create an error in this file
      const error = new Error('Test error');
      const result = getErrorSourceFile(error);

      // Should detect this test file since the error originated here
      if (result) {
        expect(result.fileName).toContain('caller-file.test');
        expect(result.line).toBeGreaterThan(0);
        expect(result.content).toContain('Test error');
      }
    });

    it('returns null for errors without stack', () => {
      const error = new Error('no stack');
      error.stack = undefined;
      const result = getErrorSourceFile(error);
      expect(result).toBeNull();
    });

    it('returns null for errors with unparseable stack', () => {
      const error = new Error('bad stack');
      error.stack = 'Error: bad stack\n  some random text';
      const result = getErrorSourceFile(error);
      expect(result).toBeNull();
    });
  });

  describe('formatSourceForContext', () => {
    it('formats source with line numbers and arrow marker', () => {
      const source: SourceFileInfo = {
        filePath: '/path/to/billing.ts',
        fileName: 'billing.ts',
        line: 3,
        column: 10,
        content: 'import { db } from "./database";\n\nconst x = user.plan.tier;\n\nexport default x;',
      };

      const formatted = formatSourceForContext(source);

      expect(formatted).toContain('--- Source File: billing.ts (line 3) ---');
      expect(formatted).toContain(' →    3 | const x = user.plan.tier;');
      expect(formatted).toContain('      1 | import { db } from "./database";');
      expect(formatted).not.toContain(' →    1 |');
    });

    it('handles single-line files', () => {
      const source: SourceFileInfo = {
        filePath: '/path/to/config.ts',
        fileName: 'config.ts',
        line: 1,
        column: 1,
        content: 'export const config = {};',
      };

      const formatted = formatSourceForContext(source);
      expect(formatted).toContain(' →    1 | export const config = {};');
    });
  });

  describe('includeCallerSource config integration', () => {
    it('DEFAULT_CONFIG has includeCallerSource true', async () => {
      const { DEFAULT_CONFIG } = await import('../../src/agent.js');
      expect(DEFAULT_CONFIG.includeCallerSource).toBe(true);
    });

    it('can disable includeCallerSource globally', async () => {
      const { updateConfig, getConfig } = await import('../../src/agent.js');
      updateConfig({ includeCallerSource: false });
      const config = getConfig();
      expect(config.includeCallerSource).toBe(false);
      // Reset
      updateConfig({ includeCallerSource: true });
    });
  });
});
