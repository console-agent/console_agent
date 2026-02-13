/**
 * E2E tests — calls the real Gemini API.
 *
 * Requires GEMINI_API_KEY in .env or environment.
 * Run with: bun run test:e2e
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { updateConfig, executeAgent } from '../../src/agent.js';
import type { AgentResult } from '../../src/types.js';

const API_KEY = process.env.GEMINI_API_KEY;

// Skip all E2E tests if no API key
const describeE2E = API_KEY && API_KEY !== 'your-gemini-api-key-here'
  ? describe
  : describe.skip;

/**
 * Validate that a result has the correct AgentResult structure.
 */
function expectValidResult(result: AgentResult) {
  expect(result).toBeDefined();
  expect(typeof result.success).toBe('boolean');
  expect(typeof result.summary).toBe('string');
  expect(result.summary.length).toBeGreaterThan(0);
  expect(typeof result.data).toBe('object');
  expect(Array.isArray(result.actions)).toBe(true);
  expect(typeof result.confidence).toBe('number');
  expect(result.confidence).toBeGreaterThanOrEqual(0);
  expect(result.confidence).toBeLessThanOrEqual(1);

  // Metadata
  expect(result.metadata).toBeDefined();
  expect(typeof result.metadata.model).toBe('string');
  expect(typeof result.metadata.tokensUsed).toBe('number');
  expect(result.metadata.tokensUsed).toBeGreaterThan(0);
  expect(typeof result.metadata.latencyMs).toBe('number');
  expect(result.metadata.latencyMs).toBeGreaterThan(0);
  expect(Array.isArray(result.metadata.toolCalls)).toBe(true);
  expect(typeof result.metadata.cached).toBe('boolean');
}

describeE2E('E2E: Real Gemini API calls', () => {
  beforeAll(() => {
    updateConfig({
      apiKey: API_KEY,
      model: 'gemini-2.5-flash-lite',
      mode: 'blocking',
      logLevel: 'info',
      anonymize: false, // Don't strip test data
      timeout: 25000,
    });
  });

  it('basic prompt — returns valid structured result', async () => {
    const result = await executeAgent('What is 2 + 2? Answer concisely.');

    expectValidResult(result);
    expect(result.success).toBe(true);
    expect(result.metadata.model).toBe('gemini-2.5-flash-lite');
    console.log('Basic result:', JSON.stringify(result, null, 2));
  });

  it('security persona — detects SQL injection risk', async () => {
    const result = await executeAgent(
      'Check this input for SQL injection vulnerabilities',
      "admin' OR '1'='1; DROP TABLE users; --",
      { persona: 'security' },
    );

    expectValidResult(result);
    expect(result.success).toBe(true);
    // Should mention SQL injection or risk
    const fullText = JSON.stringify(result).toLowerCase();
    expect(
      fullText.includes('sql') || fullText.includes('injection') || fullText.includes('risk'),
    ).toBe(true);
    console.log('Security result:', JSON.stringify(result, null, 2));
  });

  it('debug persona — analyzes an error', async () => {
    const result = await executeAgent(
      'Debug this error and suggest a fix',
      {
        error: 'TypeError: Cannot read properties of undefined (reading "map")',
        code: 'const items = data.users.map(u => u.name)',
        context: 'data.users is undefined when API returns empty response',
      },
      { persona: 'debugger' },
    );

    expectValidResult(result);
    expect(result.success).toBe(true);
    console.log('Debug result:', JSON.stringify(result, null, 2));
  });

  it('architect persona — reviews API design', async () => {
    const result = await executeAgent(
      'Review this REST API endpoint design',
      {
        endpoint: 'POST /api/users/search',
        handler: 'Accepts JSON body with filters, returns paginated user list',
        concerns: 'Should this be GET with query params instead?',
      },
      { persona: 'architect' },
    );

    expectValidResult(result);
    expect(result.success).toBe(true);
    console.log('Architect result:', JSON.stringify(result, null, 2));
  });

  it('auto-detects persona from keywords', async () => {
    const result = await executeAgent(
      'Is this code vulnerable to XSS attacks?',
      '<div dangerouslySetInnerHTML={{ __html: userInput }} />',
    );

    expectValidResult(result);
    // Should auto-detect security persona
    expect(result.success).toBe(true);
    console.log('Auto-detect result:', JSON.stringify(result, null, 2));
  });

  it('handles context as complex object', async () => {
    const result = await executeAgent(
      'Analyze these performance metrics and suggest optimizations',
      {
        avgResponseTime: '3200ms',
        p99ResponseTime: '8500ms',
        errorRate: 0.02,
        requestsPerSecond: 150,
        databaseQueries: 12,
        cacheHitRate: 0.35,
      },
    );

    expectValidResult(result);
    expect(result.success).toBe(true);
    console.log('Complex context result:', JSON.stringify(result, null, 2));
  });
});

describeE2E('E2E: Gemini 3 Flash Preview (high thinking)', () => {
  beforeAll(() => {
    updateConfig({
      apiKey: API_KEY,
      model: 'gemini-3-flash-preview',
      mode: 'blocking',
      logLevel: 'info',
      anonymize: false,
      timeout: 25000,
    });
  });

  it('uses thinking mode with reasoning output', async () => {
    const result = await executeAgent(
      'Design an optimal database indexing strategy for a multi-tenant SaaS app with 10M users',
      {
        tables: ['users', 'organizations', 'projects', 'tasks', 'comments'],
        commonQueries: [
          'tasks by user within org',
          'recent comments on project',
          'user activity timeline',
        ],
      },
      {
        thinking: { level: 'high', includeThoughts: true },
      },
    );

    expectValidResult(result);
    expect(result.success).toBe(true);
    expect(result.metadata.model).toBe('gemini-3-flash-preview');
    console.log('Thinking result:', JSON.stringify(result, null, 2));
  });
});
