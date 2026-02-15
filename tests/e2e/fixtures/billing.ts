/**
 * Dummy billing module for E2E testing.
 * This file has an intentional bug: user.plan may be undefined.
 */

import { updateConfig, executeAgent } from '../../../src/agent.js';

interface User {
  id: string;
  name: string;
  email: string;
  plan?: {
    tier: 'free' | 'pro' | 'enterprise';
    seats: number;
    pricePerSeat: number;
  };
}

function calculateInvoice(user: User) {
  // BUG: user.plan can be undefined for free users!
  // @ts-expect-error — intentional bug for testing
  const total = user.plan.seats * user.plan.pricePerSeat;
  return {
    userId: user.id,
    amount: total,
    currency: 'USD',
    // @ts-expect-error — intentional bug for testing
    tier: user.plan.tier,
  };
}

/**
 * Simulate: error occurs in billing, developer uses console.agent to debug.
 * The agent should see this file's source code automatically.
 */
export async function simulateBillingError(apiKey: string) {
  updateConfig({
    apiKey,
    model: 'gemini-2.5-flash-lite',
    mode: 'blocking',
    logLevel: 'info',
    verbose: true,
    anonymize: false,
    timeout: 25000,
    includeCallerSource: true,
  });

  const freeUser: User = {
    id: 'usr_123',
    name: 'John Doe',
    email: 'john@example.com',
    // plan is intentionally undefined!
  };

  try {
    calculateInvoice(freeUser);
  } catch (error) {
    // This is the key test: pass the error, and the agent should
    // auto-detect this billing.ts file and include it as context
    const result = await executeAgent(
      'Analyze this billing error and recommend a fix',
      error as Error,
      { persona: 'debugger' },
    );
    return result;
  }
}

/**
 * Simulate: developer calls console.agent from this file without an error.
 * The agent should auto-detect the caller file (this billing.ts).
 */
export async function simulateCallerDetection(apiKey: string) {
  updateConfig({
    apiKey,
    model: 'gemini-2.5-flash-lite',
    mode: 'blocking',
    logLevel: 'info',
    verbose: true,
    anonymize: false,
    timeout: 25000,
    includeCallerSource: true,
  });

  // Call from this file — agent should detect billing.ts as the caller
  const result = await executeAgent(
    'Review this billing module for potential bugs and improvements',
  );
  return result;
}

/**
 * Simulate: includeCallerSource disabled — no source file should be sent.
 */
export async function simulateWithoutCallerSource(apiKey: string) {
  updateConfig({
    apiKey,
    model: 'gemini-2.5-flash-lite',
    mode: 'blocking',
    logLevel: 'info',
    verbose: true,
    anonymize: false,
    timeout: 25000,
    includeCallerSource: false,
  });

  const result = await executeAgent(
    'What is 2 + 2? Answer concisely.',
  );
  return result;
}
