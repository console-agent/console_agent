/**
 * E2E tests — Caller Source File Detection.
 *
 * Tests that console.agent automatically reads and sends the caller's
 * source file to the AI model for better context-aware debugging.
 *
 * Uses a dummy billing.ts fixture with an intentional bug.
 *
 * Requires GEMINI_API_KEY in .env or environment.
 * Run with: bun run test:e2e
 */

import { describe, it, expect } from 'vitest';
import {
  simulateBillingError,
  simulateCallerDetection,
  simulateWithoutCallerSource,
} from './fixtures/billing.js';

const API_KEY = process.env.GEMINI_API_KEY;

const describeE2E = API_KEY && API_KEY !== 'your-gemini-api-key-here'
  ? describe
  : describe.skip;

describeE2E('E2E: Caller Source File Detection (billing.ts fixture)', () => {

  it('error path — agent receives billing.ts source via error stack', { timeout: 60000 }, async () => {
    const result = await simulateBillingError(API_KEY!);

    // The billing function should throw, and the agent should analyze it
    expect(result).toBeDefined();
    expect(result!.success !== undefined).toBe(true);
    expect(typeof result!.summary).toBe('string');
    expect(result!.summary.length).toBeGreaterThan(0);
    expect(result!.metadata.tokensUsed).toBeGreaterThan(0);
    expect(result!.metadata.latencyMs).toBeGreaterThan(0);

    // The agent should reference the billing bug in its response
    const fullText = JSON.stringify(result).toLowerCase();
    const mentionsBilling = fullText.includes('plan') ||
      fullText.includes('undefined') ||
      fullText.includes('billing') ||
      fullText.includes('null') ||
      fullText.includes('optional') ||
      fullText.includes('check');
    expect(mentionsBilling).toBe(true);

    console.log('\n🐛 Billing error analysis:', result!.summary);
    console.log('   Data:', JSON.stringify(result!.data, null, 2));
  });

  it('caller detection — agent sees billing.ts when called from it', { timeout: 60000 }, async () => {
    const result = await simulateCallerDetection(API_KEY!);

    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.metadata.tokensUsed).toBeGreaterThan(0);

    // The agent should have found bugs in the billing code
    const fullText = JSON.stringify(result).toLowerCase();
    const mentionsBug = fullText.includes('plan') ||
      fullText.includes('undefined') ||
      fullText.includes('optional') ||
      fullText.includes('null') ||
      fullText.includes('bug') ||
      fullText.includes('check');
    expect(mentionsBug).toBe(true);

    console.log('\n🔍 Caller detection review:', result.summary);
    console.log('   Data:', JSON.stringify(result.data, null, 2));
  });

  it('disabled — works fine without caller source', { timeout: 60000 }, async () => {
    const result = await simulateWithoutCallerSource(API_KEY!);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(typeof result.summary).toBe('string');
    expect(result.metadata.tokensUsed).toBeGreaterThan(0);

    console.log('\n✅ No caller source result:', result.summary);
  });
});
