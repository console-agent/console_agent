/**
 * E2E tests — calls the real Gemini API.
 *
 * Requires GEMINI_API_KEY in .env or environment.
 * Run with: bun run test:e2e
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { updateConfig, executeAgent } from '../../src/agent.js';
import type { AgentResult } from '../../src/types.js';
import * as zod from 'zod';
const z = zod.z ?? zod;

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
    // Model may return success:false when it finds a vulnerability (which is correct behavior)
    expect(typeof result.success).toBe('boolean');
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
    // Model may return success:false when it identifies the bug (correct behavior)
    expect(typeof result.success).toBe('boolean');
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
    // Should auto-detect security persona; model may return false for vulnerabilities
    expect(typeof result.success).toBe('boolean');
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
    // Model may return success:false when it detects performance issues (correct behavior)
    expect(typeof result.success).toBe('boolean');
    console.log('Complex context result:', JSON.stringify(result, null, 2));
  });
});

describeE2E('E2E: Custom Structured Output (schema & responseFormat)', () => {
  beforeAll(() => {
    updateConfig({
      apiKey: API_KEY,
      model: 'gemini-2.5-flash-lite',
      mode: 'blocking',
      logLevel: 'info',
      anonymize: false,
      timeout: 25000,
    });
  });

  it('Zod schema — returns typed structured output', async () => {
    const EmailValidation = z.object({
      isValid: z.boolean(),
      reason: z.string(),
      suggestions: z.array(z.string()),
    });

    const result = await executeAgent(
      'Validate this email address and explain why it is or is not valid',
      'not-a-real-email@',
      { schema: EmailValidation },
    );

    expectValidResult(result);
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('isValid');
    expect(typeof result.data.isValid).toBe('boolean');
    expect(typeof result.data.reason).toBe('string');
    expect(Array.isArray(result.data.suggestions)).toBe(true);
    console.log('Zod schema result:', JSON.stringify(result, null, 2));
  });

  it('responseFormat JSON schema — returns structured output', async () => {
    const result = await executeAgent(
      'Analyze this code for potential security issues',
      'const x = eval(userInput);',
      {
        responseFormat: {
          type: 'json_object',
          schema: {
            type: 'object',
            properties: {
              severity: { type: 'string', description: 'One of: low, medium, high, critical' },
              issue: { type: 'string', description: 'Description of the issue' },
              fix: { type: 'string', description: 'Suggested fix' },
            },
            required: ['severity', 'issue', 'fix'],
          },
        },
      },
    );

    expectValidResult(result);
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('severity');
    expect(result.data).toHaveProperty('issue');
    expect(result.data).toHaveProperty('fix');
    expect(typeof result.data.severity).toBe('string');
    expect(typeof result.data.issue).toBe('string');
    expect(typeof result.data.fix).toBe('string');
    console.log('responseFormat result:', JSON.stringify(result, null, 2));
  });

  it('no custom schema — returns default AgentResult format', async () => {
    const result = await executeAgent('What is 1 + 1? Answer concisely.');

    expectValidResult(result);
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.summary).toBe('string');
    // Default schema includes these standard fields
    expect(typeof result.confidence).toBe('number');
    expect(Array.isArray(result.actions)).toBe(true);
    console.log('Default schema result:', JSON.stringify(result, null, 2));
  });
});

describeE2E('E2E: Tools — opt-in only, actually passed to API', () => {
  beforeAll(() => {
    updateConfig({
      apiKey: API_KEY,
      model: 'gemini-2.5-flash-lite',
      mode: 'blocking',
      logLevel: 'info',
      anonymize: false,
      timeout: 30000, // tools need more time
    });
  });

  it('google_search tool — search grounding returns results', { timeout: 60000 }, async () => {
    const result = await executeAgent(
      'What is the current population of Tokyo? Use search to find the latest data.',
      undefined,
      { tools: ['google_search'] },
    );

    expectValidResult(result);
    expect(result.success).toBe(true);
    // The response should reference Tokyo population
    const fullText = JSON.stringify(result).toLowerCase();
    expect(fullText.includes('tokyo') || fullText.includes('population')).toBe(true);
    console.log('Google Search result:', JSON.stringify(result, null, 2));
  });

  it('code_execution tool — runs code and returns result', { timeout: 60000 }, async () => {
    const result = await executeAgent(
      'Use code execution to calculate the 20th Fibonacci number',
      undefined,
      { tools: ['code_execution'] },
    );

    expectValidResult(result);
    expect(result.success).toBe(true);
    // The 20th Fibonacci number is 6765
    const fullText = JSON.stringify(result);
    expect(fullText.includes('6765')).toBe(true);
    console.log('Code Execution result:', JSON.stringify(result, null, 2));
  });

  it('no tools by default — toolCalls should be empty', async () => {
    const result = await executeAgent(
      'What is 2 + 2? Answer concisely.',
    );

    expectValidResult(result);
    expect(result.success).toBe(true);
    // No tools were requested, so toolCalls should be empty
    expect(result.metadata.toolCalls).toEqual([]);
    console.log('No tools result:', JSON.stringify(result, null, 2));
  });

  it('multiple tools — google_search + code_execution', { timeout: 60000 }, async () => {
    const result = await executeAgent(
      'Search for the current world population, then use code execution to calculate what 1% of that number is',
      undefined,
      { tools: ['google_search', 'code_execution'] },
    );

    expectValidResult(result);
    expect(result.success).toBe(true);
    console.log('Multi-tool result:', JSON.stringify(result, null, 2));
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
