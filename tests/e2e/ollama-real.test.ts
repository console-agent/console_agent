/**
 * End-to-end tests — makes real API calls to a local Ollama server.
 *
 * Requires Ollama running locally with a model pulled (e.g., ollama pull llama3.2).
 * Run with: bun run test:e2e
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { init } from '../../src/index.js';
import { executeAgent, updateConfig } from '../../src/agent.js';
import type { AgentResult } from '../../src/types.js';

// ─── Skip if Ollama is not running ───────────────────────────────────────────

async function ollamaIsRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function assertValidResult(result: AgentResult): void {
  expect(result).toBeDefined();
  expect(typeof result.success).toBe('boolean');
  expect(typeof result.summary).toBe('string');
  expect(result.summary.length).toBeGreaterThan(0);
  expect(typeof result.data).toBe('object');
  expect(Array.isArray(result.actions)).toBe(true);
  expect(typeof result.confidence).toBe('number');
  expect(result.confidence).toBeGreaterThanOrEqual(0);
  expect(result.confidence).toBeLessThanOrEqual(1);
  expect(result.metadata).toBeDefined();
  expect(typeof result.metadata.model).toBe('string');
  expect(typeof result.metadata.latencyMs).toBe('number');
  expect(result.metadata.latencyMs).toBeGreaterThan(0);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Ollama E2E', async () => {
  const running = await ollamaIsRunning();

  describe.skipIf(!running)('Real Ollama API calls', () => {
    beforeEach(() => {
      init({
        provider: 'ollama',
        model: 'llama3.2',
        ollamaHost: 'http://localhost:11434',
        mode: 'blocking',
        logLevel: 'info',
        anonymize: false,
        timeout: 60000,
        verbose: true,
      });
    });

    it('basic prompt — returns valid structured result', async () => {
      const result = await executeAgent('What is 2 + 2? Answer concisely in one sentence.');

      assertValidResult(result);
      expect(result.success).toBe(true);
      expect(result.metadata.model).toBe('llama3.2');
      const fullText = JSON.stringify(result).toLowerCase();
      expect(fullText).toContain('4');
    }, 60000);

    it('security persona — detects SQL injection risk', async () => {
      const result = await executeAgent(
        'Check this input for SQL injection vulnerabilities',
        "admin' OR '1'='1; DROP TABLE users; --",
        { persona: 'security' },
      );

      assertValidResult(result);
      const fullText = JSON.stringify(result).toLowerCase();
      expect(
        ['sql', 'injection', 'risk', 'dangerous', 'attack'].some((kw) => fullText.includes(kw)),
      ).toBe(true);
    }, 60000);

    it('debug persona — analyzes an error', async () => {
      const result = await executeAgent(
        'Debug this error and suggest a fix',
        JSON.stringify({
          error: "TypeError: Cannot read properties of undefined (reading 'map')",
          code: 'const items = data.users.map(u => u.name)',
        }),
        { persona: 'debugger' },
      );

      assertValidResult(result);
    }, 60000);

    it('tools are silently ignored', async () => {
      const result = await executeAgent(
        'What is the capital of France?',
        undefined,
        { tools: ['google_search'] },
      );

      assertValidResult(result);
      expect(result.success).toBe(true);
    }, 60000);
  });
});
