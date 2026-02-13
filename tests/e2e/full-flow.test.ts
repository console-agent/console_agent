/**
 * Full E2E flow — exactly how a user would use the package.
 *
 * This test mirrors the README quickstart:
 * 1. import { init } from '@console-agent/agent'
 * 2. init({ apiKey, ... })
 * 3. console.agent("prompt", context)
 * 4. console.agent.security / .debug / .architect
 *
 * Requires GEMINI_API_KEY in .env
 * Run with: bun run test:e2e
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as zod from 'zod';
const z = zod.z ?? zod;

const API_KEY = process.env.GEMINI_API_KEY;
const hasKey = API_KEY && API_KEY !== 'your-gemini-api-key-here';

const describeE2E = hasKey ? describe : describe.skip;

describeE2E('Full User Flow — init() + console.agent()', () => {
  beforeAll(async () => {
    // Step 1: Import exactly like a user would
    const { init } = await import('../../src/index.js');

    // Step 2: Call init() with config — the real user experience
    init({
      apiKey: API_KEY,
      model: 'gemini-2.5-flash-lite',
      mode: 'blocking',
      logLevel: 'info',
      budget: {
        maxCallsPerDay: 50,
        maxTokensPerCall: 4000,
        costCapDaily: 0.50,
      },
    });
  });

  it('console.agent is attached and callable', () => {
    expect(typeof console.agent).toBe('function');
    expect(typeof console.agent.security).toBe('function');
    expect(typeof console.agent.debug).toBe('function');
    expect(typeof console.agent.architect).toBe('function');
  });

  it('console.agent() — basic call returns structured AgentResult', async () => {
    const result = await console.agent('What is the capital of France? Answer in one word.');

    // Validate full AgentResult shape
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
    expect(typeof result.data).toBe('object');
    expect(Array.isArray(result.actions)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);

    // Metadata
    expect(result.metadata.model).toBe('gemini-2.5-flash-lite');
    expect(result.metadata.tokensUsed).toBeGreaterThan(0);
    expect(result.metadata.latencyMs).toBeGreaterThan(0);
    expect(Array.isArray(result.metadata.toolCalls)).toBe(true);

    console.log('\n📋 Basic call result:', result.summary);
  });

  it('console.agent.security() — SQL injection audit', async () => {
    const result = await console.agent.security(
      'Audit this user input for SQL injection',
      "SELECT * FROM users WHERE name = '" + "admin' OR '1'='1" + "'",
    );

    // Model may return success:false when it finds a vulnerability (correct behavior)
    expect(typeof result.success).toBe('boolean');
    expect(result.metadata.tokensUsed).toBeGreaterThan(0);

    // Should detect the SQL injection
    const text = JSON.stringify(result).toLowerCase();
    expect(text.includes('sql') || text.includes('injection') || text.includes('risk')).toBe(true);

    console.log('\n🛡️ Security audit result:', result.summary);
    console.log('   Confidence:', result.confidence);
    console.log('   Data:', JSON.stringify(result.data, null, 2));
  });

  it('console.agent.debug() — error analysis', async () => {
    const result = await console.agent.debug(
      'Why is this crashing?',
      {
        error: "TypeError: Cannot read properties of undefined (reading 'map')",
        code: `
          async function getUsers() {
            const response = await fetch('/api/users');
            const data = await response.json();
            return data.users.map(u => u.name);
          }
        `,
        note: 'Crashes when API returns { error: "not found" } instead of { users: [...] }',
      },
    );

    // Model may return success:false when analyzing a bug (correct behavior - it found the issue)
    expect(typeof result.success).toBe('boolean');
    expect(result.metadata.tokensUsed).toBeGreaterThan(0);

    console.log('\n🐛 Debug result:', result.summary);
    console.log('   Confidence:', result.confidence);
  });

  it('console.agent.architect() — design review', async () => {
    const result = await console.agent.architect(
      'Review this database schema design for a todo app',
      {
        tables: {
          users: { id: 'uuid', email: 'string', name: 'string' },
          todos: { id: 'uuid', user_id: 'uuid', title: 'string', done: 'boolean', created_at: 'timestamp' },
        },
        question: 'Is this normalized enough? Should I add categories?',
      },
    );

    expect(result.success).toBe(true);
    expect(result.metadata.tokensUsed).toBeGreaterThan(0);

    console.log('\n🏗️ Architect result:', result.summary);
    console.log('   Confidence:', result.confidence);
  });

  it('console.agent() with per-call options override', async () => {
    const result = await console.agent(
      'Explain what a closure is in JavaScript in one sentence.',
      undefined,
      {
        persona: 'general',
        tools: [], // No tools needed for this
      },
    );

    expect(result.success).toBe(true);
    expect(typeof result.summary).toBe('string');

    console.log('\n🔍 Options override result:', result.summary);
  });

  it('result can be used in application logic', async () => {
    const result = await console.agent(
      'Is this a valid email address? Answer with success true/false.',
      'not-an-email',
    );

    // The key point: you can use result.success, result.data, etc. in real code
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.confidence).toBe('number');

    // Simulating real app usage:
    if (!result.success) {
      console.log('\n⚡ App logic: Agent says invalid —', result.summary);
    } else {
      console.log('\n⚡ App logic: Agent says valid —', result.summary);
    }
  });

  it('console.agent() with Zod schema — custom typed output', async () => {
    const SentimentSchema = z.object({
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      score: z.number(),
      keywords: z.array(z.string()),
    });

    const result = await console.agent(
      'Analyze the sentiment of this review',
      'This product is amazing! Best purchase ever!',
      { schema: SentimentSchema },
    );

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('sentiment');
    expect(['positive', 'negative', 'neutral']).toContain(result.data.sentiment);
    expect(typeof result.data.score).toBe('number');
    expect(Array.isArray(result.data.keywords)).toBe(true);
    // Metadata still available
    expect(result.metadata.tokensUsed).toBeGreaterThan(0);
    expect(result.metadata.latencyMs).toBeGreaterThan(0);

    console.log('\n📐 Zod schema result:', JSON.stringify(result.data, null, 2));
    console.log('   Tokens:', result.metadata.tokensUsed);
  });

  it('console.agent() with responseFormat — plain JSON schema', async () => {
    const result = await console.agent(
      'Extract key info from this text',
      'John Doe, age 30, lives in New York, works as a software engineer.',
      {
        responseFormat: {
          type: 'json_object',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Full name' },
              age: { type: 'number', description: 'Age in years' },
              city: { type: 'string', description: 'City of residence' },
              job: { type: 'string', description: 'Job title' },
            },
            required: ['name', 'age', 'city', 'job'],
          },
        },
      },
    );

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('name');
    expect(result.data).toHaveProperty('age');
    expect(result.data).toHaveProperty('city');
    expect(result.data).toHaveProperty('job');
    expect(typeof result.data.name).toBe('string');
    expect(typeof result.data.age).toBe('number');
    // Metadata still available
    expect(result.metadata.latencyMs).toBeGreaterThan(0);

    console.log('\n📋 responseFormat result:', JSON.stringify(result.data, null, 2));
    console.log('   Tokens:', result.metadata.tokensUsed);
  });
});
